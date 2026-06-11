import { useRef, useState, useEffect, useCallback } from "react";
import type { EditorState, EditorAction, EditorComponent } from "./editor-types";
import { getDefForType, prefixFor, genName, LIBRARY } from "./editor-types";
import type { ComponentKind } from "./editor-types";
import { cn } from "@/lib/utils";
import { Plus, Minus } from "lucide-react";

const DOT_PATTERN_ID = "qe-dot-grid";
// mm -> px scale at zoom=1
const MM_TO_PX = 80;

interface Props {
  state: EditorState;
  dispatch: React.Dispatch<EditorAction>;
}

export function EditorCanvas({ state, dispatch }: Props) {
  const svgRef = useRef<SVGSVGElement | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const [size, setSize] = useState({ w: 800, h: 600 });
  const [drag, setDrag] = useState<
    | { mode: "pan"; startX: number; startY: number; panX: number; panY: number }
    | { mode: "move"; id: string; offsetX: number; offsetY: number }
    | null
  >(null);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const ro = new ResizeObserver(() => {
      setSize({ w: el.clientWidth, h: el.clientHeight });
    });
    ro.observe(el);
    setSize({ w: el.clientWidth, h: el.clientHeight });
    return () => ro.disconnect();
  }, []);

  // world (mm) -> screen px
  const worldToScreen = useCallback(
    (x: number, y: number) => ({
      px: size.w / 2 + (x * MM_TO_PX + state.pan.x) * state.zoom,
      py: size.h / 2 - (y * MM_TO_PX - state.pan.y) * state.zoom,
    }),
    [size, state.pan, state.zoom],
  );

  const screenToWorld = useCallback(
    (px: number, py: number) => ({
      x: (px - size.w / 2) / state.zoom / MM_TO_PX - state.pan.x / MM_TO_PX,
      y: -(py - size.h / 2) / state.zoom / MM_TO_PX + state.pan.y / MM_TO_PX,
    }),
    [size, state.pan, state.zoom],
  );

  // Wheel zoom
  useEffect(() => {
    const svg = svgRef.current;
    if (!svg) return;
    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      const factor = e.deltaY < 0 ? 1.1 : 1 / 1.1;
      dispatch({ type: "ZOOM", zoom: state.zoom * factor });
    };
    svg.addEventListener("wheel", onWheel, { passive: false });
    return () => svg.removeEventListener("wheel", onWheel);
  }, [dispatch, state.zoom]);

  const handlePointerDown = (e: React.PointerEvent<SVGSVGElement>) => {
    if (
      e.target === e.currentTarget ||
      (e.target as Element).getAttribute("data-canvas-bg") === "true"
    ) {
      setDrag({
        mode: "pan",
        startX: e.clientX,
        startY: e.clientY,
        panX: state.pan.x,
        panY: state.pan.y,
      });
      dispatch({ type: "SELECT", id: null });
      (e.currentTarget as Element).setPointerCapture(e.pointerId);
    }
  };

  const handlePointerMove = (e: React.PointerEvent<SVGSVGElement>) => {
    if (!drag) return;
    if (drag.mode === "pan") {
      const dx = e.clientX - drag.startX;
      const dy = e.clientY - drag.startY;
      dispatch({ type: "PAN", x: drag.panX + dx / state.zoom, y: drag.panY - dy / state.zoom });
    } else if (drag.mode === "move") {
      const rect = svgRef.current?.getBoundingClientRect();
      if (!rect) return;
      const world = screenToWorld(
        e.clientX - rect.left - drag.offsetX,
        e.clientY - rect.top - drag.offsetY,
      );
      dispatch({ type: "MOVE", id: drag.id, x: world.x, y: world.y });
    }
  };

  const handlePointerUp = (e: React.PointerEvent<SVGSVGElement>) => {
    if (drag && (e.currentTarget as Element).hasPointerCapture(e.pointerId)) {
      (e.currentTarget as Element).releasePointerCapture(e.pointerId);
    }
    setDrag(null);
  };

  const onCompPointerDown = (e: React.PointerEvent, comp: EditorComponent) => {
    e.stopPropagation();
    dispatch({ type: "SELECT", id: comp.id });
    const rect = svgRef.current?.getBoundingClientRect();
    if (!rect) return;
    const { px, py } = worldToScreen(comp.x, comp.y);
    setDrag({
      mode: "move",
      id: comp.id,
      offsetX: e.clientX - rect.left - px,
      offsetY: e.clientY - rect.top - py,
    });
    (e.currentTarget as Element).setPointerCapture?.(e.pointerId);
  };

  // Drop from library
  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    const raw = e.dataTransfer.getData("application/x-quantum-component");
    if (!raw) return;
    const type = raw as ComponentKind;
    // verify it's a valid kind
    const knownTypes = Object.values(LIBRARY)
      .flat()
      .map((d) => d.type);
    if (!knownTypes.includes(type)) return;
    const rect = svgRef.current?.getBoundingClientRect();
    if (!rect) return;
    const world = screenToWorld(e.clientX - rect.left, e.clientY - rect.top);
    const def = getDefForType(type);
    const name = genName(state.components, prefixFor(type));
    dispatch({
      type: "ADD",
      component: {
        id: `comp_${name}_${Date.now()}`,
        type,
        name,
        x: parseFloat(world.x.toFixed(3)),
        y: parseFloat(world.y.toFixed(3)),
        orientation: 0,
        params: { ...def.defaultParams },
      },
    });
  };

  return (
    <div ref={containerRef} className="relative h-full w-full overflow-hidden">
      <svg
        ref={svgRef}
        width={size.w}
        height={size.h}
        className="block touch-none select-none"
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerCancel={handlePointerUp}
        onDragOver={(e) => e.preventDefault()}
        onDrop={handleDrop}
        style={{
          backgroundColor: "#ffffff",
          backgroundImage: "radial-gradient(circle, rgba(0,0,0,0.15) 1.5px, transparent 1.5px)",
          backgroundSize: `${24 * state.zoom}px ${24 * state.zoom}px`,
          backgroundPosition: `${state.pan.x * state.zoom + size.w / 2}px ${-state.pan.y * state.zoom + size.h / 2}px`,
          cursor: drag?.mode === "pan" ? "grabbing" : "default",
        }}
      >
        {/* invisible bg rect to catch pointer events */}
        <rect data-canvas-bg="true" x={0} y={0} width={size.w} height={size.h} fill="transparent" />

        {/* Chip extent */}
        <ChipExtent state={state} worldToScreen={worldToScreen} />

        {/* Connections */}
        {state.connections.map((conn) => {
          const a = state.components.find((c) => c.id === conn.fromComp);
          const b = state.components.find((c) => c.id === conn.toComp);
          if (!a || !b) return null;
          const pa = worldToScreen(a.x, a.y);
          const pb = worldToScreen(b.x, b.y);
          const isSel = state.selectedId === conn.fromComp || state.selectedId === conn.toComp;
          return (
            <path
              key={conn.id}
              d={`M ${pa.px} ${pa.py} L ${pb.px} ${pb.py}`}
              stroke={isSel ? "#6366f1" : "#94a3b8"}
              strokeWidth={isSel ? 2.4 : 1.6}
              strokeDasharray="6 4"
              fill="none"
            />
          );
        })}

        {/* Components */}
        {state.components.map((comp) => (
          <ComponentGlyph
            key={comp.id}
            comp={comp}
            selected={state.selectedId === comp.id}
            pending={state.pendingPin?.compId === comp.id}
            worldToScreen={worldToScreen}
            zoom={state.zoom}
            onPointerDown={(e) => onCompPointerDown(e, comp)}
            onPinClick={(pin) => dispatch({ type: "PIN_CLICK", compId: comp.id, pin })}
            pendingPin={state.pendingPin}
          />
        ))}
      </svg>

      {/* Zoom badge */}
      <div className="absolute bottom-3 right-3 flex items-center gap-1 rounded-full border border-slate-200 bg-white/95 px-1 py-1 shadow-sm">
        <button
          onClick={() => dispatch({ type: "ZOOM", zoom: state.zoom / 1.2 })}
          className="flex h-6 w-6 items-center justify-center rounded-full text-slate-500 hover:bg-slate-100"
        >
          <Minus className="h-3.5 w-3.5" />
        </button>
        <span className="min-w-[44px] text-center text-[11px] font-bold text-slate-600">
          {Math.round(state.zoom * 100)}%
        </span>
        <button
          onClick={() => dispatch({ type: "ZOOM", zoom: state.zoom * 1.2 })}
          className="flex h-6 w-6 items-center justify-center rounded-full text-slate-500 hover:bg-slate-100"
        >
          <Plus className="h-3.5 w-3.5" />
        </button>
      </div>

      {/* Empty state hint */}
      {state.components.length === 0 && (
        <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
          <div className="rounded-2xl border border-dashed border-slate-300 bg-white/70 px-6 py-4 text-center text-xs text-slate-500">
            Drag a component from the Library on the right onto the canvas to begin.
          </div>
        </div>
      )}

      {/* Pending pin hint */}
      {state.pendingPin && (
        <div className="absolute left-3 top-3 rounded-full border border-indigo-200 bg-indigo-50 px-3 py-1 text-[11px] font-bold text-indigo-700 shadow-sm">
          Click another pin to connect · Esc to cancel
        </div>
      )}
    </div>
  );
}

