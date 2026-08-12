import asyncio
import random
import re
from datetime import datetime, timezone

import httpx
from bs4 import BeautifulSoup
from crawl4ai import AsyncWebCrawler, BrowserConfig, CrawlerRunConfig, CacheMode

from .extractor import extract_json_from_html, parse_doctor_data, fetch_phone_number
from .models import ScrapeRequest, ScrapeMetadata
from .slugs import resolve_specialty_slug, resolve_location_slug

MAX_UNLIMITED = 500
BATCH_SIZE = 5
MAX_CONCURRENT = 5
LIST_PAGE_DELAY = 2.0
BATCH_DELAY = 1.5


def _is_captcha_page(html: str) -> bool:
    """Detect if Practo served a CAPTCHA or bot-detection page."""
    indicators = [
        "captcha", "recaptcha", "verify you're human",
        "unusual traffic", "security check", "bot detection",
        "challenge-platform", "cf-browser-verification",
    ]
    html_lower = html.lower()
    return any(ind in html_lower for ind in indicators)


def _is_blocked_response(status_code: int) -> str | None:
    """Check if a response indicates blocking/rate-limiting."""
    if status_code == 429:
        return "RATE_LIMITED"
    if status_code == 403:
        return "BLOCKED"
    if status_code == 503:
        return "SERVICE_UNAVAILABLE"
    return None


async def _fetch_with_retry(
    client: httpx.AsyncClient,
    url: str,
    max_retries: int = 3,
    base_delay: float = 2.0,
    log_fn=None,
) -> httpx.Response | None:
    """Fetch a URL with exponential backoff retry logic (B5)."""
    for attempt in range(max_retries):
        try:
            resp = await client.get(
                url,
                headers={
                    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36"
                },
                timeout=15.0,
                follow_redirects=True,
            )

            block_reason = _is_blocked_response(resp.status_code)
            if block_reason:
                delay = base_delay * (2 ** attempt) + random.uniform(0, 2)
                if log_fn:
                    log_fn(
                        "warning",
                        f"[{block_reason}] Status {resp.status_code} for {url}. "
                        f"Backing off {delay:.1f}s (attempt {attempt + 1}/{max_retries})"
                    )
                if attempt < max_retries - 1:
                    await asyncio.sleep(delay)
                    continue
                return resp

            if _is_captcha_page(resp.text):
                delay = 10.0 + random.uniform(0, 5)
                if log_fn:
                    log_fn(
                        "warning",
                        f"[CAPTCHA_DETECTED] Possible bot detection at {url}. "
                        f"Backing off {delay:.1f}s (attempt {attempt + 1}/{max_retries})"
                    )
                if attempt < max_retries - 1:
                    await asyncio.sleep(delay)
                    continue
                return resp

            return resp

        except (httpx.TimeoutException, httpx.ConnectError, httpx.ReadError) as e:
            delay = base_delay * (2 ** attempt) + random.uniform(0, 1)
            if log_fn:
                log_fn(
                    "warning",
                    f"[RETRY] Attempt {attempt + 1}/{max_retries} for {url} — {type(e).__name__}: {e}. "
                    f"Retrying in {delay:.1f}s"
                )
            if attempt < max_retries - 1:
                await asyncio.sleep(delay)
            else:
                if log_fn:
                    log_fn("error", f"[FAILED] All {max_retries} attempts exhausted for {url}")
                return None

    return None


async def validate_slug(location_slug: str, specialty_slug: str, log_fn=None) -> bool:
    """Validate that the location/specialty combo resolves on Practo (B9)."""
    url = f"https://www.practo.com/{location_slug}/{specialty_slug}"
    async with httpx.AsyncClient() as client:
        try:
            resp = await client.head(
                url,
                headers={"User-Agent": "Mozilla/5.0"},
                timeout=10.0,
                follow_redirects=True,
            )
            if resp.status_code == 404:
                if log_fn:
                    log_fn(
                        "error",
                        f"Practo returned 404 for /{location_slug}/{specialty_slug}. "
                        "This location/specialty combination doesn't exist on Practo."
                    )
                return False
            return resp.status_code == 200
        except Exception as e:
            if log_fn:
                log_fn("error", f"Could not validate slug: {e}")
            return False


