# Requirements Document

## Introduction

This spec covers enhancements to the Schematic Editor (`/schematic-editor`) in the Silicofeller Quantum Studio frontend. The goal is to improve canvas navigation, correct ruler placement, polish scrollbar styling, animate component hover controls, persist panel layout, and add a collapsible Component Library strip.

The editor already has a functional left ruler, bottom ruler, scrollbar thumbs, per-component hover zoom controls (25%–500%), and `ResizablePanelGroup` for all panels. This spec addresses the gaps between the current state and the full feature set described in the project requirements.

## Requirements

### REQ-1 — Ruler Placement (Top + Left)

**Current state:** Horizontal ruler is rendered at the **bottom** of the canvas. Vertical ruler is on the **left**.

**Required:** Move the horizontal ruler to the **top** edge. Keep the vertical ruler on the left.

#### REQ-1.1 — Top Horizontal Ruler
- The horizontal ruler must be rendered at the **top** of the canvas area (above the dot-grid, not at the bottom).
- Height: `RULER_T = 24px`.
- Displays mm coordinate labels for major ticks and short tick marks for minor subdivisions.
- Updates in real time during zoom and pan operations.
- Ruler coordinate system aligns with canvas world coordinates (mm, auto-switching to µm at high zoom).

#### REQ-1.2 — Left Vertical Ruler
- The vertical ruler remains on the left edge — no position change needed.
- Width: `RULER_L = 28px` (unchanged).
- Labels rotate 90° counter-clockwise displaying mm values.
- Updates with zoom/pan.

#### REQ-1.3 — Ruler Corner
- The top-left corner cell (intersection of top ruler and left ruler) must be filled with `var(--muted)` to prevent overlapping labels.

#### REQ-1.4 — Remove Bottom Ruler
- The existing bottom ruler is removed and replaced by the scrollbar area.

---

### REQ-2 — Scrollbars

**Current state:** 10px SVG thumb rectangles embedded in the canvas SVG corner with no visible track, no hover state, minimal contrast.

**Required:** Proper styled scrollbars clearly visible and usable.

#### REQ-2.1 — Horizontal Scrollbar
- Positioned at the **bottom** of the canvas area (below the dot-grid).
- Height: `SCROLL_H = 12px`.
- Contains a visible **track** (`var(--muted)` background, full width) and a **thumb** (`var(--border)` fill, `rx=4`, rounded).
- Thumb width is proportional to `visibleWorldFraction` vs. `WORLD_H * 2` total range.
- Thumb position reflects current `state.pan.x`.
- Dragging the thumb updates `state.pan.x` smoothly via pointer capture.
- Thumb minimum width: 24px.

#### REQ-2.2 — Vertical Scrollbar
- Positioned at the **right** edge of the canvas area.
- Width: `SCROLL_W = 12px`.
- Same styling pattern as horizontal scrollbar.
- Thumb height proportional to visible world fraction.
- Thumb position reflects current `state.pan.y`.
- Dragging the thumb updates `state.pan.y`.
- Thumb minimum height: 24px.

#### REQ-2.3 — Scrollbar Hover State
- On hover, thumb color transitions to `var(--primary)` over 150ms.
- Track background lightens slightly on hover.

#### REQ-2.4 — Mouse Wheel Compatibility
- Wheel events on the canvas continue to zoom (not scroll). No change to existing behavior.

#### REQ-2.5 — Synchronization
- Thumb positions update synchronously with `state.pan` and `state.zoom` changes. No batching delay.

---

### REQ-3 — Component Hover Controls (Animation)

**Current state:** The `[ − ] [ 100% ] [ + ]` pill appears and disappears instantly with no animation.

**Required:** Smooth fade-in / fade-out transitions.

#### REQ-3.1 — Fade-In
- On hover enter (or selection), pill fades in over ~150ms.
- CSS: `transition: opacity 150ms ease, transform 150ms ease`.
- Start: `opacity: 0; transform: translateY(4px)`.
- End: `opacity: 1; transform: translateY(0)`.

#### REQ-3.2 — Fade-Out
- On hover leave (when not selected), pill fades out over ~120ms.
- During fade-out, `pointer-events: none` to prevent accidental clicks.

#### REQ-3.3 — Interaction Availability
- During fade-in, `pointer-events: auto` — buttons are immediately clickable.

#### REQ-3.4 — Scale Limits Display
- At `SCALE_MIN` (25%): `−` button is `disabled`, shows tooltip "Minimum scale reached".
- At `SCALE_MAX` (500%): `+` button is `disabled`, shows tooltip "Maximum scale reached".
- Disabled buttons render with `opacity-30` and `cursor-not-allowed`.