function ChipExtent({
  state,
  worldToScreen,
}: {
  state: EditorState;
  worldToScreen: (x: number, y: number) => { px: number; py: number };
}) {
  const half = state.variables.chip_size / 2;
  const tl = worldToScreen(-half, half);
  const br = worldToScreen(half, -half);
  return (
    <rect
      x={tl.px}
      y={tl.py}
      width={br.px - tl.px}
      height={br.py - tl.py}
      fill="none"
      stroke="#cbd5e1"
      strokeWidth={1}
      strokeDasharray="4 4"
      rx={6}
      pointerEvents="none"
    />
  );
}

function ComponentGlyph({
  comp,
  selected,
  pending,
  worldToScreen,
  zoom,
  onPointerDown,
  onPinClick,
  pendingPin,
}: {
  comp: EditorComponent;
  selected: boolean;
  pending: boolean;
  worldToScreen: (x: number, y: number) => { px: number; py: number };
  zoom: number;
  onPointerDown: (e: React.PointerEvent) => void;
  onPinClick: (pin: string) => void;
  pendingPin: EditorState["pendingPin"];
}) {
  const def = getDefForType(comp.type);
  const { px, py } = worldToScreen(comp.x, comp.y);
  const sizePx = Math.max(20, def.size * MM_TO_PX * zoom);
  const half = sizePx / 2;
  const isQubit = comp.type === "TransmonPocket" || comp.type === "TransmonCross";
  const isResonator = comp.type === "ResonatorCoilRect" || comp.type === "OpenToGround";

  const fill = isQubit ? "#f59e0b" : isResonator ? "#e2e8f0" : "#f1f5f9";
  const stroke = selected ? "#6366f1" : isResonator ? "#64748b" : "#475569";

  return (
    <g
      transform={`translate(${px} ${py}) rotate(${comp.orientation})`}
      onPointerDown={onPointerDown}
      className={cn("cursor-grab", selected && "cursor-grabbing")}
    >
      {/* selection halo */}
      {selected && (
        <rect
          x={-half - 6}
          y={-half - 6}
          width={sizePx + 12}
          height={sizePx + 12}
          rx={10}
          fill="none"
          stroke="#6366f1"
          strokeOpacity={0.35}
          strokeWidth={3}
        />
      )}
      <rect
        x={-half}
        y={-half}
        width={sizePx}
        height={sizePx}
        rx={isQubit ? 6 : 4}
        fill={fill}
        stroke={stroke}
        strokeWidth={selected ? 2 : 1.2}
      />
      {/* Qubit detail: capacitor pads */}
      {isQubit && (
        <>
          <rect
            x={-half * 0.55}
            y={-half * 0.5}
            width={half * 1.1}
            height={4}
            fill="#92400e"
            rx={1}
          />
          <rect
            x={-half * 0.55}
            y={half * 0.5 - 4}
            width={half * 1.1}
            height={4}
            fill="#92400e"
            rx={1}
          />
          <line x1={0} y1={-3} x2={0} y2={3} stroke="#7f1d1d" strokeWidth={1.5} />
        </>
      )}
      {/* Resonator meander hint */}
      {isResonator && (
        <path
          d={`M ${-half * 0.6} 0 L ${-half * 0.2} 0 L ${-half * 0.2} ${-half * 0.4} L ${half * 0.2} ${-half * 0.4} L ${half * 0.2} ${half * 0.4} L ${half * 0.6} ${half * 0.4}`}
          fill="none"
          stroke="#475569"
          strokeWidth={1.2}
        />
      )}
      <text
        x={0}
        y={half + 12}
        textAnchor="middle"
        className="select-none"
        fontSize={10}
        fontWeight={700}
        fill="#334155"
      >
        {comp.name}
      </text>

      {/* Pins */}
      {def.pins.map((pin, i) => {
        const angle = (i / Math.max(1, def.pins.length)) * Math.PI * 2;
        const r = half + 2;
        const cx = Math.cos(angle) * r;
        const cy = Math.sin(angle) * r;
        const isPending = pendingPin?.compId === comp.id && pendingPin?.pin === pin;
        return (
          <g key={pin}>
            <circle
              cx={cx}
              cy={cy}
              r={isPending ? 5 : 3.5}
              fill={isPending ? "#6366f1" : pending || selected ? "#6366f1" : "#94a3b8"}
              stroke="#fff"
              strokeWidth={1}
              onPointerDown={(e) => {
                e.stopPropagation();
                onPinClick(pin);
              }}
              className="cursor-crosshair"
            />
            {(pending || selected) && (
              <text x={cx + 6} y={cy + 3} fontSize={8} fill="#475569" fontWeight={600}>
                {pin}
              </text>
            )}
          </g>
        );
      })}
    </g>
  );
}
