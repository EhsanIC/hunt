"""One-off recon for TODO Section 4: jobvision.ir job-search API.

Checks:
1. Plain httpx POST with no cookies / browser session (header tiers if needed)
2. Keyword really is the POST body field `keyword` (different keyword -> different jobs)
3. Pagination shape (requestedPage/pageSize in, current-page + total count out)
4. Real job-posting URL pattern (resolve /jobs/{id}, follow redirects)
"""

import json
import re
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


def attempt(client, body, label, headers=None):
    print(f"\n=== {label} ===")
    r = client.post(API, json=body, headers=headers)
    ctype = r.headers.get("content-type", "").split(";")[0]
    print(f"status={r.status_code} content-type={ctype}")
    if "json" not in ctype:
        print("non-JSON body head:", r.text[:160].replace("\n", " "))
        return None
    body = r.json()
    # API wraps the payload in an envelope: {traceId, isSuccess, statusCode, message, data}
    if isinstance(body.get("data"), (dict, list)):
        return body["data"]
    return body


def jobs_of(data):
    for k, v in data.items():
        if k.lower() == "jobposts" and isinstance(v, list):
            return v
    return next((v for v in data.values() if isinstance(v, list)), [])


def main():
    with httpx.Client(timeout=20) as client:
        # 1) no cookies, no special headers
        data = attempt(client, BASE_BODY, "1) plain httpx (default UA, no cookies)")
        tier = "plain default UA"
        if data is None:
            time.sleep(1)
            data = attempt(
                client, BASE_BODY, "2) + browser User-Agent (still no cookies)",
                headers={"User-Agent": UA},
            )
            tier = "browser User-Agent"
        if data is None:
            time.sleep(1)
            data = attempt(
                client, BASE_BODY, "3) + UA + Referer/Origin/Accept (no cookies)",
                headers={"User-Agent": UA, "Referer": f"{SITE}/jobs", "Origin": SITE,
                         "Accept": "application/json"},
            )
            tier = "UA + Referer/Origin/Accept"
        if data is None:
            print("\nRESULT: plain httpx NOT enough - Playwright fallback likely required")
            return

        print(f"\n>>> works with: {tier} (no cookies sent)")

        # 2) response shape + pagination
        scalars = {k: v for k, v in data.items() if not isinstance(v, (list, dict))}
        print("data-level scalar fields:", json.dumps(scalars, ensure_ascii=False))
        print("data-level list fields:", {k: len(v) for k, v in data.items() if isinstance(v, list)})

        jobs = jobs_of(data)
        if not jobs:
            print("no jobPosts list; top-level keys:", list(data.keys()))
            return
        print("jobPosts count:", len(jobs))
        first = jobs[0]
        print("jobPosts[0] keys:", sorted(first.keys()))
        comp = first.get("company") or {}
        print(
            "jobPosts[0] sample:",
            json.dumps(
                {"id": first.get("id"), "title": first.get("title"),
                 "jobUrl": first.get("jobUrl"),
                 "company": {k: comp.get(k) for k in ("nameFa", "pageUrl")}},
                ensure_ascii=False,
            ),
        )
        react_first = (first.get("id"), first.get("title"))

        # 3) different keyword -> different results?
        time.sleep(1)
        d2 = attempt(client, {**BASE_BODY, "keyword": "django"}, "4) keyword=django")
        if d2:
            j2 = jobs_of(d2)
            print("django first 3:", [(j.get("id"), j.get("title")) for j in j2[:3]])
            if j2:
                print("DIFFERENT from react:",
                      (j2[0].get("id"), j2[0].get("title")) != react_first)

        # 4) page 2 -> different results?
        time.sleep(1)
        d3 = attempt(client, {**BASE_BODY, "requestedPage": 2}, "5) requestedPage=2")
        if d3:
            j3 = jobs_of(d3)
            print("page2 first 3:", [(j.get("id"), j.get("title")) for j in j3[:3]])

        # 5) URL pattern: resolve /jobs/{id} and follow redirects
        jid = first.get("id")
        time.sleep(1)
        print(f"\n=== 6) resolve {SITE}/jobs/{jid} ===")
        r = client.get(f"{SITE}/jobs/{jid}", headers={"User-Agent": UA},
                       follow_redirects=True)
        print("status:", r.status_code)
        print("final url:", str(r.url))
        m = re.search(r"<title>(.*?)</title>", r.text, re.S)
        if m:
            print("page <title>:", m.group(1).strip()[:140])

        time.sleep(1)
        r2 = client.get(f"{SITE}/jobs/{jid}/placeholder-slug", headers={"User-Agent": UA},
                        follow_redirects=True)
        print("with fake slug -> status:", r2.status_code, "final url:", str(r2.url))

        print("\ncompany.pageUrl shape:", comp.get("pageUrl"))


if __name__ == "__main__":
    main()
