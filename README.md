# Vibe Chords

A free, non-commercial guitar chord progression app built with Next.js, TypeScript, Tailwind CSS, and local Ollama inference.

## Features

- Generates guitar chord progressions from mood-based "vibes"
- Local LLM inference via Ollama — no API keys, no hosted providers
- Audio playback with Tone.js
- Animated chord diagrams with GSAP
- VexChords / VexTab notation rendering

## Quick start

```sh
npm ci
cp .env.example .env.local
npm run dev
```

Then open [http://localhost:3000](http://localhost:3000).

## Prerequisites

- [Node.js](https://nodejs.org) 22 or newer
- [Ollama](https://ollama.com) running locally with a model pulled (e.g. `ollama pull qwen2.5:1.5b`)

## Configuration

Copy `.env.example` to `.env.local` and adjust the two variables:

| Variable | Default | Purpose |
| --- | --- | --- |
| `OLLAMA_BASE_URL` | `http://127.0.0.1:11434` | Local Ollama endpoint |
| `OLLAMA_MODEL` | `qwen2.5:1.5b` | Model tag for inference |

Only local HTTP endpoints are accepted. Cloud model tags and credentials are rejected.

## Development commands

| Command | Purpose |
| --- | --- |
| `npm run dev` | Start the Next.js development server |
| `npm run build` | Compile the production app |
| `npm run start` | Serve the compiled production app |
| `npm run lint` | Run ESLint |
| `npm run test` | Run unit and component tests |
| `npm run typecheck` | Generate route types and check TypeScript |
| `npm run eval:models` | Evaluate installed candidate models |

## Project structure

```
app/          Next.js App Router pages
components/   React components
lib/          Core logic (voicings, progression, vibe selection, local model)
evals/        Model evaluation framework
tests/        Unit and component tests
```

## Architecture notes

App Router pages are Server Components by default. Server configuration and Ollama adapters live in `lib/server/` with `import "server-only"`. Browser adapters live in `lib/client/` with `import "client-only"`. Client Components use `"use client"` and access browser APIs in effects or event handlers.

The browser posts known vibe IDs to the server. The server limits each model request to one bounded generation, validates 3–6 chord symbols, and supplies trusted local voicings and audio. No environment value uses a `NEXT_PUBLIC_` prefix.

## Alternative: Docker with Tilt

The repository includes a `Tiltfile` and Docker Compose files for containerized development. This setup is optional — the quick start above is the simplest path.

### Prerequisites

- [Tilt](https://docs.tilt.dev) installed
- Docker with Docker Compose 2.24.4 or newer
- A running Docker daemon

### Usage

```sh
# Use a locally running native Ollama (default)
tilt up

# Or run both the app and Ollama in containers
tilt up -- --runtime=container
```

Open [http://localhost:3000](http://localhost:3000) and the Tilt dashboard URL printed by Tilt.

To stop:

```sh
tilt down -- --runtime=native
# or
tilt down -- --runtime=container
```

See the [Tilt Compose guide](https://docs.tilt.dev/docker_compose.html) and [Ollama API documentation](https://docs.ollama.com/api) for more details.

## License

MIT — see [LICENSE](LICENSE).
