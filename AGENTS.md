<!-- BEGIN:nextjs-agent-rules -->
# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.
<!-- END:nextjs-agent-rules -->

## Cursor Cloud specific instructions

This is a single Next.js 16 (App Router) application using React 19, Tailwind CSS v4, and TypeScript. There is no database, no external API, and no test framework configured.

**Key commands** (all via `npm`; see `package.json` scripts):
- `npm run dev` — starts Turbopack dev server on port 3000
- `npm run build` — production build
- `npm run lint` — runs ESLint (eslint-config-next with core-web-vitals + TypeScript rules)

**Notes:**
- The `main` branch contains only a `README.md`. All application code lives on branches forked from `copilot/init-nextjs-repo-and-add-skills`.
- No `.env` file or secrets are required.
- No automated tests exist yet; lint is the only code-quality check.
