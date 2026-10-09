# Implementation Plan: Vibe Chords MVP

## Overview

Build a Vercel-deployable Next.js app where a guitarist filters and selects a
bounded local vibe catalog, generates a short guitar-friendly progression via
OpenRouter's `openai/gpt-6-luna`, and immediately sees/hears supported positions.

## Capability Map

| Module id | Responsibility | Depends on |
| --- | --- | --- |
| catalog | Expandable local vibe data, selection, bounded search, Surprise me | — |
| music-foundation | Chord-symbol validation and trusted position/note lookup | — |
| notation-spike | VexTab rendering compatibility | music-foundation |
| generation | Server-side OpenRouter generation and output validation | catalog, music-foundation |
| playback | Individual and sequential selected-position audio | music-foundation |
| experience | Responsive system-themed UI joining all modules | catalog, notation-spike, generation, playback |
| verification | Automated and real-browser proof of the core flow | experience |

Build order: catalog + music-foundation → notation-spike → generation + playback
→ experience → verification.

## Architecture Decisions

- Keep the catalog local, typed, and filterable; search is a UI filter only.
- Treat model output as harmonic intent only. Resolve every chord to local,
  trusted position/note data before rendering or playing it.
- Use VexTab for tab/notation rendering after a compatibility spike;
  do not send model-generated VexTab syntax to the client.
- Keep `OPENROUTER_API_KEY` and model use server-side. The model name is an
  environment/config setting, not client state.
- Use one playback controller so a chord preview and progression cannot sound
  concurrently.

## Delivery Phases

### Phase 1: De-risk the musical foundation

1. Scaffold the strict TypeScript Next.js project and its test/lint/build commands.
2. Create the expandable catalog and selection/search/Surprise-me domain logic.
3. Create the chord/voicing data contract and prove a supported VexTab render.

Checkpoint: project builds; catalog filtering/selection is tested; VexTab
renders at least one open and one higher-neck chord position.

### Phase 2: Deliver the generate-and-play path

4. Add the server-only OpenRouter generation route, Zod validation, and safe errors.
5. Add playback for one position and a sequence, with a single-stop lifecycle.
6. Assemble the responsive system-theme selection and result experience.

Checkpoint: a mocked end-to-end request produces a supported progression that
can be individually previewed and played in order.

### Phase 3: Prove and prepare the MVP

7. Add focused unit/component coverage and browser coverage for the core flow.
8. Add Vercel configuration, environment documentation, rate/spend protection,
   and final deployment checks.

## Risks and Mitigations

| Risk | Impact | Mitigation |
| --- | --- | --- |
| VexTab or modern Next.js compatibility | High | Test first; do not build UI around unproven behavior. |
| Model returns chords outside supported positions | High | Constrain prompt, validate symbols, resolve only local known voicings, retry/fail safely. |
| Public generation endpoint incurs abuse/cost | High | Server-only key, request validation, rate limit, and explicit spend cap before production. |
| Too many options overwhelm users | Medium | Group by facet, cap one choice per group, filter locally, and test small-screen browsing. |
| Browser audio lifecycle leaks notes | Medium | Central controller and stop-on-unmount/regenerate rules with tests. |

## Parallelization

After Task 1, catalog (Task 2) and the music/VexTab spike (Task 3) can proceed
independently. Generation and playback may start after their respective
foundations, but experience integration is sequential because it consumes both
contracts.

## Open Decisions Before Production

- Choose the licensed source of chord-position and pitch data.
- Set request rate and OpenRouter spend limits.
