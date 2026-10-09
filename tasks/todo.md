# Vibe Chords MVP Tasks

## Task 1: Scaffold the application contract

**Description:** Create the Next.js App Router TypeScript baseline with Tailwind,
test tooling, and documented commands.

**Acceptance criteria:**

- [x] `npm run dev`, `npm run lint`, `npm run test`, and `npm run build` exist.
- [x] Strict TypeScript and a server/client boundary convention are established.
- [x] No secret is committed; `.env.example` names required keys.

**Verification:** Run lint, unit tests, and production build.  
**Dependencies:** None  
**Files likely touched:** `package.json`, `app/layout.tsx`, `app/page.tsx`,
`app/globals.css`, test config  
**Estimated scope:** Medium

## Task 2: Implement the expandable vibe catalog

**Description:** Add typed local catalog records, facet selection rules, local
search, and visible Surprise-me selection.

**Acceptance criteria:**

- [x] The catalog contains the initial Mood, Genre, Era, Setting, and Energy options from the spec.
- [x] Search returns only matching catalog items by label, synonym, or facet.
- [x] Surprise me produces a valid visible cross-facet selection.

**Verification:** Run focused domain/component tests; search `rain` and verify
it reveals *Rainy night* without a network request.  
**Dependencies:** Task 1  
**Files likely touched:** `lib/vibes.ts`, `lib/vibe-selection.ts`,
`components/VibePicker.tsx`, related tests  
**Estimated scope:** Medium

## Task 3: Prove notation and voicing contracts

**Description:** Define trusted chord-position/note data and render supported
positions through VexTab in an isolated compatibility spike.

**Acceptance criteria:**

- [ ] One chord renders as a valid open position and a distinct higher-neck position.
- [ ] A selected position exposes the exact notes required for playback.
- [ ] VexTab compatibility outcome is documented before public launch work proceeds.

**Verification:** Add a renderer test/manual browser fixture and record the
compatibility result in `docs/`.  
**Dependencies:** Task 1  
**Files likely touched:** `lib/chords.ts`, `lib/voicings.ts`,
`components/ChordNotation.tsx`, spike test/doc  
**Estimated scope:** Medium

## Checkpoint: Foundation

- [ ] Lint, tests, and build pass.
- [ ] Catalog is searchable but bounded to local data.
- [ ] A VexTab position is visible in a real browser.
- [ ] VexTab compatibility outcome is recorded.

## Task 4: Add safe structured progression generation

**Description:** Implement the server route using Vercel AI SDK, OpenRouter
`openai/gpt-6-luna`, Zod validation, and safe errors.

**Acceptance criteria:**

- [x] Only selected catalog terms reach the prompt; `OPENROUTER_API_KEY` stays server-only.
- [ ] Valid output has 3–8 normalized chord symbols and resolves entirely to supported data.
- [ ] Invalid/unresolved output produces a recoverable UI-safe error.

**Verification:** Mock provider tests for valid, malformed, and unsupported
responses; run the production build.  
**Dependencies:** Tasks 2–3  
**Files likely touched:** `app/api/progression/route.ts`, `lib/progression.ts`,
related tests  
**Estimated scope:** Medium

## Task 5: Implement exclusive playback

**Description:** Add a browser playback adapter/controller for individual
positions and ordered progression playback.

**Acceptance criteria:**

- [ ] Every supported chord position can start and stop individually.
- [ ] Progression playback uses the selected position of every displayed chord.
- [ ] Starting, regenerating, or unmounting stops active audio.

**Verification:** Unit-test controller state transitions and verify start/stop
in a real browser with audio enabled.  
**Dependencies:** Task 3  
**Files likely touched:** `lib/playback.ts`, `components/PlaybackControls.tsx`,
related tests  
**Estimated scope:** Medium

## Task 6: Compose the soft responsive experience

**Description:** Join selection, generation, notation, alternate positions, and
playback in an accessible system-themed page.

**Acceptance criteria:**

- [ ] The page follows system light/dark preference without a manual theme switcher.
- [ ] Result cards show ordered chord names, notation, position selection, and controls.
- [ ] Keyboard and narrow-mobile use remains usable without horizontal page scroll.

**Verification:** Component tests plus browser checks at mobile and desktop
widths in both color schemes.  
**Dependencies:** Tasks 2, 4, and 5  
**Files likely touched:** `app/page.tsx`, `components/ProgressionResult.tsx`,
`components/ChordCard.tsx`, `app/globals.css`, related tests  
**Estimated scope:** Medium

## Checkpoint: Core flow

- [ ] A mocked request runs select → generate → select position → preview chord → play/stop progression.
- [ ] Error and loading paths are understandable and leave no audio playing.
- [ ] Lint, tests, and build pass.

## Task 7: Add end-to-end proof

**Description:** Automate the core browser flow and edge cases not covered by
unit/component tests.

**Acceptance criteria:**

- [ ] E2E coverage includes bounded search, Surprise me visibility, generation, position change, and playback controls.
- [ ] A test confirms malformed generation never produces a fabricated diagram.
- [ ] Tests run without making a paid live OpenAI call.

**Verification:** `npm run test:e2e` and a recorded manual browser pass.  
**Dependencies:** Task 6  
**Files likely touched:** `e2e/vibe-chords.spec.ts`, fixtures, test config  
**Estimated scope:** Small

## Task 8: Prepare Vercel deployment safeguards

**Description:** Document environment setup and apply public endpoint
protections before deploying.

**Acceptance criteria:**

- [ ] Deployment configuration needs only documented environment variables.
- [ ] Request rate and maximum OpenAI spend limits are configured/documented.
- [ ] The production build and deployed core flow are verified.

**Verification:** Vercel preview deployment check, production build, and manual
browser flow with a non-secret test configuration.  
**Dependencies:** Tasks 4, 6, and 7  
**Files likely touched:** `README.md`, `.env.example`, deployment config, docs  
**Estimated scope:** Medium

## Checkpoint: Complete

- [ ] All acceptance criteria above are met.
- [ ] The deployed app is verified in a real browser.
