/** Top-level CAD canvas — SVG, mm coords, pan/zoom, LOD, layers, rulers. */
import { useCallback, useEffect, useRef, useState } from "react";
import { useWorkspaceStore, useActiveDocument } from "@/lib/quantum/model/workspace-store";
import { getComponent } from "@/lib/quantum/registry/registry";
import type { ComponentGeometry, Pin } from "@/lib/quantum/geometry/types";
import { lodForZoom, lodLabel, shapeVisible, annotationVisible } from "@/lib/quantum/geometry/lod";

interface View {
  cx: number;
  cy: number;
  zoom: number;
}

const layerColor: Record<string, string> = {
  ground: "var(--cad-ground)",
  metal: "var(--cad-metal)",
  junction: "var(--cad-junction)",
  pin: "var(--cad-pin)",
  label: "var(--cad-ruler-fg)",
};

const layerStrokeColor: Record<string, string> = {
  ground: "var(--cad-ground-stroke)",
  metal: "var(--cad-metal-stroke)",
  junction: "var(--cad-junction)",
  pin: "var(--cad-pin)",
  label: "var(--cad-ruler-fg)",
};

// Stroke widths in screen-px for LOD-aware outline visibility
// At L1 (chip overview, low zoom) we want heavier outlines like Qiskit Metal
const lodStrokePx = (lod: number): number => {
  if (lod <= 1) return 1.8;   // chip overview — bold outlines
  if (lod <= 2) return 1.2;   // component view
  return 0.7;                 // device/fab detail — fine lines
};

const docLayerForShape = (
  layer: string,
): "ground" | "metal" | "junction" | "routes" | "pins" => {
  if (layer === "junction") return "junction";
  if (layer === "pin") return "pins";
  if (layer === "metal") return "metal";
  return "ground";
};

const SNAP = 0.05; // mm
const snap = (v: number, fine: boolean) => {
  const step = fine ? 0.005 : SNAP;
  return Math.round(v / step) * step;
};

function dirLabel(angle: number): string {
  // angle in radians, 0 = +x. Map to compass N/S/E/W.
  const deg = ((angle * 180) / Math.PI + 360) % 360;
  if (deg >= 315 || deg < 45) return "East";
  if (deg < 135) return "South";
  if (deg < 225) return "West";
  return "North";
}

interface PinHover {
  componentName: string;
  pinName: string;
  direction: string;
  screenX: number;
  screenY: number;
}

interface NetOverlayProps {
  doc: any;
  view: View;
  zoom: number;
  lod: number;
  selectedId: string | null;
}

function resolvePinPos(doc: any, compId: string, pinName: string) {
  // NetEdge.from.component / to.component is a component ID, not a name.
  const inst = doc.components.find((c: any) => c.id === compId);
  if (!inst) return null;
  const def = getComponent(inst.kind);
  if (!def) return null;
  const geo = def.geometry(inst.params);
  const pin = geo.pins.find((p: any) => p.name === pinName);
  if (!pin) return null;
  const rad = ((inst.placement.rotation ?? 0) * Math.PI) / 180;
  return {
    x: inst.placement.x + pin.x * Math.cos(rad) - pin.y * Math.sin(rad),
    y: inst.placement.y + pin.x * Math.sin(rad) + pin.y * Math.cos(rad),
  };
}

