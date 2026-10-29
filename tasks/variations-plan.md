# Implementation Plan: Progression Variations

## Overview

Let a guitarist explore generated chord progressions through guided mood variations and a surprise option. Keep the original visible alongside every variation generated in the current session, then save the original and all of those variations together with the vibe selection.

## Confirmed Experience

- A suggestion retains its original progression as an anchor.
- The user generates one variation per action, choosing a mood direction or surprise.
- The original and all generated variations are displayed together for direct comparison; no variation replaces the original in the main view.
- Saving the vibe saves the original and every generated variation from that session.
- No timers or metronomes are part of this feature.

## Architecture Decisions to Validate During Implementation

- Reuse existing progression generation and variation support where it fits; inspect current server and browser generation paths before choosing the shared contract.
- Model a session as the selected vibe metadata, immutable original progression, and an ordered collection of generated variations with stable labels/identifiers.
- Extend saved-vibe validation and both storage modes to persist the complete progression set while retaining compatibility with existing saved records.
- Present each progression as a distinct, labeled comparison section with its own existing playback and chord-position controls; keep the original first.

## Task List

### Phase 1: Define the session and persistence contract

#### Task 1: Model progression exploration sessions

**Description:** Define validated types and transformations for the original progression and ordered mood/surprise variations, including generation state and stable labels.

**Acceptance criteria:**
- [ ] The original is retained and cannot be replaced by a generated variation.
- [ ] Each successful generation appends exactly one labeled variation in order; failed or pending requests do not corrupt existing choices.
- [ ] Repeated generations remain distinguishable and do not mutate prior progressions.

**Verification:** Focused unit tests for session initialization, append, identity, and failure-safe state handling.
**Dependencies:** None
**Files likely touched:** `lib/progression.ts`, `lib/*variation*`, related tests
**Estimated scope:** Medium

#### Task 2: Persist all explored progressions with a saved vibe

**Description:** Extend saved-vibe schema, save API/service, and browser storage so one saved item carries the original and all generated variations. Preserve reading existing saved items.

**Acceptance criteria:**
- [ ] Saving captures the current original and every successful variation in order.
- [ ] Existing saved-vibe records still validate and render through a backward-compatible default or migration.
- [ ] Server and Pages/browser storage round-trip the same progression collection.

**Verification:** Schema, API/service, and browser-store tests cover legacy records and multi-variation round trips.
**Dependencies:** Task 1
**Files likely touched:** `lib/saved-vibe.ts`, `lib/client/vibe-service.ts`, `lib/browser-vibes-store.ts`, API routes, related tests
**Estimated scope:** Medium

### Checkpoint: Data contract

- [ ] Session and saved-record contracts preserve original identity and variation order.
- [ ] Both persistence modes round-trip legacy and new records.

### Phase 2: Generate and compare variations

#### Task 3: Generate one mood or surprise variation at a time

**Description:** Connect variation actions to the existing generation paths, using selected vibe context and the original progression as the basis for alternatives.

**Acceptance criteria:**
- [ ] Each action requests one variation and appends it without replacing the original or previous alternatives.
- [ ] Guided mood choices and surprise are available, with clear loading/error states that preserve existing options.
- [ ] Generation works in server mode and browser-only Pages mode without relying on unavailable APIs.

**Verification:** Mocked focused tests cover each generation mode, repeated requests, invalid responses, and errors in both runtime paths.
**Dependencies:** Task 1
**Files likely touched:** `components/VibeChooser.tsx`, `lib/server/local-model.ts`, `app/api/progression/route.ts`, browser generation modules, related tests
**Estimated scope:** Large; split by server and Pages paths if the existing contracts require independent work.

#### Task 4: Show original and variations together for comparison

**Description:** Add intuitive, responsive comparison UI with the original first and each generated variation clearly labeled, while retaining the current chord notation and playback interactions.

**Acceptance criteria:**
- [ ] Original and every generated variation are visible together and individually labeled.
- [ ] Users can play/stop and inspect chord positions for each progression without audio controllers interfering.
- [ ] Keyboard and narrow-screen layouts remain understandable and accessible.

**Verification:** Component tests plus an interactive browser check for generation, comparison, and independent playback controls at desktop and mobile widths.
**Dependencies:** Tasks 1 and 3
**Files likely touched:** `components/VibeChooser.tsx`, `components/ProgressionResult.tsx`, `app/globals.css`, related tests
**Estimated scope:** Medium

### Checkpoint: Explore

- [ ] Generate multiple alternatives in sequence and compare them alongside the original.
- [ ] Failed generation leaves existing alternatives usable.
- [ ] Responsive and keyboard navigation works across all progression sections.

### Phase 3: Save the complete exploration

#### Task 5: Wire save action to the complete session

**Description:** Update save behavior and saved-vibe presentation so saving and revisiting a vibe retains all progressions from the exploration session.

**Acceptance criteria:**
- [ ] Save action persists selected vibe metadata, original progression, and every generated variation.
- [ ] Reopening a saved vibe shows the complete set together in stable order.
- [ ] Save feedback and failures are clear and do not discard the in-progress session.

**Verification:** End-to-end mocked flow verifies generate several → save → reload saved vibe → compare all, in server and Pages modes.
**Dependencies:** Tasks 2 and 4
**Files likely touched:** `components/VibeChooser.tsx`, saved-vibe views, API/service/storage modules, related tests
**Estimated scope:** Medium

### Checkpoint: Complete

- [ ] `npm run check:fast` passes after each edit and `npm run check:task` passes before handoff.
- [ ] New behavior is covered at the schema, storage, component, and end-to-end levels.
- [ ] Existing saved vibes remain usable.

## Risks and Mitigations

| Risk | Impact | Mitigation |
|---|---|---|
| Existing server and Pages generation implementations diverge | High | Map both paths before implementation and define a shared validated session contract. |
| Saved schema change breaks previously stored vibes | High | Keep legacy parsing supported and test browser localStorage records. |
| Many alternatives make the comparison page unwieldy | Medium | Keep one-at-a-time generation, use compact labeled sections, and retain all sections in a responsive vertical flow. |
| Multiple progression playback controllers overlap | Medium | Ensure playback ownership is scoped and starting playback in one section stops prior audio. |

## Out of Scope

- Timers, metronomes, practice schedules, or performance scoring.
- Replacing or discarding the original progression when generating an alternative.
- Saving only individually selected variations; the confirmed behavior saves every generated variation in the session.
