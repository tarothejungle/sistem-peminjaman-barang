# Security audit continuation — 10 September 2026

## Status and evidence

Source-level security review and fixes completed for the surfaces below. This is not a certification of production infrastructure or absence of vulnerabilities.

Started from codebase-memory project `D-laragon-www-sistem-peminjaman-barang`, generation `2026-09-08T16:45:25Z` (1,755 nodes / 5,696 edges). Coverage reported changed source metadata; direct source reads were used rather than trusting old graph conclusions. Watcher subsequently refreshed the graph. Trace results included heuristic false-positive cross-language edges, so actual source calls determined impact.

Reviewed: auth routes, JWT signature/type/issuer/audience handling, session rotation/replay/revocation, password reset and change, administrator user management, booking ownership/workflow/limits, document download, image upload/storage, profile/notification ownership, response serialization, frontend auth/cache/API handling, CORS/CSP, proxy configuration, production checks, logging and dependency advisories. Literal search covered raw SQL and browser HTML/storage sinks. Relevant SQL reads use bound values; observed browser persistence holds preferences/remembered username, not access tokens.

## Fixed findings

| Finding | Fix | Evidence |
|---|---|---|
| Origin validation compared hostname only and broke local single-server access | Compare scheme, host and effective port against configured frontend/backend; same-request loopback allowed only in local environment; reject explicit cross-site fetch without origin/referrer | BrowserOriginAuthTest: changed scheme/port, hostile host, configured backend, local loopback and cross-site cases |
| Outstanding reset links survived successful password reset/change | Invalidate all outstanding links and revoke sessions in same credential-change transaction; reset serializes on user lock before token lock | PasswordResetFlowTest: second-link reset rejects first link; self/admin password changes reject real old sessions |
| Administrator password update referenced missing PasswordResetToken import | Import correct model | Real administrator-session password update regression |
| Approval payload could overwrite alternative schedule after availability check | Endpoint-specific WorkflowRequest fields; approval cannot accept alternative fields | BookingAuthorizationAndRejectionTest injection regression |
| Booking edit bypassed duration/future limits; quota count outside serializable creation transaction | Apply limits during edit excluding own record; perform creation check inside transaction | BookingCreationLimitTest edit regression; existing creation/quota tests |
| Login username variation bypassed per-account/IP+account limiter | Add aggregate 30/minute IP limiter | Full suite passes; distributed attacks still need infrastructure controls |
| Obvious timing asymmetry in login/reset lookup | Password hash work for unknown login; reset dummy hash work on both known/unknown branches | Existing known/unknown response tests; no claim of constant-time network/database/mail behavior |
| API responses and expired frontend auth could retain sensitive cached data | API private/no-store; clear QueryClient on clearAuth and failed initialization | Header assertion, frontend suite and build |
| Log message/exception objects bypassed context redaction | Redact message; retain only exception class/code in context | SecurityLoggingTest |
| Queued password-reset mail contained plaintext bearer link in serialized job | PasswordResetMail implements ShouldBeEncrypted, supported by Laravel SendQueuedMailable | Interface assertion and framework source verification |

## Verification

- `php artisan test`: **95 passed, 492 assertions**.
- `php vendor/bin/pint --test`: **passed for entire backend**.
- Frontend lint: **passed**.
- Frontend Vitest: **12 files, 34 tests passed**.
- Frontend `tsc -b && vite build`: **passed**, modern and legacy assets generated. Existing large-chunk warning remains.
- `composer audit --no-interaction`: **no advisories**.
- `npm audit --json`: **0 vulnerabilities**, includes development dependencies.
- Browser Chrome on `http://127.0.0.1:8010/`: login heading and mounted React root present; empty same-origin POST login receives **400 validation**, not origin rejection; `Cache-Control: no-store, private`.
- Git tracked-file query for `*.env`, `*.sql`, `*.dump`, `*.backup`, `*.key`: no matches. This is not a historical secret scan.
- Local Laravel server started on port 8010 (parent process 16392).

## Limits / deployment follow-up

- PostgreSQL concurrent requests were not exercised: feature suite uses SQLite. Serializable quota/availability and simultaneous reset/session behavior require a PostgreSQL concurrency run before production assurance.
- Production host, TLS termination, proxy allowlist, remote DB certificate validation, real SMTP delivery and queue worker availability were not observed. Existing boot checks validate some config but do not prove deployed infrastructure is correct.
- Existing CSP permits `data:` scripts because Vite legacy feature detection imports a data URL; dynamic hashes are derived from HTML response content. This weakens CSP as a secondary XSS defense. Removing it safely needs build/legacy-browser compatibility work; current audit does not claim strict CSP.
- Native non-browser requests without Origin/Referer remain supported; explicit cross-site Fetch Metadata is rejected. Production origin whitelist uses configured URLs rather than arbitrary Host headers.
- No evidence in this run proves local secrets were disclosed. Do not rotate APP_KEY blindly: encrypted data and queued mail depend on it. If prior dump/secret exposure is confirmed, coordinate credential rotation and session revocation with deployment owner.
- Root docs still describe obsolete Express/Prisma roles in places; implementation is Laravel + React. This report records current observations, not those stale specifications.
- Worktree already contains old tracked directory deletions and untracked `be/`, `fe/`. No commit, push, migration or destructive cleanup performed. `docs/` is ignored: this report persists locally but is not automatically included in Git.
- Previous FULL_DAY minimum +1-day behavior was not altered in this security pass. Tests passing does not settle the earlier product-semantic inconsistency.
- Graph excludes vendor, generated build, docs and secrets by design; inspected relevant direct sources where needed. Dependency audit replaces neither vendor code review nor penetration testing.

## Continuation priorities

1. Run PostgreSQL concurrency scenarios for quotas, overlapping resources and simultaneous reset/change/login requests.
2. Replace legacy data-URL feature probe / derive CSP from trusted build manifest, with modern and target legacy-browser checks.
3. Validate production infrastructure and reconcile canonical Laravel documentation; preserve this report when resolving directory migration/commit layout.

## Delivery self-check

| Axis | Score | Evidence / improvement |
|---|---|---|
| Accuracy | 4/5 | Executed tests and browser check; concurrency claims deliberately limited to source evidence. |
| Completeness | 3/5 | Broad application review completed; production infrastructure and PostgreSQL concurrency remain unverified. Next run should address those concrete gaps. |
| Clarity | 4/5 | Findings, verification and residual risks separated; stale docs still need reconciliation. |
| Actionability | 4/5 | Fixes and regressions saved; deployment checks need actual environment access. |
| Conciseness | 4/5 | Single durable report supports continuation; detailed evidence retained here rather than repeated in final response. |

Overall: **3.8/5**. User should regard this as verified application fixes with explicit remaining production-assurance work, not a claim that all security risks are eliminated.
