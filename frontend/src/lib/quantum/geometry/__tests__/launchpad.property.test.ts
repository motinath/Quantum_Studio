import { describe, it, expect } from "vitest";
import fc from "fast-check";
import { launchpad } from "../launchpad";

describe("Launchpad Property Tests", () => {
  const doubleArb = (min: number, max: number) =>
    fc.double({ min, max, noNaN: true, noInfinity: true });

  it("Property 3: for any valid launchpad params with gap, at least one shape has fill === 'var(--cad-gap)' and minDetail <= 3", () => {
    fc.assert(
      fc.property(
        doubleArb(0.005, 0.03), // gap
        (gap) => {
          const geo = launchpad({ gap });
          const gapShapes = geo.shapes.filter(
            s => s.fill === "var(--cad-gap)" && (s.minDetail ?? 1) <= 3
          );
          expect(gapShapes.length).toBeGreaterThanOrEqual(1);
        }
      ),
      { numRuns: 100 }
    );
  });

  it("Property 15: for any valid launchpad params, shapes are non-empty, bbox is positive and every shape has non-empty d", () => {
    fc.assert(
      fc.property(
        doubleArb(0.1, 0.5), // padW
        doubleArb(0.1, 0.5), // padH
        doubleArb(0.05, 0.3), // taperLen
        doubleArb(0.01, 0.05), // traceWidth
        doubleArb(0.005, 0.03), // gap
        doubleArb(0.02, 0.15), // stubLen
        (padW, padH, taperLen, traceWidth, gap, stubLen) => {
          const geo = launchpad({ padW, padH, taperLen, traceWidth, gap, stubLen });
          
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
