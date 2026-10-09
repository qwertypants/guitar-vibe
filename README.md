# Vibe Chords

A free, non-commercial guitar chord progression app. This baseline provides
the Next.js App Router, strict TypeScript, Tailwind CSS, and test tooling.
Product requirements are in [the spec](docs/vibe-chords-spec.md).

## Local development

Use Node.js 22.22.2 or a compatible version listed in `package.json`. The
`.nvmrc` pins the supported Node 22 version. Install the locked dependencies:

```sh
npm ci
npm run dev
```

Open http://localhost:3000. The baseline starts without any credentials.
Development and production builds use Next.js's supported Webpack compiler.
Turbopack's CSS compiler requires a local worker port that this sandbox blocks.
Next.js's automatic agent-rule writing is disabled so running the app does
not rewrite the repository's existing `AGENTS.md`.
To enable progression generation, copy `.env.example` to `.env.local` and set
`OPENROUTER_API_KEY` from your OpenRouter account. `OPENROUTER_MODEL` defaults
to `openai/gpt-6-luna` and can be changed to another OpenRouter model ID.
Keep `.env.local` private. Only the empty `.env.example` is versioned. Without
the key, the app still loads, but generation returns a setup message.

## Commands

| Command | Purpose |
| --- | --- |
| `npm run dev` | Start the Next.js development server |
| `npm run lint` | Run ESLint with the Next.js and TypeScript rules |
| `npm run test` | Run unit and component tests once |
| `npm run test:watch` | Run tests while developing |
| `npm run typecheck` | Generate Next.js route types and check strict TypeScript |
| `npm run build` | Compile the production app and check its types |
| `npm run start` | Serve the compiled production app |

Run lint, tests, typecheck, and build before handing off a change. Browser
end-to-end tooling and `test:e2e` will be added with the core flow in Task 7.

## Server and client boundaries

- App Router pages and layouts are Server Components by default. Keep
  `app/layout.tsx` and `app/page.tsx` on the server; compose interactive
  components into them as needed.
- Put credential access and provider adapters in `lib/server/`. Every module
  in that directory must start with `import "server-only";`. The installed
  marker makes Next.js reject an import into a client component at build time.
  Read environment variables inside server functions so page builds do not
  need provider credentials.
- Put browser-only adapters in `lib/client/`. Start them with
  `import "client-only";`.
  Interactive components use `.client.tsx` names and start with `"use client";`.
  Access browser APIs in effects or event handlers, since Client Components
  may also render on the server.
- Shared typed data and pure helpers can live directly in `lib/`. Keep them
  free of environment reads, provider imports, browser APIs, and side effects.
- Client code calls server routes with serializable data. Credentials never
  use a `NEXT_PUBLIC_` prefix and never appear in client props or responses.

Progression generation uses the OpenRouter provider for the Vercel AI SDK.
The browser submits selected catalog IDs; the server maps those IDs to labels,
requests structured chord symbols, and resolves every chord against local
supported guitar voicings before returning it.

Vitest uses React Testing Library and jsdom for synchronous component tests.
Pure domain tests can select the Node environment with
`// @vitest-environment node`. Test asynchronous Server Components through
the browser flow once end-to-end tooling is added.

## Tooling references

The baseline follows the official [Next.js installation guide](https://nextjs.org/docs/app/getting-started/installation),
[Next.js ESLint guide](https://nextjs.org/docs/app/api-reference/config/eslint),
[Next.js Vitest guide](https://nextjs.org/docs/app/guides/testing/vitest),
and [Tailwind Next.js guide](https://tailwindcss.com/docs/installation/framework-guides/nextjs).
The boundary convention follows [Next.js Server and Client Components](https://nextjs.org/docs/app/getting-started/server-and-client-components).
Tests resolve the shared `@/*` alias through [Vite's native TypeScript paths support](https://vite.dev/config/shared-options#resolve-tsconfigpaths).
The generation integration follows OpenRouter's [Vercel AI SDK provider guide](https://openrouter.ai/docs/guides/community/frameworks-and-integrations-overview)
and the AI SDK's [structured output guide](https://ai-sdk.dev/docs/ai-sdk-core/generating-structured-data).
