import json
import re
import asyncio
from typing import Any


REDUX_STATE_PATTERNS = [
    re.compile(r"window\.__REDUX_STATE__\s*=\s*(\{.+?\})\s*;?\s*</script>", re.DOTALL),
    re.compile(r"window\.__INITIAL_STATE__\s*=\s*(\{.+?\})\s*;?\s*</script>", re.DOTALL),
    re.compile(r"window\.__PRELOADED_STATE__\s*=\s*(\{.+?\})\s*;?\s*</script>", re.DOTALL),
]

EXPECTED_TOP_LEVEL_KEYS = {"profile_reducer"}


def extract_json_from_html(html: str, log_fn=None) -> dict:
    """Extract and validate the Redux state JSON from Practo profile page HTML.

    Uses regex-based extraction instead of brittle string slicing.
    Tries multiple variable names and validates structure before returning.
    """
    for pattern in REDUX_STATE_PATTERNS:
        match = pattern.search(html)
        if match:
            json_text = match.group(1).strip()
            try:
                data = json.loads(json_text)
                if _validate_structure(data, log_fn):
                    return data
                else:
                    if log_fn:
                        log_fn(
                            "warning",
                            f"UNEXPECTED_PAGE_STRUCTURE: JSON parsed but missing expected keys. "
                            f"Found: {list(data.keys())[:10]}"
                        )
                    return data  # Return anyway, let parse_doctor_data handle gracefully
            except json.JSONDecodeError as e:
                if log_fn:
                    log_fn("warning", f"JSON parse failed on first attempt: {e}")
                # Try removing trailing characters (semicolons, whitespace)
                for trim in range(1, 5):
                    try:
                        data = json.loads(json_text[:-trim])
                        if log_fn:
                            log_fn("info", f"JSON parsed after trimming {trim} trailing characters")
                        return data
                    except json.JSONDecodeError:
                        continue

    if log_fn:
        log_fn(
            "warning",
            "UNEXPECTED_PAGE_STRUCTURE: No Redux state variable found in page HTML. "
            "Practo may have changed their page structure."
        )
    return {}


def _validate_structure(data: dict, log_fn=None) -> bool:
    """Check that the JSON has the expected top-level keys."""
    return EXPECTED_TOP_LEVEL_KEYS.issubset(data.keys())


def _safe_get(data: Any, *keys, default="Not Available"):
    """Safely traverse nested dict/list paths."""
    current = data
    for key in keys:
        if isinstance(current, dict):
            current = current.get(key)
        elif isinstance(current, list) and isinstance(key, int):
            current = current[key] if len(current) > key else None
        else:
            return default
        if current is None:
            return default
    return current if current is not None else default


