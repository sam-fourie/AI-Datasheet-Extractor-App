<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->

## UI System Conventions

- Theme tokens live in `src/app/globals.css`. Extend them there before hard-coding colours, radii, shadows or durations in components. Components use the Tailwind names from `@theme`, not the raw `--ui-*` variables.
- Token families:
  - Surfaces: `page`, `surface`, `surface-elevated`, `surface-subtle`, `surface-muted`, `surface-sunken`, `surface-hover`, `surface-selected`, `row-active`, `material`, `scrim`.
  - Borders: `border`, `border-subtle`, `border-strong`, `control-border`.
  - Text: `text`, `text-muted`, `text-tertiary`.
  - Accent: `accent`, `accent-strong`, `accent-text`, `accent-soft`.
  - Status: `success`, `warning` and `danger`, each with `-strong`, `-soft` and `-ring`, plus `pending` (grey) and `focus`.
  - Charts: `chart-neutral`, `chart-neutral-strong`.
  - Elevation: `shadow-xs`, `shadow-card`, `shadow-overlay`.
  - Radii: `rounded-xs` (6), `rounded-sm` (8), `rounded-md` (12), `rounded-lg` (16), `rounded-pill`.
  - Type scale: `text-title-1`, `text-title-2`, `text-title-3`, `text-body`, `text-callout`, `text-caption`, `text-stat`. Weights are 400, 500 and 600 only. Use `tabular-nums` on numeric cells.
  - Layout: `--ui-sidebar-width`, `--ui-topbar-height`, `--ui-header-height`, `--ui-toolbar-height`, `--ui-content-narrow`, `--ui-content-default`, `--ui-content-review`.
  - Motion: `ease-ui`, `ease-ui-emphasized`, `--ui-duration-fast`, `--ui-duration`, `--ui-duration-slow`, and the entrance animations `animate-fade-in`, `animate-dialog-in`, `animate-sheet-right-in`, `animate-sheet-bottom-in`, `animate-toast-in` and `animate-float-in`. Wrap animations in `motion-safe:`. A global reduced-motion block also turns them off.
- Colour semantics:
  - Green: confirmed, match, or a good score.
  - Red: a human marked the value incorrect or corrected it, a baseline mismatch, an error, or a destructive action.
  - Amber: AI risk or needs attention (AI unsure, medium or low confidence, flagged by the AI, partial match, runs disagree, a mid score).
  - Blue: selected, informational, or the primary action.
  - Grey: pending or neutral, including unscored agreement.
- Scores: accuracy and agreement share one threshold map, `scoreTone` and `SCORE_BANDS` in `src/lib/submissions/score.ts`. 95 and above is success, 80 to 94 is warning, below 80 is danger, and a missing value is neutral. Render scores with `ScoreBadge` rather than picking colours locally.
- Use sentence case everywhere, with no uppercase letter-spaced eyebrows. Table headers are caption-size, weight 500 and `text-text-muted`.
- One surface per region: a white card with a hairline border and `shadow-card`. Never nest bordered boxes; group content with spacing and hairline dividers. Shadows are only for things that float: menus, popovers, dialogs, toasts and the segmented-control thumb.
- A view has at most one primary button. Destructive actions live in menus, and turn solid red only inside their confirm dialog.
- Keep the visual direction Apple-like: neutral palette, restrained blue accent, subtle borders, soft shadows, and clean spacing. Avoid loud gradients, purple-heavy palettes and heavy depth effects.
- Shared primitives live in `src/components/ui` and are exported from `src/components/ui/index.ts`. Use them before writing new controls:
  - Actions: `Button` (variants primary, secondary, ghost, danger and plain; `loading` and `aria-disabled` keep focus but block clicks), `IconButton` (optional `tooltip` and `shortcut`), `LinkButton`, `CopyButton`.
  - Forms: `Field`, `Label`, `TextField`, `NumberField`, `SelectField`, `Textarea`, `Checkbox`, `Switch`, `FileField`, `SearchField` (optional `shortcutKey`), `Combobox` (optional `inputRef`), `SegmentedControl`. Form controls take `controlSize?: "md" | "lg"`, never `size`.
  - Overlays: `Dialog` (center dialog or sheet; `width` overrides the size classes), `Popover`, `Menu` (`MenuItem.checked` and `itemRole` give `menuitemradio` or `menuitemcheckbox`), `Tooltip`, and `ToastProvider` with `useToast`.
  - Display: `Badge`, `Callout`, `Card`, `DescriptionList`, `Disclosure`, `EmptyState`, `Kbd`, `PageHeader`, `ProgressBar`, `Skeleton` and `SkeletonText`, `Spinner`, `Stat` and `StatGroup`, and `Table` with `THead`, `TBody`, `Tr`, `Th` and `Td`.
