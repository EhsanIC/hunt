"""JobVision API client.

The target site builds a route for display, but the real search is the POST
request to JobPost/List. Keep the filters in the JSON body; do not try to
construct or scrape the browser URL. Optional filter names are passed through
as-is because JobVision has more filter fields than this app currently renders.
"""

import asyncio
import sys
from typing import Any

import httpx

API = "https://candidateapi.jobvision.ir/api/v1/JobPost/List"
SOURCE_SITE = "jobvision.ir"
JOB_URL_TEMPLATE = "https://jobvision.ir/jobs/{id}"

PAGE_SIZE = 30
MAX_PAGES = 5
PAGE_DELAY_SECONDS = 1.0

BASE_BODY: dict[str, Any] = {
    "pageSize": PAGE_SIZE,
    "requestedPage": 1,
    "sortBy": 1,
    "searchId": None,
}


def _text(value: Any) -> str | None:
    if value is None:
        return None
    text = str(value).strip()
    return text or None


def _first_text(*values: Any) -> str | None:
    for value in values:
        text = _text(value)
        if text:
            return text
    return None


def _number(value: Any) -> float | None:
    if value is None or isinstance(value, bool):
        return None
    try:
        return float(value)
    except (TypeError, ValueError):
        return None


def _format_experience(years: Any) -> str | None:
    if years is None:
        return None
    try:
        y = int(years)
    except (TypeError, ValueError):
        return None
    if y == 0:
        return "No experience"
    if y == 1:
        return "1 year"
    return f"{y} years"


def _to_search_job(post: dict[str, Any], page: int = 1, search_id: str | None = None) -> dict[str, Any] | None:
    jid = post.get("id")
    if jid is None:
        return None

    company = post.get("company") or {}
    properties = post.get("properties") or {}
    location = post.get("location") or {}
    city = location.get("city") or {}
    province = location.get("province") or {}
    work_type = post.get("workType") or {}
    seniority = post.get("seniorityLevel") or {}
    salary = post.get("salary") or post.get("salaryRange") or {}

    exp_years = properties.get("requiredRelatedExperienceYears")
    formatted_exp = _format_experience(exp_years)

    skills = post.get("skills")
    if skills is None:
        skills = post.get("skillList") or properties.get("skills")

    job = {
        "id": int(jid),
        "source_job_id": int(jid),
        "title": _first_text(post.get("title")) or "Untitled job",
        "company": _first_text(company.get("nameFa"), company.get("nameEn")) or "Unknown company",
        "url": JOB_URL_TEMPLATE.format(id=jid),
        "source_site": SOURCE_SITE,
        "is_remote": properties.get("isRemote", post.get("isRemote")),
        "is_internship": properties.get("isInternship", post.get("isInternship")),
        "location": _first_text(
            location.get("title"),
            city.get("titleFa"),
            city.get("titleEn"),
            province.get("titleFa"),
            province.get("titleEn"),
        ),
        "work_type": _first_text(work_type.get("titleFa"), work_type.get("titleEn"), post.get("workType")),
        "experience_level": _first_text(
            post.get("experienceLevel"),
            post.get("workExperience"),
            post.get("workExperienceTitle"),
        )
        or formatted_exp,
        "seniority_level": _first_text(seniority.get("titleFa"), seniority.get("titleEn"), post.get("seniorityLevel")),
        "description": _first_text(post.get("description"), post.get("jobDescription"), post.get("content")),
        "responsibilities": _first_text(post.get("responsibilities"), post.get("duties")),
        "requirements": _first_text(post.get("requirements"), post.get("qualifications")),
        "skills": skills,
        "salary_min": _number(salary.get("min") if isinstance(salary, dict) else None),
        "salary_max": _number(salary.get("max") if isinstance(salary, dict) else None),
        "salary_currency": _first_text(
            salary.get("currency") if isinstance(salary, dict) else None,
            salary.get("currencyCode") if isinstance(salary, dict) else None,
        ),
        "salary_text": _first_text(
            salary.get("text") if isinstance(salary, dict) else None,
            post.get("salaryText"),
        ),
        "company_logo_url": _first_text(company.get("logo"), company.get("logoUrl"), company.get("logoUrlFa")),
        "company_description": _first_text(company.get("description"), company.get("about")),
        "company_page_url": _first_text(company.get("pageUrl"), company.get("url")),
        "posted_at": _first_text(post.get("postedAt"), post.get("createdAt"), post.get("publishDate")),
        "expires_at": _first_text(post.get("expiresAt"), post.get("expireDate"), post.get("deadline")),
        "search_id": search_id,
        "source_page": page,
        "raw_data": post,
    }
    return job


