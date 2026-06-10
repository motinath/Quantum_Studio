import { describe, it, expect } from "vitest";
import fc from "fast-check";
import { transmonPocket } from "../transmon-pocket";

describe("TransmonPocket Property Tests", () => {
  const doubleArb = (min: number, max: number) =>
    fc.double({ min, max, noNaN: true, noInfinity: true });

  it("Property 2: bbox.w === pocketW and bbox.h === pocketH", () => {
    fc.assert(
      fc.property(
        doubleArb(0.3, 1.0), // pocketW
        doubleArb(0.3, 1.0), // pocketH
        (pocketW, pocketH) => {
          const geo = transmonPocket({ pocketW, pocketH });
          expect(geo.bbox.w).toBeCloseTo(pocketW, 5);
          expect(geo.bbox.h).toBeCloseTo(pocketH, 5);
        }
      ),
      { numRuns: 100 }
    );
  });

  it("Property 3: at least one shape has fill === 'var(--cad-gap)' and minDetail <= 2", () => {
    fc.assert(
      fc.property(
        doubleArb(0.005, 0.05), // gap (or clGap since the etched outline uses padGap/gap constants)
        (gap) => {
          const geo = transmonPocket({ clGap: gap });
          const gapShapes = geo.shapes.filter(
            s => s.fill === "var(--cad-gap)" && (s.minDetail ?? 1) <= 2
          );
          expect(gapShapes.length).toBeGreaterThanOrEqual(1);
        }
      ),
      { numRuns: 100 }
    );
  });

  it("Property 5: at least one shape has minDetail >= 4 and fill === 'var(--cad-qubit-junction)'", () => {
    fc.assert(
      fc.property(
        doubleArb(0.01, 0.05), // padGap
        (padGap) => {
          const geo = transmonPocket({ padGap });
          const jjShapes = geo.shapes.filter(
            s => (s.minDetail ?? 1) >= 4 && s.fill === "var(--cad-qubit-junction)"
          );
          expect(jjShapes.length).toBeGreaterThanOrEqual(1);
        }
      ),
      { numRuns: 100 }
    );
  });

  it("Property 6: exactly two shapes have fill === 'var(--cad-qubit-pad)', minDetail <= 2, maxDetail === 4", () => {
    fc.assert(
      fc.property(
        doubleArb(0.2, 0.5), // padW
        doubleArb(0.05, 0.15), // padH
        doubleArb(0.01, 0.05), // padGap
        (padW, padH, padGap) => {
          const geo = transmonPocket({ padW, padH, padGap });
          const padShapes = geo.shapes.filter(
            s => s.fill === "var(--cad-qubit-pad)" &&
                 (s.minDetail ?? 1) <= 2 &&
                 s.maxDetail === 4
          );
          expect(padShapes.length).toBe(2);
        }
      ),
      { numRuns: 100 }
    );
  });
});
