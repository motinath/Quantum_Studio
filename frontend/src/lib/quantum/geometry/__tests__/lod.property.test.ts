/**
 * Property 9: LOD shape filter is a pure predicate consistent with minDetail/maxDetail gates
 *
 * For any shape s with minDetail ∈ {1,2,3,4} and maxDetail ∈ {1,2,3,4} where minDetail ≤ maxDetail,
 * and for any LOD lod ∈ {1,2,3,4}:
 * shapeVisible(s, lod) shall return true iff lod >= s.minDetail && lod <= s.maxDetail
 *
 * **Validates: Requirements 7.1, 7.2, 7.3, 7.4**
 */

import { describe, it, expect } from 'vitest';
import fc from 'fast-check';
import { shapeVisible } from '../lod';
import type { Detail, Shape } from '../types';

const FC_RUNS = { numRuns: 100 };

/** Arbitrary for Detail values (1–4) */
const detailArb = fc.integer({ min: 1, max: 4 }) as fc.Arbitrary<Detail>;

describe('Property 9: shapeVisible is a pure predicate consistent with minDetail/maxDetail gates', () => {
  it('returns true iff lod is within [minDetail, maxDetail] for all valid combinations', () => {
    fc.assert(
      fc.property(
        detailArb,
        detailArb,
        detailArb,
        (minDetail, maxDetail, lod) => {
          // Constrain: minDetail must be <= maxDetail
          fc.pre(minDetail <= maxDetail);

          const shape: Shape = {
            layer: 'metal',
            d: 'M 0 0 h 1 v 1 h -1 Z',
            minDetail,
            maxDetail,
          };

          const result = shapeVisible(shape, lod);
          const expected = lod >= minDetail && lod <= maxDetail;

          expect(result).toBe(expected);
        }
      ),
      FC_RUNS
    );
  });

  it('covers all 64 exhaustive (minDetail, maxDetail, lod) combinations', () => {
    /**
     * There are 10 valid (minDetail, maxDetail) pairs where minDetail <= maxDetail,
     * and 4 lod values = 40 valid combos. We enumerate all explicitly to complement
     * the random property test above.
     */
    const levels: Detail[] = [1, 2, 3, 4];

    for (const minDetail of levels) {
      for (const maxDetail of levels) {
        if (minDetail > maxDetail) continue;

        for (const lod of levels) {
          const shape: Shape = {
            layer: 'metal',
            d: 'M 0 0 h 1 v 1 h -1 Z',
            minDetail,
            maxDetail,
          };

          const result = shapeVisible(shape, lod);
          const expected = lod >= minDetail && lod <= maxDetail;

          expect(result).toBe(expected);
        }
      }
    }
  });

  it('treats missing minDetail as 1 and missing maxDetail as 4', () => {
    fc.assert(
      fc.property(detailArb, (lod) => {
        // Shape with no minDetail / maxDetail defaults to always visible
        const shape: Shape = {
          layer: 'metal',
          d: 'M 0 0 h 1 v 1 h -1 Z',
        };

        expect(shapeVisible(shape, lod)).toBe(true);
      }),
      FC_RUNS
    );
  });

  it('treats missing minDetail as 1 (shape visible from LOD 1)', () => {
    fc.assert(
      fc.property(detailArb, detailArb, (maxDetail, lod) => {
        // No minDetail — defaults to 1
        const shape: Shape = {
          layer: 'metal',
          d: 'M 0 0 h 1 v 1 h -1 Z',
          maxDetail,
        };

        const result = shapeVisible(shape, lod);
        const expected = lod >= 1 && lod <= maxDetail;

        expect(result).toBe(expected);
      }),
      FC_RUNS
    );
  });

  it('treats missing maxDetail as 4 (shape visible up to LOD 4)', () => {
    fc.assert(
      fc.property(detailArb, detailArb, (minDetail, lod) => {
        // No maxDetail — defaults to 4
        const shape: Shape = {
          layer: 'metal',
          d: 'M 0 0 h 1 v 1 h -1 Z',
          minDetail,
        };

        const result = shapeVisible(shape, lod);
        const expected = lod >= minDetail && lod <= 4;

        expect(result).toBe(expected);
      }),
      FC_RUNS
    );
  });
});
