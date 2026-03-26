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
