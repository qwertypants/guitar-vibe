---
name: guitar-vibe-development
description: Implement or change Guitar Vibe product behavior, UI, or code in this repository. Use for feature work and bug fixes; use progression-harness for progression evaluation and model-comparison work.
---

# Guitar Vibe development

Use this skill for product and code changes in this repository. Keep the requested scope and existing product behavior in view; inspect the current implementation before assuming a control or capability is missing.

## Find the relevant code

- Start with `graft ask "<task>" --source` before grepping or opening source. Use the returned `covers:` spans and `graft callers` to trace the relevant path; use `graft grep` when you need every occurrence. Read only the exact source ranges needed.
- Read `CONSTRAINTS.md` before changing code. Do not weaken its quality bar.
- Trace the full product path affected by the change: UI → route/API → validation and domain logic → persistence or playback → visible result. Check existing tests for the behavior and preserve established contracts unless the request changes them.

## Generation and playable voicings

Keep the distinction between generated music symbols and playable guitar data clear. The model returns chord symbols. The trusted boundary is:

`model symbols → output parsing/schema validation → chord symbol parser and resolver → catalogued voicings → midiNotes playback`

Inspect the current schema, parser, resolver, and voicing catalog before changing any of these layers. Treat model output as untrusted input: validate it at the existing boundaries and reject unsupported symbols rather than inventing a fingering or MIDI notes. UI diagrams and audio should come from the resolved voicing data so they describe the same position. Preserve any existing progression-level validation and fallback behavior unless the task explicitly changes it.

## Playback and timing

- Inspect `PlaybackControls`, `PlaybackController`, and the audio implementation before making playback changes. The current UI already has per-chord preview, sequence play/stop, and stop controls; do not introduce a duplicate transport or claim these controls are absent.
- A chord preview should play the selected voicing's `midiNotes` together as one chord. Selecting another guitar position updates that chord's selected voicing and previews the newly selected position.
- The current sequence controller plays resolved voicings in order, advances on the configured chord duration, and supports stopping/cancellation. Preserve that relationship between audible notes, active-card state, and sequence order when modifying timing or playback.
- Do not add tempo, strumming, rhythmic cues, lessons, or composition controls unless requested. Re-read the current implementation and relevant tests before describing timing or promising behavior.

## Changes and verification

- Preserve unrelated working-tree changes. Keep edits limited to files needed for the requested feature; inspect `git status --short` and `git diff` before handoff.
- Run `npm run check:fast` after every edit and `npm run check:task` before handing work back, as required by `CONSTRAINTS.md`. Report any check that could not complete and its actual result.
- After a substantial code change, run `graft build` so the repository graph reflects it.
- For motion work, use the existing `animaxxing` and relevant GSAP skills when their guidance applies; do not copy their animation instructions into this skill.
