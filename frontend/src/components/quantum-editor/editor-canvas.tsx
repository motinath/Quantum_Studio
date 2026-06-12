import {
  useRef, useState, useEffect, useCallback, useMemo,
  forwardRef, useImperativeHandle,
} from "react";
import { useQueries, useQuery } from "@tanstack/react-query";
import { Plus, Minus, Maximize2, ZoomIn, ZoomOut } from "lucide-react";
import { prefixForCategory, type EditorState } from "@/lib/editor/design-store";
import { useWorkspace } from "@/lib/editor/workspace-store";
import {
  componentPinsQueryOptions,
  componentPreviewQueryOptions,
  componentsQueryOptions,
} from "@/lib/bridge/queries";
import { defaultParamsFromMetadata } from "@/lib/bridge/adapters";
import { bridgeClient } from "@/lib/bridge/client";
import type { ComponentSummary, PinSpec, Placement } from "@/lib/bridge/types";
import { cn } from "@/lib/utils";

// ── Canvas constants ──────────────────────────────────────────────────────────
const MM_TO_PX   = 80;
const UM_TO_MM   = 0.001;
const RULER_L    = 28;   // left vertical ruler width (px)
const RULER_T    = 24;   // top horizontal ruler height (px)  ← replaces RULER_B
const SCROLL_H   = 12;   // horizontal scrollbar height (px)
const SCROLL_W   = 12;   // vertical scrollbar width (px)
const WORLD_H    = 20;   // half of navigable world in mm (total = 40 × 40 mm)

const UI_SCALE_KEY = "_uiScale";
const SCALE_MIN    = 0.25;
const SCALE_MAX    = 5.0;
const SCALE_STEP   = 0.1;

const LIB_DRAG_START = "silicofeller:component-drag-start";
const LIB_DRAG_END   = "silicofeller:component-drag-end";

// ── Public handle ─────────────────────────────────────────────────────────────
export interface EditorCanvasHandle {
  fitToContent: () => void;
  getSvgElement: () => SVGSVGElement | null;
}

// ── Drag state ────────────────────────────────────────────────────────────────
type DragState =
  | { mode: "pan";  startX: number; startY: number; panX: number; panY: number }
  | { mode: "move"; id: string; offsetX: number; offsetY: number }
  | null;

// ── Helpers ───────────────────────────────────────────────────────────────────
function getUiScale(p: Placement): number {
  const v = p.params[UI_SCALE_KEY];
  return typeof v === "number" && v > 0 ? v : 1;
}

function rulerTicks(worldStart: number, worldEnd: number, pixLen: number) {
  const span = worldEnd - worldStart;
  if (span <= 0 || pixLen <= 0) return [];
  const raw  = span / (pixLen / 80);
  const mag  = Math.pow(10, Math.floor(Math.log10(raw)));
  let step   = mag;
  if (raw / mag > 5) step = mag * 5; else if (raw / mag > 2) step = mag * 2;
  const first = Math.ceil(worldStart / step) * step;
  const ticks: { value: number; px: number; major: boolean }[] = [];
  for (let v = first; v <= worldEnd + step * 0.01; v += step) {
    const px = ((v - worldStart) / span) * pixLen;
    if (px < 0 || px > pixLen) continue;
    ticks.push({ value: parseFloat(v.toFixed(8)), px, major: Math.abs(Math.round(v / step) % 5) === 0 });
  }
  return ticks;
}

function fmtTick(v: number, step: number): string {
  if (Math.abs(v) < 1e-9) return "0";
  if (step < 0.01) return `${(v * 1000).toFixed(0)}µ`;
  return `${v.toFixed(step < 0.5 ? 1 : 0)}`;
}

