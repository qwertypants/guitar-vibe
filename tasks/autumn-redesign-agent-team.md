# Autumn redesign: agent team implementation plan

Status: implemented and integrated in the current checkout. See `tasks/autumn-redesign-execution.md` for verification evidence and execution deviations. This document includes the user's correction to keep playback simple.

## 1. Outcome and scope

Refine the existing Next.js guitar progression site into a compact, modern practice workspace. Preserve the autumn identity, trusted local voicings, explicit generation, and existing audio behavior.

### Product contract

- Keep Georgia for the wordmark and main headings; use a clean system sans-serif for controls and body text. Shorten the oversized header and reduce repeated instructional copy.
- Keep mood choices prominent, selected vibes visible and removable, and generation controls full-width on phones. Surprise me updates visible choices and never generates automatically.
- Use one consistent SVG icon family, with icons beside labels for Generate, Surprise me, Refine, Play, Stop, Preview, Close, and More. Hide decorative icons from assistive technology. Icon-only controls require accessible names.
- Add a simple More menu in the chooser header with How to play and Reset selection. How to play opens a short accessible dialog. Reset clears selections, results, and errors through the existing selection path, which also stops old audio. Disable Reset while generation is pending to avoid introducing response races.
- On phones below 768px, Refine opens a bottom sheet with labeled search and the existing optional facets. At larger widths it opens an inline panel. Selection changes apply immediately; Done closes the sheet. Closing preserves selections and returns focus to Refine. No swipe-only interactions.
- Keep all selected vibe chips visible when refinements close. Keep one selection per facet and the existing toggle/search behavior.
- Chord cards show a large chord symbol, quieter voicing label, centered diagram, labeled native position selector, and individual Preview button. Frets and notes move into a Details disclosure. Rendering failure exposes that text automatically and displays a useful error.
- Highlight the active preview or sequence card using existing playback state, with a text indicator as well as color. Do not add new playback state or timing features.
- Keep the existing Play progression and Stop controls above the cards, plus individual previews. Add icons and consistent styling only. No bottom playback bar, player panel, transport timeline, scrubber, progress meter, persistent player, or extra playback settings.
- Preserve VexTab dependency, declarations, and conversion helper. Preserve the renderer function signature and progression API.

### Grid contract

| Viewport width | Columns |
| --- | --- |
| Below 768px | 1 |
| 768px through 1023px | 2 |
| 1024px through 1279px | 3 |
| 1280px and above | 4 maximum |

Use ordered CSS media queries and `minmax(0, 1fr)`. Keep the existing 1280px maximum page width, approximately 16px desktop card padding, and a diagram that fits within its card. Preserve DOM progression order and prevent horizontal page overflow. Do not shrink touch targets to fit four columns.

### Theme contract

Follow `prefers-color-scheme` without a manual theme override. System changes must update both the page and SVG diagrams while preserving selections, generation results, and ongoing audio.

| Semantic token | Light | Dark |
| --- | --- | --- |
| Background | `#F7EBDD` | `#1C1714` |
| Card | `#FFF9F0` | `#2A211C` |
| Foreground | `#241C17` | `#F7EBDD` |
| Muted text / diagram lines | `#705C4F` | `#C6AD9B` |
| Accent | `#A8442A` | `#E38B6F` |
| Text on accent | `#FFF9F0` | `#241C17` |

Use separate accent-foreground and card tokens; dark action text must not inherit dark card backgrounds as its text color. Set native control colors and `color-scheme` for both themes. Add theme-color metadata for each system preference. Verify contrast and adjust token pairs centrally if needed.

### Design influences

Use these reviewed sources as guidance, adapted to a web application:

