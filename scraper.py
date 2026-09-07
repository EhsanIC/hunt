"""Standalone scraper — TODO Section 5, made async for Section 6.

Searches jobvision.ir via its JSON API with plain httpx (no browser), using
the facts confirmed by recon_section4.py:

- keyword is a POST body field (not a query param), no cookies/headers needed
- response envelope: the job list lives at `data.jobPosts[]`
- pagination: request sends `requestedPage`/`pageSize`; response `data` echoes
  them and carries the total `jobPostCount`; out-of-range pages return an
  empty `jobPosts[]`
- job URL: https://jobvision.ir/jobs/{id}  (the site redirects to the canonical
  /jobs/{id}/{slug}; a bare id works)

Run:  python scraper.py [keyword]     (default keyword: react)
"""

import asyncio
import sys

import httpx

API = "https://candidateapi.jobvision.ir/api/v1/JobPost/List"
SOURCE_SITE = "jobvision.ir"
JOB_URL_TEMPLATE = "https://jobvision.ir/jobs/{id}"

PAGE_SIZE = 30
MAX_PAGES = 5  # sane cap (TODO Section 5): stop after the first 5 pages no matter what
PAGE_DELAY_SECONDS = 1.0  # be a good citizen: pause between page requests

# Request body captured from the site (DevTools) and verified in Section 4 recon.
# `lastSeen` is kept at its capture-time value; the API still returns current
# listings with it (verified live 2026-09-07).
BASE_BODY = {
    "pageSize": PAGE_SIZE,
    "requestedPage": 1,
    "sortBy": 1,
    "lastSeen": "2026-08-23T14:02:41.987",
    "locationWrapper": "mashhad",
    "keyword": "react",  # replaced per call
    "searchId": None,
}


def _to_job(post: dict) -> dict | None:
    """Map one raw jobPosts[] entry to {title, company, url, source_site}."""
    jid = post.get("id")
    if jid is None:
        return None
    return {
        "title": str(post.get("title") or "").strip(),
        "company": str((post.get("company") or {}).get("nameFa") or "").strip(),
        "url": JOB_URL_TEMPLATE.format(id=jid),
        "source_site": SOURCE_SITE,
    }


async def search_jobs(
    client: httpx.AsyncClient, keyword: str, max_pages: int = MAX_PAGES
) -> list[dict]:
    """Search jobvision.ir for `keyword` and return the matching jobs.

    Each result is {title, company, url, source_site}. Paginates via
    `requestedPage` until all results are collected, `max_pages` is reached,
    or the API stops returning entries. Results are deduplicated by url.
    Pass a shared httpx.AsyncClient (e.g. one created in the FastAPI lifespan)
    to reuse connection pooling across keywords.
    """
    keyword = keyword.strip()
    if not keyword:
        raise ValueError("keyword must not be empty")

    jobs: list[dict] = []
    seen_urls: set[str] = set()

    total: int | None = None
    for page in range(1, max_pages + 1):
        body = {**BASE_BODY, "keyword": keyword, "requestedPage": page}
        r = await client.post(API, json=body)
        r.raise_for_status()
        payload = r.json()
        data = payload.get("data") if isinstance(payload, dict) else None
        if not isinstance(data, dict):
            raise ValueError(
                "unexpected API response: no `data` object "
                f"(statusCode={payload.get('statusCode')!r}, "
                f"message={payload.get('message')!r})"
            )

        posts = data.get("jobPosts") or []
        if isinstance(data.get("jobPostCount"), int):
            total = data["jobPostCount"]

        for post in posts:
            job = _to_job(post)
            if job and job["url"] not in seen_urls:
                seen_urls.add(job["url"])
                jobs.append(job)

        # Stop when this page was empty, or we already have every result.
        if not posts or (total is not None and len(jobs) >= total):
            break
        if page < max_pages:
            await asyncio.sleep(PAGE_DELAY_SECONDS)

    return jobs


async def _cli(keyword: str) -> None:
    async with httpx.AsyncClient(timeout=20) as client:
        results = await search_jobs(client, keyword)
    print(f"\n{len(results)} job(s) found:\n")
    for i, job in enumerate(results, 1):
        print(f"{i:3}. {job['title']}")
        print(f"      {job['company']}")
        print(f"      {job['url']}")
    if not results:
        print("No results — try a different keyword.")


def main() -> None:
    # Windows consoles may not default to UTF-8; titles/companies are Persian
    if hasattr(sys.stdout, "reconfigure"):
        sys.stdout.reconfigure(encoding="utf-8")

    keyword = sys.argv[1] if len(sys.argv) > 1 else "react"
    print(f"Searching {SOURCE_SITE} for {keyword!r} ...")
    asyncio.run(_cli(keyword))


if __name__ == "__main__":
    main()
