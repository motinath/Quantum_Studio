import { describe, it, expect } from "vitest";
import fc from "fast-check";
import { filletCenterline } from "../cpw";
import type { Pt } from "../cpw";

describe("CPW filletCenterline Property Test", () => {
  const pointArb = fc.record({
    x: fc.double({ min: -10, max: 10 }),
    y: fc.double({ min: -10, max: 10 }),
  });

  // Generator for 3+ points with at least one non-collinear interior bend
  const ptsArb = fc.array(pointArb, { minLength: 3, maxLength: 6 })
    .filter(pts => {
      for (let i = 1; i < pts.length - 1; i++) {
        const v1 = { x: pts[i-1].x - pts[i].x, y: pts[i-1].y - pts[i].y };
        const v2 = { x: pts[i+1].x - pts[i].x, y: pts[i+1].y - pts[i].y };
        const l1 = Math.hypot(v1.x, v1.y);
        const l2 = Math.hypot(v2.x, v2.y);
        if (l1 < 0.05 || l2 < 0.05) continue;
        const u1 = { x: v1.x / l1, y: v1.y / l1 };
        const u2 = { x: v2.x / l2, y: v2.y / l2 };
        const cosA = u1.x * u2.x + u1.y * u2.y;
        const angle = Math.acos(Math.max(-1, Math.min(1, cosA)));
        // check that bend is not straight and not collinear
        if (angle < Math.PI - 0.05 && angle > 0.05) {
          return true;
        }
      }
      return false;
    });

  it("should assert filletCenterline output length changes correctly based on radius", () => {
    fc.assert(
      fc.property(
        ptsArb,
        fc.double({ min: 0.01, max: 2.0 }),
        (pts, r) => {
          const filleted = filletCenterline(pts, r);
          expect(filleted.length).toBeGreaterThan(pts.length);
        }
      ),
      { numRuns: 150 }
    );
  });

  it("should assert filletCenterline output length equals input length when r === 0", () => {
    fc.assert(
      fc.property(
        ptsArb,
        (pts) => {
          const filleted = filletCenterline(pts, 0);
          expect(filleted.length).toBe(pts.length);
          expect(filleted).toEqual(pts);
        }
      ),
      { numRuns: 150 }
    );
  });
});