#### REQ-3.5 — Per-Component Independence
- Each component independently stores its scale via `_uiScale` in `placement.params`.
- Scale step: `SCALE_STEP = 0.1` (10 percentage points per click).
- Scale range: `[0.25, 5.0]` (25% to 500%).

---

### REQ-4 — Panel Layout Persistence

**Current state:** `ResizablePanelGroup` panels have working resize handles but panel sizes reset to defaults on every page reload.

**Required:** Panel sizes are saved to and restored from localStorage.

#### REQ-4.1 — Storage
- Key: `"silicofeller:panel-layout:v1"`.
- Stored shape:
  ```ts
  interface PanelLayout {
    libSize: number;        // Component Library width %
    inspectorSize: number;  // Property Inspector width %
    codeSize: number;       // Code IDE width %
    libOpen: boolean;       // Whether library panel is open
  }
  ```

#### REQ-4.2 — Save Trigger
- Save layout whenever the user finishes dragging a panel divider, using `onLayout` callback on `ResizablePanelGroup`.

#### REQ-4.3 — Restore on Mount
- On mount, read stored layout from localStorage.
- Apply stored `defaultSize` to each panel.
- If no stored layout exists, use defaults: `libSize=18, inspectorSize=24, codeSize=40, libOpen=false`.
- Clamp values to each panel's `[minSize, maxSize]` range if out of bounds.

#### REQ-4.4 — Panel Size Constraints (unchanged)
- Component Library: `min=12`, `max=35`, default=18
- Property Inspector: `min=14`, `max=42`, default=24
- Code IDE: `min=24`, `max=62`, default=40

---

### REQ-5 — Component Library Collapsible Strip

**Current state:** When `libOpen = false`, the Component Library panel is fully unmounted. No collapse animation, no collapsed indicator.

**Required:** Collapsed strip indicator and animated open/close.

#### REQ-5.1 — Collapsed Strip
- When `libOpen = false`, show a narrow vertical strip (`16px` wide) on the left edge of the workspace.
- Strip contains a rotated label "Components" and a chevron-right icon.
- Clicking the strip sets `libOpen = true` and opens the panel.
- Strip shows a tooltip "Open Component Library" on hover.

#### REQ-5.2 — Persist Open/Closed State
- `libOpen` value is included in the `PanelLayout` stored in localStorage (REQ-4.1).
- Restored on reload along with panel sizes.

#### REQ-5.3 — Collapse Behavior
- Panel unmount/mount behavior is acceptable (no animation required for collapse itself).
- The strip must appear immediately when `libOpen = false`.

---

### REQ-6 — Ruler Unit Labels

**Current state:** `fmtTick` already switches between mm and µm display. No static unit label is shown on the ruler.

**Required:** Small unit indicator label on each ruler.

#### REQ-6.1 — Unit Label
- Top ruler: small `"mm"` label (or `"µm"` when `step < 0.01`) at the right end of the ruler, near the right edge.
- Left ruler: small `"mm"` (or `"µm"`) label at the bottom of the ruler, near the corner.
- Font size: 7px, color: `var(--muted-foreground)`.
- Unit switches dynamically with zoom (same threshold as `fmtTick`: `step < 0.01` → µm).

---

### REQ-7 — Canvas Auto-Resize (Verification)

**Current state:** `EditorCanvas` uses `ResizeObserver` on its container div — already works correctly.

**Required:** No code change. Verify that canvas reflows when panel dividers are dragged.

#### REQ-7.1
- When any panel divider is dragged, the `EditorCanvas` container must resize and the `ResizeObserver` must update `size.w` / `size.h`.
- Canvas content must not clip or overflow during or after resize.

---

## Glossary

| Term | Definition |
|------|-----------|
| `RULER_L` | Width in px of the left vertical ruler (28px) |
| `RULER_T` | Height in px of the top horizontal ruler (24px, replaces `RULER_B`) |
| `SCROLL_H` | Height in px of the horizontal scrollbar (12px) |
| `SCROLL_W` | Width in px of the vertical scrollbar (12px) |
| `WORLD_H` | Half the total navigable world extent in mm (20mm, so total = 40mm × 40mm) |
| `MM_TO_PX` | Canvas scale factor: 1mm = 80px at zoom=1 |
| `UI_SCALE_KEY` | The `placement.params` key storing per-component visual scale (`"_uiScale"`) |
| `SCALE_MIN` | Minimum per-component scale: 0.25 (25%) |
| `SCALE_MAX` | Maximum per-component scale: 5.0 (500%) |
| `SCALE_STEP` | Per-click scale increment: 0.1 (10 percentage points) |
| `PanelLayout` | localStorage object tracking panel sizes and `libOpen` state |
| Thumb | The draggable indicator inside a scrollbar track |
| Track | The full-length background of a scrollbar |
| Collapsed strip | 16px-wide vertical bar shown when the Component Library panel is closed |
