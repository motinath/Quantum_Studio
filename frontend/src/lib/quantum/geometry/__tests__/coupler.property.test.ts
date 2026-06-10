/**
 * Property-based tests for capacitive coupler geometry (Properties 7, 8)
 *
 * **Validates: Requirements 5.2, 5.3, 5.5, 5.6**
 */
import { describe, it, expect } from "vitest";
import fc from "fast-check";
import { capCoupler } from "../coupler";

describe("CapCoupler Property Tests", () => {
  const doubleArb = (min: number, max: number) =>
    fc.double({ min, max, noNaN: true, noInfinity: true });

  /**
   * Property 7: for any valid fingerLen, fingerW, gap, exactly 6 shapes have
   * fill === 'var(--cad-coupler)' and minDetail <= 2.
   * These are: 2 backing bars + 4 interdigitated fingers (all with minDetail: 2).
   * The L1 silhouette (maxDetail: 1) also has fill 'var(--cad-coupler)' but is excluded.
   *
   * **Validates: Requirements 5.2, 5.3, 5.5**
   */
  it("Property 7: exactly 6 shapes have fill === 'var(--cad-coupler)' and minDetail <= 2", () => {
    fc.assert(
      fc.property(
        doubleArb(0.04, 0.3),  // fingerLen: [0.04, 0.3]
        doubleArb(0.01, 0.08), // fingerW: [0.01, 0.08]
        doubleArb(0.003, 0.04), // gap: [0.003, 0.04]
        (fingerLen, fingerW, gap) => {
          const geo = capCoupler({ fingerLen, fingerW, gap });
          // Filter: fill === 'var(--cad-coupler)', minDetail <= 2, exclude maxDetail: 1 (L1 silhouette)
          const couplerDetailShapes = geo.shapes.filter(
            s =>
              s.fill === "var(--cad-coupler)" &&
              (s.minDetail ?? 1) <= 2 &&
              (s.maxDetail ?? 4) !== 1
          );
          expect(couplerDetailShapes.length).toBe(6); // 2 backing bars + 4 fingers
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Property 8: for any valid fingerLen and gap,
   * bbox.w ≈ fingerLen × 2 + gap (within tolerance ~0.025 for the halo padding).
   * Increasing fingerLen by delta increases bbox.w by 2 × delta.
   *
   * Note: bbox.w = totalW + 0.02 where totalW = fingerLen * 2 + gap
   * So bbox.w ≈ fingerLen * 2 + gap within ~0.025 tolerance.
   *
   * **Validates: Requirements 5.5, 5.6**
   */
  it("Property 8: bbox.w ≈ fingerLen × 2 + gap within tolerance; increasing fingerLen increases bbox.w by 2 × delta", () => {
    fc.assert(
      fc.property(
        doubleArb(0.04, 0.15),  // fingerLen1 (lower half of range)
        doubleArb(0.16, 0.3),   // fingerLen2 (upper half, ensuring fingerLen2 > fingerLen1)
        doubleArb(0.003, 0.04), // gap: [0.003, 0.04]
        (fingerLen1, fingerLen2, gap) => {
          const geo1 = capCoupler({ fingerLen: fingerLen1, gap });
          // bbox.w = (fingerLen * 2 + gap) + 0.02 halo padding
          // So |bbox.w - (fingerLen * 2 + gap)| should be ~0.02, within 0.025 tolerance
          const expectedBase1 = fingerLen1 * 2 + gap;
          expect(Math.abs(geo1.bbox.w - expectedBase1)).toBeLessThan(0.025);

          const geo2 = capCoupler({ fingerLen: fingerLen2, gap });
          const deltaLen = fingerLen2 - fingerLen1;
          const deltaBboxW = geo2.bbox.w - geo1.bbox.w;
          // bbox.w increases by exactly 2 * deltaLen
          expect(deltaBboxW).toBeCloseTo(2 * deltaLen, 10);
        }
      ),
      { numRuns: 100 }
    );
  });
});
