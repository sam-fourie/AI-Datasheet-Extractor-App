# AI Datasheet Extractor

Internal workflow for staging datasheet extraction requests, persisting the full submission metadata, and reviewing AI output with a human correction layer.

## Environment

Create `.env.local` with:

```bash
OPENAI_API_KEY=...
MONGODB_URI=...
```

`MONGODB_URI` must include the target database name. The app uses the native MongoDB driver and stores submissions in the `datasheet_submissions` collection.

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

### Review behavior

The original AI extraction is never mutated after persistence. Reviewer edits only update the human review layer. The UI resolves the current display value by overlaying confirmed or corrected review decisions on top of the immutable extraction snapshot.

## Notes For Future Changes

- Reuse the submission types and review helpers instead of creating parallel JSON shapes in pages or components.
- Keep list/detail pages fetching directly from the repository in Server Components. Only mutations should go through route handlers.
- If the review model changes, update the Zod schema in `src/lib/submissions/schemas.ts`, the normalization helpers, and the shared editor together.
