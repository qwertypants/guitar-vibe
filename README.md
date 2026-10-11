# Vibe Chords

A free, non-commercial guitar chord progression app built with Next.js, strict
TypeScript, Tailwind CSS and local Ollama inference. The browser submits catalog
vibe IDs; the server asks for chord symbols and resolves them against supported
local guitar voicings. No hosted provider or API key is required.

## Local development with Tilt

Prerequisites are Tilt, Docker with Docker Compose 2.24.4 or newer, and a running
Docker daemon. The images pin Node.js 22.22.2 and Ollama 0.40.2. The first image
build installs the locked npm dependencies. This can require internet access.
Tilt does not install system tools.

On this Mac, the default uses an already installed and running native Ollama:

```sh
tilt up
# Explicit equivalent:
tilt up -- --runtime=native
```

Native Ollama is a prerequisite that you manage separately. It must be reachable
from Docker Desktop at `http://host.docker.internal:11434`. Check this path if
model setup fails. Tilt never starts, stops or reconfigures your native server.
Native inference can use the Mac's Metal acceleration; the container option
uses the Linux runtime and does not provide macOS Metal acceleration.

To run both the app and Ollama in containers:

```sh
tilt up -- --runtime=container
```

Open [the app](http://localhost:3000) and the Tilt dashboard URL printed by Tilt.
The app port binds only to `127.0.0.1`. Override it before starting Tilt with
`APP_PORT=3100 tilt up`. Container Ollama has no published host port. Its models
persist in the named `guitar-vibe-dev_ollama-models` volume.

The `model-prepare` resource checks readiness for up to 60 seconds and verifies
the selected model. If it is missing, the job pulls it with a 15-minute download
deadline and verifies it again. The app waits for this job to succeed. The first
model download requires internet access and disk space. Once images,
dependencies and weights are present, ordinary inference runs offline. Requests
never download models or fall back to a hosted service.

The provisional inference model is `qwen2.5:1.5b`. It is not a measured winner
yet. Override it for setup and inference with an explicit local tag:

```sh
OLLAMA_MODEL=qwen2.5:0.5b-instruct-q4_K_M tilt up
```

Model weights use native Ollama storage in native mode, or the named model volume
in container mode. Allow memory for the model plus Docker and the Next.js server.
Larger models can exhaust Docker's memory allocation or exceed the inference
request's 30-second deadline. Increase resources only after measuring the model
on your machine.

Source directories mount into the app for Next.js reloads. Package or root config
changes require an image rebuild or a Tilt restart. The Docker build context uses
an allowlist and excludes credentials, `.git`, dependency directories, worktrees,
benchmark output and local scratch. Compose does not load `.env.local` into the
container; use the documented `OLLAMA_MODEL` shell override. `OLLAMA_BASE_URL` is
set by the selected runtime.

Stop Tilt, then clean up its containers and network using the same runtime:

```sh
tilt down -- --runtime=native
# For container mode:
tilt down -- --runtime=container
```

Shutdown keeps model weights and the Next.js cache. Do not add `--volumes` to
normal cleanup. Native Ollama remains running.

## Compose without Tilt

Tilt uses `compose.yml`, adding `compose.native.yml` for native mode. The setup
service is opt-in so it can run as a finite job. Run it before claiming the app is
ready:

```sh
# Native Ollama:
docker compose -f compose.yml -f compose.native.yml run --rm --no-deps model-prepare
docker compose -f compose.yml -f compose.native.yml up --build app
# Cleanup in another terminal:
docker compose -f compose.yml -f compose.native.yml down

# Container Ollama:
docker compose -f compose.yml up -d --wait ollama
docker compose -f compose.yml run --rm --no-deps model-prepare
docker compose -f compose.yml up --build app
# Cleanup in another terminal:
docker compose -f compose.yml down
```

## Host development and evaluation

Use Node.js 22.22.2 or another version accepted by `package.json`. The `.nvmrc`
pins Node 22. Install the locked dependencies and keep native Ollama running:

```sh
npm ci
cp .env.example .env.local
node scripts/check-model.mjs
npm run dev
```

The defaults target `http://127.0.0.1:11434` and the provisional 1.5B model.
The setup script reads shell environment variables, not Next.js env files. If
you change the model in `.env.local`, pass that same `OLLAMA_MODEL` when running
the setup script. Keep local environment files private.

The server accepts only local HTTP endpoints with the hostnames `localhost`,
`127.0.0.1`, `::1`, `host.docker.internal` or `ollama`. Cloud model tags and
credentials are rejected. Unavailable models, timeouts and invalid responses
return safe setup or retry messages; model output never supplies voicings,
audio data or executable instructions.

The five-model evaluation shortlist is `qwen2.5:0.5b-instruct-q4_K_M`,
`qwen2.5:1.5b-instruct-q4_K_M`, `qwen3:4b-q4_K_M`, `qwen3.5:2b-nvfp4` and
`granite4:micro`. The `qwen3.5:2b-nvfp4` tag is MLX and runs only with native
Ollama on Apple Silicon; it is not a Linux-container candidate. Prepare each
candidate separately before evaluating. The runner never pulls weights. For
native Ollama, use `ollama pull <tag>` for each candidate, then:

```sh
npm run eval:models -- --runs 3 --out evals/output/benchmark.json
```

Tilt includes a manual `eval-models` resource, triggered from its dashboard or
`tilt trigger eval-models`. Native mode uses the runner's five-model default
shortlist; Linux container mode explicitly passes the four portable candidates
and omits the MLX-only NVFP4 tag. The resource writes `evals/output/tilt.json`
on the host. Prepare each candidate supported by the chosen runtime first, for
example with `OLLAMA_MODEL=<tag> docker compose ... run --rm --no-deps
model-prepare`. Container evaluation reports the Linux container's hardware
view; run the host command for native host metadata.
Benchmark output under `evals/output/` is ignored. Quality checks are harmony
and vibe proxies, not proof of musical taste. Compare quality gates before
latency and resource measurements; no model selection claim is implied.

## Commands

| Command | Purpose |
| --- | --- |
| `tilt up` | Container app with the existing native Ollama |
| `tilt up -- --runtime=container` | Container app and Ollama |
| `npm run dev` | Host Next.js development server |
| `npm run lint` | ESLint |
| `npm run test` | Unit and component tests |
| `node --test tests/check-model.test.mjs` | Finite model setup behavior checks |
| `npm run test:watch` | Watch tests |
| `npm run typecheck` | Generate route types and check TypeScript |
| `npm run build` | Compile the production app |
| `npm run start` | Serve the compiled production app |
| `npm run start:pi` | Serve production on the LAN, port 3100 |
| `npm run eval:models -- --runs 3 --out evals/output/benchmark.json` | Evaluate installed candidate models |

Development and production use Next.js's supported Webpack compiler.
Automatic agent-rule writing is disabled so the app does not rewrite `AGENTS.md`.
Run lint, tests, typecheck and build before handing off application changes.

## Raspberry Pi on the LAN

The existing systemd installer serves compiled production bundles on port 3100.
Install Node.js 22.22.2 and provision a local Ollama runtime and model on the Pi
separately. This installer does not install Ollama or download weights. Copy
`.env.example` to `.env.local` and set the Pi's local endpoint and installed model.
The app permits local endpoints only, so a remote Mac Ollama endpoint will fail
configuration validation. Pi inference performance has not been verified.

```sh
npm ci
node scripts/check-model.mjs
npm run build
bash deploy/install-pi-service.sh
```

Pass the same shell model override to the setup script if you changed the model
in `.env.local`. The installer registers `guitar-vibe.service` for the checkout
and SSH user, enables it at boot and waits up to 30 seconds for the app's local
HTTP response. This confirms HTTP startup, not model generation. It uses `sudo`,
checks that port 3100 is free and refuses to replace an existing service name.
Next.js reads environment files from the checkout; variables set only in an SSH
shell are not inherited by systemd.

Open `http://<pi-ip>:3100` on the LAN. Allow TCP port 3100 through the Pi firewall
if needed. To update, update the checkout, run `npm ci` and `npm run build`, then
`sudo systemctl restart guitar-vibe`. Read logs with
`sudo journalctl -u guitar-vibe -f`.

For an older service using port 3000, first confirm 3100 is free, then update:

```sh
ss -ltnH | awk '{print $4}' | grep -E ':3100$'
sudo sed -i 's/^Environment=PORT=3000$/Environment=PORT=3100/' /etc/systemd/system/guitar-vibe.service
sudo systemctl daemon-reload
sudo systemctl restart guitar-vibe
```

## Server and client boundaries

App Router pages are Server Components by default. Keep server configuration and
Ollama adapters in `lib/server/`, with `import "server-only";`. Browser adapters
live in `lib/client/` with `import "client-only";`. Client Components use
`"use client";` and access browser APIs in effects or event handlers. Shared
helpers remain free of environment reads and browser side effects.

The browser posts known vibe IDs to the server. The server limits each model
request to one bounded generation with a 2,048-token context and 128 generated
tokens, validates 3-8 chord symbols and supplies trusted local voicings and audio.
No environment value uses a `NEXT_PUBLIC_` prefix.

Existing asset license files remain with their assets. This document does not
establish a license for the app or downloaded model weights.

## Tooling references

See the official [Next.js guides](https://nextjs.org/docs/app/getting-started/installation),
[Tilt Compose guide](https://docs.tilt.dev/docker_compose.html),
[Compose merge rules](https://docs.docker.com/reference/compose-file/merge/),
and [Ollama API documentation](https://docs.ollama.com/api).