// ── Main component ────────────────────────────────────────────────────────────
export const EditorCanvas = forwardRef<EditorCanvasHandle, object>(function EditorCanvas(_p, ref) {
  const { activeTab, dispatchActive } = useWorkspace();
  const state    = activeTab.state;
  const dispatch = dispatchActive;
  const doc      = { placements: state.placements, connections: state.connections };

  const uniqueName = useCallback((prefix: string) => {
    let n = 0;
    const taken = new Set(state.placements.map((p) => p.name));
    while (taken.has(`${prefix}${n}`)) n++;
    return `${prefix}${n}`;
  }, [state.placements]);

  const svgRef       = useRef<SVGSVGElement | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const [size,      setSize]      = useState({ w: 800, h: 600 });
  const [drag,      setDrag]      = useState<DragState>(null);
  const [libDragId, setLibDragId] = useState<string | null>(null);
  const [dropPrev,  setDropPrev]  = useState<{ componentId: string; x: number; y: number } | null>(null);
  const [dragOver,  setDragOver]  = useState(false);
  const [hovered,   setHovered]   = useState<string | null>(null);
  // scrollbar hover tracking
  const [hScrollHover, setHScrollHover] = useState(false);
  const [vScrollHover, setVScrollHover] = useState(false);

  // Canvas content dimensions (inside rulers + scrollbars)
  //   top ruler:  RULER_T
  //   left ruler: RULER_L
  //   right:      SCROLL_W
  //   bottom:     SCROLL_H
  const canvasW = size.w - RULER_L - SCROLL_W;
  const canvasH = size.h - RULER_T - SCROLL_H;

  useEffect(() => {
    const el = containerRef.current; if (!el) return;
    const ro = new ResizeObserver(() => setSize({ w: el.clientWidth, h: el.clientHeight }));
    ro.observe(el); setSize({ w: el.clientWidth, h: el.clientHeight });
    return () => ro.disconnect();
  }, []);

  // Bridge queries
  const compsQ = useQuery(componentsQueryOptions());
  const compsById = useMemo(() => {
    const m = new Map<string, ComponentSummary>();
    (compsQ.data ?? []).forEach((c) => m.set(c.id, c));
    return m;
  }, [compsQ.data]);

  const renderQ = useQuery({
    queryKey: ["bridge", "render", doc],
    queryFn: ({ signal }) => bridgeClient.renderDesign(doc, signal).then((r) => { if (r.error) throw new Error(r.error); return r.data!; }),
    enabled: doc.placements.length > 0,
    staleTime: 0,
    placeholderData: (prev) => prev,
  });

  const routeSvg = useMemo(() => {
    const m = new Map<string, string>();
    (renderQ.data?.routes ?? []).forEach((r) => m.set(r.connectionId, r.svg));
    return m;
  }, [renderQ.data?.routes]);

  const pinQueries = useQueries({ queries: state.placements.map((p) => componentPinsQueryOptions(p.componentId)) });

  useEffect(() => {
    const onS = (e: Event) => { const id = (e as CustomEvent<{ componentId?: string }>).detail?.componentId; if (id) setLibDragId(id); };
    const onE = () => { setLibDragId(null); setDropPrev(null); };
    window.addEventListener(LIB_DRAG_START, onS);
    window.addEventListener(LIB_DRAG_END, onE);
    return () => { window.removeEventListener(LIB_DRAG_START, onS); window.removeEventListener(LIB_DRAG_END, onE); };
  }, []);

  // ── Coordinate transforms ──────────────────────────────────────────────────
  // SVG origin for canvas content is at (RULER_L, RULER_T)
  const w2s = useCallback((x: number, y: number) => ({
    px: RULER_L + canvasW / 2 + (x * MM_TO_PX + state.pan.x) * state.zoom,
    py: RULER_T + canvasH / 2 - (y * MM_TO_PX - state.pan.y) * state.zoom,
  }), [canvasW, canvasH, state.pan, state.zoom]);

  const s2w = useCallback((px: number, py: number) => ({
    x:  (px - RULER_L - canvasW / 2) / state.zoom / MM_TO_PX - state.pan.x / MM_TO_PX,
    y: -(py - RULER_T - canvasH / 2) / state.zoom / MM_TO_PX + state.pan.y / MM_TO_PX,
  }), [canvasW, canvasH, state.pan, state.zoom]);

  // ── Wheel zoom ─────────────────────────────────────────────────────────────
  useEffect(() => {
    const svg = svgRef.current; if (!svg) return;
    const onW = (e: WheelEvent) => { e.preventDefault(); dispatch({ type: "ZOOM", zoom: state.zoom * (e.deltaY < 0 ? 1.1 : 1/1.1) }); };
    svg.addEventListener("wheel", onW, { passive: false });
    return () => svg.removeEventListener("wheel", onW);
  }, [dispatch, state.zoom]);

  // ── Keyboard shortcuts ─────────────────────────────────────────────────────
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") dispatch({ type: "CANCEL_PIN" });
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "z" && !e.shiftKey) { e.preventDefault(); dispatch({ type: "UNDO" }); }
      if ((e.metaKey || e.ctrlKey) && (e.key === "y" || (e.shiftKey && e.key.toLowerCase() === "z"))) { e.preventDefault(); dispatch({ type: "REDO" }); }
      if ((e.key === "Delete" || e.key === "Backspace") && state.selection &&
          document.activeElement?.tagName !== "INPUT" && document.activeElement?.tagName !== "TEXTAREA") {
        if (state.selection.kind === "placement") dispatch({ type: "DELETE_PLACEMENT", id: state.selection.id });
        else dispatch({ type: "DELETE_CONNECTION", id: state.selection.id });
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [dispatch, state.selection]);

  // ── Pointer handlers ───────────────────────────────────────────────────────
  const onPDown = (e: React.PointerEvent<SVGSVGElement>) => {
    const t = e.target as Element;
    if (t === e.currentTarget || t.getAttribute("data-canvas-bg") === "true" || state.tool === "pan") {
      setDrag({ mode: "pan", startX: e.clientX, startY: e.clientY, panX: state.pan.x, panY: state.pan.y });
      dispatch({ type: "SELECT", selection: null });
      (e.currentTarget as Element).setPointerCapture(e.pointerId);
    }
  };

  const onPMove = (e: React.PointerEvent<SVGSVGElement>) => {
    if (!drag) return;
    const rect = svgRef.current?.getBoundingClientRect(); if (!rect) return;
    if (drag.mode === "pan") {
      dispatch({ type: "PAN", x: drag.panX + (e.clientX - drag.startX) / state.zoom, y: drag.panY - (e.clientY - drag.startY) / state.zoom });
    } else if (drag.mode === "move" && state.tool !== "pan") {
      const w = s2w(e.clientX - rect.left - drag.offsetX, e.clientY - rect.top - drag.offsetY);
      const snap = 0.05;
      dispatch({ type: "MOVE_PLACEMENT", id: drag.id, x: Math.round(w.x / snap) * snap, y: Math.round(w.y / snap) * snap });
    }
  };

  const onPUp = (e: React.PointerEvent<SVGSVGElement>) => {
    if (drag && (e.currentTarget as Element).hasPointerCapture(e.pointerId))
      (e.currentTarget as Element).releasePointerCapture(e.pointerId);
    setDrag(null);
  };

  // ── Drop handlers ──────────────────────────────────────────────────────────
  const onDrop = async (e: React.DragEvent) => {
    e.preventDefault(); setDragOver(false);
    const cid = e.dataTransfer.getData("application/x-silicofeller-component");
    setDropPrev(null); setLibDragId(null);
    if (!cid) return;
    const summary = compsById.get(cid); if (!summary) return;
    const rect = svgRef.current?.getBoundingClientRect(); if (!rect) return;
    const w = s2w(e.clientX - rect.left, e.clientY - rect.top);
    const snap = 0.05;
    const x = Math.round(w.x / snap) * snap, y = Math.round(w.y / snap) * snap;
    const metaRes = await bridgeClient.getMetadata(cid);
    const params  = metaRes.data ? defaultParamsFromMetadata(metaRes.data) : {};
    const name    = uniqueName(prefixForCategory(summary.category));
    dispatch({
      type: "ADD_PLACEMENT",
      placement: { id: `pl_${name}_${Date.now()}`, componentId: cid, name, x: parseFloat(x.toFixed(3)), y: parseFloat(y.toFixed(3)), rotation: 0, params },
    });
  };

  const onDragOver = (e: React.DragEvent<SVGSVGElement>) => {
    e.preventDefault(); setDragOver(true); e.dataTransfer.dropEffect = "copy";
    const cid  = libDragId || (e.dataTransfer.types.includes("application/x-silicofeller-component") ? e.dataTransfer.getData("application/x-silicofeller-component") : "");
    const rect = svgRef.current?.getBoundingClientRect();
    if (!cid || !rect) return;
    const w = s2w(e.clientX - rect.left, e.clientY - rect.top);
    const snap = 0.05;
    setDropPrev({ componentId: cid, x: Math.round(w.x / snap) * snap, y: Math.round(w.y / snap) * snap });
  };

  // ── Fit-to-content ─────────────────────────────────────────────────────────
  const fitToContent = useCallback(() => {
    if (!state.placements.length) { dispatch({ type: "ZOOM", zoom: 1 }); dispatch({ type: "PAN", x: 0, y: 0 }); return; }
    const xs = state.placements.map((p) => p.x), ys = state.placements.map((p) => p.y);
    const pad = 1.5;
    const cW = Math.max(Math.max(...xs) - Math.min(...xs) + pad * 2, 2);
    const cH = Math.max(Math.max(...ys) - Math.min(...ys) + pad * 2, 2);
    const zoom = Math.min(canvasW / (cW * MM_TO_PX), canvasH / (cH * MM_TO_PX), 4);
    dispatch({ type: "ZOOM", zoom });
    dispatch({ type: "PAN", x: -((Math.min(...xs) + Math.max(...xs)) / 2) * MM_TO_PX, y: -((Math.min(...ys) + Math.max(...ys)) / 2) * MM_TO_PX });
  }, [state.placements, canvasW, canvasH, dispatch]);

  useImperativeHandle(ref, () => ({ fitToContent, getSvgElement: () => svgRef.current }), [fitToContent]);

  // ── Ruler tick computation ─────────────────────────────────────────────────
  // Horizontal ruler (top): world X at left and right edges of canvas
  const hWS = s2w(RULER_L,           RULER_T + canvasH / 2);
  const hWE = s2w(RULER_L + canvasW, RULER_T + canvasH / 2);

  // Vertical ruler (left): world Y coords.
  // s2w at SVG y=RULER_T (top of canvas)      → large positive world-Y (top of design)
  // s2w at SVG y=RULER_T+canvasH (bottom)     → small / negative world-Y (bottom of design)
  // rulerTicks needs worldStart < worldEnd, so pass bottom→top:
  const vWBottom = s2w(RULER_L, RULER_T + canvasH);  // smallest world-Y (SVG bottom)
  const vWTop    = s2w(RULER_L, RULER_T);             // largest  world-Y (SVG top)

  const hTicks = useMemo(() => rulerTicks(hWS.x,        hWE.x,        canvasW), [hWS.x, hWE.x, canvasW]);
  // vTicks: px=0 corresponds to vWBottom (SVG bottom), px increases upward → flip to SVG y
  const vTicks = useMemo(() => rulerTicks(vWBottom.y,   vWTop.y,      canvasH), [vWBottom.y, vWTop.y, canvasH]);

  const hStep = hTicks.length >= 2 ? Math.abs(hTicks[1].value - hTicks[0].value) : 1;
  const vStep = vTicks.length >= 2 ? Math.abs(vTicks[1].value - vTicks[0].value) : 1;
  const unitLabel = hStep < 0.01 ? "µm" : "mm";

  // ── Scrollbar geometry ─────────────────────────────────────────────────────
  const wTotal = WORLD_H * 2; // 40 mm navigable range
  const panXmm =  -state.pan.x / MM_TO_PX;
  const panYmm =   state.pan.y / MM_TO_PX;
  const vHX = (canvasW / 2) / state.zoom / MM_TO_PX;
  const vHY = (canvasH / 2) / state.zoom / MM_TO_PX;

  // Horizontal thumb
  const hTrackW  = canvasW;
  const hTS      = Math.max(0, Math.min(1, (panXmm - vHX + WORLD_H) / wTotal));
  const hTSz     = Math.min(1, (vHX * 2) / wTotal);
  const hThumbW  = Math.max(24, hTSz * hTrackW);
  const hThumbX  = RULER_L + hTS * (hTrackW - hThumbW);

  // Vertical thumb
  const vTrackH  = canvasH;
  const vTS      = Math.max(0, Math.min(1, 1 - (panYmm + vHY + WORLD_H) / wTotal));
  const vTSz     = Math.min(1, (vHY * 2) / wTotal);
  const vThumbH  = Math.max(24, vTSz * vTrackH);
  const vThumbY  = RULER_T + vTS * (vTrackH - vThumbH);

  // ── Per-component scale ────────────────────────────────────────────────────
  const changeScale = useCallback((id: string, delta: number) => {
    const p = state.placements.find((x) => x.id === id); if (!p) return;
    const cur  = getUiScale(p);
    const next = Math.max(SCALE_MIN, Math.min(SCALE_MAX, parseFloat((cur + delta).toFixed(2))));
    dispatch({ type: "UPDATE_PLACEMENT", id, patch: { params: { ...p.params, [UI_SCALE_KEY]: next } } });
  }, [state.placements, dispatch]);

  // ── Clip path id (unique per canvas tab to avoid collisions) ───────────────
  const clipId = `cc-${activeTab.id}`;

  // ── Render ─────────────────────────────────────────────────────────────────
  return (
    <div ref={containerRef} className="relative h-full w-full overflow-hidden bg-background select-none">
      <svg
        ref={svgRef}
        width={size.w}
        height={size.h}
        className="block touch-none"
        style={{
          cursor: state.tool === "pan"
            ? (drag?.mode === "pan" ? "grabbing" : "grab")
            : drag?.mode === "move" ? "grabbing" : "default",
        }}
        onPointerDown={onPDown}
        onPointerMove={onPMove}
        onPointerUp={onPUp}
        onPointerCancel={onPUp}
        onDragEnter={onDragOver}
        onDragOver={onDragOver}
        onDragLeave={(e) => { if (!e.currentTarget.contains(e.relatedTarget as Node | null)) { setDropPrev(null); setDragOver(false); } }}
        onDrop={onDrop}
      >
        <defs>
          <clipPath id={clipId}>
            <rect x={RULER_L} y={RULER_T} width={canvasW} height={canvasH} />
          </clipPath>
        </defs>

        {/* ── Dot-grid background ────────────────────────────────────────── */}
        <rect
          data-canvas-bg="true"
          x={RULER_L} y={RULER_T} width={canvasW} height={canvasH}
          fill="transparent"
          style={{
            backgroundImage: "radial-gradient(circle, color-mix(in oklab, var(--foreground) 15%, transparent) 1px, transparent 1px)",
            backgroundSize: `${24 * state.zoom}px ${24 * state.zoom}px`,
            backgroundPosition: `${state.pan.x * state.zoom + canvasW / 2}px ${-state.pan.y * state.zoom + canvasH / 2}px`,
          }}
        />

        {/* ── Canvas content (clipped) ───────────────────────────────────── */}
        <g clipPath={`url(#${clipId})`}>
          {/* Drop-zone boundary */}
          {(() => {
            const { px: tx, py: ty } = w2s(-4.5,  3);
            const { px: bx, py: by } = w2s( 4.5, -3);
            return (
              <rect
                x={tx} y={ty} width={bx - tx} height={by - ty}
                fill={dragOver ? "color-mix(in oklab, var(--primary) 10%, transparent)" : "none"}
                stroke={dragOver ? "var(--primary)" : "color-mix(in oklab, var(--foreground) 20%, transparent)"}
                strokeWidth={dragOver ? 2 : 1.5}
                strokeDasharray={dragOver ? "none" : "8 5"}
                rx={3}
              />
            );
          })()}

          {/* Bridge render overlay */}
          {renderQ.data?.svg && (() => {
            const sc = state.zoom * MM_TO_PX * UM_TO_MM;
            const { px, py } = w2s(0, 0);
            return <g transform={`translate(${px} ${py}) scale(${sc} ${-sc})`} dangerouslySetInnerHTML={{ __html: renderQ.data!.svg }} />;
          })()}

          {/* Component previews (fallback when no bridge render) */}
          {!renderQ.data?.svg && state.placements.map((p) => (
            <PlacementPreview key={p.id} placement={p} w2s={w2s} zoom={state.zoom} uiScale={getUiScale(p)} />
          ))}

          {/* Drop ghost */}
          {dropPrev && <DropGhost componentId={dropPrev.componentId} x={dropPrev.x} y={dropPrev.y} w2s={w2s} zoom={state.zoom} />}

          {/* Placements + pins */}
          {state.placements.map((p, i) => (
            <PlacementGlyph
              key={p.id}
              placement={p}
              componentId={p.componentId}
              selected={state.selection?.kind === "placement" && state.selection.id === p.id}
              pendingOwner={state.pendingPin?.placementId ?? null}
              pendingPin={state.pendingPin?.pinName ?? null}
              pins={pinQueries[i]?.data?.pins ?? []}
              w2s={w2s}
              zoom={state.zoom}
              uiScale={getUiScale(p)}
              onPointerDown={(e) => {
                e.stopPropagation();
                if (state.tool === "pan") return;
                dispatch({ type: "SELECT", selection: { kind: "placement", id: p.id } });
                const rect = svgRef.current?.getBoundingClientRect(); if (!rect) return;
                const sc = w2s(p.x, p.y);
                setDrag({ mode: "move", id: p.id, offsetX: e.clientX - rect.left - sc.px, offsetY: e.clientY - rect.top - sc.py });
                (e.currentTarget as Element).setPointerCapture(e.pointerId);
              }}
              onPinClick={(pin) => dispatch({ type: "PIN_CLICK", placementId: p.id, pinName: pin, defaultRouteComponentId: "RouteMeander" })}
            />
          ))}

          {/* Connections */}
          {state.connections.map((c) => {
            const a = state.placements.find((x) => x.id === c.from.placementId);
            const b = state.placements.find((x) => x.id === c.to.placementId);
            if (!a || !b) return null;
            const isSel = state.selection?.kind === "connection" && state.selection.id === c.id;
            const rsvg  = routeSvg.get(c.id);
            if (rsvg && renderQ.data) {
              const sc = state.zoom * MM_TO_PX * UM_TO_MM;
              const { px, py } = w2s(0, 0);
              return (
                <g key={c.id} className="cursor-pointer" onClick={(e) => { e.stopPropagation(); dispatch({ type: "SELECT", selection: { kind: "connection", id: c.id } }); }}>
                  {isSel && <g transform={`translate(${px} ${py}) scale(${sc} ${-sc})`} opacity={0.3} dangerouslySetInnerHTML={{ __html: rsvg }} />}
                  <g transform={`translate(${px} ${py}) scale(${sc} ${-sc})`} opacity={isSel ? 1 : 0.9} dangerouslySetInnerHTML={{ __html: rsvg }} />
                </g>
              );
            }
            const pa = w2s(a.x, a.y), pb = w2s(b.x, b.y);
            return (
              <g key={c.id}>
                {isSel && <path d={`M ${pa.px} ${pa.py} L ${pb.px} ${pb.py}`} stroke="var(--primary)" strokeWidth={8} strokeOpacity={0.2} fill="none" />}
                <path
                  d={`M ${pa.px} ${pa.py} L ${pb.px} ${pb.py}`}
                  stroke={isSel ? "var(--primary)" : "#5B9BD5"}
                  strokeWidth={isSel ? 2.5 : 1.8}
                  strokeDasharray={renderQ.isLoading ? "6 4" : "none"}
                  fill="none"
                  className="cursor-pointer"
                  onClick={(e) => { e.stopPropagation(); dispatch({ type: "SELECT", selection: { kind: "connection", id: c.id } }); }}
                />
                <text x={(pa.px+pb.px)/2} y={(pa.py+pb.py)/2 - 6} textAnchor="middle" fontSize={8} fill={isSel ? "var(--primary)" : "var(--muted-foreground)"} className="pointer-events-none select-none">
                  {renderQ.isLoading ? "rendering…" : (c.routeComponentId ?? "CPW")}
                </text>
              </g>
            );
          })}
        </g>

        {/* ══════════════════════════════════════════════════════════════════
            TOP HORIZONTAL RULER  (REQ-1.1)
        ══════════════════════════════════════════════════════════════════ */}
        <g>
          {/* Ruler background */}
          <rect x={RULER_L} y={0} width={canvasW} height={RULER_T} fill="var(--card)" />
          {/* Bottom border line */}
          <line x1={RULER_L} y1={RULER_T} x2={RULER_L + canvasW} y2={RULER_T} stroke="var(--border)" strokeWidth={1} />
          {/* Tick marks and labels */}
          {hTicks.map(({ value, px, major }) => (
            <g key={value}>
              {/* Ticks grow downward from the bottom border of the ruler toward the canvas */}
              <line
                x1={RULER_L + px} y1={RULER_T}
                x2={RULER_L + px} y2={RULER_T + (major ? 8 : 5)}
                stroke="var(--muted-foreground)" strokeWidth={major ? 1 : 0.5}
              />
              {major && (
                <text
                  x={RULER_L + px + 2} y={RULER_T - 4}
                  fontSize={8} fill="var(--muted-foreground)"
                  className="pointer-events-none select-none"
                >
                  {fmtTick(value, hStep)}
                </text>
              )}
            </g>
          ))}
          {/* Unit label at far right of top ruler */}
          <text
            x={RULER_L + canvasW - 3} y={RULER_T - 3}
            fontSize={7} textAnchor="end" fill="var(--muted-foreground)"
            className="pointer-events-none select-none"
          >
            {unitLabel}
          </text>
        </g>

        {/* ══════════════════════════════════════════════════════════════════
            LEFT VERTICAL RULER  (REQ-1.2)
        ══════════════════════════════════════════════════════════════════ */}
        <g>
          {/* Ruler background */}
          <rect x={0} y={RULER_T} width={RULER_L} height={canvasH} fill="var(--card)" />
          {/* Right border line */}
          <line x1={RULER_L} y1={RULER_T} x2={RULER_L} y2={RULER_T + canvasH} stroke="var(--border)" strokeWidth={1} />
          {/* Tick marks and labels */}
          {vTicks.map(({ value, px, major }) => {
            // px=0 → SVG bottom of canvas; px=canvasH → SVG top of canvas
            const sy = RULER_T + canvasH - px;
            return (
              <g key={value}>
                <line
                  x1={RULER_L - (major ? 10 : 6)} y1={sy}
                  x2={RULER_L} y2={sy}
                  stroke="var(--muted-foreground)" strokeWidth={major ? 1 : 0.5}
                />
                {major && (
                  <text
                    x={RULER_L / 2} y={sy}
                    fontSize={8} textAnchor="middle" dominantBaseline="middle"
                    fill="var(--muted-foreground)"
                    transform={`rotate(-90,${RULER_L / 2},${sy})`}
                    className="pointer-events-none select-none"
                  >
                    {fmtTick(value, vStep)}
                  </text>
                )}
              </g>
            );
          })}
          {/* Unit label at bottom of left ruler */}
          <text
            x={RULER_L / 2} y={RULER_T + canvasH - 4}
            fontSize={7} textAnchor="middle" fill="var(--muted-foreground)"
            className="pointer-events-none select-none"
          >
            {unitLabel}
          </text>
        </g>

        {/* ══════════════════════════════════════════════════════════════════
            CORNER CELLS  (REQ-1.3)
        ══════════════════════════════════════════════════════════════════ */}
        {/* Top-left corner (ruler intersection) */}
        <rect x={0} y={0} width={RULER_L} height={RULER_T} fill="var(--muted)" />
        {/* Bottom-left corner (left ruler + scrollbar) */}
        <rect x={0} y={RULER_T + canvasH} width={RULER_L} height={SCROLL_H} fill="var(--muted)" />
        {/* Top-right corner (top ruler + scrollbar) */}
        <rect x={RULER_L + canvasW} y={0} width={SCROLL_W} height={RULER_T} fill="var(--muted)" />
        {/* Bottom-right corner (both scrollbars) */}
        <rect x={RULER_L + canvasW} y={RULER_T + canvasH} width={SCROLL_W} height={SCROLL_H} fill="var(--muted)" />

        {/* ══════════════════════════════════════════════════════════════════
            HORIZONTAL SCROLLBAR  (REQ-2.1 / 2.3 / 2.5)
        ══════════════════════════════════════════════════════════════════ */}
        <g
          onMouseEnter={() => setHScrollHover(true)}
          onMouseLeave={() => setHScrollHover(false)}
        >
          {/* Track */}
          <rect
            x={RULER_L} y={RULER_T + canvasH}
            width={canvasW} height={SCROLL_H}
            fill={hScrollHover ? "color-mix(in oklab, var(--muted) 80%, var(--border))" : "var(--muted)"}
            style={{ transition: "fill 150ms ease" }}
          />
          {/* Thumb */}
          <rect
            x={hThumbX}
            y={RULER_T + canvasH + 2}
            width={hThumbW}
            height={SCROLL_H - 4}
            fill={hScrollHover ? "var(--primary)" : "var(--border)"}
            rx={4}
            className="cursor-pointer"
            style={{ transition: "fill 150ms ease" }}
            onPointerDown={(e) => {
              e.stopPropagation();
              const sx = e.clientX, sp = state.pan.x;
              const mv = (ev: PointerEvent) => {
                const ratio = (ev.clientX - sx) / (hTrackW - hThumbW);
                dispatch({ type: "PAN", x: sp - ratio * wTotal * MM_TO_PX, y: state.pan.y });
              };
              const up = () => { window.removeEventListener("pointermove", mv); window.removeEventListener("pointerup", up); };
              window.addEventListener("pointermove", mv);
              window.addEventListener("pointerup", up);
              (e.currentTarget as Element).setPointerCapture(e.pointerId);
            }}
          />
        </g>

        {/* ══════════════════════════════════════════════════════════════════
            VERTICAL SCROLLBAR  (REQ-2.2 / 2.3 / 2.5)
        ══════════════════════════════════════════════════════════════════ */}
        <g
          onMouseEnter={() => setVScrollHover(true)}
          onMouseLeave={() => setVScrollHover(false)}
        >
          {/* Track */}
          <rect
            x={RULER_L + canvasW} y={RULER_T}
            width={SCROLL_W} height={canvasH}
            fill={vScrollHover ? "color-mix(in oklab, var(--muted) 80%, var(--border))" : "var(--muted)"}
            style={{ transition: "fill 150ms ease" }}
          />
          {/* Thumb */}
          <rect
            x={RULER_L + canvasW + 2}
            y={vThumbY}
            width={SCROLL_W - 4}
            height={vThumbH}
            fill={vScrollHover ? "var(--primary)" : "var(--border)"}
            rx={4}
            className="cursor-pointer"
            style={{ transition: "fill 150ms ease" }}
            onPointerDown={(e) => {
              e.stopPropagation();
              const sy = e.clientY, sp = state.pan.y;
              const mv = (ev: PointerEvent) => {
                const ratio = (ev.clientY - sy) / (vTrackH - vThumbH);
                dispatch({ type: "PAN", x: state.pan.x, y: sp - ratio * wTotal * MM_TO_PX });
              };
              const up = () => { window.removeEventListener("pointermove", mv); window.removeEventListener("pointerup", up); };
              window.addEventListener("pointermove", mv);
              window.addEventListener("pointerup", up);
              (e.currentTarget as Element).setPointerCapture(e.pointerId);
            }}
          />
        </g>
      </svg>

      {/* ══════════════════════════════════════════════════════════════════════
          COMPONENT HOVER ZOOM CONTROLS  (REQ-3)
          Rendered as HTML overlays positioned over the SVG canvas.
      ══════════════════════════════════════════════════════════════════════ */}
      {state.placements.map((p) => {
        const isHovered  = hovered === p.id;
        const isSelected = state.selection?.kind === "placement" && state.selection.id === p.id;
        const visible    = isHovered || isSelected;
        const { px, py } = w2s(p.x, p.y);
        const sc         = getUiScale(p);
        const atMin      = sc <= SCALE_MIN + 0.001;
        const atMax      = sc >= SCALE_MAX - 0.001;

        return (
          <div
            key={`ov-${p.id}`}
            className="pointer-events-auto absolute z-30 flex items-center gap-1 rounded-full border border-border bg-card/95 px-2 py-1 shadow-lg backdrop-blur"
            style={{
              left: px,
              top: py,
              transform: "translate(-50%, calc(-100% - 18px))",
              // REQ-3.1 / REQ-3.2: fade-in / fade-out animation
              opacity:        visible ? 1 : 0,
              translate:      visible ? "0 0" : "0 4px",
              transition:     visible
                ? "opacity 150ms ease, translate 150ms ease"
                : "opacity 120ms ease, translate 120ms ease",
              // REQ-3.2: disable pointer events while fading out
              pointerEvents:  visible ? "auto" : "none",
            }}
            onMouseEnter={() => setHovered(p.id)}
            onMouseLeave={() => setHovered(null)}
          >
            {/* Zoom-out button */}
            <button
              type="button"
              disabled={atMin}
              onClick={(e) => { e.stopPropagation(); changeScale(p.id, -SCALE_STEP); }}
              title={atMin ? "Minimum scale reached" : "Make component smaller"}
              className={cn(
                "flex h-6 w-6 items-center justify-center rounded-full bg-muted text-foreground transition-colors",
                atMin ? "opacity-30 cursor-not-allowed" : "hover:bg-primary hover:text-primary-foreground",
              )}
            >
              <Minus className="h-3.5 w-3.5" />
            </button>

            {/* Scale indicator */}
            <span className="min-w-[40px] text-center text-[11px] font-bold tabular-nums">
              {Math.round(sc * 100)}%
            </span>

            {/* Zoom-in button */}
            <button
              type="button"
              disabled={atMax}
              onClick={(e) => { e.stopPropagation(); changeScale(p.id, SCALE_STEP); }}
              title={atMax ? "Maximum scale reached" : "Make component larger"}
              className={cn(
                "flex h-6 w-6 items-center justify-center rounded-full bg-muted text-foreground transition-colors",
                atMax ? "opacity-30 cursor-not-allowed" : "hover:bg-primary hover:text-primary-foreground",
              )}
            >
              <Plus className="h-3.5 w-3.5" />
            </button>
          </div>
        );
      })}

      {/* Invisible hover hit areas — larger than the visual glyph for easier hover capture */}
      {state.placements.map((p) => {
        const { px, py } = w2s(p.x, p.y);
        const hit = Math.max(48, 0.9 * MM_TO_PX * state.zoom * getUiScale(p));
        return (
          <div
            key={`hh-${p.id}`}
            className="pointer-events-auto absolute"
            style={{ left: px - hit/2, top: py - hit/2, width: hit, height: hit, zIndex: 15 }}
            onMouseEnter={() => setHovered(p.id)}
            onMouseLeave={() => setHovered(null)}
          />
        );
      })}

      {/* ── Global zoom controls ─────────────────────────────────────────── */}
      <div
        className="absolute flex items-center gap-1 rounded-full border border-border bg-card/95 px-1.5 py-1 shadow-sm backdrop-blur"
        style={{ bottom: SCROLL_H + 8, right: SCROLL_W + 8 }}
      >
        <button type="button" onClick={() => dispatch({ type: "ZOOM", zoom: Math.max(0.25, state.zoom/1.2) })} className="flex h-6 w-6 items-center justify-center rounded-full text-muted-foreground hover:bg-muted">
          <ZoomOut className="h-3.5 w-3.5" />
        </button>
        <button type="button" onClick={() => dispatch({ type: "ZOOM", zoom: 1 })} className="min-w-[44px] text-center text-[11px] font-bold text-foreground hover:text-primary" title="Reset zoom">
          {Math.round(state.zoom * 100)}%
        </button>
        <button type="button" onClick={() => dispatch({ type: "ZOOM", zoom: Math.min(8, state.zoom*1.2) })} className="flex h-6 w-6 items-center justify-center rounded-full text-muted-foreground hover:bg-muted">
          <ZoomIn className="h-3.5 w-3.5" />
        </button>
        <div className="mx-0.5 h-4 w-px bg-border" />
        <button type="button" onClick={fitToContent} className="flex h-6 w-6 items-center justify-center rounded-full text-muted-foreground hover:bg-muted" title="Fit view (F)">
          <Maximize2 className="h-3.5 w-3.5" />
        </button>
      </div>

      {/* ── Status overlays ──────────────────────────────────────────────── */}
      {state.pendingPin && (
        <div className="absolute rounded-full border border-primary/30 bg-primary/10 px-3 py-1 text-[11px] font-bold text-primary shadow-sm"
          style={{ top: RULER_T + 8, left: RULER_L + 8 }}
        >
          Click another pin to connect · Esc to cancel
        </div>
      )}
      {state.placements.length === 0 && (
        <div className="pointer-events-none absolute inset-0 flex items-center justify-center"
          style={{ paddingTop: RULER_T, paddingLeft: RULER_L }}
        >
          <div className="rounded-lg border border-dashed border-border bg-card/70 px-6 py-4 text-center text-xs text-muted-foreground">
            Drag a component from the Library to begin.
          </div>
        </div>
      )}
      {renderQ.isError && (
        <div className="absolute rounded-md border border-destructive/30 bg-destructive/10 px-3 py-1 text-[10px] text-destructive"
          style={{ bottom: SCROLL_H + 40, left: RULER_L + 8 }}
        >
          Render failed: {String(renderQ.error)}
        </div>
      )}
      {renderQ.isFetching && state.connections.length > 0 && (
        <div className="absolute flex items-center gap-1.5 rounded-full border border-border bg-card/90 px-3 py-1 text-[10px] text-muted-foreground shadow-sm backdrop-blur"
          style={{ bottom: SCROLL_H + 40, left: RULER_L + 8 }}
        >
          <span className="inline-block h-2 w-2 animate-pulse rounded-full bg-primary" /> Rendering route geometry…
        </div>
      )}
    </div>
  );
});

