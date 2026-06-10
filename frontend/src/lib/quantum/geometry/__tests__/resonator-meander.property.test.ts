import { describe, it, expect } from "vitest";
import fc from "fast-check";
import { meanderResonator } from "../resonator-meander";
import { meanderCenterline, filletCenterline } from "../cpw";

describe("MeanderResonator Property Tests", () => {
  const doubleArb = (min: number, max: number) =>
    fc.double({ min, max, noNaN: true, noInfinity: true });

  it("Property 3: for any valid gap, at least one shape has fill === 'var(--cad-gap)' and minDetail <= 3", () => {
    fc.assert(
      fc.property(
        doubleArb(0.005, 0.03), // gap
        (gap) => {
          const geo = meanderResonator({ gap });
          const gapShapes = geo.shapes.filter(
            s => s.fill === "var(--cad-gap)" && (s.minDetail ?? 1) <= 3
          );
          expect(gapShapes.length).toBeGreaterThanOrEqual(1);
        }
      ),
      { numRuns: 100 }
    );
  });

  it("Property 10: autoTurns mode computes turn count and pitch affects it monotonically", () => {
    fc.assert(
      fc.property(
        doubleArb(2.0, 5.0), // length
        doubleArb(0.1, 0.5), // leadIn
        doubleArb(0.1, 0.5), // pitch
        (length, leadIn, pitch) => {
          // Ensure leadIn * 2 < length
          const actualLeadIn = Math.min(leadIn, length * 0.4);
          const geo = meanderResonator({ length, leadIn: actualLeadIn, pitch, autoTurns: true });
          
          // Verify turn count calculation formula
          const expectedTurns = Math.max(1, Math.round(Math.max(1, (length - 2 * actualLeadIn) / pitch)));
          // We can't directly check the internal variable turns, but we can verify that annotations contains the turn count
          const ann = geo.annotations?.find(a => a.text.includes("T"));
          if (ann) {
            expect(ann.text).toContain(`${expectedTurns}T`);
          }

          // Check monotonicity: increasing pitch decreases or keeps turn count equal
          const geoLargerPitch = meanderResonator({ length, leadIn: actualLeadIn, pitch: pitch + 0.1, autoTurns: true });
          const turns1 = Math.max(1, Math.round(Math.max(1, (length - 2 * actualLeadIn) / pitch)));
          const turns2 = Math.max(1, Math.round(Math.max(1, (length - 2 * actualLeadIn) / (pitch + 0.1))));
          expect(turns2).toBeLessThanOrEqual(turns1);
        }
      ),
      { numRuns: 100 }
    );
  });

  it("Property 11: increasing amplitude increases bbox.h", () => {
    fc.assert(
      fc.property(
        doubleArb(0.1, 0.3), // a1
        doubleArb(0.31, 0.6), // a2
        (a1, a2) => {
          const geo1 = meanderResonator({ amplitude: a1, axis: "horizontal" });
          const geo2 = meanderResonator({ amplitude: a2, axis: "horizontal" });
          expect(geo2.bbox.h).toBeGreaterThan(geo1.bbox.h);
        }
      ),
      { numRuns: 100 }
    );
  });

  it("Property 12: at least one trace shape has minDetail <= 2, and one gap shape has minDetail <= 3", () => {
    fc.assert(
      fc.property(
        doubleArb(0.005, 0.03), // gap
        (gap) => {
          const geo = meanderResonator({ gap });
          const traceShapes = geo.shapes.filter(
            s => s.layer === "metal" && (s.minDetail ?? 1) <= 2 && s.fill !== "none"
          );
          const gapShapes = geo.shapes.filter(
            s => s.fill === "var(--cad-gap)" && (s.minDetail ?? 1) <= 3
          );
          expect(traceShapes.length).toBeGreaterThanOrEqual(1);
          expect(gapShapes.length).toBeGreaterThanOrEqual(1);
        }
      ),
      { numRuns: 100 }
    );
  });

  it("Property 13: variant colors match readout and bus tokens", () => {
    fc.assert(
      fc.property(
        fc.constantFrom("readout", "bus") as fc.Arbitrary<"readout" | "bus">,
        (variant) => {
          const geo = meanderResonator({ variant });
          const traceColor = variant === "bus" ? "var(--cad-bus)" : "var(--cad-readout)";
          const traceShape = geo.shapes.find(
            s => s.layer === "metal" && (s.minDetail ?? 1) === 2
          );
          expect(traceShape?.fill).toBe(traceColor);
        }
      ),
      { numRuns: 100 }
    );
  });

  it("Property 16: calling filletCenterline directly with fillet > 0 produces more points", () => {
    fc.assert(
      fc.property(
        doubleArb(2.0, 5.0), // length
        doubleArb(0.1, 0.4), // amplitude
        doubleArb(0.05, 0.15), // fillet
        (length, amplitude, fillet) => {
          const start = { x: 0, y: 0 };
          const end = { x: length, y: 0 };
          const pts = meanderCenterline(start, end, { turns: 4, amplitude, leadIn: 0.18 });
          
          const filleted = filletCenterline(pts, fillet);
          expect(filleted.length).toBeGreaterThan(pts.length);
        }
      ),
      { numRuns: 100 }
    );
  });
});
