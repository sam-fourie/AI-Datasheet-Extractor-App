<!-- BEGIN:nextjs-agent-rules -->
# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.
<!-- END:nextjs-agent-rules -->

## UI System Conventions

- Theme tokens live in `src/app/globals.css` and should be extended there before hard-coding new colors, radii, or shadows in components.
- Shared app primitives live in `src/components/ui`; use those first for buttons, fields, labels, cards, and standard form controls.
- Keep the visual direction Apple-like: neutral palette, restrained blue accent, subtle borders, soft shadows, and clean spacing.
- Avoid loud gradients, purple-heavy palettes, and heavy depth effects unless a specific screen clearly needs them.
- Prefer native controls and server-safe components by default. Only introduce client components when a browser API or real client state is required.

## Submission Persistence Architecture

- Successful extraction requests are persisted in MongoDB using `MONGODB_URI`. The collection name is `datasheet_submissions`.
- Shared persisted submission types live in `src/lib/submissions/types.ts`. Reuse those types instead of creating duplicate response shapes in components or routes.
- Mongo connection setup lives in `src/lib/mongodb.ts`, and server-side data access belongs in `src/lib/submissions/repository.ts`.
- Server Components should read submissions directly from the repository. Mutations belong in route handlers, not in ad hoc client-side data layers.

## Review Model

- The stored AI extraction snapshot is immutable once saved.
- Human edits are stored as a separate review overlay with `pending | confirmed | corrected` decisions for package selection, measurements, and pins.
- Review normalization, resolved display values, and decision counting live in `src/lib/submissions/review.ts`. Keep all review-state rules centralized there.
- The shared review UI lives in `src/components/submission-review-editor.tsx` and is used by both the live post-submit result and the persisted submission detail page. Keep those workflows on the same editor rather than forking the review behavior.

## AI Provider Configuration

- The OpenAI model allowlist, list pricing, and supported reasoning efforts live in `src/lib/ai/models.ts`. It is imported by client components, so keep it free of server-only code and SDK imports.
- Server defaults come from `OPENAI_MODEL` and `OPENAI_REASONING_EFFORT` and are resolved in `src/lib/ai/settings.ts`. Route handlers must validate any requested model or effort through `resolveExtractionSettings` before calling the provider.
- `ProviderMeta` carries optional run metadata (effort, usage, latency, estimated cost, response id). Older submissions only have `model` and `provider`, so treat the extra fields as optional everywhere.
- Display formatting for provider metadata lives in `src/lib/ai/provider-meta.ts` and the shared `src/components/provider-run-pills.tsx` component. Do not format token counts or costs ad hoc in pages.
- Per-model aggregates for the archive come from `summarizeModelRuns` in `src/lib/submissions/model-stats.ts`; extend that helper rather than reducing over submissions inside components.
- Re-runs are ordinary submissions with a stored `comparison.baselineSubmissionId`. Agreement against the baseline is computed on read in `src/lib/submissions/agreement.ts` and never persisted, so it always reflects the baseline's latest review. Convert provider results with `buildExtractionSnapshot` in `src/lib/submissions/extraction-snapshot.ts` rather than mapping rows inline in routes.

## Route Map

- `/` is the intake workbench.
- `/submissions` is the persisted submission archive and review queue.
- `/submissions/[submissionId]` is the detailed review page.
- `/preview` remains an internal UI sandbox and is not part of the primary workflow.
