// src/components/TouchControls.jsx
//
// On-screen touch controls for Kiroman (Requirements 4.2, 6.2).
//
// Renders a thumb-friendly control overlay for touch devices: a directional pad
// (up / down / left / right) plus a pause button. The buttons are wired to a
// `useTouch` adapter's handlers (`pressDirection` / `releaseDirection` /
// `pressPause`), which emit the same intent contract the game loop already
// consumes from the keyboard adapter.
//
// Touch ergonomics:
//   - Large tap targets (min ~64px) sized for thumbs.
//   - `touch-action: none` + `preventDefault` on pointer events so pressing the
//     controls doesn't scroll, zoom, or trigger text selection / the iOS
//     double-tap-zoom while playing.
//   - Pointer events (not touch/mouse) so it works uniformly across devices,
//     with `pressDirection` on down and `releaseDirection` on up/cancel/leave to
//     support press-and-hold movement.
//
// Visibility: this overlay is intended for coarse-pointer (touch) devices. By
// default it self-hides on fine-pointer (mouse) devices via `useCoarsePointer`.
// Callers may override with the `visible` prop (e.g. to force-show for testing
// or a "touch controls always on" setting).
//
// Accessibility: every button has an explicit `aria-label`; the group is a
// labelled region. Purely decorative arrow glyphs are `aria-hidden`.

import { useCoarsePointer } from '../input/useTouch.js';

/**
 * A single d-pad / control button. Wires pointer events for press-and-hold and
 * prevents the browser's default touch gestures (scroll/zoom/select).
 *
 * @param {Object} props
 * @param {string} props.label accessible label for the button
 * @param {() => void} props.onPress called on pointer-down (begin press)
 * @param {() => void} [props.onRelease] called on pointer up / cancel / leave
 * @param {React.ReactNode} props.children visible (decorative) glyph
 * @param {string} [props.className] extra classes for grid placement / accent
 * @returns {JSX.Element}
 */
function ControlButton({ label, onPress, onRelease, children, className = '' }) {
  const handleDown = (event) => {
    event.preventDefault(); // stop scroll/zoom/selection while playing
    onPress?.();
  };
  const handleRelease = (event) => {
    event.preventDefault();
    onRelease?.();
  };

  return (
    <button
      type="button"
      aria-label={label}
      onPointerDown={handleDown}
      onPointerUp={onRelease ? handleRelease : undefined}
      onPointerCancel={onRelease ? handleRelease : undefined}
      onPointerLeave={onRelease ? handleRelease : undefined}
      onContextMenu={(e) => e.preventDefault()}
      className={
        'flex items-center justify-center select-none touch-none ' +
        'h-16 w-16 rounded-2xl text-2xl font-bold text-white ' +
        'bg-violet-600/80 border border-violet-300/40 shadow-lg shadow-violet-900/40 ' +
        'active:scale-95 active:bg-violet-500 transition-transform ' +
        'focus:outline-none focus-visible:ring-2 focus-visible:ring-violet-300 ' +
        className
      }
      style={{ touchAction: 'none' }}
    >
      {children}
    </button>
  );
}

/**
 * The touch control overlay: a d-pad plus a pause button.
 *
 * @param {Object} props
 * @param {(dir: 'up'|'down'|'left'|'right') => void} props.pressDirection begin holding a direction
 * @param {(dir?: 'up'|'down'|'left'|'right') => void} props.releaseDirection release the d-pad
 * @param {() => void} props.pressPause latch a one-shot pause
 * @param {boolean} [props.visible] force show/hide; when omitted, auto-detects a
 *   coarse (touch) pointer and shows only on touch devices
 * @param {string} [props.className] extra classes for the outer container
 * @returns {JSX.Element | null}
 */
function TouchControls({
  pressDirection,
  releaseDirection,
  pressPause,
  visible,
  className = '',
}) {
  const coarse = useCoarsePointer();
  const show = visible ?? coarse;

  if (!show) return null;

  /** @param {'up'|'down'|'left'|'right'} dir */
  const dpadProps = (dir) => ({
    onPress: () => pressDirection(dir),
    onRelease: () => releaseDirection(dir),
  });

  return (
    <div
      role="group"
      aria-label="Touch controls"
      className={
        'w-full flex items-center justify-between gap-6 px-4 py-3 select-none ' +
        className
      }
      style={{ touchAction: 'none' }}
    >
      {/* Directional pad — 3x3 grid with buttons on the cross positions. */}
      <div
        role="group"
        aria-label="Directional pad"
        className="grid grid-cols-3 grid-rows-3 gap-2"
      >
        <span aria-hidden="true" />
        <ControlButton label="Move up" {...dpadProps('up')}>
          <span aria-hidden="true">▲</span>
        </ControlButton>
        <span aria-hidden="true" />

        <ControlButton label="Move left" {...dpadProps('left')}>
          <span aria-hidden="true">◀</span>
        </ControlButton>
        <span aria-hidden="true" />
        <ControlButton label="Move right" {...dpadProps('right')}>
          <span aria-hidden="true">▶</span>
        </ControlButton>

        <span aria-hidden="true" />
        <ControlButton label="Move down" {...dpadProps('down')}>
          <span aria-hidden="true">▼</span>
        </ControlButton>
        <span aria-hidden="true" />
      </div>

      {/* Pause — edge-triggered tap, styled as a distinct accent action. */}
      <ControlButton
        label="Pause or resume"
        onPress={() => pressPause()}
        className="!bg-fuchsia-500/80 active:!bg-fuchsia-400 !rounded-full"
      >
        <span aria-hidden="true">❚❚</span>
      </ControlButton>
    </div>
  );
}

export default TouchControls;
