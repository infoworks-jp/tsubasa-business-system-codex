# Recruitment audit — 2026-11-02

Baseline: rio-corporate-site commit a10d829605eaea5bef3e11a96ff4ea7553ace0a0.

## Audit condition repaired

The old `indeed_links_configured` check searched recruit-contact.js for two fixed Indeed IDs. The public site now routes visitors through internal recruitment pages. The repaired check verifies public recruitment routing, listing links, three detail pages, JobPosting identity/region, consistent application URLs, expiry where provided, and office telephone links. Six regression cases pass.

Audit fix: c526a17ea24c1c288e346de2135085f6cc3998b1.
GitHub Actions: https://github.com/infoworks-jp/tsubasa-business-system-codex/actions/runs/41391229764 — success. All nine configuration/availability checks passed. Indeed returned HTTP 401 to the GitHub runner, so external destinations are explicitly NOT_VERIFIED there. CI success does not mean every application destination is verified.

## Independent live findings

Read-only requests from the working environment on 2026-11-02 returned HTTP 200 for /recruit/, /recruit/sapporo-entry/, /recruit/sapporo-experienced/, and /recruit/yokohama/ at https://rio-works.com.

| Page | Configured destination | Finding |
| --- | --- | --- |
| Sapporo entry | https://jp.indeed.com/viewjob?jk=91ce7644bf2afaab | HTTP 200; title 土木作業スタッフ, Sapporo location, application action present. No submitted application or delivery test. |
| Sapporo experienced | https://jp.indeed.com/viewjob?jk=186fc84748c75fce | HTTP 200; employer 株式会社　吏央, Hokkaido location, title 解体工　未経験OK、経験者高待遇、資格取得全額負担します。. External JobPosting salary is JPY 11,000–15,000 per day, while the corporate page states JPY 13,000–18,000. The new live-content check reports FAIL when structured external content is available. This is a content mismatch, not an HTTP link failure. |
| Yokohama | Indeed /jobs search for 株式会社吏央 土工・土木作業員 in 神奈川県横浜市 | Search page returned HTTP 200. This does not establish a direct route to Airwork job 6037094. |

Telephone URLs are configured correctly: Sapporo tel:0113748012; Yokohama tel:0459303366. Telephone calls were not made.

## Outstanding

- Confirm the intended Sapporo experienced listing and its authoritative pay range using Airwork job 11807357 / ad 2975653. Do not silently substitute a different listing or alter employment conditions from inconsistent evidence.
- Confirm a current direct application URL for Yokohama Airwork job 6037094 / ad 2891758. Do not infer an Indeed job key from an Airwork identifier.
- The secondary Sapporo experienced Townwork source link redirected to /session/destroy/?type=webSSO in this environment; it was not independently verified as a job detail page.

No recruitment site copy, employment conditions, business database, or application submission was modified. The requested audit repair is deployed; full destination/content verification remains incomplete for the reasons above.
