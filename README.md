# AI Datasheet Extractor

Internal tool for extracting package data (package selection, measurements and pins) from component datasheets with OpenAI models, then checking every value against the datasheet. Each extraction is saved as a submission. The AI output is kept unchanged, and a reviewer confirms or corrects each value in a separate review layer. The same datasheet can be re-run with other models to compare them.

## Environment

Create `.env.local` with:

```bash
OPENAI_API_KEY=...
MONGODB_URI=...

# Cloudflare R2: uploads, retained PDFs and the URL-source cache.
R2_ACCOUNT_ID=...
R2_ACCESS_KEY_ID=...
R2_SECRET_ACCESS_KEY=...
R2_BUCKET_NAME=...

# Optional. Defaults shown. Values must be in the allowlist in src/lib/ai/models.ts.
OPENAI_MODEL=gpt-5.6-terra
OPENAI_REASONING_EFFORT=high

# HTTP Basic login as username:password. Optional locally; required on Vercel Production.
APP_BASIC_AUTH=...
```

`MONGODB_URI` must include the target database name. The app uses the native MongoDB driver and stores submissions in the `datasheet_submissions` collection.

`APP_BASIC_AUTH` (`username:password`) gates the whole app with an HTTP Basic login. `src/proxy.ts` checks it on every page and API request, so the browser asks for the login when the app first loads, and the mutating route handlers check it again as the authoritative gate. The gate is opt-in: when the variable is unset the app is open, exactly as before. The production domain is public, so setting it in Vercel (Production and Preview) is strongly recommended.

`OPENAI_MODEL` and `OPENAI_REASONING_EFFORT` set the defaults preselected on the New extraction page. Each request can override them, and the server validates the chosen values against the allowlist. High effort is the default because the September 2026 bake-off showed it matched reviewed values better than medium at the same cost.

## Commands

```bash
npm install
npm run dev     # http://localhost:3000
npm run lint
npm test        # Vitest unit tests
npm run build
```

Type-check with `npx tsc --noEmit -p tsconfig.json`.

## Primary Routes

| Route | Page |
| --- | --- |
| `/` | New extraction: upload a PDF or paste a link, choose a package category and model, and extract. On success it opens the review page. |
| `/submissions` | Submissions: one row per datasheet (baseline extraction) with its model runs nested, plus search, category, status (all, needs review, reviewed) and sort (recent activity, newest, part number, most pending). |
| `/submissions/[submissionId]` | The review workspace for a baseline or a re-run. |
| `/reports` | Statistics: overview, accuracy, model leaderboard, cost and latency, agreement by datasheet, the fields the AI gets wrong most, and how each number is defined. Filters for range, model, effort, category and datasheet. |
| `/preview`, `/preview/review` | Internal style guide and review fixtures. Not linked from navigation. |

## Architecture

### Persistence model

Each successful extraction is saved as one submission document with:

- An intake snapshot: part number, package category, requested fields and the source (an uploaded file or a normalized URL).
- An immutable extraction snapshot: package selection, measurements, pins, AI notes, evidence pages and provider metadata (model, effort, token usage, latency, estimated cost, response id).
- A human review layer: reviewer notes, plus a `pending | confirmed | corrected` decision for the package selection, each measurement and each pin.
- Lifecycle fields: `createdAt`, `updatedAt`, `reviewedAt` and `reviewStatus`.
- For re-runs, `comparison.baselineSubmissionId`, which points at the baseline.