- [Mobile iOS design](https://skills.sh/wshobson/agents/mobile-ios-design): clear hierarchy, sheets, adaptive layouts, semantic colors, and accessible controls. This is community guidance, not an Apple-authored skill or a request to adopt SwiftUI.
- [UI/UX Pro Max](https://skills.sh/nextlevelbuilder/ui-ux-pro-max-skill/ui-ux-pro-max): touch spacing, restrained SVG icons, progressive disclosure, and responsive behavior.
- [Vercel web design guidelines](https://skills.sh/vercel-labs/agent-skills/web-design-guidelines): focus, keyboard access, theme handling, and mobile layout verification.

These sources were discovered and read during planning. No additional skills have been installed. Installation is optional; do not introduce an external design service, account, or API dependency. The existing local design/accessibility skills can support execution.

### Exclusions

No provider, API, catalog, voicing, synthesis, or playback-engine redesign. No saved library, history, accounts, navigation tabs, deployment, push, or PR. Avoid unrelated refactors and new race-handling mechanisms unless the redesign creates a concrete need.

## 2. Repository and worktree readiness

- Repository: `/Users/wilkins/Sites/guitar-vibe`.
- Filesystem inspection found `.git/HEAD` pointing to `main`, with branch ref `178e7cd14494a63986a85032b4779cce919670a5`. This is an observed ref, not a confirmed clean execution baseline.
- The prior VexChords/autumn implementation exists in the current files and was left uncommitted. Treat it as user-owned baseline work and preserve it.
- Dirty/untracked state and existing worktree inventory have not been verified through the required version-control tool. Root must resolve both before execution.
- The user-provided repository instructions require GitButler for version-control operations. `but` and its installed skill were unavailable during this planning session. Do not guess commands or silently substitute another workflow. At execution, locate/read the skill and use the required tool; if still unavailable, resolve the tooling constraint with the user before version-control mutations.
- Use Graft before source discovery. Re-read relevant truncated spans before editing. Refresh with `graft build` after integration.
- `.env`, `.next`, `node_modules`, `graft`, generated type/build files, and `docs/` are ignored. Do not commit credentials, caches, or generated artifacts. This plan is under `tasks/` so an implementation handoff can include it explicitly.
- Do not copy `.env` into workers. Local fixture chords and intercepted API responses are sufficient for verification; provider availability is outside this task's completion gate.
- Never commit unrelated dirty changes to create a baseline. Root must obtain a safe baseline containing the accepted current rendering/UI before branching workers. If that cannot be isolated safely, implement sequentially in the current workspace with the same ownership boundaries.

## 3. Dependency graph

```text
Root readiness and baseline
  -> Root shared tokens, grid rules, icon contract, compact page shell
      -> A: theme-aware diagrams and card details
      -> B: vibe controls, refinement sheet, More menu
      -> C: simple playback controls and card presentation
  -> Root integration and full checks
  -> D: independent browser/accessibility verification
  -> Root fixes, final verification, Graft refresh, handoff
```

A, B, and C start together only after the shared contract is available in their checkouts. D starts after the integrated build is ready. Maximum concurrency is root plus three workers; run the verifier in a later wave.

## 4. Agent roster and model allocation

Use stronger reasoning for lifecycle/accessibility decisions and smaller models for bounded presentation work. Model names are execution suggestions; use the runtime's supported equivalents if unavailable and record substitutions. Explicit model overrides require fresh worker contexts with self-contained briefs.

| Agent | Model / effort | Purpose and owned files | Inputs / dependency | Prohibited scope | Deliverable |
| --- | --- | --- | --- | --- | --- |
| Root | `gpt-6.1-sol`, high | Plan, shared contracts, `app/globals.css`, `app/page.tsx`, `app/layout.tsx`, `components/UiIcon.tsx`, package files if needed, integration, final fixture/browser artifacts | User requirements, current accepted baseline | Unrelated changes, provider/playback redesign, unrequested external actions | Shared contract commit, integrated verified result |
| A | `gpt-6-sol`, high | `lib/chord-notation.ts`, `components/ChordNotation.tsx`, `tests/chord-notation.test.tsx`; new theme helper/test only if required | Shared theme tokens; existing render cleanup and local voicings | CSS, icon contract, playback controller, chooser/menu files, catalog data | Theme-aware diagrams, accessible Details/fallback, lifecycle tests |
| B | `gpt-6-sol`, medium | `components/VibePicker.tsx`, `components/VibeChooser.tsx`, `tests/vibe-picker.test.tsx`, `tests/page.test.tsx`; new refinement/menu/help components and their tests | Shared icon/tokens; existing selection and request behavior | Global CSS, chord renderer, progression/playback files, server/API files | Refine sheet/panel, More/Help/Reset, visible selections, generation icons |
| C | `gpt-6-luna`, medium | `components/PlaybackControls.tsx`, `components/ProgressionResult.tsx`, `tests/playback-controls.test.tsx` | Shared icon/tokens/grid; unchanged playback controller and child-render API | Theme lifecycle, menu/sheet logic, global CSS, playback engine, new player features | Simple icon-supported playback controls, compact cards, active-card indicator |
| D | `gpt-6-sol`, medium | Read-only integrated browser/accessibility review; own temporary evidence directory only | Integrated build and acceptance checklist | Product edits, commits, deployments, credentials | Reproducible findings, screenshots, verification report |

Root owns package and lockfile writes. Prefer a small typed shared SVG icon component to avoid adding a package for a few icons. If an icon package is chosen, install it once in the contract phase and import only used icons. Workers request shared changes through Root rather than editing shared files.

If C encounters nontrivial audio lifecycle changes, stop that expansion and return it to Root. Promote C to `gpt-6-sol` only for a documented unresolved issue; do not have multiple agents repeat the same work. D must not be the original implementer for the area it reviews.

## 5. Worktree map

Worktrees are appropriate for A, B, and C because their production/test paths are disjoint. They are conditional on the readiness gate and a baseline containing the current uncommitted redesign.

Use a task-specific run suffix in branch names to avoid collisions. Root chooses allowed sibling paths supported by the runtime; the paths below are logical names, not permission claims.

| Branch / checkout | Owner | Base / start gate | Ownership | Local verification | Integration order |
| --- | --- | --- | --- | --- | --- |
| `redesign/autumn-integration-<run>` / integration | Root | Verified accepted baseline; use a dedicated integration checkout if the primary has unrelated changes | Root roster files | Baseline checks; shared-contract checks | First |
| `redesign/autumn-theme-<run>` / theme | A | Root's committed shared contract | A roster files only | Renderer/theme component tests, typecheck | Second |
| `redesign/autumn-vibes-<run>` / vibes | B | Same contract commit | B roster files only | Picker, page, sheet/menu tests, typecheck | Third |
| `redesign/autumn-cards-<run>` / cards | C | Same contract commit | C roster files only | Playback controls tests, typecheck | Fourth |
| Integrated checkout, read-only | D | All worker changes integrated and build passing | No product writes | Browser and accessibility checks | Last |

Each worktree needs its own dependencies and Next.js output. Root assigns unique server ports and confirms each server's checkout before browser checks. Do not run build and dev processes against the same `.next` directory concurrently. Shared-tree fallback requires sequential writers; the reviewer can remain read-only.

## 6. Execution waves

### Wave 0: Root establishes the contract

1. Verify instructions, version-control tooling, current changes, worktrees, and accepted baseline. Preserve all user work.
2. Run baseline tests/typecheck/lint/build. Record existing failures separately; do not assume the previous session's checks still apply.
3. Establish semantic light/dark CSS tokens, responsive grid media queries, shared icons, compact page shell, native-control colors, and system-specific theme-color metadata.
4. Keep the interactive More menu within B-owned chooser components so Root's page remains a simple shell.
5. Publish the icon prop/name contract and theme token names in worker briefs. All workers consume these without independent edits.
6. Verify the contract and create its commit through the required version-control workflow. This commit must include the accepted baseline needed by workers.

Gate: all three checkouts contain the same verified baseline and shared contract; ownership is explicit.

### Wave 1: Independent implementation

A replaces hardcoded renderer colors with resolved semantic token values. Use an SSR-safe system-theme subscription to trigger redraws, with cleanup. Do not let theme changes remount the progression or reset audio. Preserve effect-owned drawing nodes, cancellation, and detached stale renders. Test theme changes alongside rapid voicing changes, failure, recovery, and unmount.

B implements a labeled modal refinement sheet on phones and an inline panel on larger screens, sharing the same selection/search state without duplicate active controls. Use native dialog semantics or an existing accessible primitive. Support Escape, close/Done, focus containment and restoration, and internal scrolling. Closing/viewport changes must restore scroll/focus safely. Add More/Help/Reset and icon-supported generation actions without modifying domain selection logic or the API.

C updates existing controls and card shells. Keep the playback controller untouched. Use its existing state to identify the active card by progression index during sequence playback and voicing identity during previews. Keep one global control group above the cards and a preview per card. Style with shared tokens and icons. Preserve stop-on-selection, regeneration, and unmount behavior.

Each worker runs owned behavior tests and typecheck, fixes its failures, and returns the handoff below. Do not add tests that only assert CSS class names. Use real VexChords where possible; mocks belong at asynchronous failure/theme/browser API boundaries.

Gate: bounded worker changes are reviewable, local checks pass, and scope exclusions remain intact.

### Wave 2: Root integrates, D verifies

Root reviews and integrates A, then B, then C. Inspect actual changes and tests rather than trusting reports. Resolve shared-style adjustments centrally. Run the full checks and start a verified integrated production server. D then runs the acceptance matrix. Root fixes accepted findings in their owned areas, repeats affected checks, and refreshes Graft.

## 7. Integration and handoff protocol

- Workers do not merge/rebase the integration branch or edit each other's files. One active writer per tracked file.
- Root reviews and integrates through the repository-required tooling. Do not invent GitButler recipes. Use the installed skill and verified capabilities.
- Every writing worker returns branch/checkout identity, baseline and contract commit, own commit hashes, changed paths, test commands/results, assumptions, unresolved risks, and ownership-change requests.
- Root keeps a provenance table of worker commits and integrated equivalents. No required change may remain only in a worker checkout.
- Fix conflicts centrally; never discard another agent's work or dirty user files. On failed integration, preserve checkouts and diagnose before further integration.
- Only remove execution-owned worktrees after provenance and verification are recorded, using the tool's approval behavior. Do not touch pre-existing worktrees.
- No push, PR, deployment, skill installation, or external design-service action is implied by this plan.

## 8. Verification and safety gates

### Automated checks

```sh
npm test
npm run typecheck
npm run lint
npm run build
graft build
```

Run type generation and production build sequentially in the integrated checkout to avoid generated-file races. Read exit codes and full failure summaries. Baseline test counts are historical, not a required fixed count.

### Browser acceptance matrix

- Inspect 320, 390, 768, 1024, 1280, and 1440px in light and dark modes. Verify breakpoint transitions at 767/768, 1023/1024, and 1279/1280px, plus the four-column cap at a wider viewport.
- Confirm no horizontal page overflow, readable diagrams, natural text wrapping, 44px minimum touch targets, approximately 8px spacing between separate touch controls, and usable 200% browser zoom.
- Change system preference while a progression and alternate positions are displayed and audio is running. Page, native controls, and diagram colors update; selection/result/audio state is preserved. No duplicate SVGs or stale async writes.
- Verify open, muted, and higher-fret diagrams against local voicings and playback notes. Exercise rapid position changes and diagram failures; fallback text remains accessible.
- Verify More menu, Help dialog, Refine sheet, Done, Escape, keyboard focus containment/restoration, resizing with a sheet open, and no background-scroll lock left after close/unmount.
- Verify mood toggles, search, facet choices, removable selections, visible Surprise me results, and explicit Generate. Refine/More closing must not trigger generation. Reset is unavailable while pending and stops old audio when results clear.
- Verify full progression playback, individual previews, active-card indication, Stop, and cancellation on position/selection changes. Confirm no expanded player UI or bottom playback bar exists.
- Verify normal text contrast of at least 4.5:1 and visible focus/control boundaries in both themes. Honor reduced-motion preferences; use short opacity/transform transitions only where helpful.
- Exercise the page with local fixture responses, including generation errors, rather than relying on a paid/live provider. Report fixture verification honestly; it does not prove provider availability or audible sound quality.
- Capture screenshots and record route, server checkout, port, build identity, and browser errors. D supplies reproduction steps and severity for each finding.

Stop and resolve any dirty-baseline ambiguity, overlapping ownership, secret-copy requirement, tool rejection, persistent regression, or expanded player scope before the affected work continues. Continue independent safe tasks where possible. Keep execution commits recoverable; avoid history rewrites or destructive cleanup.

## 9. Definition of done

- The four-column cap and responsive breakpoints work with readable cards and no horizontal page overflow.
- Light/dark themes follow system settings, including live changes and theme-aware diagrams.
- Compact header, consistent icons, simple menus, phone refinement sheet, visible/removable selections, and chord Details/fallback work with keyboard and touch.
- Existing simple playback controls and previews remain; no expanded player has been introduced.
- Trusted voicings, API, VexTab compatibility artifacts, and playback engine remain intact.
- All integrated tests, typecheck, lint, and production build pass. Independent browser/accessibility review is complete and accepted findings are resolved.
- Graft is refreshed, integration provenance is recorded, and user changes are preserved. Required changes are present in the designated integration checkout.
- Final report names the integrated result, checks and browser evidence, and any real limitation. External actions occur only if separately requested.

## 10. First execution wave

Root starts alone with the tooling/readiness and baseline gate, then establishes shared tokens, icons, grid rules, and page shell. No implementation workers spawn until that contract is available in safe checkouts. Afterward A and B start on `gpt-6-sol`, C starts on `gpt-6-luna`, and D remains blocked until integration and production build verification. Each worker receives this plan, its exact owned paths, the contract commit, and its acceptance checklist in a fresh context.