export function NetOverlay({ doc, view, zoom, lod, selectedId }: NetOverlayProps) {
  const routesVisible = doc.layers.find((l: any) => l.id === "routes")?.visible !== false;
  if (!routesVisible) return null;

  const resolvedEdges = doc.nets.map((edge: any) => {
    const fromPos = resolvePinPos(doc, edge.from.component, edge.from.pin);
    const toPos = resolvePinPos(doc, edge.to.component, edge.to.pin);
    if (!fromPos || !toPos) return null;

    // edge.from.component and edge.to.component are component IDs; compare directly to selectedId.
    const isConnectedToSelected = selectedId != null && (
      edge.from.component === selectedId || edge.to.component === selectedId
    );

    return {
      edge,
      from: fromPos,
      to: toPos,
      isConnectedToSelected
    };
  }).filter(Boolean);

  return (
    <g className="cad-net-overlay">
      {resolvedEdges.map((re: any, idx: number) => {
        const strokeColor = re.isConnectedToSelected ? "var(--cad-select)" : "var(--cad-net)";
        const strokeWidth = re.isConnectedToSelected ? 3.0 / zoom : 1.5 / zoom;
        const className = lod >= 2 ? "cad-net-flow" : undefined;
        return (
          <line
            key={idx}
            x1={re.from.x}
            y1={re.from.y}
            x2={re.to.x}
            y2={re.to.y}
            stroke={strokeColor}
            strokeWidth={strokeWidth}
            className={className}
            vectorEffect="non-scaling-stroke"
          />
        );
      })}
    </g>
  );
}