- `cn()` in `src/components/ui/cn.ts` only joins truthy class strings. It does not merge Tailwind classes, so a `className` that fights a primitive's own utility (another padding, height or colour) is not guaranteed to win. Use the primitive's props, or Tailwind's trailing `!` (for example `px-0!`), to override.
- Prefer native controls and server-safe components by default. Only introduce client components when a browser API or real client state is required. Wrap every `localStorage` and `sessionStorage` access in try/catch.
- `/preview` is the living style guide for the primitives, and its interactive demos live in `src/components/ui/preview-demos.tsx`. Add a demo there when you add or change a primitive.

## Shared App Components

- `src/components/review-status-badge.tsx`: `ReviewStatusBadge` and `describeReviewStatus`, the single wording for "Not started", "In review" and "Reviewed · 84%", and for re-run status.
- `src/components/score-badge.tsx`: `ScoreBadge` for accuracy and agreement, coloured by `scoreTone`.
- `src/components/provider-run-meta.tsx`: `ProviderRunMeta` shows model, effort, tokens, latency and estimated cost. `formatRunPerformance` is the short latency and cost line.
- `src/components/relative-time.tsx`: `RelativeTime`, rendered on the client so it never causes a hydration mismatch.
- `src/components/delete-submission-dialog.tsx`: `DeleteSubmissionDialog`, the only delete flow. A baseline with runs always cascades. The action is disabled with `RUN_IN_PROGRESS_REASON` while a background run for that group is running.
- `src/components/review-queue-badge.tsx`: the sidebar count of pending baselines.
- Shell: `AppLink` (a guard-aware `next/link`), `AppPageLayout` and `AppStatusPage` (for the error and not-found pages), `AppSidebarNav` (desktop, 1024 px and up) and `AppMobileNav` (the top bar below 1024 px). All of these are in `src/components/`.
- The root layout mounts `NavigationGuardProvider`, then `ToastProvider`, then `BackgroundTasksProvider`.

## Navigation

- `src/components/navigation-blocker-provider.tsx` owns every leave-page warning.
  - `useNavigationGuard(guard | null)` registers a guard while it is non-null.
  - Level `"navigation"` intercepts in-app links, `navigate()` and the browser Back button with a confirm dialog, and also arms `beforeunload`. The intake uses it while an extraction runs, and the review workspace uses it while the draft is dirty.
  - Level `"unload"` only arms `beforeunload`, so in-app navigation stays free. Background re-runs use it.
- `useNavigationGuardControls()` returns `navigate(href, { replace? })` and `releaseAndReplace(href)`. `navigate` is the only way app code navigates programmatically (menus, toasts, dialogs, delete, the completion card). The one exception is same-page query updates on pages that register no guard: the Submissions and Reports filters call `router.replace(href, { scroll: false })`.
- In-app hrefs rendered by `Menu`, toast actions and `LinkButton` go through `AppLink` or `navigate`, never a bare `<a>` or `router.push`. `AppLink` asks the provider through `useNavigationGuardInterceptor`, which is internal to the shell.
- Intake hand-off: on success the intake writes `sessionStorage["review:arrival:<submissionId>"] = "1"` and calls `releaseAndReplace("/submissions/<id>")`. The review workspace reads and removes that key on mount and shows the arrival banner, computing every number from the submission itself. There is no query parameter for this, and nothing tidies the URL with `history.replaceState`.
- Long-running model re-runs go through `useBackgroundTasks().startTask` from `src/components/background-tasks-provider.tsx`. It allows up to 3 concurrent tasks, survives client navigation, shows toasts and the running chip, and supports `retry` and `isGroupBusy`. Re-runs have no Cancel. After starting a run from the intake duplicate notice, the app navigates to the baseline, never to the unfinished run.