// ── Sub-components ────────────────────────────────────────────────────────────

function PlacementPreview({ placement, w2s, zoom, uiScale }: {
  placement: Placement;
  w2s: (x: number, y: number) => { px: number; py: number };
  zoom: number;
  uiScale: number;
}) {
  const q = useQuery(componentPreviewQueryOptions(placement.componentId, placement.params));
  const p = q.data;
  if (!p?.svg) return null;
  const { px, py } = w2s(placement.x, placement.y);
  const sc = zoom * MM_TO_PX * (p.units === "um" ? UM_TO_MM : 1) * uiScale;
  const vb = p.viewBox;
  return (
    <g transform={`translate(${px} ${py}) rotate(${-placement.rotation})`}>
      <g
        transform={`scale(${sc} ${-sc}) translate(${-(vb.x+vb.w/2)} ${-(vb.y+vb.h/2)})`}
        dangerouslySetInnerHTML={{ __html: p.svg }}
        style={{ transition: "transform 0.12s ease" }}
      />
    </g>
  );
}

function DropGhost({ componentId, x, y, w2s, zoom }: {
  componentId: string; x: number; y: number;
  w2s: (x: number, y: number) => { px: number; py: number };
  zoom: number;
}) {
  const q = useQuery(componentPreviewQueryOptions(componentId));
  const p = q.data;
  const { px, py } = w2s(x, y);
  if (!p?.svg) {
    const s = Math.max(36, 0.6 * MM_TO_PX * zoom), h = s / 2;
    return (
      <g className="pointer-events-none" transform={`translate(${px} ${py})`}>
        <rect x={-h} y={-h} width={s} height={s} rx={4}
          fill="color-mix(in oklab, var(--primary) 10%, transparent)"
          stroke="var(--primary)" strokeDasharray="5 4" strokeOpacity={0.65}
        />
      </g>
    );
  }
  const sc = zoom * MM_TO_PX * (p.units === "um" ? UM_TO_MM : 1);
  const vb = p.viewBox;
  return (
    <g className="pointer-events-none" opacity={0.72}>
      <g transform={`translate(${px} ${py})`}>
        <g transform={`scale(${sc} ${-sc}) translate(${-(vb.x+vb.w/2)} ${-(vb.y+vb.h/2)})`}
          dangerouslySetInnerHTML={{ __html: p.svg }}
        />
      </g>
      <circle cx={px} cy={py} r={4} fill="var(--primary)" stroke="var(--background)" strokeWidth={1.5} />
    </g>
  );
}

