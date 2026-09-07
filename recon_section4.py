"""Recon for TODO Section 4: jobvision.ir job-search API.

Checks:
1. Plain httpx POST with no cookies / browser session (header tiers if needed)
2. Keyword really is the POST body field `keyword` (different keyword -> different jobs)
3. Pagination shape (requestedPage/pageSize in, current-page + total count out)
4. Real job-posting URL pattern (resolve /jobs/{id}, follow redirects)

Run standalone:  python recon_section4.py   (prints the same JSON the endpoint returns)
Run via the app: GET /recon/section4        (wired up in main.py)
"""

import json
import re
import sys
import time

import httpx

API = "https://candidateapi.jobvision.ir/api/v1/JobPost/List"
SITE = "https://jobvision.ir"

BASE_BODY = {
    "pageSize": 30,
    "requestedPage": 1,
    "sortBy": 1,
    "lastSeen": "2026-08-23T14:02:41.987",
    "locationWrapper": "mashhad",
    "keyword": "react",
    "searchId": None,
}

UA = (
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 "
    "(KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36"
)

# Escalating header tiers, all still cookie-less
HEADER_TIERS = [
    ("plain default UA", None),
    ("browser User-Agent", {"User-Agent": UA}),
    (
        "UA + Referer/Origin/Accept",
        {
            "User-Agent": UA,
            "Referer": f"{SITE}/jobs",
            "Origin": SITE,
            "Accept": "application/json",
        },
    ),
]


def jobs_of(data):
    for k, v in data.items():
        if k.lower() == "jobposts" and isinstance(v, list):
            return v
    return next((v for v in data.values() if isinstance(v, list)), [])


def _attempt(client, body, headers=None):
    """POST to the API. Returns (data, error): envelope-unwrapped payload, or an error string."""
    try:
        r = client.post(API, json=body, headers=headers)
    except (httpx.HTTPError, ValueError) as exc:
        return None, f"{type(exc).__name__}: {exc}"
    ctype = r.headers.get("content-type", "").split(";")[0]
    if r.status_code != 200 or "json" not in ctype:
        head = r.text[:120].replace("\n", " ")
        return None, f"status={r.status_code} content-type={ctype} head={head!r}"
    try:
        payload = r.json()
    except ValueError as exc:
        return None, f"JSONDecodeError: {exc}"
    # API wraps the payload in an envelope: {traceId, isSuccess, statusCode, message, data}
    if isinstance(payload.get("data"), (dict, list)):
        payload = payload["data"]
    return payload, None


def _get_job_page(client, path):
    """GET a site URL following redirects. Returns (final_url, status, title, error)."""
    try:
        r = client.get(f"{SITE}{path}", headers={"User-Agent": UA}, follow_redirects=True)
    except httpx.HTTPError as exc:
        return None, None, None, f"{type(exc).__name__}: {exc}"
    m = re.search(r"<title>(.*?)</title>", r.text, re.S)
    return (
        str(r.url),
        r.status_code,
        m.group(1).strip()[:140] if m else None,
        None,
    )


def run_recon() -> dict:
    """Run all Section 4 checks and return the results as a structured dict."""
    out: dict = {}

    with httpx.Client(timeout=20) as client:
        # 1) no cookies, escalating header tiers
        data = error = None
        tier = None
        for tier_label, headers in HEADER_TIERS:
            data, error = _attempt(client, BASE_BODY, headers=headers)
            tier = tier_label
            if data is not None:
                break
            time.sleep(1)
        if data is None:
            return {
                "tier_tried": tier,
                "error": error,
                "verdict": "plain httpx NOT enough - Playwright fallback likely required",
            }
        out["no_cookies"] = {"works_with": tier}

        # 2) response shape + pagination
        jobs = jobs_of(data)
        first = jobs[0] if jobs else None
        comp = (first.get("company") or {}) if first else {}
        out["response_shape"] = {
            "job_posts": jobs,  # full first page, raw entries as returned by the API
            "data_scalars": {
                k: v for k, v in data.items() if not isinstance(v, (list, dict))
            },
            "data_lists": {
                k: len(v) for k, v in data.items() if isinstance(v, list)
            },
            "jobposts_entry_keys": sorted(first.keys()) if first else None,
        }
        react_first = (first.get("id"), first.get("title")) if first else None

        # 3) different keyword -> different results?
        time.sleep(1)
        d2, err2 = _attempt(client, {**BASE_BODY, "keyword": "django"})
        out["keyword_param"] = {"call_ok": d2 is not None, "error": err2}
        if d2 is not None:
            j2 = jobs_of(d2)
            django_first = (j2[0].get("id"), j2[0].get("title")) if j2 else None
            out["keyword_param"].update(
                {
                    "django_first_3": [(j.get("id"), j.get("title")) for j in j2[:3]],
                    "different_from_react": django_first != react_first,
                }
            )

        # 4) page 2 -> different results?
        time.sleep(1)
        d3, err3 = _attempt(client, {**BASE_BODY, "requestedPage": 2})
        out["pagination"] = {"page2_error": err3}
        if d3 is not None:
            j3 = jobs_of(d3)
            out["pagination"].update(
                {
                    "page2_scalars": {
                        k: v
                        for k, v in d3.items()
                        if not isinstance(v, (list, dict))
                    },
                    "page2_first_3": [(j.get("id"), j.get("title")) for j in j3[:3]],
                }
            )

        # 5) URL pattern: resolve /jobs/{id} and follow redirects
        jid = first.get("id") if first else None
        out["url_pattern"] = {}
        if jid is None:
            out["url_pattern"]["error"] = "no job id available to test"
        else:
            time.sleep(1)
            final, status, title, err4 = _get_job_page(client, f"/jobs/{jid}")
            out["url_pattern"]["bare_id"] = {
                "url": f"{SITE}/jobs/{jid}",
                "status": status,
                "final_url": final,
                "page_title": title,
                "error": err4,
            }
            time.sleep(1)
            final2, status2, _title2, err5 = _get_job_page(
                client, f"/jobs/{jid}/placeholder-slug"
            )
            out["url_pattern"]["fake_slug"] = {
                "url": f"{SITE}/jobs/{jid}/placeholder-slug",
                "status": status2,
                "final_url": final2,
                "error": err5,
            }
            out["url_pattern"]["company_pageUrl_shape"] = comp.get("pageUrl")

    return out


def main():
    # Windows consoles may not default to UTF-8; job titles/company names are Persian
    if hasattr(sys.stdout, "reconfigure"):
        sys.stdout.reconfigure(encoding="utf-8")
    print(json.dumps(run_recon(), indent=2, ensure_ascii=False))


if __name__ == "__main__":
    main()
