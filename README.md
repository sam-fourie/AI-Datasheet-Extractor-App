# AI Datasheet Extractor

Internal workflow for staging datasheet extraction requests, persisting the full submission metadata, and reviewing AI output with a human correction layer.

## Environment

Create `.env.local` with:

```bash
OPENAI_API_KEY=...
MONGODB_URI=...

# Optional. Defaults shown. Values must be in the allowlist in src/lib/ai/models.ts.
OPENAI_MODEL=gpt-5.6-terra
OPENAI_REASONING_EFFORT=medium
```

`MONGODB_URI` must include the target database name. The app uses the native MongoDB driver and stores submissions in the `datasheet_submissions` collection.

`OPENAI_MODEL` and `OPENAI_REASONING_EFFORT` set the defaults preselected on the intake workbench. Each request can override them from the form, and the chosen values are validated against the allowlist on the server.

## Commands

```bash
npm install
npm run dev
npm run lint
npm run build
```

## Primary Routes

- `/`: intake workbench for new extraction submissions
- `/submissions`: persisted submission history and review queue
- `/submissions/[submissionId]`: detailed review page for one saved submission
- `/preview`: internal UI foundation route

## Architecture

### Persistence model

Each successful extraction is persisted as a submission document with:

- intake snapshot: part number, package category, requested fields, source mode, source label, and normalized source metadata
- immutable extraction snapshot: fields, pins, package selection, provider metadata, and AI review notes
- human review layer: reviewer notes plus package, measurement, and pin decisions using `pending | confirmed | corrected`
- submission lifecycle metadata: `createdAt`, `updatedAt`, `reviewedAt`, and submission-level `reviewStatus`

Uploaded PDFs store metadata only in v1: file name, MIME type, byte size, and SHA-256 checksum. URL submissions store the normalized URL and resolved PDF file name. Raw PDF bytes are not retained after extraction.

### Code structure

- `src/lib/submissions/types.ts`: shared persisted submission and review types
- `src/lib/submissions/review.ts`: normalization, decision counting, and resolved-view helpers
- `src/lib/submissions/repository.ts`: Mongo-backed submission repository
- `src/lib/mongodb.ts`: cached Mongo client bootstrap
- `src/components/submission-review-editor.tsx`: shared review UI used by both the live result and saved detail page

### AI model configuration

- `src/lib/ai/models.ts` is the client-safe allowlist of OpenAI models with labels, list pricing, and the reasoning efforts each one accepts. Add or retire models there.
- `src/lib/ai/settings.ts` resolves the server defaults from the environment and validates per-request overrides.
- `src/lib/ai/openai-provider.ts` calls the Responses API with a hard 240 second deadline and records token usage, latency, response id, and an estimated cost in `providerMeta`.
- Every submission shows its model, effort, token counts, latency, and estimated cost, which is the basis for comparing models against the review accuracy score.

### Model comparison (re-runs)

- The detail page can re-run a datasheet with another model via `POST /api/submissions/[submissionId]/rerun`. The route reuses the stored PDF (copied to a new object key for uploads, fetched again for URL sources) and the original intake snapshot, then saves a new submission with `comparison.baselineSubmissionId` pointing at the root baseline.
- `src/lib/submissions/agreement.ts` scores a re-run against the baseline. Once the baseline has confirmed or corrected decisions, only those rows count and the reviewed values are the reference; before that, every row is compared against the baseline's raw AI output. Measurements match on the set of numbers they contain, names on normalised identifiers.
- Agreement is computed on read, so reviewing the baseline later updates every re-run's score. Deleting a baseline leaves its re-runs with no comparison.
- The archive groups submissions per model and effort in a model performance table (runs, reviewed accuracy, agreement, latency, cost) built by `src/lib/submissions/model-stats.ts`, and can be filtered by model or narrowed to baselines only.

### Review behavior

The original AI extraction is never mutated after persistence. Reviewer edits only update the human review layer. The UI resolves the current display value by overlaying confirmed or corrected review decisions on top of the immutable extraction snapshot.

## Notes For Future Changes

- Reuse the submission types and review helpers instead of creating parallel JSON shapes in pages or components.
- Keep list/detail pages fetching directly from the repository in Server Components. Only mutations should go through route handlers.
- If the review model changes, update the Zod schema in `src/lib/submissions/schemas.ts`, the normalization helpers, and the shared editor together.