function PlacementGlyph({ placement, componentId, selected, pendingOwner, pendingPin, pins, w2s, zoom, uiScale, onPointerDown, onPinClick }: {
  placement: Placement; componentId: string; selected: boolean;
  pendingOwner: string | null; pendingPin: string | null;
  pins: PinSpec[];
  w2s: (x: number, y: number) => { px: number; py: number };
  zoom: number; uiScale: number;
  onPointerDown: (e: React.PointerEvent) => void;
  onPinClick: (p: string) => void;
}) {
  const q  = useQuery(componentPreviewQueryOptions(componentId, placement.params));
  const vb = q.data?.viewBox;
  const um = q.data?.units === "um" ? UM_TO_MM : 1;
  const sz = vb ? Math.max(vb.w, vb.h) * um * MM_TO_PX * zoom * uiScale : Math.max(28, 0.5 * MM_TO_PX * zoom);
  const { px, py } = w2s(placement.x, placement.y);
  const half = sz / 2;
  const isPO = pendingOwner === placement.id;
  return (
    <g
      transform={`translate(${px} ${py}) rotate(${-placement.rotation})`}
      className={cn("cursor-grab", selected && "cursor-grabbing")}
      onPointerDown={onPointerDown}
    >
      <rect x={-half} y={-half} width={sz} height={sz} fill="transparent" stroke="none" />
      {selected && (
        <rect x={-half-6} y={-half-6} width={sz+12} height={sz+12} rx={6}
          fill="none" stroke="var(--primary)" strokeOpacity={0.5} strokeWidth={2} strokeDasharray="3 2"
        />
      )}
      <text x={0} y={half+14} textAnchor="middle" fontSize={10} fontWeight={700} fill="var(--foreground)" className="select-none">
        {placement.name}
      </text>
      {pins.map((pin) => {
        const cx = pin.hint.x * UM_TO_MM * MM_TO_PX * zoom;
        const cy = -pin.hint.y * UM_TO_MM * MM_TO_PX * zoom;
        const iP = isPO && pendingPin === pin.name;
        return (
          <g key={pin.name}>
            <circle
              cx={cx} cy={cy} r={iP ? 5 : 3.5}
              fill={iP ? "var(--destructive)" : selected ? "var(--primary)" : "var(--muted-foreground)"}
              stroke="var(--background)" strokeWidth={1}
              className="cursor-crosshair"
              onPointerDown={(e) => { e.stopPropagation(); onPinClick(pin.name); }}
            />
            {selected && (
              <text x={cx+6} y={cy+3} fontSize={8} fill="var(--foreground)" fontWeight={700} className="pointer-events-none select-none">
                {pin.name}
              </text>
            )}
          </g>
        );
      })}
    </g>
  );
}
