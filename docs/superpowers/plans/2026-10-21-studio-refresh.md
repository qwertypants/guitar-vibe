# Guitar Vibe studio refresh implementation plan

**Status:** Plan only. Based on commit `73501d0`, branch `plan/studio-refresh`, isolated at `/Users/wilkins/Sites/guitar-vibe-studio-plan`. No application code changed. Read the parent repository's `AGENTS.md` and `CONSTRAINTS.md` before implementation; these local guidance files are ignored by Git and are absent from a fresh worktree.

**Goal:** Make the existing choose, generate, play, and practice journey feel like a precise, inviting studio instrument.

**Architecture:** Keep the existing Next.js App Router, React components, progression API, notation renderers, and playback controller. Deliver static visual improvements first, then a small motion layer that observes UI state without controlling it. Use existing GSAP and `@gsap/react` dependencies.

## 1. Evidence and release boundary

Repository evidence came from Graft's `VibeChooser` dependency trace and source spans: `components/VibeChooser.tsx:16–204`, `VibePicker.tsx:25–114`, `PlaybackControls.tsx:13–94`, `ProgressionResult.tsx:12–62`, `ScalePractice.tsx:7–54`, `Tabs.tsx:8–59`, `MotionStage.tsx:12–123`, `ChordNotation.tsx:20–74`, and `MyVibesLibrary.tsx:26–168`. CSS is unindexed; its responsive rules were inspected directly.

Observed in the production browser at 1280×800 and 320×740:

- Choosing Moody and generating produced Am–F–G. The first measured API response took 1,902ms. Selection, result navigation, chord diagrams, position choices, and best-fit scale are already useful and recognizable.
- Play progression reported “Playing position 1 of 3.” C-major scale playback reported “Playing scale note 1.” Scale tablature rendered with no reported audio/notation error. This verifies UI/controller state, not audible quality or musical timing.
- The light UI uses warm cream/rust, Georgia headings/chord names, and Arial controls. Wide chooser content spans almost the entire page; hierarchy relies on borders, large whitespace, and several competing headings.
- At 320px the document width remains 320px and the progression retains two columns. Transport controls measure 37.2px high; fret/note metadata measures 9.6px. Scale notation is about 948px wide inside its local horizontal viewport.
- Desktop cards can grow very tall for three chords, while metadata remains tiny. The transport is above the cards but scrolls away when practicing lower down.

Observed in source, not tested as failures:

- `VibeChooser` waits for a 200ms outgoing tween before changing views and uses `transitioning` to disable actions and playback activity. React state therefore depends on animation completion.
- `MotionStage` animates scattered title letters, tilts entrances, scales every pressed button, and inserts ripples. `VibePicker` rotates/bounces choices; playback scales chord names. These effects compete with the proposed instrument ergonomics.
- `app/layout.tsx` marks intro content hidden before paint with a 1,200ms fallback. Existing reduced-motion handling is useful, but readable content should not depend on motion boot.
- Existing tabs support arrows, Home/End, roving focus, and selected state. Preserve this behavior.

Assumptions: practice benefits from a persistent transport, restrained color, and less visual movement. These are design judgments, not user-test findings. Physical touch, assistive technology, audible timing, reduced-motion runtime changes, and long saved libraries have not been validated in this planning turn.

**Smallest coherent release:** shared visual tokens, chooser hierarchy, readable chord cards, stable playback controls, scale panel, matching My Vibes styling, and the five scoped motion treatments below. Preserve two-column phone progressions, category selection/search, variation choices, Surprise me, position preview, save/filter/delete, and scale playback. Keep the visible name “Vibe Chords” pending a separate naming decision. Optional later work: tempo/loop controls, metronome, keyboard playback shortcuts, waveform visualization, theme switcher, library redesign, or new practice modes.

## 2. Recommended visual direction: warm precision

Use a neutral studio console with a restrained copper accent. Keep the warmth of the current interface while making notation and transport the strongest elements.

