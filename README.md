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

## GitHub Pages

The Pages version runs entirely in the browser. It uses the same trusted musical
rules as the local model's fallback, with Familiar, Richer, and Adventurous
variations. It does not call Ollama or require a backend. Repeating a generation
with the same settings produces the same progression.

Saved vibes use localStorage on the current browser and device. Clearing site
data removes them. They do not sync across devices or import the local app's
SQLite library. If browser storage is blocked, full, or damaged, the app reports
an error and does not overwrite the existing saved data.

Build the static site with:

```sh
npm ci
npm run build:pages
```

The result is `out/`, configured for `/guitar-vibe/`. The script builds in a
temporary directory without API routes and removes that directory afterward.
The existing `npm run dev`, `npm run build`, `npm run start`, Docker, and Pi
workflows continue to use Ollama and SQLite.

To preview the repository path locally:

```sh
preview_dir=$(mktemp -d)
ln -s "$PWD/out" "$preview_dir/guitar-vibe"
python3 -m http.server 4173 --bind 127.0.0.1 --directory "$preview_dir"
```

Open [http://127.0.0.1:4173/guitar-vibe/](http://127.0.0.1:4173/guitar-vibe/).

To publish, set **Settings > Pages > Build and deployment > Source** to
**GitHub Actions** in `qwertypants/guitar-vibe`. After the workflow is committed
and pushed to `main`, it runs the required checks, verifies both builds, and
publishes to [qwertypants.github.io/guitar-vibe](https://qwertypants.github.io/guitar-vibe/).
Pull requests run checks and builds without deploying. You can also run the
**GitHub Pages** workflow manually on `main`. Repository visibility and your
GitHub plan must permit Pages hosting.

Only the deploy job has Pages write and OIDC permissions. No API keys or database
files are included in the artifact. To roll back, revert the relevant change on
`main` and let the workflow publish the previous behavior again.

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
