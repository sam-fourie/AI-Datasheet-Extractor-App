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

## Route Map

- `/` is the intake workbench.
- `/submissions` is the persisted submission archive and review queue.
- `/submissions/[submissionId]` is the detailed review page.
- `/preview` remains an internal UI sandbox and is not part of the primary workflow.