| Element | Concrete treatment |
| --- | --- |
| Typography | System sans (`system-ui`, Arial fallback) for interface and chord symbols; medium weight, no tight negative tracking on musical symbols. System monospace for fret/note values with tabular numerals. No font download. Body 16px/1.5, labels 13–14px, musical metadata at least 12px, chord names 28–36px, page title 24–28px. |
| Color | Light: canvas `#F3F1EC`, panel `#FFFEFA`, text `#242724`, secondary `#535B55`, border `#C4C9C2`, accent `#9A412A`, accent text white. Dark follows OS preference: canvas `#171B19`, panel `#222824`, text `#F3F3EB`, secondary `#B8C2B9`, border `#606C63`, accent `#F0A080`, accent text `#211B17`. Verify every actual pairing before acceptance. |
| Spacing/surfaces | 4/8/12/16/24/32px spacing scale. 16px phone and 24–32px desktop gutters, max width 1200px. Flat panels, 1px borders, 8px radii; shadows only to distinguish the sticky transport. Avoid nested outlined boxes and dense pill clusters. |
| Shell and chooser | Stable compact brand/navigation row on both choose and play views. Group category/search/options into one panel; selection summary and variation controls form the next clear step. Bound search width on desktop. Generate has the sole filled primary style; Surprise and Reset remain secondary. Explain why Generate is disabled before selection. |
| Result and cards | Heading and Edit vibe precede one transport row. Cards show chord symbol, position name, bounded diagram, then explicit “Frets” and “Notes” rows rather than emoji labels. Keep text outside the diagram readable; reserve diagram aspect ratio during lazy loading. Cap diagram width near 180–220px on desktop instead of stretching to fill a card. Position buttons remain in document flow below each diagram. |
| Responsive layout | Preserve two columns below 768px and at tablet widths; use three at 900px and above. Allow metadata and position buttons to wrap inside each card without shrinking their text. At 320px put metadata below the diagram to avoid a narrow split header. Accept vertical scrolling rather than compressing targets. |
| Transport | Keep Play/Stop in the same order and reserve enough width for “Stop progression.” Use a sticky top transport row within the result, below any sticky shell; both rows' combined height must leave useful content at 320×568. Let controls wrap if needed. Use scroll padding/margins so focused controls are never covered. No floating overlay over notation. |
| Practice/library | Keep native scale disclosure. Give its summary a 44px target and visible chevron; keep scale Play/Stop before notation. Keep horizontal scrolling local to full-width tablature, with a visible scroll hint and keyboard access. My Vibes inherits typography, targets, palette, and card rhythm without changing its data model or filter/delete workflow. |
| Feedback | Selection uses a check plus border/fill; playback uses a persistent active border and visible “Playing chord N” text. Errors use text and an icon, with a retry action where already supported. Reserve status space so generation/save messages do not displace primary controls. Focus ring is at least 2px with 3px offset. |

Visual styling owns all resting states, layout, color, type, and focus. Motion owns only short transitions between those states. No visual design skill may be replaced by animaxxing.

## 3. Motion contract for future implementation

During the motion phase explicitly invoke `.agents/skills/animaxxing/SKILL.md` for **single, scoped effects**, paired with `gsap-nextjs` and `gsap-react`. Consult `gsap-core` and `gsap-performance` for matching media preferences and cleanup/performance. Animaxxing was not invoked or read during planning. Its future scope is limited to this table; no full-page treatment, WebGL, ScrollTrigger, SplitText, or decorative loops.

| Component/effect | Purpose and trigger | Duration and treatment | Interruption behavior | Reduced-motion equivalent |
| --- | --- | --- | --- | --- |
| `VibePicker`, variation controls, `Tabs` | Confirm an accepted selection or category change | 100–160ms border/fill transition; tab underline may move 120–180ms. No chip travel, rotation, stagger, or button scaling. | Update pressed/selected state synchronously; overwrite previous transition and settle on latest selection. Removal never waits for exit. | Immediate check, border, fill, and underline at final position. |
| `VibeChooser` generation | Acknowledge request start and completion without suggesting fake progress | Busy text and `aria-busy` immediately; one 120–180ms status-color transition. Keep icon static during the request. | Response/error ends status immediately. No minimum display timer; retry starts from current state. | Same text, static icon, immediate state change. |
| `ProgressionResult` arrival | Identify newly available musical material | Commit result/view immediately. Optional 160–220ms accent-line opacity transition around the result; content and transport are fully visible throughout. No card cascade. | New generation, navigation, playback, or unmount kills effect and clears inline styles. No completion callback changes application state. | Result and accent appear immediately. |
| `ScalePractice` and library disclosure | Make expansion understandable while keeping the control anchored | Native expansion changes layout immediately; optional 100–160ms chevron rotation and content accent fade. Do not tween height or delay mounting/notation. | Rapid close/open follows native state, cancels old tween, and leaves focus on summary. | Native instant expansion and static final chevron. |
| `PlaybackControls`, chord previews, scale Play/Stop | Show actual controller state without competing with timing | Active border/text changes immediately; optional 80–120ms decorative indicator color transition only on start/stop. Chord advances and scale notes use instantaneous static highlighting. | Stop, preview replacement, position change, and view changes win immediately. No accumulated tweens or moving chord names. | Identical static active states and labels. |