## Submission Persistence Architecture

- Successful extraction requests are persisted in MongoDB using `MONGODB_URI`. The collection name is `datasheet_submissions`.
- Shared persisted submission types live in `src/lib/submissions/types.ts`. Reuse those types instead of creating duplicate response shapes in components or routes.
- Mongo connection setup lives in `src/lib/mongodb.ts`, and server-side data access belongs in `src/lib/submissions/repository.ts`:
  - Reads: `getSubmissionDetail`, `getSubmissionIntake` (intake only, for the PDF routes), `listSubmissionSummaries` (every submission; no page uses it, but it is the reference input for `summarizeModelRuns` checks), `listSubmissionModelRuns` (the baseline plus its re-runs with agreement and review progress), `listDatasheetGroups` (the Submissions list, with `totals`), `listDatasheetIndex` (baselines only, for the intake duplicate check and recent list), `getReviewQueueCount`, `findNextPendingBaseline`, `listReportSubmissions` (Reports) and `listRunMetaSummaries` (intake estimates).
  - Writes: `createSubmission`, `updateSubmissionReview`, `deleteSubmission` and `deleteSubmissionWithRuns`.
  - `isValidSubmissionId` requires 24 hex characters. Every `[submissionId]` route checks it before any query and returns 400 when it fails.
- List and Reports query strings are parsed and serialized in `src/lib/submissions/list-query.ts` and `src/lib/submissions/reports.ts`.
- Grouping: the list has one group per baseline, and re-runs nest under their baseline. Counts and the review queue count baselines only, duplicates included. `duplicateCount` counts other baselines with the same normalized part number (`normalizePartNumberKey` in `source.ts`).
- Server Components read submissions directly from the repository. Mutations belong in route handlers, not in ad hoc client-side data layers.
- `DELETE /api/submissions/[id]?cascade=runs` calls `deleteSubmissionWithRuns`. It deletes the Mongo documents (the root and every re-run whose `comparison.baselineSubmissionId` is the root) first and collects their retained upload keys, then the route deletes those R2 objects best-effort. Without `cascade=runs` the route deletes that one submission and its retained upload.
- R2 object prefixes:
  - `datasheets/pending/{uuid}/{file}`: direct-to-R2 uploads waiting for extraction. On success they are copied under the submission prefix and deleted. After a model-side failure they are kept for "Try again" (`retryableUpload: true`). The bucket lifecycle rule applies to this prefix only.
  - `datasheets/submissions/{submissionId}/{file}`: retained uploads, one per submission. Re-runs copy the source object to their own key.
  - `datasheets/url-cache/{sha256(normalizedUrl)}/{contentSha256}.pdf`: the exact bytes extracted from a URL source (`UrlSourceMeta.contentSha256`). `…/legacy.pdf` holds a later vendor copy for submissions without `contentSha256`, or whose content object is missing. Helpers are in `src/lib/pdf-cache.ts`. The extraction route writes the extracted bytes under the content key in `after()`, and `cacheUrlSourcePdf` skips the Put when HEAD finds the object. These objects are shared by every submission of that URL, and no submission delete ever removes them.