def parse_doctor_data(data: dict, profile_url: str = "", log_fn=None) -> dict:
    """Parse the Redux state JSON into a flat 17-field doctor record.

    Fixes from audit:
    - B3: Education vs Training split using is_bluebook_compliant
    - B4: All practice locations captured, not just relations[0]
    - B2: Mobile number extracted from practice_doctor_id if available
    """
    prof = data.get("profile_reducer", {})

    # The profile data can be at different paths depending on page structure
    doc_profile = _safe_get(prof, "doctorProfile", "profile", default=None)
    if not doc_profile or not isinstance(doc_profile, dict):
        doc_profile = prof

    # ── Name ──
    name_obj = doc_profile.get("name") or prof.get("full_name") or {}
    if isinstance(name_obj, dict):
        full_name = " ".join(
            filter(
                None,
                [
                    name_obj.get("pre_salutation"),
                    name_obj.get("first_name"),
                    name_obj.get("last_name"),
                ],
            )
        )
    else:
        full_name = str(name_obj) if name_obj else "Not Available"

    # ── Gender ──
    gender = doc_profile.get("gender") or prof.get("gender")
    if not gender and isinstance(name_obj, dict):
        salutation = name_obj.get("pre_salutation", "")
        if salutation in ("Mr.", "Mr"):
            gender = "Male"
        elif salutation in ("Ms.", "Mrs.", "Ms", "Mrs"):
            gender = "Female"
    # Last resort: infer from pronoun usage in summary/notes
    if not gender:
        summary_text = (doc_profile.get("summary") or prof.get("summary") or "").lower()
        he_count = summary_text.count(" he ") + summary_text.count(" his ") + summary_text.count("he has") + summary_text.count("he is")
        she_count = summary_text.count(" she ") + summary_text.count(" her ") + summary_text.count("she has") + summary_text.count("she is")
        if he_count > she_count and he_count >= 2:
            gender = "Male"
        elif she_count > he_count and she_count >= 2:
            gender = "Female"
    gender = gender or "Not Available"

    # ── Specializations ──
    specializations = doc_profile.get("specializations", [])
    primary_spec = "Not Available"
    secondary_specs = []
    if specializations:
        first = specializations[0]
        primary_spec = _safe_get(first, "subspeciality", "sub_speciality_name", default="Not Available")
        for s in specializations[1:]:
            name = _safe_get(s, "subspeciality", "sub_speciality_name", default=None)
            if name:
                secondary_specs.append(name)

    # ── Relations / Practice Locations (B4: all locations) ──
    relations = prof.get("relations", [])
    if not relations:
        relations = _safe_get(prof, "doctorProfile", "relations", default=[])
        if not isinstance(relations, list):
            relations = []

    # Primary location
    primary_est = relations[0].get("establishment", {}) if relations else {}
    practice_name = primary_est.get("name", "Not Available")

    primary_address = primary_est.get("address", {})
    if not isinstance(primary_address, dict):
        primary_address = {}

    city_obj = primary_address.get("city", {})
    city = city_obj.get("city_name", "Not Available") if isinstance(city_obj, dict) else "Not Available"
    state = city_obj.get("state_name", "Not Available") if isinstance(city_obj, dict) else "Not Available"

    street = (
        primary_address.get("address_line1")
        or primary_address.get("street_address")
        or primary_address.get("street")
        or "Not Available"
    )
    if primary_address.get("address_line2"):
        street += ", " + str(primary_address.get("address_line2"))

    pincode = (
        primary_address.get("pin_code")
        or primary_address.get("zip_code")
        or primary_address.get("pincode")
        or primary_address.get("zipcode")
        or primary_address.get("postal_code")
        or "Not Available"
    )
    # Try extracting 6-digit pincode from address string if still missing
    if pincode == "Not Available" and street != "Not Available":
        import re as _re2
        pin_match = _re2.search(r'\b(\d{6})\b', street)
        if pin_match:
            pincode = pin_match.group(1)

    # Additional locations (B4)
    additional_locations = []
    for rel in relations[1:]:
        est = rel.get("establishment", {})
        loc_name = est.get("name", "Unknown")
        loc_addr = est.get("address", {})
        if isinstance(loc_addr, dict):
            loc_street = loc_addr.get("address_line1") or loc_addr.get("street_address") or ""
            loc_city = _safe_get(loc_addr, "city", "city_name", default="")
            loc_str = f"{loc_name}"
            if loc_street:
                loc_str += f" ({loc_street}"
                if loc_city:
                    loc_str += f", {loc_city}"
                loc_str += ")"
            elif loc_city:
                loc_str += f" ({loc_city})"
            additional_locations.append(loc_str)
        else:
            additional_locations.append(loc_name)

    # ── Qualifications / Education vs Training (B3) ──
    qualifications = doc_profile.get("qualifications", [])
    if not qualifications:
        qualifications = prof.get("qualifications", [])

    _TRAINING_PREFIXES = (
        "fellowship", "certificate", "certification", "diploma in",
        "pgdip", "pg diploma", "acls", "bls", "atls",
    )

    education = []
    training_certs = []
    for q in qualifications:
        qual_name = _safe_get(q, "master_qualification", "name", default=None)
        if not qual_name:
            qual_name = q.get("name")
        if not qual_name:
            continue

        # B3: Multiple signals to distinguish education from training
        is_degree = q.get("is_bluebook_compliant", None)
        qual_type = q.get("type", "").lower() if q.get("type") else ""
        name_lower = qual_name.lower()

        is_training = (
            is_degree is False
            or qual_type in ("certification", "training", "fellowship")
            or any(name_lower.startswith(p) for p in _TRAINING_PREFIXES)
        )

        if is_training:
            training_certs.append(qual_name)
        else:
            education.append(qual_name)

    # If no split is possible (all same type), put everything in education
    if not education and training_certs:
        education = training_certs
        training_certs = []

    # ── Registrations ──
    registrations = doc_profile.get("registrations", [])
    if not registrations:
        registrations = prof.get("registrations", [])
    regs = []
    for r in registrations:
        num = r.get("number", "")
        council = _safe_get(r, "council", "name", default="")
        if num:
            regs.append(f"{num} ({council})" if council else num)

    # ── Awards ──
    awards_list = doc_profile.get("awards", [])
    if not awards_list:
        awards_list = prof.get("awards", [])
    awards = [a.get("title") for a in awards_list if a.get("title")]

    # ── Memberships ──
    memberships_list = doc_profile.get("memberships", [])
    if not memberships_list:
        memberships_list = prof.get("memberships", [])
    memberships = [_safe_get(m, "council", "name", default=None) for m in memberships_list]
    memberships = [m for m in memberships if m]

    # ── Summary / Notes ──
    summary = doc_profile.get("summary") or prof.get("summary") or ""
    notes = summary.strip() if summary else "Not Available"

    # ── Mobile Number (B2) ──
    # The vnpractice API needs the numeric practice_id, not the UUID.
    # Best source: parse it from the profile URL query string.
    practice_doctor_id = None
    if profile_url:
        import re as _re
        pid_match = _re.search(r"practice_id=(\d+)", profile_url)
        if pid_match:
            practice_doctor_id = pid_match.group(1)
    if not practice_doctor_id and relations:
        # Fallback: try numeric IDs from the relation/establishment
        for key in ("practice_id", "establishment_id"):
            val = relations[0].get(key)
            if val and str(val).isdigit():
                practice_doctor_id = str(val)
                break
        if not practice_doctor_id:
            est = relations[0].get("establishment", {})
            for key in ("id", "practice_id"):
                val = est.get(key)
                if val and str(val).isdigit():
                    practice_doctor_id = str(val)
                    break

    # ── Years of Experience ──
    yoe = doc_profile.get("years_of_experience") or prof.get("years_of_experience")
    years_exp = str(yoe) if yoe is not None else "Not Available"

    result = {
        "Full Name": full_name or "Not Available",
        "Gender": gender,
        "Primary Specialty": primary_spec,
        "Secondary Specialty": ", ".join(secondary_specs) if secondary_specs else "Not Available",
        "Hospital/Clinic Name": practice_name,
        "City": city,
        "State": state,
        "Training and Certifications": ", ".join(training_certs) if training_certs else "Not Available",
        "Years of Experience": years_exp,
        "Medical Council Registration": ", ".join(regs) if regs else "Not Available",
        "Education": ", ".join(education) if education else "Not Available",
        "Clinic Address": street,
        "Pincode": str(pincode),
        "Mobile Number": "Not Available",  # Will be filled by fetch_phone_number
        "Awards and Recognition": ", ".join(awards) if awards else "Not Available",
        "Membership": ", ".join(memberships) if memberships else "Not Available",
        "Notes": notes,
    }

    # Store practice_doctor_id for phone lookup
    result["_practice_doctor_id"] = practice_doctor_id
    result["_additional_locations"] = additional_locations
    result["_profile_url"] = profile_url

    return result


