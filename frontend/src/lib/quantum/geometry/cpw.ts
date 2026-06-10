/**
 * Coplanar waveguide (CPW) polygon builder.
 *
 * Given a centerline polyline (mm), produces:
 *   - trace polygon (the superconducting center strip)
 *   - gap polygon (the etched-away region around the trace, exposing substrate)
 *
 * Bends are rounded with a configurable fillet radius. The output is a flat
 * SVG path "d" string per polygon. All coordinates are in mm.
 *
 * Default geometry mirrors Qiskit Metal defaults:
 *   trace_width = 10 µm,  gap = 6 µm,  fillet = 90 µm
 */

export interface Pt {
  x: number;
  y: number;
}

export interface CPWStyle {
  /** Center-trace width, mm (default 0.010 = 10 µm) */
  traceWidth?: number;
  /** Etch gap on each side, mm (default 0.006 = 6 µm) */
  gap?: number;
  /** Fillet radius at bends, mm (default 0.090 = 90 µm) */
  fillet?: number;
}

export interface CPWGeometry {
  trace: string; // SVG path d
  gap: string;   // SVG path d (full ground cutout: trace + both gaps)
  centerline: string;
}

const dot = (a: Pt, b: Pt) => a.x * b.x + a.y * b.y;
const sub = (a: Pt, b: Pt): Pt => ({ x: a.x - b.x, y: a.y - b.y });
const add = (a: Pt, b: Pt): Pt => ({ x: a.x + b.x, y: a.y + b.y });
const scale = (a: Pt, s: number): Pt => ({ x: a.x * s, y: a.y * s });
const len = (a: Pt) => Math.hypot(a.x, a.y);
const norm = (a: Pt): Pt => {
  const l = len(a) || 1;
  return { x: a.x / l, y: a.y / l };
};
const perp = (a: Pt): Pt => ({ x: -a.y, y: a.x }); // 90° CCW

/**
 * Insert rounded fillets at every interior vertex of a polyline.
 * Returns an SVG path "d" string using L and arc commands.
 */
function filletedPath(pts: Pt[], r: number): string {
  if (pts.length < 2) return "";
  if (pts.length === 2 || r <= 0) {
    return `M ${pts[0].x} ${pts[0].y} ` + pts.slice(1).map(p => `L ${p.x} ${p.y}`).join(" ");
  }

  let d = `M ${pts[0].x} ${pts[0].y}`;
  for (let i = 1; i < pts.length - 1; i++) {
    const prev = pts[i - 1];
    const cur = pts[i];
    const next = pts[i + 1];
    const v1 = sub(prev, cur);
    const v2 = sub(next, cur);
    const l1 = len(v1);
    const l2 = len(v2);
    if (l1 < 1e-9 || l2 < 1e-9) {
      d += ` L ${cur.x} ${cur.y}`;
      continue;
    }
    const u1 = scale(v1, 1 / l1);
    const u2 = scale(v2, 1 / l2);
    const cosA = Math.max(-1, Math.min(1, dot(u1, u2)));
    const angle = Math.acos(cosA);
    // For straight or near-straight, skip arc
    if (angle > Math.PI - 1e-3 || angle < 1e-3) {
      d += ` L ${cur.x} ${cur.y}`;
      continue;
    }
    // tangent length from vertex
    const t = Math.min(r / Math.tan(angle / 2), l1 * 0.5, l2 * 0.5);
    const p1 = add(cur, scale(u1, t));
    const p2 = add(cur, scale(u2, t));
    // Sweep flag: cross product sign of v1 -> v2
    const cross = u1.x * u2.y - u1.y * u2.x;
    const sweep = cross < 0 ? 1 : 0;
    const actualR = t * Math.tan(angle / 2);
    d += ` L ${p1.x} ${p1.y} A ${actualR} ${actualR} 0 0 ${sweep} ${p2.x} ${p2.y}`;
  }
  const last = pts[pts.length - 1];
  d += ` L ${last.x} ${last.y}`;
  return d;
}

/**
 * Offset a polyline laterally by `d` (positive = left of travel direction).
 * Uses per-vertex bisector offset which is good enough for the gentle bends
 * we use in CPW routing.
 */
function offsetPolyline(pts: Pt[], d: number): Pt[] {
  const out: Pt[] = [];
  for (let i = 0; i < pts.length; i++) {
    const prev = pts[i - 1];
    const cur = pts[i];
    const next = pts[i + 1];
    let n: Pt;
    if (!prev) {
      n = perp(norm(sub(next!, cur)));
    } else if (!next) {
      n = perp(norm(sub(cur, prev)));
    } else {
      const n1 = perp(norm(sub(cur, prev)));
      const n2 = perp(norm(sub(next, cur)));
      const bis = norm(add(n1, n2));
      const c = Math.max(0.25, dot(bis, n1)); // clamp to avoid runaway at sharp angles
      n = scale(bis, 1 / c);
    }
    out.push(add(cur, scale(n, d)));
  }
  return out;
}