- `vercel.json` sets `supportsCancellation` for `src/app/api/extractions/route.ts`, so `request.signal` fires when the client cancels. The route checks the signal right before `createSubmission` and returns 499 `{ code: "cancelled" }` without saving.
- Access: `APP_BASIC_AUTH` (`username:password`) is an HTTP Basic login. The logic lives in `src/lib/auth.ts`. `src/proxy.ts` checks every page and API request except `_next/static`, `_next/image` and the favicon, and `requireAuthorizedRequest` in `src/app/api/_lib/access.ts` checks every mutating route handler again as the authoritative gate. New mutating routes must call it. The gate is opt-in: unset, every request is allowed.
- Vendor PDF URLs are only fetched through `readPdfFromUrl` in `src/lib/pdf-source.ts`, which uses the guarded downloader in `src/lib/public-fetch.ts` (no private or internal addresses, redirects re-checked, the body capped at `MAX_PDF_BYTES` while streaming). Never `fetch` a user-supplied URL directly.
- Upload URLs sign the declared `Content-Type` and `Content-Length`. The extraction route HEADs the pending object and rejects it when it is missing, larger than `MAX_PDF_BYTES` or a different size from the one claimed, before reading it. R2 reads stop at `MAX_PDF_BYTES` (`R2ObjectTooLargeError`).
- The Mongo client is created with `ignoreUndefined: true`, so optional fields are omitted rather than stored as null. Reviews saved before September 2026 can still hold null optional fields (for example `correctedStatus: null`); the review payload schema in `src/lib/submissions/schemas.ts` treats null as unset, and any new optional field must do the same.
- Indexes for `datasheet_submissions` are defined in `src/lib/submissions/indexes.ts` and applied only by a human running `scripts/ensure-submission-indexes.ts --apply`. Never create them from a request path, `getSubmissionCollection` or `mongodb.ts`.
- The intake routes (`/api/extractions`, `/api/extractions/upload-url`, `/api/pdf-url-validation`) and the PDF routes return error bodies with `{ error, code }`. The intake reads the code (`ExtractionErrorCode` in `src/lib/extractions.ts`) and never guesses from the status or the message.

## Review Model

- The stored AI extraction snapshot is immutable once saved.
- Human edits are stored as a separate review overlay with `pending | confirmed | corrected` decisions for package selection, measurements, and pins.
- Review rules live in `src/lib/submissions/review.ts`. Keep all review-state rules centralized there. It covers normalization, resolved display values, decision counting, row keys, corrections, attention, bulk eligibility, dirty detection and the next pending row.
- Filter rules live in `src/lib/submissions/review-filters.ts`: `ReviewFilter`, `matchesReviewFilter`, `pinMatchesQuery`, `computeVisibleRows` and `createAttentionContextResolver`. The filters are all, pending, needs attention, incorrect, differs from baseline (re-runs) and runs disagree (baselines with runs).
- Evidence page helpers live in `src/lib/submissions/evidence.ts`: normalizing and formatting pages, the primary page, pin grouping by page above `PIN_GROUP_THRESHOLD` pins, and page references in AI notes. Evidence pages are 1-based physical page indexes of the PDF.
- The review surface is the workspace in `src/components/review/`, rendered by `/submissions/[submissionId]` and by the fixtures on `/preview/review`. Network calls go through `review-services.ts`, so the fixtures can stub them. There is no live post-submit editor.
- `src/components/review/types.ts` holds UI contracts only. `workspace-model.ts` holds display-only derivations. Neither may define review rules.
- Modes (`getInitialReviewMode`): a pending baseline opens in edit mode. Reviewed baselines and every re-run open in read mode.
  - Read mode never mutates the draft. Bulk buttons are hidden, and the decision keys (C, X, Enter, U, Backspace) only show the hint "Press E to edit this review".
  - E enters edit mode.
- Saves are explicit, with no autosave. A correction enters the draft only when it is applied. Save sends `PATCH /api/submissions/[id]/review`.
- Dirty rule: `countChangedDecisions` counts rows whose normalized entry differs in any field (status, corrected values, `correctedStatus`, note). The draft is dirty when that count is above 0 or the reviewer notes differ (`isReviewDraftDirty`).
  - While dirty, a navigation-level guard offers Discard changes.
  - The draft is mirrored to `localStorage` under `review:draft:{submissionId}:{savedUpdatedAt}` (debounced 500 ms, cleared on Save and Discard). A mirror for the same `savedUpdatedAt` offers Restore on the next visit. Mirrors for older versions are deleted.