Uploaded PDFs are kept in R2 under the submission, and URL sources are cached in R2 (see [Datasheet PDFs](#datasheet-pdfs)).

### Code structure

- `src/app/`: routes. Loading skeletons are scoped with route groups (`(intake)/` for New extraction, `submissions/(list)/` for the list) so no skeleton wraps the review route, whose `layout.tsx` checks the submission exists and returns a real 404 for unknown ids. Route handlers are under `src/app/api/`.
- `src/components/ui/`: shared primitives (buttons, form controls, dialog and sheet, menu, popover, tooltip, toasts, table, badges and more), exported from `index.ts`. `/preview` shows each one.
- `src/components/*.tsx`: the app shell and shared app components: the collapsible icon-rail sidebar and the mobile nav, `AppLink`, the navigation guard provider, the background task provider, the delete dialog and the status, score and run badges.
- `src/components/intake/`: the New extraction form, upload and URL validation, progress, duplicate notice and recent extractions.
- `src/components/submissions/`: the Submissions list, toolbar and row menus.
- `src/components/review/`: the review workspace (see below).
- `src/components/reports/`: the Reports sections and charts.
- `src/lib/submissions/`: types, the Mongo repository and pure rules:
  - `review.ts`: review normalization, resolved values, decision counts, corrections, attention reasons, bulk eligibility and dirty detection.
  - `review-filters.ts`: the review list filters and pin search.
  - `agreement.ts`: re-run agreement against the baseline and the baseline's per-row run hints.
  - `evidence.ts`: evidence page helpers and pin grouping by page.
  - `score.ts`: the shared score thresholds.
  - `model-stats.ts` and `reports.ts`: per-model and Reports aggregates.
  - `list-query.ts`: the Submissions list query string.
  - `source.ts`: client-safe source helpers, including `getSubmissionPdfHref`.
  - `pdf-viewer.ts`: server-side resolution of the embedded PDF viewer.
- `src/lib/ai/`: the model allowlist and pricing, settings, the OpenAI provider and run metadata formatting.
- `src/lib/format.ts`: date, byte and duration formatting.
- `src/lib/r2.ts` and `src/lib/pdf-cache.ts`: R2 access and the URL-source PDF cache.
- `src/lib/mongodb.ts`: the cached Mongo client.

`AGENTS.md` has the detailed conventions for contributors and coding agents.

### AI model configuration

- `src/lib/ai/models.ts` is the client-safe allowlist of OpenAI models with labels, list pricing and the reasoning efforts each one accepts. Add or retire models there.
- `src/lib/ai/settings.ts` resolves the server defaults from the environment and validates per-request overrides.
- `src/lib/ai/openai-provider.ts` calls the Responses API with a hard 240-second deadline and records token usage, latency, response id and an estimated cost in `providerMeta`. The prompt defines evidence pages as 1-based physical page indexes of the PDF, which the datasheet pane's page links rely on.

## Review behaviour

The AI extraction is never changed after it is saved. Reviewer decisions only update the review layer, and the displayed value overlays confirmed or corrected decisions on the saved extraction.

The review page is one continuous list of the package selection, measurements and pins, next to the datasheet. On wide screens the datasheet is a pane that can follow the active row's evidence page. On narrower screens it opens as a sheet.

- **Modes.** A pending baseline opens in edit mode. Reviewed baselines and all re-runs open in read mode, which never changes anything; press E or choose Edit review to start editing.
- **Explicit save.** Nothing is saved until you choose Save (or press ⌘S / Ctrl+S). A correction only enters the draft when you apply it. Undo covers the last 50 changes.
- **Leaving with unsaved changes.** While the draft has unsaved changes, in-app links and the browser Back button ask before leaving and offer Discard changes. Closing the tab shows the browser's own warning. The draft is also mirrored to `localStorage`, so after a crash or a closed tab the next visit offers to restore it.
- **Attention.** Rows are flagged when they differ from the baseline (re-runs), have low or medium AI confidence, the AI was unsure or did not find the value, a pin number is duplicated, at least half the re-runs disagree (baselines), the AI flagged the row, or there is no evidence page.
- **Filters and search.** All, Pending, Needs attention, Incorrect, Differs from baseline (re-runs) and Runs disagree (baselines with runs). Pins can be searched by number or name.
- **Bulk confirm.** "Confirm N high-confidence" confirms only visible pending rows with high AI confidence and no attention reasons (and, for measurements, an AI status of Extracted). It never overwrites confirmed or corrected rows, and the toast offers Undo. On a re-run against a fully reviewed baseline, "Confirm N matching the reviewed baseline" confirms pending rows that match it.
- **Finishing.** The save that clears the last pending row shows a summary with a link to the next submission that needs review.

### Keyboard shortcuts

Shortcuts work in the review list and when nothing is focused. They are ignored while typing (except ⌘S), inside menus and popovers, while a dialog is open, and inside the datasheet pane. Press ? on the review page to see them.

| Keys | Action |
| --- | --- |
| J or ↓ | Next row |
| K or ↑ | Previous row |
| C or Enter | Confirm |
| X | Incorrect: open the correction |
| U or Backspace | Back to pending |
| N / Shift+N | Next / previous pending row |
| [ / ] | Previous / next evidence page |
| P | Show the datasheet at this row |
| / | Find pin |
| E | Edit review (in read mode) |
| ⌘S / Ctrl+S | Save |
| ⌘Z / Ctrl+Z | Undo |
| Esc | Close the correction or search |
| ? | Show the shortcuts |

In read mode, C, X, Enter, U and Backspace only show the hint "Press E to edit this review". The ? dialog also has the auto-advance setting, which moves to the next pending row after C, Enter or ⌘Enter / Ctrl+Enter.

## Model comparison (re-runs)

- A datasheet can be re-run with another model and effort from the review page ("Run another model…") or from the duplicate notice on the New extraction page. `POST /api/submissions/[submissionId]/rerun` reuses the stored PDF and the original intake snapshot, then saves a new submission whose `comparison.baselineSubmissionId` points at the baseline.
- Re-runs happen in the background: up to three at a time. They keep running while you move around the app, show a running chip and toasts, and can be retried if they fail. They cannot be cancelled. Closing the tab while one runs shows the browser's leave warning.
- `src/lib/submissions/agreement.ts` scores a re-run against the baseline. Once the baseline has confirmed or corrected decisions, only those rows count and the reviewed values are the reference. Before that, every row is compared against the baseline's raw AI output. Measurements match on the set of numbers they contain, and names on normalized identifiers.
- Agreement is computed on read, so reviewing the baseline later updates every re-run's score. A coloured agreement score is shown only when the baseline is fully reviewed. Otherwise the app shows neutral text such as "vs unreviewed baseline" or "vs partly reviewed baseline (3 of 19)".
- Agreement appears inline: in the re-run's review header and row markers, in the run switcher, and in the Model runs section on both baseline and re-run pages. Baseline rows show hints such as "2 of 4 runs differ".
- Reports compares models across datasheets (runs, reviewed accuracy, agreement, median latency, cost) and explains each definition on the page.

## Datasheet PDFs

PDFs are stored in Cloudflare R2. The app never streams PDF bytes through its own responses: uploads go straight to R2 with a presigned PUT, and reads are signed redirects or signed URLs.

| Prefix | Contents | Deleted when |
| --- | --- | --- |
| `datasheets/pending/{uuid}/{file}` | Uploads waiting for extraction. | Moved under the submission prefix on success. Kept after a model-side failure so "Try again" does not re-upload. Abandoned objects expire through the bucket lifecycle rule. |
| `datasheets/submissions/{submissionId}/{file}` | The retained upload for each submission. Re-runs copy it to their own key. | When the submission is deleted (best-effort, after the database delete). |
| `datasheets/url-cache/{sha256(url)}/{contentSha256}.pdf` | The exact bytes extracted from a URL source. | Never. Shared by every submission of that URL. |
| `datasheets/url-cache/{sha256(url)}/legacy.pdf` | A later vendor copy for older URL submissions that have no content hash, or whose exact copy is missing. | Never. |

- **Caching URL sources.** A URL extraction records the SHA-256 of the extracted bytes and caches them after the response is sent. Older URL submissions are cached lazily the first time someone opens the PDF. Re-runs read the cache first when they have the exact revision, and write vendor bytes through to the cache.
- **Bucket lifecycle.** Configure the R2 expiry rule on `datasheets/pending/` only. Never expire `datasheets/submissions/` or `datasheets/url-cache/`: those are the only saved copies.
- **Opening PDFs.** Links use `/api/submissions/[id]/pdf?page=N`, which redirects to a signed R2 URL at that page (`?download=1` downloads it). The embedded viewer uses URLs signed at the start of the UTC hour and valid for two hours, so the frame stays cached, and refreshes them shortly before they expire.
- **Rotted links.** Once a URL source is cached, it keeps working even if the vendor moves or deletes the file. If an older submission was never cached and the vendor no longer serves the PDF, the pane says it couldn't load the datasheet and offers Try again and Open original. When only a later vendor copy is available, the app says the cached copy may differ from the one that was extracted. Uploads from before PDFs were retained show that the PDF wasn't kept for that submission.

## Database indexes

The indexes for `datasheet_submissions` are defined in `src/lib/submissions/indexes.ts` (the review queue, re-runs by baseline, and newest first). The app never creates them itself, because `MONGODB_URI` points at production. Apply them once, deliberately:

```bash
node --env-file=.env.local scripts/ensure-submission-indexes.ts           # dry run: lists the indexes
node --env-file=.env.local scripts/ensure-submission-indexes.ts --apply   # creates them
```

The script runs under Node's native TypeScript support (Node 22.18 or later). Creating the indexes is idempotent, so re-running it after a change to `indexes.ts` only adds what is missing. An index whose options changed under the same name must be dropped by hand first.

## Testing

`npm test` runs Vitest over `src/**/*.test.ts` in a Node environment. Tests are pure: no database, network or R2. Review, agreement, filter, evidence, score, report and formatting rules live in `src/lib` so they can be unit-tested.

## Notes for future changes

- Reuse the submission types in `src/lib/submissions/types.ts` and the helpers in `src/lib/submissions` instead of creating parallel shapes in pages or components.
- Server Components read from the repository directly. Only mutations go through route handlers.
- If the review model changes, update the Zod schema in `src/lib/submissions/schemas.ts`, the rules in `review.ts` and the review workspace together.