export function filletCenterline(pts: Pt[], r: number): Pt[] {
  if (pts.length < 3 || r <= 0) return pts;
  
  const out: Pt[] = [];
  out.push(pts[0]);
  
  for (let i = 1; i < pts.length - 1; i++) {
    const prev = pts[i - 1];
    const cur = pts[i];
    const next = pts[i + 1];
    
    const v1 = { x: prev.x - cur.x, y: prev.y - cur.y };
    const v2 = { x: next.x - cur.x, y: next.y - cur.y };
    
    const l1 = Math.hypot(v1.x, v1.y);
    const l2 = Math.hypot(v2.x, v2.y);
    
    if (l1 < 1e-9 || l2 < 1e-9) {
      out.push(cur);
      continue;
    }
    
    const u1 = { x: v1.x / l1, y: v1.y / l1 };
    const u2 = { x: v2.x / l2, y: v2.y / l2 };
    
    const cosA = Math.max(-1, Math.min(1, u1.x * u2.x + u1.y * u2.y));
    const angle = Math.acos(cosA);
    
    if (angle > Math.PI - 1e-3 || angle < 1e-3) {
      out.push(cur);
      continue;
    }
    
    // tangent length from vertex
    const t = Math.min(r / Math.tan(angle / 2), l1 * 0.5, l2 * 0.5);
    const p1 = { x: cur.x + u1.x * t, y: cur.y + u1.y * t };
    const p2 = { x: cur.x + u2.x * t, y: cur.y + u2.y * t };
    
    // center of the arc
    const bisRaw = { x: u1.x + u2.x, y: u1.y + u2.y };
    const bisLen = Math.hypot(bisRaw.x, bisRaw.y);
    const bis = bisLen > 1e-9 ? { x: bisRaw.x / bisLen, y: bisRaw.y / bisLen } : { x: 0, y: 0 };
    
    const cosHalfAngle = Math.cos(angle / 2);
    const h = cosHalfAngle > 1e-9 ? t / cosHalfAngle : t;
    const C = { x: cur.x + bis.x * h, y: cur.y + bis.y * h };
    
    const v_p1 = { x: p1.x - C.x, y: p1.y - C.y };
    const v_p2 = { x: p2.x - C.x, y: p2.y - C.y };
    const actualR = Math.hypot(v_p1.x, v_p1.y);
    
    const theta1 = Math.atan2(v_p1.y, v_p1.x);
    const theta2 = Math.atan2(v_p2.y, v_p2.x);
    
    let diff = theta2 - theta1;
    while (diff < -Math.PI) diff += 2 * Math.PI;
    while (diff > Math.PI) diff -= 2 * Math.PI;
    
    const numSteps = 8;
    for (let j = 0; j <= numSteps; j++) {
      const f = j / numSteps;
      const theta = theta1 + diff * f;
      out.push({
        x: C.x + actualR * Math.cos(theta),
        y: C.y + actualR * Math.sin(theta)
      });
    }
  }
  
  out.push(pts[pts.length - 1]);
  return out;
}

export function buildCPW(centerline: Pt[], style: CPWStyle = {}): CPWGeometry {
  const w = style.traceWidth ?? 0.010;
  const g = style.gap ?? 0.006;
  const r = style.fillet ?? 0.090;

  // Fillet centerline into a smooth discretized polyline first
  const filletedCenter = filletCenterline(centerline, r);

  const halfTrace = w / 2;
  const halfGap = w / 2 + g;

  // Trace polygon (closed): offset +halfTrace then -halfTrace reversed
  const leftT = offsetPolyline(filletedCenter, halfTrace);
  const rightT = offsetPolyline(filletedCenter, -halfTrace);
  // Gap polygon: outer ring same way at halfGap
  const leftG = offsetPolyline(filletedCenter, halfGap);
  const rightG = offsetPolyline(filletedCenter, -halfGap);

  // For rendering simplicity we draw two filleted "ribbon" rectangles, treating
  // each side as a filleted polyline and closing across the ends.
  const traceRing = [...leftT, ...rightT.slice().reverse()];
  const gapRing = [...leftG, ...rightG.slice().reverse()];

  const closeRing = (ring: Pt[]) => {
    if (!ring.length) return "";
    return `M ${ring[0].x} ${ring[0].y} ` +
      ring.slice(1).map(p => `L ${p.x} ${p.y}`).join(" ") + " Z";
  };

  return {
    trace: closeRing(traceRing),
    gap: closeRing(gapRing),
    centerline: closeRing(filletedCenter).replace(/ Z$/, ""), // centerline path
  };
}

/** Generate a meander centerline between two points along a major axis.
 *  Produces a serpentine (back-and-forth) polyline that the CPW builder then
 *  thickens. This is what creates the classic Qiskit Metal "resonator squiggle".
 */
export function meanderCenterline(
  start: Pt,
  end: Pt,
  opts: {
    turns?: number;     // number of U-turns
    amplitude?: number; // perpendicular swing (mm)
    leadIn?: number;    // straight section at each end (mm)
  } = {},
): Pt[] {
  const turns = Math.max(1, opts.turns ?? 6);
  const amp = opts.amplitude ?? 0.25;
  const leadIn = opts.leadIn ?? 0.10;

  const axis = sub(end, start);
  const total = len(axis);
  if (total < 1e-6) return [start, end];
  const u = scale(axis, 1 / total);
  const n = perp(u); // perpendicular (left)

  // Available length for meandering
  const span = Math.max(0.01, total - 2 * leadIn);
  const seg = span / turns; // distance along axis per half-turn pair

  const pts: Pt[] = [];
  pts.push(start);
  pts.push(add(start, scale(u, leadIn)));

  for (let i = 0; i < turns; i++) {
    const sideSign = i % 2 === 0 ? 1 : -1;
    const baseDist = leadIn + i * seg;
    const a = add(start, scale(u, baseDist));
    const b = add(a, scale(n, sideSign * amp));
    const c = add(b, scale(u, seg));
    const d = add(c, scale(n, -sideSign * amp));
    pts.push(b, c, d);
  }
  pts.push(add(start, scale(u, total - leadIn)));
  pts.push(end);
  return pts;
}