def _api_body(filters: dict[str, Any], page: int) -> dict[str, Any]:
    """Build a clean JobVision payload and omit only unset optional values."""
    body = {**BASE_BODY, **filters, "requestedPage": page}
    return {
        key: value
        for key, value in body.items()
        if value is not None or key == "searchId"
    }


async def search_jobs_with_filters(
    client: httpx.AsyncClient,
    filters: dict[str, Any],
    max_pages: int = MAX_PAGES,
) -> dict[str, Any]:
    """Search JobVision with arbitrary supported filters.

    The normalized jobs retain both commonly used fields and the complete
    source listing in ``raw_data`` for future field extraction.
    """
    if not isinstance(filters, dict):
        raise ValueError("filters must be an object")

    filters = dict(filters)
    filters.pop("maxPages", None)
    jobs: list[dict[str, Any]] = []
    seen_ids: set[int] = set()
    total: int | None = None
    search_id: str | None = None
    last_data: dict[str, Any] = {}

    for page in range(1, max_pages + 1):
        response = await client.post(API, json=_api_body(filters, page))
        response.raise_for_status()
        envelope = response.json()
        data = envelope.get("data") if isinstance(envelope, dict) else None
        if not isinstance(data, dict):
            raise ValueError(
                "unexpected API response: no `data` object "
                f"(statusCode={envelope.get('statusCode')!r}, "
                f"message={envelope.get('message')!r})"
            )

        last_data = data
        if isinstance(data.get("jobPostCount"), int):
            total = data["jobPostCount"]
        if data.get("searchId") is not None:
            search_id = str(data["searchId"])
            filters["searchId"] = search_id

        posts = data.get("jobPosts") or []
        for post in posts:
            if not isinstance(post, dict):
                continue
            job = _to_search_job(post, page=page, search_id=search_id)
            if job and job["id"] not in seen_ids:
                seen_ids.add(job["id"])
                jobs.append(job)

        if not posts or (total is not None and len(jobs) >= total):
            break
        if page < max_pages:
            await asyncio.sleep(PAGE_DELAY_SECONDS)

    return {
        "currentPage": last_data.get("currentPage", 1),
        "pageSize": last_data.get("pageSize", filters.get("pageSize", PAGE_SIZE)),
        "jobPostCount": total if total is not None else len(jobs),
        "searchId": search_id,
        "hasSalaryHistogram": last_data.get("hasSalaryHistogram"),
        "jobs": jobs,
    }


async def search_jobs(
    client: httpx.AsyncClient, keyword: str, max_pages: int = MAX_PAGES
) -> list[dict[str, Any]]:
    """Backward-compatible keyword-only wrapper used by POST /scrape."""
    keyword = keyword.strip()
    if not keyword:
        raise ValueError("keyword must not be empty")
    result = await search_jobs_with_filters(
        client, {"keyword": keyword}, max_pages=max_pages
    )
    return result["jobs"]


async def _cli(keyword: str) -> None:
    async with httpx.AsyncClient(timeout=20) as client:
        result = await search_jobs_with_filters(client, {"keyword": keyword})
    print(f"\n{len(result['jobs'])} job(s) found:\n")
    for i, job in enumerate(result["jobs"], 1):
        print(f"{i:3}. {job['title']}")
        print(f"      {job['company']}")
        print(f"      {job['url']}")
    if not result["jobs"]:
        print("No results — try different filters.")


def main() -> None:
    if hasattr(sys.stdout, "reconfigure"):
        sys.stdout.reconfigure(encoding="utf-8")
    keyword = sys.argv[1] if len(sys.argv) > 1 else "react"
    print(f"Searching {SOURCE_SITE} for {keyword!r} ...")
    asyncio.run(_cli(keyword))


if __name__ == "__main__":
    main()