export function Canvas() {
  const doc = useActiveDocument();
  const select = useWorkspaceStore(s => s.selectComponent);
  const selectedId = useWorkspaceStore(s => s.selectedComponentId);
  const updateComponent = useWorkspaceStore(s => s.updateComponent);
  const containerRef = useRef<HTMLDivElement>(null);
  const [size, setSize] = useState({ w: 800, h: 600 });
  const [view, setView] = useState<View>({ cx: -4, cy: -3, zoom: 80 });
  const [panDrag, setPanDrag] = useState<{ x: number; y: number } | null>(null);
  const [moveDrag, setMoveDrag] = useState<
    { id: string; startX: number; startY: number; baseX: number; baseY: number } | null
  >(null);
  const [hoveredId, setHoveredId] = useState<string | null>(null);
  const [pinHover, setPinHover] = useState<PinHover | null>(null);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const ro = new ResizeObserver(() => {
      const r = el.getBoundingClientRect();
      setSize({ w: r.width, h: r.height });
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const setFitToScreen = useWorkspaceStore(s => s.setFitToScreen);

  const fit = useCallback(() => {
    if (!doc) return;
    const pad = 0.5;
    const w = doc.chipSize.w + pad * 2;
    const h = doc.chipSize.h + pad * 2;
    const zoom = Math.min(size.w / w, size.h / h);
    setView({
      cx: -doc.chipSize.w / 2 - pad,
      cy: -doc.chipSize.h / 2 - pad,
      zoom,
    });
  }, [doc, size.w, size.h]);

  useEffect(() => { fit(); }, [fit]);

  // Keep a ref to the latest fit callback so the stable store wrapper never
  // closes over a stale version (avoids a brief undefined window on resize).
  const fitRef = useRef(fit);
  useEffect(() => { fitRef.current = fit; }, [fit]);

  // Register a single stable wrapper on mount; update the ref whenever fit
  // changes so the toolbar/F shortcut always calls the current implementation.
  // The wrapper is only removed from the store on component unmount, which
  // means the button stays enabled for the full lifetime of the tab and never
  // flashes disabled on window/panel resize.
  useEffect(() => {
    const stableWrapper = () => fitRef.current();
    setFitToScreen(stableWrapper);
    return () => setFitToScreen(undefined);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [setFitToScreen]);

  const onWheel = (e: React.WheelEvent) => {
    e.preventDefault();
    const rect = (e.currentTarget as HTMLDivElement).getBoundingClientRect();
    const px = e.clientX - rect.left;
    const py = e.clientY - rect.top;
    const wx = view.cx + px / view.zoom;
    const wy = view.cy + py / view.zoom;
    const factor = e.deltaY < 0 ? 1.18 : 1 / 1.18;
    const newZoom = Math.max(10, Math.min(6000, view.zoom * factor));
    setView({ zoom: newZoom, cx: wx - px / newZoom, cy: wy - py / newZoom });
  };

  const onPointerDown = (e: React.PointerEvent) => {
    if (e.button === 1 || (e.button === 0 && e.shiftKey && !moveDrag)) {
      e.preventDefault();
      (e.target as Element).setPointerCapture(e.pointerId);
      setPanDrag({ x: e.clientX, y: e.clientY });
    } else if (e.button === 0 && !moveDrag) {
      select(null);
    }
  };
  const onPointerMove = (e: React.PointerEvent) => {
    if (panDrag) {
      const dx = (e.clientX - panDrag.x) / view.zoom;
      const dy = (e.clientY - panDrag.y) / view.zoom;
      setView(v => ({ ...v, cx: v.cx - dx, cy: v.cy - dy }));
      setPanDrag({ x: e.clientX, y: e.clientY });
    } else if (moveDrag && doc) {
      const dx = (e.clientX - moveDrag.startX) / view.zoom;
      const dy = (e.clientY - moveDrag.startY) / view.zoom;
      const fine = e.altKey;
      const nx = snap(moveDrag.baseX + dx, fine);
      const ny = snap(moveDrag.baseY + dy, fine);
      const inst = doc.components.find(c => c.id === moveDrag.id);
      if (inst) {
        updateComponent(moveDrag.id, { placement: { ...inst.placement, x: nx, y: ny } });
      }
    }
  };
  const onPointerUp = () => {
    setPanDrag(null);
    setMoveDrag(null);
  };

  if (!doc) {
    return (
      <div className="flex h-full items-center justify-center text-muted-foreground">
        No tab open. Use the Templates menu to start a new design.
      </div>
    );
  }

  const layers = doc.layers;
  const visible = (id: string) => layers.find(l => l.id === id)?.visible !== false;
  const opacity = (id: string) => layers.find(l => l.id === id)?.opacity ?? 1;

  const tx = -view.cx * view.zoom;
  const ty = -view.cy * view.zoom;
  const lod = lodForZoom(view.zoom);

  const worldToScreen = (wx: number, wy: number) => ({
    x: (wx - view.cx) * view.zoom,
    y: (wy - view.cy) * view.zoom,
  });

  return (
    <div
      ref={containerRef}
      className="relative h-full w-full overflow-hidden bg-[var(--cad-bg)] select-none"
      onWheel={onWheel}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onPointerLeave={onPointerUp}
      style={{ cursor: panDrag ? "grabbing" : moveDrag ? "move" : "default" }}
    >
      <Rulers view={view} size={size} />
      <svg
        width={size.w}
        height={size.h}
        className="absolute inset-0"
        style={{ shapeRendering: "geometricPrecision" }}
      >
        <Grid view={view} size={size} />
        <g transform={`translate(${tx} ${ty}) scale(${view.zoom})`}>
          {/* Chip drop shadow — slightly offset dark rect behind the substrate */}
          <rect
            x={-doc.chipSize.w / 2 + 3 / view.zoom}
            y={-doc.chipSize.h / 2 + 3 / view.zoom}
            width={doc.chipSize.w}
            height={doc.chipSize.h}
            fill="rgba(0,0,0,0.12)"
          />
          {/* Chip substrate */}
          <rect
            x={-doc.chipSize.w / 2}
            y={-doc.chipSize.h / 2}
            width={doc.chipSize.w}
            height={doc.chipSize.h}
            fill="var(--cad-ground)"
            stroke="var(--cad-ground-stroke)"
            strokeWidth={2 / view.zoom}
          />
          {doc.components.map(inst => {
            const def = getComponent(inst.kind);
            if (!def) return null;
            const geo = def.geometry(inst.params);
            return (
              <ComponentNode
                key={inst.id}
                name={inst.name}
                geo={geo}
                placement={inst.placement}
                zoom={view.zoom}
                lod={lod}
                isSelected={inst.id === selectedId}
                isHovered={inst.id === hoveredId}
                onSelect={() => select(inst.id)}
                onHoverEnter={() => setHoveredId(inst.id)}
                onHoverLeave={() => { setHoveredId(h => h === inst.id ? null : h); setPinHover(null); }}
                onMoveStart={(e) => {
                  e.stopPropagation();
                  select(inst.id);
                  setMoveDrag({
                    id: inst.id,
                    startX: e.clientX,
                    startY: e.clientY,
                    baseX: inst.placement.x,
                    baseY: inst.placement.y,
                  });
                  (e.target as Element).setPointerCapture(e.pointerId);
                }}
                onPinHover={(pin) => {
                  if (!pin) { setPinHover(null); return; }
                  // pin coords are component-local; convert via placement
                  const rad = ((inst.placement.rotation ?? 0) * Math.PI) / 180;
                  const wx = inst.placement.x + pin.x * Math.cos(rad) - pin.y * Math.sin(rad);
                  const wy = inst.placement.y + pin.x * Math.sin(rad) + pin.y * Math.cos(rad);
                  const sp = worldToScreen(wx, wy);
                  setPinHover({
                    componentName: inst.name,
                    pinName: pin.name,
                    direction: dirLabel(pin.angle + rad),
                    screenX: sp.x,
                    screenY: sp.y,
                  });
                }}
                pinsVisible={visible("pins")}
                layerVisible={(l) => visible(docLayerForShape(l))}
                layerOpacity={(l) => opacity(docLayerForShape(l))}
              />
            );
          })}
          <NetOverlay
            doc={doc}
            view={view}
            zoom={view.zoom}
            lod={lod}
            selectedId={selectedId}
          />
        </g>
      </svg>

      {pinHover && (
        <div
          className="pointer-events-none absolute z-10 -translate-x-1/2 -translate-y-[calc(100%+10px)] rounded-md border bg-card px-2 py-1 text-[11px] font-mono shadow-md"
          style={{ left: pinHover.screenX, top: pinHover.screenY }}
        >
          <div className="font-semibold text-foreground">{pinHover.componentName} · {pinHover.pinName}</div>
          <div className="text-muted-foreground">{pinHover.direction} port</div>
        </div>
      )}

      <div className="absolute bottom-2 right-3 flex items-center gap-2 rounded-md border bg-card/95 px-2 py-1 text-[11px] font-mono text-muted-foreground shadow-sm">
        <span>{Math.round(view.zoom)} px/mm</span>
        <span className="text-foreground">·</span>
        <span className="font-medium text-foreground">{lodLabel(lod)}</span>
      </div>
    </div>
  );
}

interface NodeProps {
  name: string;
  geo: ComponentGeometry;
  placement: { x: number; y: number; rotation: number };
  zoom: number;
  lod: 1 | 2 | 3 | 4;
  isSelected: boolean;
  isHovered: boolean;
  onSelect: () => void;
  onHoverEnter: () => void;
  onHoverLeave: () => void;
  onMoveStart: (e: React.PointerEvent) => void;
  onPinHover: (pin: Pin | null) => void;
  pinsVisible: boolean;
  layerVisible: (layer: string) => boolean;
  layerOpacity: (layer: string) => number;
}

function ComponentNode({
  name, geo, placement, zoom, lod, isSelected, isHovered, onSelect, onHoverEnter, onHoverLeave,
  onMoveStart, onPinHover, pinsVisible, layerVisible, layerOpacity,
}: NodeProps) {
  const sw = lodStrokePx(lod) / zoom;   // LOD-aware outline width
  const transform = `translate(${placement.x} ${placement.y}) rotate(${placement.rotation})`;
  const showPins = pinsVisible || isSelected || isHovered || lod >= 3;
  const fontSize = 11 / zoom;
  const labelPadX = fontSize * 0.6;
  const labelPadY = fontSize * 0.25;
  const labelText = `${name} · ${geo.bbox.w.toFixed(2)}×${geo.bbox.h.toFixed(2)} mm`;
  const labelTextW = labelText.length * fontSize * 0.55;

  return (
    <g
      transform={transform}
      className={isSelected ? "cad-selected-glow" : undefined}
      onPointerDown={(e) => { if (e.button === 0 && !e.shiftKey) onMoveStart(e); }}
      onClick={(e) => { e.stopPropagation(); onSelect(); }}
      onPointerEnter={onHoverEnter}
      onPointerLeave={onHoverLeave}
      style={{ cursor: "move" }}
    >
      {/* Selection wash behind the geometry */}
      {isSelected && (
        <rect
          x={geo.bbox.x - 0.01} y={geo.bbox.y - 0.01}
          width={geo.bbox.w + 0.02} height={geo.bbox.h + 0.02}
          fill="var(--cad-select-wash)"
          stroke="none"
        />
      )}

      {geo.shapes.map((s, i) => {
        if (!shapeVisible(s, lod)) return null;
        if (!layerVisible(s.layer)) return null;
        return (
          <path
            key={i}
            d={s.d}
            fill={s.fill ?? layerColor[s.layer] ?? "var(--cad-metal)"}
            stroke={s.stroke ?? layerStrokeColor[s.layer] ?? "transparent"}
            strokeWidth={s.strokeWidth ?? sw}
            opacity={layerOpacity(s.layer)}
            vectorEffect="non-scaling-stroke"
          />
        );
      })}

      {showPins && geo.pins.map(p => {
        const tickLen = 10 / zoom;
        const tx2 = p.x + Math.cos(p.angle) * tickLen;
        const ty2 = p.y + Math.sin(p.angle) * tickLen;
        const r = (isSelected || isHovered ? 4.5 : 3.5) / zoom;
        return (
          <g
            key={p.name}
            onPointerEnter={(e) => { e.stopPropagation(); onPinHover(p); }}
            onPointerLeave={() => onPinHover(null)}
            style={{ pointerEvents: "all" }}
          >
            {/* direction tick */}
            <line
              x1={p.x} y1={p.y} x2={tx2} y2={ty2}
              stroke="var(--cad-pin)"
              strokeWidth={1.5 / zoom}
              vectorEffect="non-scaling-stroke"
            />
            {/* outer halo when selected/hovered */}
            {(isSelected || isHovered) && (
              <circle cx={p.x} cy={p.y} r={r + 2 / zoom} fill="var(--cad-pin-ring)" />
            )}
            <circle
              cx={p.x} cy={p.y}
              r={r}
              fill="var(--cad-pin)"
              stroke="white"
              strokeWidth={1 / zoom}
              vectorEffect="non-scaling-stroke"
            />
            {(isSelected || isHovered || lod >= 4) && (
              <text
                x={p.x + 7 / zoom}
                y={p.y - 5 / zoom}
                fontSize={fontSize * 0.85}
                fill="var(--cad-pin)"
                fontFamily="var(--font-mono)"
                style={{ pointerEvents: "none" }}
              >{p.name}</text>
            )}
          </g>
        );
      })}

      {lod >= 4 && geo.annotations?.map((a, i) => {
        if (!annotationVisible(a, lod)) return null;
        return (
          <text
            key={i}
            x={a.x} y={a.y}
            fontSize={fontSize}
            textAnchor={a.anchor ?? "middle"}
            fill="var(--cad-dim)"
            fontFamily="var(--font-mono)"
            transform={a.rotation ? `rotate(${a.rotation} ${a.x} ${a.y})` : undefined}
            style={{ pointerEvents: "none" }}
          >{a.text}</text>
        );
      })}

      {isSelected && (
        <>
          <rect
            x={geo.bbox.x} y={geo.bbox.y}
            width={geo.bbox.w} height={geo.bbox.h}
            fill="none"
            stroke="var(--cad-select)"
            strokeWidth={1.6 / zoom}
            strokeDasharray={`${4 / zoom} ${3 / zoom}`}
            vectorEffect="non-scaling-stroke"
          />
          {/* label pill */}
          <rect
            x={geo.bbox.x - labelPadX / 2}
            y={geo.bbox.y - fontSize - labelPadY * 2 - 2 / zoom}
            width={labelTextW + labelPadX}
            height={fontSize + labelPadY * 2}
            rx={fontSize * 0.25}
            fill="var(--cad-select)"
          />
          <text
            x={geo.bbox.x}
            y={geo.bbox.y - labelPadY - 2 / zoom}
            fontSize={fontSize}
            fill="white"
            fontFamily="var(--font-mono)"
            style={{ pointerEvents: "none" }}
          >
            {labelText}
          </text>
        </>
      )}

      {/* Hover outline (subtle, only when not selected) */}
      {isHovered && !isSelected && (
        <rect
          x={geo.bbox.x} y={geo.bbox.y}
          width={geo.bbox.w} height={geo.bbox.h}
          fill="none"
          stroke="var(--cad-select)"
          strokeWidth={1 / zoom}
          opacity={0.45}
          vectorEffect="non-scaling-stroke"
        />
      )}
    </g>
  );
}

function Grid({ view, size }: { view: View; size: { w: number; h: number } }) {
  const minor = 0.1, major = 1.0;
  const lines: React.ReactNode[] = [];
  const xMin = view.cx, xMax = view.cx + size.w / view.zoom;
  const yMin = view.cy, yMax = view.cy + size.h / view.zoom;
  const lod = lodForZoom(view.zoom);

  // At L1 (chip overview ≤ 60 px/mm), hide the grid entirely — the chip
  // boundary provides enough spatial context, matching Qiskit Metal's clean look.
  if (lod <= 1) return <g />;

  const startX = Math.floor(xMin / minor) * minor;
  for (let x = startX; x <= xMax; x += minor) {
    const isMajor = Math.abs(x / major - Math.round(x / major)) < 1e-6;
    if (!isMajor && view.zoom < 60) continue;
    const sx = (x - view.cx) * view.zoom;
    lines.push(
      <line key={`vx${x.toFixed(3)}`} x1={sx} y1={0} x2={sx} y2={size.h}
        stroke={isMajor ? "var(--cad-grid-major)" : "var(--cad-grid-minor)"} strokeWidth={1} />
    );
  }
  const startY = Math.floor(yMin / minor) * minor;
  for (let y = startY; y <= yMax; y += minor) {
    const isMajor = Math.abs(y / major - Math.round(y / major)) < 1e-6;
    if (!isMajor && view.zoom < 60) continue;
    const sy = (y - view.cy) * view.zoom;
    lines.push(
      <line key={`hy${y.toFixed(3)}`} x1={0} y1={sy} x2={size.w} y2={sy}
        stroke={isMajor ? "var(--cad-grid-major)" : "var(--cad-grid-minor)"} strokeWidth={1} />
    );
  }
  return <g>{lines}</g>;
}

function Rulers({ view, size }: { view: View; size: { w: number; h: number } }) {
  const major = 1.0;
  const labels: React.ReactNode[] = [];
  const xMin = view.cx, xMax = view.cx + size.w / view.zoom;
  const startX = Math.ceil(xMin / major) * major;
  for (let x = startX; x <= xMax; x += major) {
    const sx = (x - view.cx) * view.zoom;
    labels.push(
      <div key={`xl${x}`}
        className="absolute top-0 -translate-x-1/2 text-[10px] font-mono text-[var(--cad-ruler-fg)]"
        style={{ left: sx }}>{x.toFixed(0)}</div>
    );
  }
  const yMin = view.cy, yMax = view.cy + size.h / view.zoom;
  const startY = Math.ceil(yMin / major) * major;
  for (let y = startY; y <= yMax; y += major) {
    const sy = (y - view.cy) * view.zoom;
    labels.push(
      <div key={`yl${y}`}
        className="absolute left-0 -translate-y-1/2 text-[10px] font-mono text-[var(--cad-ruler-fg)]"
        style={{ top: sy }}>{y.toFixed(0)}</div>
    );
  }
  return <div className="pointer-events-none absolute inset-0">{labels}</div>;
}
