import { describe, it, expect } from "vitest";
import fc from "fast-check";
import { routeCPW } from "../route";
import type { Pt } from "../cpw";

describe("Route Property Tests", () => {
  const doubleArb = (min: number, max: number) =>
    fc.double({ min, max, noNaN: true, noInfinity: true });

  const waypointArb = fc.record({
    x: doubleArb(-5.0, 5.0),
    y: doubleArb(-5.0, 5.0)
  });

  const waypointsArb = fc.array(waypointArb, { minLength: 2, maxLength: 4 })
    .filter(pts => {
      // Ensure points are not duplicate
      for (let i = 1; i < pts.length; i++) {
        if (Math.hypot(pts[i].x - pts[i-1].x, pts[i].y - pts[i-1].y) < 0.1) {
          return false;
        }
      }
      return true;
    });

  it("Property 12: exactly one trace shape with minDetail <= 2 and exactly one gap shape with minDetail <= 3", () => {
    fc.assert(
      fc.property(
        waypointsArb,
        doubleArb(0.01, 0.05), // traceWidth
        doubleArb(0.005, 0.03), // gap
        (waypoints, traceWidth, gap) => {
          const geo = routeCPW({ waypoints, traceWidth, gap });
          
          const traceShapes = geo.shapes.filter(
            s => s.layer === "metal" && (s.minDetail ?? 1) <= 2 && s.fill !== "none"
          );
          expect(traceShapes.length).toBe(1);

          const gapShapes = geo.shapes.filter(
            s => s.fill === "var(--cad-gap)" && (s.minDetail ?? 1) <= 3
          );
          expect(gapShapes.length).toBe(1);
        }
      ),
      { numRuns: 100 }
    );
  });

  it("Property 14: feedline vs default variants set the correct colors", () => {
    fc.assert(
      fc.property(
        waypointsArb,
        fc.constantFrom("feedline", "default") as fc.Arbitrary<"feedline" | "default">,
        (waypoints, variant) => {
          const geo = routeCPW({ waypoints, variant });
          const traceShape = geo.shapes.find(
            s => s.layer === "metal" && (s.minDetail ?? 1) === 2
          );
          if (variant === "feedline") {
            expect(traceShape?.fill).toBe("var(--cad-feedline)");
          } else {
            expect(traceShape?.fill).toBe("var(--cad-trace)");
          }
        }
      ),
      { numRuns: 100 }
    );
  });

  it("Property 15: shapes.length > 0, bbox is positive and every shape has non-empty d", () => {
    fc.assert(
      fc.property(
        waypointsArb,
        (waypoints) => {
          const geo = routeCPW({ waypoints });
          expect(geo.shapes.length).toBeGreaterThan(0);
          expect(geo.bbox.w).toBeGreaterThan(0);
          expect(geo.bbox.h).toBeGreaterThan(0);
          
          for (const s of geo.shapes) {
            expect(s.d).not.toBe("");
          }
        }
      ),
      { numRuns: 100 }
    );
  });
});