- Reviewer notes are capped at `REVIEWER_NOTES_MAX_LENGTH` (4000). The textarea and `submissionReviewPayloadSchema` share that constant.
- Bulk confirm eligibility (`isBulkConfirmEligible` and `planBulkConfirm`): the row must be pending, have high AI confidence (a missing confidence does not count) and have no attention reasons. A measurement must also have AI status "Extracted". Bulk confirm only covers visible rows and never overwrites confirmed or corrected rows.
- Attention reasons (`classifyRowAttention`, shown in `ATTENTION_REASONS` order): `differsFromBaseline`, `lowConfidence`, `aiUnsure`, `notFound`, `mediumConfidence`, `duplicatePinNumber`, `runsDisagree`, `needsReview` and `noEvidence`.
  - `runsDisagree` uses `runHintDisagrees`: at least one run, at least one mismatch, and mismatches × 2 ≥ runs. Partial matches never count.
  - `noEvidence` is only raised when the extraction records evidence pages somewhere, so legacy extractions are not flagged on every row.
- Legacy `correctedStatus`: `buildSubmissionResolvedView` derives a missing `correctedStatus` on read with `deriveCorrectedMeasurementStatus`, the same rule `applyCorrection` uses for new corrections.
  - A correction to `NOT_FOUND_VALUE` ("Not found in datasheet") resolves to "Not found".
  - A corrected value on a field the AI did not mark "Extracted" resolves to "Extracted".
  - Otherwise the AI status stands.
  - This intentionally changed accuracy and agreement for some legacy reviews, and the Reports definitions say so.

## AI Provider Configuration

- The OpenAI model allowlist, list pricing, and supported reasoning efforts live in `src/lib/ai/models.ts`. It is imported by client components, so keep it free of server-only code and SDK imports.
- Server defaults come from `OPENAI_MODEL` and `OPENAI_REASONING_EFFORT` and are resolved in `src/lib/ai/settings.ts`. Route handlers must validate any requested model or effort through `resolveExtractionSettings` before calling the provider.
- `ProviderMeta` carries optional run metadata (effort, usage, latency, estimated cost, response id). Older submissions only have `model` and `provider`, so treat the extra fields as optional everywhere.
- Display formatting for provider metadata lives in `src/lib/ai/provider-meta.ts` (`formatUsd`, `formatTokenCount`, `formatLatency`, `formatRunLabel`, `formatModelShortLabel` and related helpers) and in the shared `ProviderRunMeta` component. Generic date, byte and duration formatting lives in `src/lib/format.ts`. Do not format token counts, costs or dates ad hoc in pages. `formatUsd` shows two decimals at $0.10 and above, three from $0.01, and four below.
- The extraction prompt defines evidence pages as 1-based physical page indexes of the PDF file, not printed page labels (`src/lib/ai/openai-provider.ts`). The PDF pane's `#page=N` links depend on this.
- Per-model aggregates come from `summarizeModelRuns` in `src/lib/submissions/model-stats.ts`, including average, median and p90 latency (`percentile`, linear interpolation). Extend that helper rather than reducing over submissions inside components.
- Reports aggregates live in `src/lib/submissions/reports.ts`: the overview, accuracy distribution, cost versus agreement, leaderboard sort, agreement matrix, field correction rates and filter options. `buildReports` composes them. The Reports leaderboard must match `summarizeModelRuns` for the same scope.
- Re-runs are ordinary submissions with a stored `comparison.baselineSubmissionId` that points at the root baseline. Convert provider results with `buildExtractionSnapshot` in `src/lib/submissions/extraction-snapshot.ts` rather than mapping rows inline in routes.
- Re-runs of URL sources read the PDF cache first. With `contentSha256` they use the exact cached revision, then fall back to the vendor. Without it they use the vendor, then fall back to `legacy.pdf`. Vendor bytes are written through to the cache.
- Agreement against the baseline is computed on read in `src/lib/submissions/agreement.ts` and never persisted, so it always reflects the baseline's latest review.
  - Agreement rows carry `key`, `baselineIndex` and `rerunIndex`.
  - Map rows to re-run refs with `agreementRowToRerunRef` and `indexAgreementRowsByRerunKey`.
  - The baseline page's per-row hints come from `buildBaselineRunHints` and `describeRunHint` ("2 of 4 runs differ").