Save/error/filter feedback stays static. Remove global ripples, elastic release, title entrances, error shake, and library FLIP choreography in this release. Animation cannot delay handlers, disable an otherwise ready action, schedule audio, move a target under the pointer, hide readable content, or steal focus. Handle preference changes mid-effect by killing tweens and restoring final styles. Use scoped refs/useGSAP cleanup, `revertOnUpdate` where appropriate, and context-safe event callbacks. A failed GSAP initialization must leave all controls/content visible and functional after React hydration.

## 4. Ordered implementation phases

Each phase depends on the previous phase's accepted result. Use ordinary Git, preserve unrelated work, and stage explicit owned paths. Before changing shared symbols run `graft callers <symbol> --depth all`; include all affected call sites. No API/storage/audio timing changes are required.

1. **Freeze evidence and budgets.** Re-read local guidance, inspect status, and capture the untouched production build. Save baseline JSON and screenshots under `docs/studio-refresh-evidence/`. Reproduce chooser, pending, error, three/four-chord result, alternate position, expanded scale, and empty/populated library. Use an isolated database and clearly label any mocked response. This phase produces the comparison reference for all later phases.
2. **Static visual foundation.** Edit `app/globals.css`, `app/page.tsx`, `components/MotionStage.tsx`, `components/VibePicker.tsx`, and `components/VibeChooser.tsx`. Introduce the palette/type/spacing tokens, stable shell, chooser groupings, and 44px controls. Consolidate conflicting responsive overrides rather than appending another override layer. Keep existing state and handlers. Verify choose/search/variation and keyboard tabs at 320px and desktop before progressing.
3. **Playable result and practice layout.** Edit `components/ProgressionResult.tsx`, `PlaybackControls.tsx`, `ChordNotation.tsx`, `ScalePractice.tsx`, and their styles. Add stable sticky transport, visible playback status, reserved diagram geometry, readable metadata, and focusable local tablature scrolling. Apply shared treatments to `components/MyVibesLibrary.tsx` and inspect `app/my-vibes/page.tsx`. Retain existing callback contracts (`onPlay`, `onEditVibe`, `renderFooter`) and `PlaybackController` subscriptions; do not create a second controller for the transport.
4. **Restrained motion and failure resilience.** Invoke the future skills above. Edit `MotionStage.tsx`, `VibeChooser.tsx`, `VibePicker.tsx`, `PlaybackControls.tsx`, `Tabs.tsx`, `ScalePractice.tsx`, `MyVibesLibrary.tsx`, `lib/motion.ts`, and `app/layout.tsx`. Remove boot hiding and animation-dependent navigation/`transitioning` gates. Commit React state before any optional tween; preserve stopping when leaving Play. Remove unused plugin imports after their last caller disappears. Keep existing GSAP packages; add no animation dependency. Update `tests/layout.test.tsx` to assert visible server content without requiring a boot timer.
5. **Verify and hand off.** Extend existing behavior tests in `tests/page.test.tsx`, `vibe-picker.test.tsx`, `playback-controls.test.tsx`, `scale-practice.test.tsx`, `chord-notation.test.tsx`, and `my-vibes.test.tsx` only where behavior changes. Cover immediate result availability with unfinished/failed motion, rapid view changes, Stop during an effect, disclosure interruption, and motion preference changes. Compare production browser evidence and budgets; record failures honestly. Refresh Graft with `graft build` after the multi-file change. Stop for review before any push or PR.

## 5. Verification and performance budgets

Planning baseline, 2026-10-21: local production `next build --webpack`/`next start`, Node 26.7.0, Chromium collaborative preview, 1280×800, no CPU/network throttling. Five repeat navigations in the same browser profile, cache not explicitly cleared; 1.8-second observation window per run. These are warm local lab measurements, not phone/field performance or a speedup claim. Machine load was 7.14/3.51/2.50, so repeat under comparable load before attributing small differences to design.

