# Cookie scanning

Two levels, matching the honest split on the marketing site.

- **Runtime observation** — the in-page "Scan now" widget reads `document.cookie`
  and storage as they are actually set on the current page. Immediate, but only
  ever sees one page in one state.
- **Full pre-deploy crawl** — `scripts/cookie-crawl.mjs` spiders a whole site in
  real Chromium and inventories every cookie set across it, including HttpOnly
  ones (read from the CDP cookie jar, not `document.cookie`). This is the audit
  that catches a tag someone added three pages deep.

## Running a crawl

```bash
npm run scan -- --url https://your-site.com
# options:
#   --max-pages 40                 how many same-origin pages to visit
#   --cadence weekly|monthly       label recorded in the report
#   --out cookie-report            output directory
#   --baseline .cookie-baseline.json   what "new" is measured against
#   --no-update                    don't rewrite the baseline this run
#   --click-accept "#acAccept"     also accept consent and crawl post-consent
```

It writes `cookie-report/report.html` (a readable table) and `report.json`, and
updates the baseline. Each cookie is classified against
[`scripts/cookie-catalog.json`](../scripts/cookie-catalog.json) into
essential / analytics / personalization / advertising / **unknown**. Treat
`unknown` as a to-do: add a pattern to the catalog. The process exits non-zero
when new or unknown cookies appear, so a scheduled run can act on it.

**What it finds vs. doesn't.** It reports what a browser actually receives while
crawling — real, not a guess — but coverage is only as deep as the crawl
(same-origin, up to `--max-pages`) and classification is heuristic. It is not a
substitute for legal review of what each cookie is for.

## Scheduling weekly or monthly, with an emailed report

[`.github/workflows/cookie-scan.yml`](../.github/workflows/cookie-scan.yml) runs
the crawl on a schedule, uploads the HTML report, emails it, and commits the
updated baseline so the next run can diff against it.

Configure it in **Settings → Secrets and variables → Actions**:

| Kind | Name | Purpose |
| --- | --- | --- |
| Variable | `SCAN_URL` | Site to crawl (required) |
| Variable | `COOKIE_SCAN_CADENCE` | `weekly` (default) or `monthly` — **the toggle** |
| Variable | `SCAN_EMAIL_TO` | Recipient; set it to enable the email step |
| Variable | `SCAN_MAX_PAGES` | Optional page cap (default 40) |
| Secret | `SMTP_SERVER` / `SMTP_PORT` | Mail server (e.g. `smtp.gmail.com` / `465`) |
| Secret | `SMTP_USERNAME` / `SMTP_PASSWORD` | Mailbox + an app password |

The **cadence toggle** is `COOKIE_SCAN_CADENCE`: both a weekly and a monthly cron
are registered, and the job runs only for the one matching the variable. Set it
to `monthly` and only the 1st-of-the-month run fires; leave it unset or `weekly`
for Mondays. `workflow_dispatch` runs it on demand any time.

The emailed subject carries the headline — e.g. *"12 cookies, 2 new, 1 unknown"* —
so a run with nothing new is a glance to dismiss and a run that added a tracker
stands out. Without SMTP configured, the report is still kept as a workflow
artifact.