- `isScoredAgreement` is the one definition of a scored agreement: basis "reviewed" and a fully reviewed baseline. Use it (or `describeAgreementBasis`, which also returns the neutral text) everywhere a coloured agreement score is shown or aggregated: the review header, list ranges, the run switcher, the Model runs section, Reports, and "Confirm N matching the reviewed baseline" (`listMatchingPendingRefs`).
  - Unscored runs show neutral text: "vs unreviewed baseline", or "vs partly reviewed baseline (3 of 19)".

## PDF Access

- Link to a submission's PDF with `getSubmissionPdfHref` in `src/lib/submissions/source.ts`. It is client-safe. It returns `{ available, href, external }`, where `href` is `/api/submissions/{id}/pdf?page=N` and `external` is the vendor URL for URL sources.
- `GET /api/submissions/[id]/pdf` returns a 307 to a signed R2 URL. It adds `#page=N` for `?page=N` (1 to 10000), and `?download=1` signs a 5-minute attachment URL instead. An uncached URL source is fetched and cached lazily on first use.
- The review pane uses `resolvePdfViewer` from `src/lib/submissions/pdf-viewer.ts` on the server. It never fetches from vendors, so an uncached URL source returns `uncached`. The client then calls `POST /api/submissions/[id]/pdf/viewer`, which runs `ensurePdfViewerReady`, caches the PDF, and returns the ready state or `source-unreachable`.
- Viewer URLs come from `createObjectViewerUrl` in `src/lib/r2.ts`. The signing date is floored to the start of the UTC hour, and the URL expires 2 hours after that floor. Every render within an hour yields a byte-identical URL. The pane keeps its first ready URL and refreshes through `POST /pdf/viewer` only when fewer than 5 minutes remain.
- A ready state carries `revision: "extracted" | "latest-copy"`. For `latest-copy` the UI says the cached copy may differ from the one that was extracted.
- Never proxy PDF bytes through a function response. Uploads go straight to R2 with a presigned PUT, and reads are signed redirects or signed URLs.

## Testing

- `npm test` runs Vitest (`vitest.config.ts`, Node environment, `src/**/*.test.ts`).
- Tests are pure: no database, no network, no R2. Put rules in `src/lib` so they can be unit-tested, and add tests next to the helper you change.
- Verify changes with `npx tsc --noEmit -p tsconfig.json`, `npm run lint` and `npm test`.

## Route Map

- `/` is New extraction (intake only), in the `src/app/(intake)/` route group together with its loading skeleton. On success it hands off to the review page through the session-storage arrival key.
- `/submissions` is the Submissions list: baseline submissions with their model runs nested, plus search, category, status and sort. The list page lives in the `src/app/submissions/(list)/` route group so its loading state never wraps the review route.
- `/submissions/[submissionId]` is the review workspace for baselines and re-runs. Unknown or malformed ids answer with an HTTP 404: `layout.tsx` in that segment runs the lean `submissionExists` check and calls `notFound()` before the segment's `loading.tsx` starts streaming, and `src/app/submissions/not-found.tsx` renders the page and its title.
- HTTP status rule: once any `loading.tsx` or Suspense fallback above a component streams, the status is locked at 200 and `notFound()` can only render UI. Never add a `loading.tsx` at the app root (it would wrap every route); scope skeletons with route groups, and put existence checks that must return 404 in a layout above the route's `loading.tsx`.
- `/reports` holds all statistics: accuracy, agreement, model leaderboard, cost and latency, field correction rates, and the definitions of each number.
- `/preview` is the internal living style guide and `/preview/review` holds review fixtures. Neither is linked from navigation.