async def fetch_phone_number(practice_doctor_id: int | str, log_fn=None) -> str:
    """Fetch virtual phone number from Practo's vnpractice API (B2).

    This API returns a virtual/trackable number that routes to the clinic.
    It does NOT require authentication, OTP, or CAPTCHA.
    """
    import httpx

    if not practice_doctor_id:
        return "Not publicly available — no practice ID found"

    url = f"https://www.practo.com/health/api/vn/vnpractice"
    params = {"practice_doctor_id": str(practice_doctor_id)}

    try:
        async with httpx.AsyncClient() as client:
            resp = await client.get(
                url,
                params=params,
                headers={"User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36"},
                timeout=10.0,
            )
            if resp.status_code == 200:
                data = resp.json()
                vn = data.get("vn_phone_number", {})
                number = vn.get("number", "")
                if number:
                    if log_fn:
                        log_fn("info", f"Phone number retrieved for practice_doctor_id={practice_doctor_id}")
                    return number
                return "Not publicly available — API returned no number"
            elif resp.status_code == 404:
                if log_fn:
                    log_fn("info", f"No virtual number provisioned for ID {practice_doctor_id} (404)")
                return "Not publicly available — No virtual number"
            else:
                if log_fn:
                    log_fn("warning", f"Phone API returned status {resp.status_code} for ID {practice_doctor_id}")
                return "Not publicly available — API error"
    except Exception as e:
        if log_fn:
            log_fn("warning", f"Phone number fetch failed: {e}")
        return "Not publicly available — network error"
