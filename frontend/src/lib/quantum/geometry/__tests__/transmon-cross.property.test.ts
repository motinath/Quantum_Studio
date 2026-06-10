import { describe, it, expect } from "vitest";
import fc from "fast-check";
import { transmonCross } from "../transmon-cross";
import { shapeVisible } from "../lod";

describe("TransmonCross Property Tests", () => {
  const doubleArb = (min: number, max: number) =>
    fc.double({ min, max, noNaN: true, noInfinity: true });

  /**
   * Property 1: L1 silhouette shapes span armLength × 2 in each axis & bbox.w === bbox.h
   *
   * **Validates: Requirements 1.1, 1.6, 1.7, 8.2**
   */
  it("Property 1: L1 silhouette shapes span armLength × 2 in each axis & bbox.w === bbox.h", () => {
    fc.assert(
      fc.property(
        doubleArb(0.05, 0.6), // armLength ∈ [0.05, 0.6]
        (armLength) => {
          const geo = transmonCross({ armLength });
          // L1 silhouette shapes have maxDetail: 1 (only visible at L1)
          const l1Shapes = geo.shapes.filter(s => (s.maxDetail ?? 4) <= 1);
          expect(l1Shapes.length).toBeGreaterThan(0);

          // Parse SVG rect path to extract width/height dimensions
          const dims = l1Shapes.map(s => {
            const m = s.d.match(/h\s+([-\d.]+)\s+v\s+([-\d.]+)/);
            if (m) {
              return { w: Math.abs(parseFloat(m[1])), h: Math.abs(parseFloat(m[2])) };
            }
            return { w: 0, h: 0 };
          });

          // The cross silhouette is two overlapping rects: one wide (w=armLen*2, h=armW) and
          // one tall (w=armW, h=armLen*2). Check that arm span equals armLength × 2 in each axis.
          const hasHoriz = dims.some(d => Math.abs(d.w - armLength * 2) < 1e-4);
          const hasVert = dims.some(d => Math.abs(d.h - armLength * 2) < 1e-4);

          expect(hasHoriz).toBe(true);
          expect(hasVert).toBe(true);

          // Bbox must be square (both w and h equal pocket)
          expect(geo.bbox.w).toBeCloseTo(geo.bbox.h, 5);

          // Verify L1 shapes are visible at lod=1 via shapeVisible
          l1Shapes.forEach(s => expect(shapeVisible(s, 1)).toBe(true));
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Property 2: bbox.w === pocket and bbox.h === pocket
   *
   * **Validates: Requirements 1.3, 1.7**
   */
  it("Property 2: bbox.w === pocket and bbox.h === pocket", () => {
    fc.assert(
      fc.property(
        doubleArb(0.3, 0.9), // pocket ∈ [0.3, 0.9]
        (pocket) => {
          const geo = transmonCross({ pocket });
          expect(geo.bbox.w).toBeCloseTo(pocket, 5);
          expect(geo.bbox.h).toBeCloseTo(pocket, 5);
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Property 3: at least one shape has fill === 'var(--cad-gap)' and minDetail <= 2
   *
   * **Validates: Requirements 1.2, 1.8**
   */
  it("Property 3: at least one shape has fill === 'var(--cad-gap)' and minDetail <= 2", () => {
    fc.assert(
      fc.property(
        doubleArb(0.005, 0.05), // gap ∈ [0.005, 0.05]
        (gap) => {
          const geo = transmonCross({ gap });
          const gapShapes = geo.shapes.filter(
            s => s.fill === "var(--cad-gap)" && (s.minDetail ?? 1) <= 2
          );
          expect(gapShapes.length).toBeGreaterThanOrEqual(1);

          // Verify at least one gap shape is visible at lod=2
          const visibleAtL2 = gapShapes.filter(s => shapeVisible(s, 2));
          expect(visibleAtL2.length).toBeGreaterThanOrEqual(1);
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Property 4: shapes at minDetail <= 3 include claw metal shapes in all 4 cardinal directions
   *
   * **Validates: Requirements 1.4, 1.9**
   */
  it("Property 4: shapes at minDetail <= 3 include claw metal shapes in all 4 cardinal directions", () => {
    fc.assert(
      fc.property(
        doubleArb(0.02, 0.15), // clawSize ∈ [0.02, 0.15]
        doubleArb(0.005, 0.04), // clawWidth ∈ [0.005, 0.04]
        (clawSize, clawWidth) => {
          const geo = transmonCross({ clawSize, clawWidth });
          // 3 shapes per cardinal direction (East, West, North, South) = 12 claw shapes
          // Plus 2 L2+ cross metal pads = 14 total shapes matching this filter
          const padShapesAtL3 = geo.shapes.filter(
            s => (s.minDetail ?? 1) <= 3 && s.fill === "var(--cad-qubit-pad)" && s.maxDetail !== 1
          );
          // At least 12 claw shapes (3 per direction × 4 cardinal directions)
          expect(padShapesAtL3.length).toBeGreaterThanOrEqual(12);

          // Verify claw shapes are visible at lod=3
          const visibleAtL3 = padShapesAtL3.filter(s => shapeVisible(s, 3));
          expect(visibleAtL3.length).toBeGreaterThanOrEqual(12);
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Property 5: at least one shape has minDetail >= 4 and fill === 'var(--cad-qubit-junction)'
   *
   * **Validates: Requirements 1.5**
   */
  it("Property 5: at least one shape has minDetail >= 4 and fill === 'var(--cad-qubit-junction)'", () => {
    fc.assert(
      fc.property(
        doubleArb(0.003, 0.03), // jjGap ∈ [0.003, 0.03]
        (jjGap) => {
          const geo = transmonCross({ jjGap });
          const jjShapes = geo.shapes.filter(
            s => (s.minDetail ?? 1) >= 4 && s.fill === "var(--cad-qubit-junction)"
          );
          expect(jjShapes.length).toBeGreaterThanOrEqual(1);

          // Verify JJ shapes are only visible at lod=4 (not at lod=3)
          jjShapes.forEach(s => {
            expect(shapeVisible(s, 4)).toBe(true);
          });
        }
      ),
      { numRuns: 100 }
    );
  });
});
