import asyncio
import json
import uuid
from datetime import datetime, timezone

from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from pydantic import ValidationError
from sse_starlette.sse import EventSourceResponse
import httpx

from scraper.models import ScrapeRequest
from scraper.crawler import scrape_task


app = FastAPI(title="Practo Scraper API")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Task storage: task_id -> {queue, task, cancel_event, created_at}
active_tasks: dict[str, dict] = {}

# Task cleanup interval (seconds)
TASK_TTL_SECONDS = 300  # 5 minutes


async def _cleanup_stale_tasks():
    """B11: Periodically remove tasks that were never consumed."""
    while True:
        await asyncio.sleep(60)
        now = datetime.now(timezone.utc)
        stale_ids = []
        for tid, tdata in active_tasks.items():
            age = (now - tdata["created_at"]).total_seconds()
            if age > TASK_TTL_SECONDS and not tdata.get("streaming"):
                stale_ids.append(tid)
        for tid in stale_ids:
            tdata = active_tasks.pop(tid, None)
            if tdata:
                tdata["cancel_event"].set()
                task = tdata.get("task")
                if task and not task.done():
                    task.cancel()


@app.on_event("startup")
async def startup():
    asyncio.create_task(_cleanup_stale_tasks())


@app.get("/api/autocomplete/location")
async def autocomplete_location(query: str = ""):
    if len(query) < 2:
        return {"results": []}

    url = "https://www.practo.com/client-api/v1/cerebro/v3/autocomplete"
    params = {"query": query, "indexes": '["city","locality"]'}
    async with httpx.AsyncClient() as client:
        try:
            resp = await client.get(
                url, params=params, headers={"User-Agent": "Mozilla/5.0"}, timeout=10.0
            )
            if resp.status_code == 200:
                return resp.json()
            return {"error": f"Practo API returned status {resp.status_code}"}
        except Exception as e:
            return {"error": str(e)}


@app.get("/api/autocomplete/specialty")
async def autocomplete_specialty(query: str = "", city: str = ""):
    if len(query) < 2:
        return {"results": []}

    url = "https://www.practo.com/client-api/v1/cerebro/v3/autocomplete"
    params = {
        "query": query,
        "exclude": '["locality","region","insurance_providers"]',
        "contexts": json.dumps({"city": city}),
    }
    async with httpx.AsyncClient() as client:
        try:
            resp = await client.get(
                url, params=params, headers={"User-Agent": "Mozilla/5.0"}, timeout=10.0
            )
            if resp.status_code == 200:
                return resp.json()
            return {"error": f"Practo API returned status {resp.status_code}"}
        except Exception as e:
            return {"error": str(e)}


@app.post("/api/start")
async def start_scrape(req: ScrapeRequest):
    task_id = str(uuid.uuid4())
    q = asyncio.Queue()
    cancel_event = asyncio.Event()

    task = asyncio.create_task(scrape_task(req, q, cancel_event))

    active_tasks[task_id] = {
        "queue": q,
        "task": task,
        "cancel_event": cancel_event,
        "created_at": datetime.now(timezone.utc),
        "streaming": False,
    }

    return {"task_id": task_id}


@app.post("/api/cancel/{task_id}")
async def cancel_scrape(task_id: str):
    """B11: Cancel an in-progress scrape."""
    tdata = active_tasks.get(task_id)
    if not tdata:
        return {"error": "Task not found"}

    tdata["cancel_event"].set()

    # Send a cancelled event to the queue
    try:
        await tdata["queue"].put({
            "type": "done",
            "message": "Scrape cancelled by user",
            "data": [],
            "metadata": {"cancelled": True},
        })
    except Exception:
        pass

    return {"status": "cancelled"}


@app.get("/api/stream/{task_id}")
async def stream_scrape(task_id: str, request: Request):
    tdata = active_tasks.get(task_id)
    if not tdata:
        return {"error": "Task not found"}

    q = tdata["queue"]
    tdata["streaming"] = True

    async def event_generator():
        try:
            while True:
                if await request.is_disconnected():
                    # B11: Cancel background task on disconnect
                    tdata["cancel_event"].set()
                    break

                try:
                    event = await asyncio.wait_for(q.get(), timeout=1.0)
                except asyncio.TimeoutError:
                    continue

                yield json.dumps(event)

                if event.get("type") == "done":
                    break
        finally:
            # B11: Cleanup task from memory
            if task_id in active_tasks:
                del active_tasks[task_id]

    return EventSourceResponse(event_generator())


if __name__ == "__main__":
    import uvicorn

    uvicorn.run(app, host="0.0.0.0", port=8000)