| Metric | Current measured baseline | Release budget and reason |
| --- | --- | --- |
| FCP | Median 24ms, range 12–28ms | Same-harness median increase ≤50ms; absolute local target ≤100ms. Allows small styling noise, no new font/network dependency. |
| LCP | Median 408ms, range 404–424ms | Median ≤458ms in the same harness; removing entrance choreography should improve it. Rebaseline on throttled phones before implementation. |
| CLS | 0 in all five initial-page runs | ≤0.01 initial navigation and no unexpected control displacement in the journey. Reserve notation space; native user-requested panel expansion is expected reflow. |
| JS encoded resource bytes | 218,389 bytes in every initial-page run, including route prefetch | No increase above this baseline for the same request set. No new animation package/plugin or webfont. Also compare full journey lazy-loaded bytes separately. |
| Generation | One successful response, 1,902ms | No server latency conclusion from one sample. Budget UI response-to-enabled-Play ≤50ms, independently of model time, removing the current 200ms gate. |

Before implementation, collect five cold and five warm runs for phone and desktop production pages, median/range, response status, exact Chromium version, cache policy, CPU/network settings, and JS/CSS bytes. Add interaction timing, long tasks, generation response-to-ready, notation arrival, and first/warm audible playback latency. Use identical progressions/settings for before/after; do not compare different model outputs. Proposed interaction budget: input-to-visible-feedback ≤100ms, no new animation-attributable task >50ms, no audio onset regression >20ms on a comparable device. Use a trace to attribute failures. Native audio preparation is measured separately from motion, and animation adds zero intentional delay. Establish throttled-device budgets before code edits, using the same baseline plus at most 10% for timing metrics, capped by LCP 2.5s and interaction 200ms targets; if baseline already misses these, record a separate performance issue rather than relaxing the visual refresh budget.

Acceptance matrix:

- Before/after captures at 320×568, 390×844, 768×1024, 1280×800, and 1440×900, including light/dark, pending/error, long labels, three/four chords, expanded scale, and saved library. Document width must not exceed viewport width; only tablature may scroll horizontally inside its labelled region.
- Keyboard: Tab/Shift+Tab entire journey; category/workspace arrows and Home/End; Enter/Space buttons and disclosure; visible focus after generation and navigation. No hidden panel receives focus. Sticky controls never obscure focused content. No new global Space shortcut.
- Touch: actual phone portrait/landscape, 44×44px minimum targets with at least 8px separation where practical, scroll without accidental preview, Play/Stop reachable while lower cards/scale are visible, safe-area and virtual-keyboard checks. Browser resizing does not count as touch-device verification.
- Readability/accessibility: 200% text zoom and 400% reflow; musical metadata ≥12px, readable accidentals/fret numbers, text contrast ≥4.5:1, large text and necessary nontext/focus contrast ≥3:1. Selection/playback state has text or shape in addition to color. Check accessible names, live status, disclosure state, and a screen-reader pass; avoid announcing every scale note if it overwhelms playback controls.
- Reduced motion: OS preference before load and toggled during every effect. Final state is immediate and stable; no spatial motion. Force motion initialization failure and delayed hydration; server content stays visible, hydrated controls work, and result navigation does not await a tween. Test rapid selection, regeneration, expansion, and start/stop without stale state or leftover transforms.
- Speed: primary actions are ready as soon as their actual prerequisites are ready. Capture a trace while playing, changing positions, scrolling, and expanding practice. No decorative loops, layout animation, sustained `will-change`, or unnecessary runtime plugin loading.

## 6. Required checks and open limits

During implementation run `npm run check:fast` after **every edit**, and `npm run check:task` before handoff. The latter includes changed-line coverage ≥80%, Semgrep, and dependency scanning; do not weaken `CONSTRAINTS.md`, skip checks, lower thresholds, or hide failures. Run `npm run build` and review the production browser separately. Existing overall statement/branch coverage must not fall beyond the documented 0.5% tolerance. Report tool/environment blockers distinctly from failing application behavior.

Planning access limits: browser state and notation were verified, but sound was not independently heard, physical-device/assistive-technology checks were not performed, and reduced-motion/failure checks remain implementation acceptance work. The production build initially failed with `SQLITE_BUSY` while collecting route data; a second unchanged build succeeded. Reconcile database initialization separately if it recurs. The parent checkout's modified `compose.yml` was excluded from this worktree.

Decisions to review before implementation: accept this palette and system typography; confirm sticky transport behavior on short phones. Recommended defaults are specified above, so these do not require architectural investigation. Naming, new playback features, and library information architecture remain outside this release.