async def scrape_task(
    req: ScrapeRequest,
    q: asyncio.Queue,
    cancel_event: asyncio.Event,
):
    """Main scrape orchestrator with all hardening fixes."""

    async def log(level: str, message: str):
        await q.put({
            "type": level,
            "message": message,
            "timestamp": datetime.now(timezone.utc).isoformat(),
        })

    async def progress(current: int, total: int, message: str, phase: str = "extraction"):
        await q.put({
            "type": "progress",
            "current": current,
            "total": total,
            "message": message,
            "phase": phase,
            "timestamp": datetime.now(timezone.utc).isoformat(),
        })

    effective_limit = req.limit
    if effective_limit is None:
        effective_limit = MAX_UNLIMITED
        await log("info", f"Unlimited mode — capped at {MAX_UNLIMITED} profiles for safety")

    metadata = ScrapeMetadata(
        timestamp=datetime.now(timezone.utc).isoformat(),
        location=req.location,
        specialty=req.specialty,
        limit_requested=req.limit,
    )

    location_slug = resolve_location_slug(req.location)
    specialty_slug = resolve_specialty_slug(req.specialty)

    await log("info", f"Starting scrape for '{req.specialty}' in '{req.location}' (Limit: {effective_limit})")
    await log("info", f"Resolved URL: /{location_slug}/{specialty_slug}")

    # ── Phase 0: Validate slug (B9) ──
    await log("info", "Validating location/specialty with Practo...")
    is_valid = await validate_slug(location_slug, specialty_slug, log_fn=lambda lvl, msg: None)
    if not is_valid:
        # Try a GET to provide more context
        async with httpx.AsyncClient() as client:
            resp = await _fetch_with_retry(
                client,
                f"https://www.practo.com/{location_slug}/{specialty_slug}",
                max_retries=1,
                log_fn=lambda lvl, msg: asyncio.ensure_future(log(lvl, msg)),
            )
            if resp is None or resp.status_code == 404:
                await log(
                    "error",
                    f"Invalid location/specialty — Practo returned 404 for /{location_slug}/{specialty_slug}. "
                    "Please check your input and try again."
                )
                await q.put({"type": "done", "data": [], "metadata": metadata.__dict__})
                return

    # ── Phase 1: Discovery ──
    await progress(0, effective_limit, "Starting doctor discovery...", phase="discovery")

    profile_urls: list[str] = []
    seen_urls: set[str] = set()  # B8: dedup
    page = 1
    dedup_count = 0

    async with httpx.AsyncClient() as client:
        while True:
            if cancel_event.is_set():
                await log("info", "Scrape cancelled by user")
                break

            if len(profile_urls) >= effective_limit:
                await log("info", f"Reached limit of {effective_limit} profiles")
                break

            list_url = f"https://www.practo.com/{location_slug}/{specialty_slug}?page={page}"
            await log("info", f"[DISCOVERY] Fetching list page {page}...")

            resp = await _fetch_with_retry(
                client,
                list_url,
                max_retries=3,
                log_fn=lambda lvl, msg: asyncio.ensure_future(log(lvl, msg)),
            )

            if resp is None:
                await log("error", f"Failed to fetch list page {page} after retries. Stopping discovery.")
                break

            if resp.status_code == 404:
                if page == 1:
                    await log(
                        "error",
                        f"Error 404 on first page. The specialty '{req.specialty}' might need a different Practo URL slug."
                    )
                else:
                    await log("info", f"Page {page} returned 404. End of listings.")
                break

            if resp.status_code != 200:
                await log("warning", f"Page {page} returned status {resp.status_code}. Stopping discovery.")
                break

            soup = BeautifulSoup(resp.text, "html.parser")
            cards = soup.find_all("div", {"class": "listing-doctor-card"})

            if not cards:
                await log("info", f"No more doctor cards found on page {page}. Discovery complete.")
                break

            new_links = 0
            for card in cards:
                if len(profile_urls) >= effective_limit:
                    break

                a_tag = card.find("a")
                if a_tag and a_tag.get("href"):
                    href = a_tag["href"]
                    if href.startswith("/"):
                        href = "https://www.practo.com" + href

                    # B8: Deduplication
                    normalized = href.split("?")[0].rstrip("/")
                    if normalized in seen_urls:
                        dedup_count += 1
                        continue

                    seen_urls.add(normalized)
                    profile_urls.append(href)
                    new_links += 1

            await log("info", f"[DISCOVERY] Found {new_links} new profiles on page {page} (total: {len(profile_urls)})")
            if dedup_count > 0:
                metadata.total_skipped_dedup = dedup_count

            await progress(
                len(profile_urls),
                effective_limit,
                f"Discovered {len(profile_urls)} profiles so far...",
                phase="discovery",
            )

            page += 1
            await asyncio.sleep(LIST_PAGE_DELAY + random.uniform(0, 1))

    total_profiles = len(profile_urls)
    metadata.total_found = total_profiles

    if dedup_count > 0:
        await log("info", f"[DEDUP] Skipped {dedup_count} duplicate profile URLs")

    await log("info", f"Discovery complete: {total_profiles} unique profile URLs collected")

    if total_profiles == 0:
        await log("info", "No profiles found. This may be a valid result for this location/specialty.")
        await q.put({"type": "done", "data": [], "metadata": metadata.__dict__})
        return

    # ── Phase 2: Extraction ──
    await progress(0, total_profiles, "Starting profile extraction...", phase="extraction")
    scraped_data: list[dict] = []
    failed_urls: list[str] = []

    browser_config = BrowserConfig(
        headless=True,
        viewport_width=1280,
        viewport_height=720,
        user_agent="Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36",
    )
    crawler_config = CrawlerRunConfig(
        page_timeout=60000,
        cache_mode=CacheMode.BYPASS,
        simulate_user=True,
        override_navigator=True,
        wait_until="domcontentloaded",
        delay_before_return_html=1.0,
    )

    async with AsyncWebCrawler(config=browser_config) as crawler:
        for i in range(0, total_profiles, BATCH_SIZE):
            if cancel_event.is_set():
                await log("info", "Scrape cancelled by user during extraction")
                break

            batch_urls = profile_urls[i : i + BATCH_SIZE]
            batch_end = min(i + BATCH_SIZE, total_profiles)
            await log("info", f"[EXTRACTION] Fetching profiles {i + 1} to {batch_end} of {total_profiles}...")

            try:
                results = await crawler.arun_many(
                    urls=batch_urls,
                    config=crawler_config,
                    max_concurrent=MAX_CONCURRENT,
                )
            except Exception as e:
                await log("error", f"Batch crawl failed: {e}")
                failed_urls.extend(batch_urls)
                continue

            # Process results
            retry_urls: list[str] = []
            for idx, res in enumerate(results):
                url = batch_urls[idx] if idx < len(batch_urls) else "unknown"

                if not res.success:
                    await log("warning", f"[FAILED] Could not fetch {url}: {res.error_message}")
                    retry_urls.append(url)
                    continue

                # Try extraction FIRST — Practo pages contain "recaptcha" in
                # their own login scripts, but __REDUX_STATE__ is still present.
                log_callback = lambda lvl, msg: asyncio.ensure_future(log(lvl, msg))
                json_data = extract_json_from_html(res.html, log_fn=log_callback)

                if not json_data:
                    # Only now check if it's actually a CAPTCHA wall
                    if _is_captcha_page(res.html):
                        await log("warning", f"[CAPTCHA] Bot detection page returned for {url}")
                    else:
                        await log("warning", f"[NO_DATA] No Redux state found in {url}")
                    retry_urls.append(url)
                    continue

                try:
                    parsed = parse_doctor_data(json_data, profile_url=url, log_fn=log_callback)
                    scraped_data.append(parsed)
                    await progress(
                        len(scraped_data),
                        total_profiles,
                        f"Extracted: {parsed['Full Name']}",
                        phase="extraction",
                    )
                except Exception as e:
                    await log("error", f"[PARSE_ERROR] Error parsing {url}: {e}")
                    retry_urls.append(url)

            # B5: Retry failed URLs from this batch (1 retry attempt)
            if retry_urls:
                await log("info", f"[RETRY] Retrying {len(retry_urls)} failed profiles from batch...")
                await asyncio.sleep(3.0 + random.uniform(0, 2))

                try:
                    retry_results = await crawler.arun_many(
                        urls=retry_urls,
                        config=crawler_config,
                        max_concurrent=min(3, len(retry_urls)),
                    )
                    for idx, res in enumerate(retry_results):
                        url = retry_urls[idx] if idx < len(retry_urls) else "unknown"
                        if res.success:
                            json_data = extract_json_from_html(res.html)
                            if json_data:
                                try:
                                    parsed = parse_doctor_data(json_data, profile_url=url)
                                    scraped_data.append(parsed)
                                    await progress(
                                        len(scraped_data),
                                        total_profiles,
                                        f"Extracted (retry): {parsed['Full Name']}",
                                        phase="extraction",
                                    )
                                    retry_urls.remove(url)
                                except Exception:
                                    pass
                except Exception as e:
                    await log("warning", f"Retry batch failed: {e}")

                failed_urls.extend(retry_urls)

            await asyncio.sleep(BATCH_DELAY + random.uniform(0, 1))

    # ── Phase 3: Phone number enrichment (B2) ──
    if scraped_data:
        await log("info", f"[ENRICHMENT] Fetching phone numbers for {len(scraped_data)} profiles...")
        phone_log = lambda lvl, msg: asyncio.ensure_future(log(lvl, msg))

        for i, doc in enumerate(scraped_data):
            if cancel_event.is_set():
                break
            pid = doc.pop("_practice_doctor_id", None)
            doc.pop("_additional_locations", None)
            doc.pop("_profile_url", None)

            if pid:
                phone = await fetch_phone_number(pid, log_fn=phone_log)
                doc["Mobile Number"] = phone
            else:
                doc["Mobile Number"] = "Not publicly available — no practice ID"

            if (i + 1) % 10 == 0:
                await asyncio.sleep(0.5)  # Light throttle for phone API

    # ── Finalize ──
    metadata.total_scraped = len(scraped_data)
    metadata.total_failed = len(failed_urls)
    metadata.failed_urls = failed_urls[:20]  # Cap for transport

    if failed_urls:
        await log("warning", f"[SUMMARY] {len(failed_urls)} profiles could not be scraped")
        metadata.warnings.append(f"{len(failed_urls)} profiles failed extraction")

    await log(
        "info",
        f"Scraping complete! {len(scraped_data)}/{total_profiles} profiles extracted successfully."
    )

    # Clean internal fields from all records
    for doc in scraped_data:
        doc.pop("_practice_doctor_id", None)
        doc.pop("_additional_locations", None)
        doc.pop("_profile_url", None)

    await q.put({
        "type": "done",
        "message": f"Scraping complete! {len(scraped_data)} profiles extracted.",
        "data": scraped_data,
        "metadata": metadata.__dict__,
    })
