# SW Refactor Codex Prompt

Use this prompt for a later implementation pass that breaks up `src/components/SW.tsx` without changing behavior.

## Prompt

```text
Refactor `src/components/SW.tsx` into smaller units without changing behavior.

Repository rules:
- This app is TanStack Start + Vite, not Next.js.
- Run app commands inside the `web` container only.
- Use this validation sequence before finishing:
  1. `docker compose -f compose.yml up -d --build`
  2. `docker compose -f compose.yml exec web bun run lint`
  3. `docker compose -f compose.yml exec web bun run typecheck`
  4. `docker compose -f compose.yml exec web bun run test`
  5. `docker compose -f compose.yml exec web bun run build`
- Use `apply_patch` for code edits.
- Do not revert unrelated user changes.

Goal:
- Make `src/components/SW.tsx` maintainable by splitting responsibilities into smaller hooks/components.
- Preserve behavior exactly.
- No regressions.

Critical constraints:
- Do not change route semantics for `/t/<topic>`, `?p=`, `?w=`, or `?r=`.
- Do not merge dedicated listen playback back into `SW`.
- Leave `src/components/PerspectiveListener.tsx` functionally untouched unless absolutely necessary.
- Do not break the current working iOS playback fix on `?p=`.
- Do not change recording/upload policy or playback format behavior.
- Preserve the existing UI/UX unless a test proves current behavior is wrong.

Current architecture notes:
- `src/components/SW.tsx` currently mixes:
  - playback/media orchestration
  - derived perspective/runtime state
  - timing editor commands
  - viewer/editor render branching
  - footer coordination
- `src/components/PerspectiveListener.tsx` is already the dedicated listen-route player and should stay separate.
- `src/components/SWEditor.tsx` is shared rendering logic and can stay shared.
- `src/routes/t.$.tsx` currently chooses between read/listen/write/record surfaces; do not broadly refactor route behavior in this pass.

Refactor requirements:
1. First add or update characterization tests that lock down current `SW` behavior before moving logic.
- Cover at least:
  - viewer inline playback flow
  - editor playback flow
  - sequence/next-playable behavior
  - timing mark/undo/clear behavior
  - route-facing `SW` prop behavior that could regress during extraction

2. Extract pure derived-state helpers out of `SW.tsx` first.
- Create a module such as `src/components/sw/selectors.ts`.
- Move pure logic like:
  - selected perspective resolution
  - selected audio source resolution
  - track bounds resolution
  - selected timings / analysis / playhead summaries
- Keep these helpers free of React side effects where possible.

3. Extract playback logic into a dedicated hook.
- Create something like `src/components/sw/useSwPlaybackController.ts`.
- Move:
  - `audioRef`
  - play/pause orchestration
  - current/render time syncing
  - playback error/rejection handling
  - sequence behavior on ended
  - track/current-time coordination
- Keep the hook focused on playback only, no JSX.

4. Extract timing editor commands into a second hook.
- Create something like `src/components/sw/useSwTimingEditor.ts`.
- Move:
  - `updateTimingEntry`
  - `setTimingStart`
  - `setTimingEnd`
  - `shiftSelectedWordStart`
  - `markAndForward`
  - `undoLastMark`
  - `rewindToPrevious`
  - `markCurrentEnd`
  - `clearCurrentMark`
  - `clearAllMarks`
  - keyboard shortcut binding
  - MIDI binding hookup
- Keep this separate from low-level playback except for explicit dependencies.

5. Split the render layer into viewer and studio surfaces.
- Create components such as:
  - `src/components/sw/SWViewerSurface.tsx`
  - `src/components/sw/SWStudioSurface.tsx`
- `SW.tsx` should become a coordinator that wires hooks + selectors + surface component.
- Preserve current markup and behavior as much as possible.

6. Do not do a large route refactor in this pass.
- If `t.$.tsx` needs minor updates because of extracted props/types, keep them minimal.
- Do not redesign route structure.

Expected output:
- Smaller `src/components/SW.tsx`
- New focused hook/component modules under `src/components/sw/`
- Tests added/updated to prevent regression
- Full validation sequence passing

When finished, summarize:
- what was extracted
- what behavior was intentionally preserved
- which files now own playback vs timing vs rendering responsibilities
```

## Notes

- Keep `?p=` playback isolated in `src/components/PerspectiveListener.tsx`.
- Treat iPhone/iOS playback behavior as the source of truth, not desktop emulation.
- Prefer incremental extraction over a broad rewrite.
