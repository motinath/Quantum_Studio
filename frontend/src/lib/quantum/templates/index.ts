/**
 * Starter templates — fully connected superconducting chip layouts.
 *
 * Placement math is derived from actual geometry pin positions so every
 * component visually touches its neighbour with a realistic coupling gap.
 *
 * Signal flow in every template:
 *   Launchpad → Feedline → (coupling gap) → Readout Resonator
 *               → (coupling claw) → Qubit → (bus/coupler) → Neighbour Qubit
 */
import { newDocument, type ChipDocument, type ComponentInstance } from "../model/document";

const mk = (
  kind: string,
  name: string,
  x: number,
  y: number,
  params: Record<string, unknown> = {},
  rotation = 0,
): ComponentInstance => ({
  id: crypto.randomUUID(),
  kind,
  name,
  placement: { x, y, rotation },
  params,
});

// ---------------------------------------------------------------------------
// Shared geometry constants (must match geometry/*.ts defaults / params used)
// ---------------------------------------------------------------------------

/** TransmonCross pin offset from centre: armLen + gap + clawWidth */
const pinOffset = (armLen: number, gap: number, clawW: number) =>
  armLen + gap + clawW;

/** MeanderResonator coupling pad half-width perpendicular to axis */
const resCouplingHalfW = (traceWidth: number) =>
  Math.max(traceWidth * 2.5, 0.040) / 2;

/** Launchpad "tie" pin x-offset from placement origin (taper + stub) */
const LP_TIE_X = 0.18 + 0.08; // taperLen + stubLen = 0.26 mm

export interface TemplateDef {
  id: string;
  label: string;
  description: string;
  build: () => ChipDocument;
}

export const templates: TemplateDef[] = [
  // =========================================================================
  // 1. Single Transmon — minimal demo
  // =========================================================================
  {
    id: "single-transmon",
    label: "Single Transmon",
    description: "One TransmonCross centred on a 3 × 3 mm chip",
    build: () => {
      const doc = newDocument("Single_Transmon");
      doc.chipSize = { w: 3, h: 3 };
      doc.components.push(
        mk("transmon-cross", "Q1", 0, 0, {
          armLength: 0.28, armWidth: 0.045, pocket: 0.70,
          gap: 0.020, clawSize: 0.07, clawWidth: 0.020,
        }),
      );
      return doc;
    },
  },

  // =========================================================================
  // 2. Transmon + Readout — one qubit, one resonator, one launchpad pair
  //
  //  LP_IN ──── FEEDLINE ────── (gap) ── RDO_1 ──(claw gap)── Q1
  //                                                            │
  //                                                        LP_OUT (north)
  // =========================================================================
  {
    id: "readout-demo",
    label: "Transmon + Readout",
    description: "Single qubit with λ/4 readout resonator, feedline and launchpads",
    build: () => {
      const doc = newDocument("Readout_Demo");
      doc.chipSize = { w: 6, h: 4 };

      // Qubit params
      const armLen = 0.28, gap = 0.020, clawW = 0.020;
      const pinOff = pinOffset(armLen, gap, clawW); // 0.32 mm

      // Q1 at centre
      const qx = 0, qy = 0;
      doc.components.push(mk("transmon-cross", "Q1", qx, qy, {
        armLength: armLen, armWidth: 0.045, pocket: 0.70,
        gap, clawSize: 0.07, clawWidth: clawW,
      }));

      // RDO_1: readout resonator, horizontal, coupler end touching Q1's east claw
      // Q1 east pin world pos = (qx + pinOff, qy) = (0.32, 0)
      // Resonator coupler pin at origin → place at (qx + pinOff, qy)
      const rdoLen = 2.0;
      const rdoX = qx + pinOff;
      const rdoY = qy;
      doc.components.push(mk("meander-resonator", "RDO_1", rdoX, rdoY, {
        length: rdoLen, amplitude: 0.22, traceWidth: 0.028, gap: 0.014,
        fillet: 0.08, axis: "horizontal", autoTurns: true, pitch: 0.32,
        variant: "readout", couplingPad: true,
      }));
      // Resonator open end world x = rdoX + rdoLen = 0.32 + 2.0 = 2.32
      // Feedline couples to the resonator coupling pad (at resonator start, open side)
      // Feedline runs horizontally at y = rdoY
      const feedY = rdoY;
      const feedXStart = rdoX + rdoLen + 0.04; // just past resonator open end
      const feedXEnd = 2.6;
      doc.components.push(mk("feedline", "FEEDLINE", 0, feedY, {
        waypoints: [{ x: feedXStart, y: feedY }, { x: feedXEnd, y: feedY }],
        variant: "feedline", traceWidth: 0.028, gap: 0.014,
      }));

      // LP_OUT: launchpad at right chip edge, tie pin toward feedline
      // tie pin at (LP_OUT.x + LP_TIE_X, feedY)
      // We want tie pin at feedXEnd → LP_OUT.x = feedXEnd - LP_TIE_X
      const lpOutX = feedXEnd - LP_TIE_X;
      doc.components.push(mk("launchpad-wirebond", "LP_OUT", lpOutX, feedY, {
        padW: 0.28, padH: 0.28, taperLen: 0.18, traceWidth: 0.028, gap: 0.014,
      }, 180)); // rotated 180° so taper points left toward feedline

      return doc;
    },
  },

  // =========================================================================
  // 3. 4Q Linear — the "IBM linear" layout
  //
  //   Q1 ── BUS_1 ── Q2 ── BUS_2 ── Q3 ── BUS_3 ── Q4
  //   │              │              │              │
  //  RDO1          RDO2           RDO3           RDO4
  //   └──────────── FEEDLINE ─────────────────────┘
  //  LP_IN                                     LP_OUT
  //
  // All resonators couple to the SOUTH claw of each qubit.
  // Bus resonators run HORIZONTALLY between EAST/WEST claws.
  // Feedline runs BELOW at a fixed y, coupled to each readout resonator's
  // open end via a short coupling gap (the resonator's T-bar open end
  // sits just above the feedline trace).
  // =========================================================================
  {
    id: "4q-linear",
    label: "4Q Linear",
    description: "4 transmons in a row — bus resonators, readout resonators, feedline, launchpads",
    build: () => {
      const doc = newDocument("4Q_Linear");
      doc.chipSize = { w: 12, h: 7 };

      // ── Qubit parameters ──────────────────────────────────────────────────
      const armLen = 0.24, armW = 0.045, pocket = 0.70;
      const gapQ = 0.020, clawSz = 0.07, clawW = 0.020;
      const pinOff = pinOffset(armLen, gapQ, clawW); // 0.278 mm

      const qPitch = 2.6;   // centre-to-centre spacing
      const qY = 0.8;        // qubit row y
      const nQ = 4;
      const qXs = Array.from({ length: nQ }, (_, i) =>
        (i - (nQ - 1) / 2) * qPitch   // symmetric around x=0
      ); // [-3.9, -1.3, 1.3, 3.9]

      const qParams = { armLength: armLen, armWidth: armW, pocket, gap: gapQ, clawSize: clawSz, clawWidth: clawW };
      qXs.forEach((x, i) => doc.components.push(mk("transmon-cross", `Q${i + 1}`, x, qY, qParams)));

      // ── Bus resonators (horizontal, between east/west claws) ──────────────
      // Q_i east pin: (qXs[i] + pinOff, qY)
      // Q_{i+1} west pin: (qXs[i+1] - pinOff, qY)
      // Bus resonator: coupler at origin, grows +x toward "open" end
      // Place coupler at Q_i east pin; open end naturally reaches Q_{i+1} west pin
      const busAmp = 0.24;
      const busTW = 0.028, busGap = 0.014;

      for (let i = 0; i < nQ - 1; i++) {
        const busX = qXs[i] + pinOff;     // coupler at east claw of left qubit
        const busEndX = qXs[i + 1] - pinOff; // open end at west claw of right qubit
        const busLen = busEndX - busX;
        doc.components.push(mk("bus-resonator", `BUS_${i + 1}`, busX, qY, {
          length: busLen, amplitude: busAmp,
          traceWidth: busTW, gap: busGap, fillet: 0.08,
          axis: "horizontal", autoTurns: true, pitch: 0.38,
          variant: "bus", couplingPad: false,
        }));
      }

      // ── Readout resonators (vertical, growing downward from south claws) ──
      // Q_i south pin: (qXs[i], qY - pinOff)
      // Resonator coupler at origin, grows +y when axis="vertical"
      // Rotate 180° → grows in -y direction (downward)
      // Place at (qXs[i], qY - pinOff)
      const rdoLen = 1.8;
      const rdoAmp = 0.20;
      const rdoTW = 0.028, rdoGap = 0.014;

      qXs.forEach((qx, i) => {
        const rdoX = qx;
        const rdoY = qY - pinOff; // south claw tip
        doc.components.push(mk("meander-resonator", `RDO_${i + 1}`, rdoX, rdoY, {
          length: rdoLen, amplitude: rdoAmp,
          traceWidth: rdoTW, gap: rdoGap, fillet: 0.08,
          axis: "vertical", autoTurns: true, pitch: 0.32,
          variant: "readout", couplingPad: true,
        }, 180)); // 180° → meander opens downward (−y from placement)
        // After rotation, the open end is at world y ≈ rdoY - rdoLen
      });

      // ── Feedline (horizontal, below all readout resonators) ───────────────
      // Readout resonator open end (after 180° rotation) is at:
      //   world y = rdoY - rdoLen = (qY - pinOff) - rdoLen
      //           = (0.8 - 0.278) - 1.8 = -1.278
      // Place feedline slightly below so there is a small coupling gap:
      const rdoOpenY = qY - pinOff - rdoLen;
      const feedY = rdoOpenY - 0.06; // ~60 µm coupling gap between T-bar and feedline
      const feedMargin = 1.0;
      const feedXL = qXs[0] - feedMargin;
      const feedXR = qXs[nQ - 1] + feedMargin;
      doc.components.push(mk("feedline", "FEEDLINE", 0, feedY, {
        waypoints: [{ x: feedXL, y: feedY }, { x: feedXR, y: feedY }],
        variant: "feedline", traceWidth: 0.030, gap: 0.015,
      }));

      // ── Launchpads (at feedline ends, tie pins touching feedline ends) ─────
      // LP_IN: rotation=0 → taper points in +x direction
      //   tie pin at (lpX + LP_TIE_X, feedY) = feedXL → lpX = feedXL - LP_TIE_X
      const lpInX = feedXL - LP_TIE_X;
      const lpOutX = feedXR + LP_TIE_X;

      doc.components.push(mk("launchpad-wirebond", "LP_IN", lpInX, feedY, {
        padW: 0.30, padH: 0.30, taperLen: 0.18, traceWidth: 0.030, gap: 0.015,
      }, 0));
      doc.components.push(mk("launchpad-wirebond", "LP_OUT", lpOutX, feedY, {
        padW: 0.30, padH: 0.30, taperLen: 0.18, traceWidth: 0.030, gap: 0.015,
      }, 180));

      return doc;
    },
  },

  // =========================================================================
  // 4. 5Q Heavy-Hex — IBM-style heavy-hex unit cell
  //
  //         Q1
  //        /  \
  //      Q4    Q5       (Q1 top, Q4/Q5 middle, Q2/Q3 bottom)
  //      |      |
  //      Q2    Q3
  //
  // Connections via bus resonators. Readouts go down from Q2/Q3/Q4/Q5
  // and sideways from Q1. Feedline runs across the bottom.
  // =========================================================================
  {
    id: "5q-heavy-hex",
    label: "IBM 5Q Heavy-Hex",
    description: "5 transmons in heavy-hex topology — bus resonators, readouts, feedline, launchpads",
    build: () => {
      const doc = newDocument("5Q_HeavyHex");
      doc.chipSize = { w: 9, h: 10 };

      const armLen = 0.24, gapQ = 0.020, clawW = 0.020;
      const pinOff = pinOffset(armLen, gapQ, clawW); // 0.278 mm

      // ── Qubit positions ───────────────────────────────────────────────────
      // Heavy-hex spacing: horizontal pitch 2.4 mm, vertical pitch 2.0 mm
      const hPitch = 2.4, vPitch = 2.0;
      const qpos: Record<string, [number, number]> = {
        Q1: [0, vPitch],
        Q4: [-hPitch / 2, 0],
        Q5: [hPitch / 2, 0],
        Q2: [-hPitch / 2, -vPitch],
        Q3: [hPitch / 2, -vPitch],
      };
      const qParams = {
        armLength: armLen, armWidth: 0.040, pocket: 0.65,
        gap: gapQ, clawSize: 0.065, clawWidth: clawW,
      };
      Object.entries(qpos).forEach(([name, [x, y]]) =>
        doc.components.push(mk("transmon-cross", name, x, y, qParams))
      );

      // ── Bus resonators between connected pairs ────────────────────────────
      // Each bus runs between the facing claws of two qubits.
      // Convention: coupler end at "from" qubit's facing pin, open end at "to" qubit's pin.
      const busTW = 0.028, busGap = 0.014, busAmp = 0.20;

      // Helper: place a bus resonator between two qubit pin world-positions
      const addBus = (name: string, fromPinWorld: [number, number], toPinWorld: [number, number]) => {
        const [fx, fy] = fromPinWorld;
        const [tx, ty] = toPinWorld;
        const dx = tx - fx, dy = ty - fy;
        const len = Math.hypot(dx, dy);
        const angleDeg = (Math.atan2(dy, dx) * 180) / Math.PI;
        // Horizontal bus if mostly horizontal, else vertical
        const axis = Math.abs(dx) >= Math.abs(dy) ? "horizontal" : "vertical";
        // Effective length along axis
        const axisLen = axis === "horizontal" ? Math.abs(dx) : Math.abs(dy);
        doc.components.push(mk("bus-resonator", name, fx, fy, {
          length: axisLen, amplitude: busAmp,
          traceWidth: busTW, gap: busGap, fillet: 0.07,
          axis, autoTurns: true, pitch: 0.34,
          variant: "bus", couplingPad: false,
        }, axis === "horizontal" ? 0 : (dy < 0 ? 180 : 0)));
        void len; void angleDeg; // suppress unused warnings
      };

      // Q1(south) → Q4(north): Q1 south pin = (0, vPitch - pinOff), Q4 north pin = (-hPitch/2, 0 + pinOff)
      // These are diagonal — use the simpler approach: place at midpoint between pockets
      // and use a meandering bus route
      // For heavy-hex the bus resonators are VERTICAL between top/middle and middle/bottom rows
      // Q1 south → between Q4 and Q5 is diagonal — Qiskit Metal uses a straight CPW route here
      // We simplify: diagonal links use a route-meander, vertical/horizontal links use bus-resonator

      // Q4 north ← Q1 south (diagonal, approx): use route
      // Q5 north ← Q1 south (diagonal, approx): use route
      // Q2 north ← Q4 south (vertical): use bus-resonator
      // Q3 north ← Q5 south (vertical): use bus-resonator
      // Q2 east ← Q3 west (horizontal): use bus-resonator

      // Q4 south pin → Q2 north pin (vertical link)
      addBus("BUS_Q4Q2",
        [qpos.Q4[0], qpos.Q4[1] - pinOff],   // Q4 south pin
        [qpos.Q2[0], qpos.Q2[1] + pinOff]    // Q2 north pin
      );
      // Q5 south pin → Q3 north pin (vertical link)
      addBus("BUS_Q5Q3",
        [qpos.Q5[0], qpos.Q5[1] - pinOff],
        [qpos.Q3[0], qpos.Q3[1] + pinOff]
      );
      // Q2 east pin → Q3 west pin (horizontal link)
      addBus("BUS_Q2Q3",
        [qpos.Q2[0] + pinOff, qpos.Q2[1]],
        [qpos.Q3[0] - pinOff, qpos.Q3[1]]
      );

      // Q1→Q4 diagonal coupling via short meander route
      doc.components.push(mk("route-meander", "CPL_Q1Q4",
        (qpos.Q1[0] + qpos.Q4[0]) / 2, (qpos.Q1[1] + qpos.Q4[1]) / 2, {
        waypoints: [
          { x: qpos.Q1[0] - pinOff * 0.7, y: qpos.Q1[1] - pinOff * 0.7 },
          { x: qpos.Q4[0] + pinOff * 0.7, y: qpos.Q4[1] + pinOff * 0.7 },
        ],
        meander: true, meanderTurns: 3, meanderAmp: 0.14,
        traceWidth: 0.028, gap: 0.014,
      }));

      // Q1→Q5 diagonal coupling
      doc.components.push(mk("route-meander", "CPL_Q1Q5",
        (qpos.Q1[0] + qpos.Q5[0]) / 2, (qpos.Q1[1] + qpos.Q5[1]) / 2, {
        waypoints: [
          { x: qpos.Q1[0] + pinOff * 0.7, y: qpos.Q1[1] - pinOff * 0.7 },
          { x: qpos.Q5[0] - pinOff * 0.7, y: qpos.Q5[1] + pinOff * 0.7 },
        ],
        meander: true, meanderTurns: 3, meanderAmp: 0.14,
        traceWidth: 0.028, gap: 0.014,
      }));

      // ── Readout resonators ─────────────────────────────────────────────────
      // Each readout goes vertically downward from the qubit's south claw
      // toward the feedline. Length varies so all open ends are near feedline y.
      const feedY = qpos.Q2[1] - pinOff - 1.6 - 0.08; // below Q2/Q3 by ~1.6mm resonator + gap
      const rdoTW = 0.028, rdoGap = 0.014;

      const readouts: Array<{ q: keyof typeof qpos; name: string; rdoLen: number; xOff: number }> = [
        // Q1 is at top — readout needs to reach down to feedline (longer)
        { q: "Q1", name: "RR1", rdoLen: 2.8, xOff: 0.28 },
        // Q4, Q5 middle row
        { q: "Q4", name: "RR4", rdoLen: 1.6, xOff: -0.28 },
        { q: "Q5", name: "RR5", rdoLen: 1.6, xOff: 0.28 },
        // Q2, Q3 bottom row — short, just need to reach feedline
        { q: "Q2", name: "RR2", rdoLen: 0.8, xOff: 0 },
        { q: "Q3", name: "RR3", rdoLen: 0.8, xOff: 0 },
      ];

      readouts.forEach(({ q, name, rdoLen, xOff }) => {
        const [qx, qy] = qpos[q];
        doc.components.push(mk("meander-resonator", name, qx + xOff, qy - pinOff, {
          length: rdoLen, amplitude: 0.18,
          traceWidth: rdoTW, gap: rdoGap, fillet: 0.07,
          axis: "vertical", autoTurns: true, pitch: 0.30,
          variant: "readout", couplingPad: true,
        }, 180)); // rotated 180° so resonator grows downward
      });

      // ── Feedline ────────────────────────────────────────────────────────────
      const feedXL = qpos.Q2[0] - 1.2;
      const feedXR = qpos.Q3[0] + 1.2;
      doc.components.push(mk("feedline", "FEEDLINE", 0, feedY, {
        waypoints: [{ x: feedXL, y: feedY }, { x: feedXR, y: feedY }],
        variant: "feedline", traceWidth: 0.030, gap: 0.015,
      }));

      // ── Launchpads ──────────────────────────────────────────────────────────
      doc.components.push(mk("launchpad-wirebond", "LP_IN", feedXL - LP_TIE_X, feedY, {
        padW: 0.30, padH: 0.30, taperLen: 0.18, traceWidth: 0.030, gap: 0.015,
      }, 0));
      doc.components.push(mk("launchpad-wirebond", "LP_OUT", feedXR + LP_TIE_X, feedY, {
        padW: 0.30, padH: 0.30, taperLen: 0.18, traceWidth: 0.030, gap: 0.015,
      }, 180));

      return doc;
    },
  },

  // =========================================================================
  // 5. 7Q Heavy Hex — 3-row heavy-hex lattice
  //
  //   Q1       Q2         (top row, 2 qubits)
  //     \     /  \
  //      Q3   Q4           (middle row)
  //     /  \   \
  //   Q5     Q6   Q7       (bottom row, 3 qubits)
  //
  //   All qubits connected by vertical bus resonators on the heavy-hex edges.
  //   Readouts descend from each qubit to a shared feedline at the bottom.
  // =========================================================================
  {
    id: "7q-heavy-hex",
    label: "7Q Heavy Hex",
    description: "7 qubits in a 3-row heavy-hex lattice with bus resonators, readouts, feedline",
    build: () => {
      const doc = newDocument("7Q_HeavyHex");
      doc.chipSize = { w: 10, h: 10 };

      const armLen = 0.22, gapQ = 0.020, clawW = 0.018;
      const pinOff = pinOffset(armLen, gapQ, clawW); // 0.258 mm

      const hP = 2.2, vP = 1.9; // horizontal and vertical pitch

      // 3-row heavy-hex: top=2Q, mid=2Q, bot=3Q
      //  Row y:  top=vP, mid=0, bot=-vP
      //  Col x pattern: top at ±hP/2, mid at 0 and hP, bot at -hP/2, hP/2, 3hP/2
      const qpos: Record<string, [number, number]> = {
        Q1: [-hP / 2, vP],
        Q2: [hP / 2, vP],
        Q3: [-hP / 2, 0],
        Q4: [hP / 2, 0],
        Q5: [-hP, -vP],
        Q6: [0, -vP],
        Q7: [hP, -vP],
      };

      const qParams = {
        armLength: armLen, armWidth: 0.038, pocket: 0.60,
        gap: gapQ, clawSize: 0.06, clawWidth: clawW,
      };
      Object.entries(qpos).forEach(([n, [x, y]]) =>
        doc.components.push(mk("transmon-cross", n, x, y, qParams))
      );

      // ── Bus resonators on heavy-hex edges ──────────────────────────────────
      const busTW = 0.026, busGapR = 0.013, busAmp = 0.18;

      const busLinks: Array<[string, string, string]> = [
        ["BUS_12", "Q1", "Q2"], // horizontal top
        ["BUS_34", "Q3", "Q4"], // horizontal mid
        ["BUS_13", "Q1", "Q3"], // vertical left top→mid
        ["BUS_24", "Q2", "Q4"], // vertical right top→mid
        ["BUS_35", "Q3", "Q5"], // diagonal mid→bot-left
        ["BUS_46", "Q4", "Q6"], // diagonal mid→bot-centre
        ["BUS_56", "Q5", "Q6"], // horizontal bot left
        ["BUS_67", "Q6", "Q7"], // horizontal bot right
      ];

      busLinks.forEach(([name, qa, qb]) => {
        const [ax, ay] = qpos[qa], [bx, by] = qpos[qb];
        const dx = bx - ax, dy = by - ay;
        const axis = Math.abs(dx) >= Math.abs(dy) ? "horizontal" : "vertical";
        // Bus coupler starts at the facing pin of qa
        let fromX = ax, fromY = ay;
        if (axis === "horizontal") {
          fromX = ax + (dx > 0 ? pinOff : -pinOff);
        } else {
          fromY = ay + (dy > 0 ? pinOff : -pinOff);
        }
        const busLen = axis === "horizontal"
          ? Math.abs(dx) - 2 * pinOff
          : Math.abs(dy) - 2 * pinOff;
        const rot = axis === "horizontal"
          ? (dx < 0 ? 180 : 0)
          : (dy < 0 ? 180 : 0);
        doc.components.push(mk("bus-resonator", name, fromX, fromY, {
          length: Math.max(0.4, busLen), amplitude: busAmp,
          traceWidth: busTW, gap: busGapR, fillet: 0.065,
          axis, autoTurns: true, pitch: 0.32,
          variant: "bus", couplingPad: false,
        }, rot));
      });

      // ── Readout resonators (vertical, downward from south claw) ───────────
      // Cap feedline so top-row resonators don't exceed 2.2 mm
      // Q5 south pin y = -vP - pinOff = -2.158; give 1.1 mm resonator → feedY = -3.33
      // But cap at max 2.0 mm resonator for any qubit
      const maxRdoLen = 2.0;
      const feedY = qpos.Q5[1] - pinOff - maxRdoLen * 0.55 - 0.07; // −3.028
      const rdoTW = 0.026, rdoGap = 0.013;

      // Readout length = distance from south claw to just above feedline, capped at maxRdoLen
      const rdoForQ = (qName: string, xOff = 0) => {
        const [qx, qy] = qpos[qName];
        const southPinY = qy - pinOff;
        const rdoLen = Math.min(maxRdoLen, Math.max(0.5, southPinY - feedY - 0.07));
        doc.components.push(mk("meander-resonator", `RR_${qName}`, qx + xOff, southPinY, {
          length: rdoLen, amplitude: 0.16,
          traceWidth: rdoTW, gap: rdoGap, fillet: 0.065,
          axis: "vertical", autoTurns: true, pitch: 0.28,
          variant: "readout", couplingPad: true,
        }, 180));
      };

      rdoForQ("Q1", -0.22);
      rdoForQ("Q2", 0.22);
      rdoForQ("Q3", -0.22);
      rdoForQ("Q4", 0.22);
      rdoForQ("Q5");
      rdoForQ("Q6");
      rdoForQ("Q7");

      // ── Feedline ────────────────────────────────────────────────────────────
      const feedXL = qpos.Q5[0] - 1.2;
      const feedXR = qpos.Q7[0] + 1.2;
      doc.components.push(mk("feedline", "FEEDLINE", 0, feedY, {
        waypoints: [{ x: feedXL, y: feedY }, { x: feedXR, y: feedY }],
        variant: "feedline", traceWidth: 0.030, gap: 0.015,
      }));

      // ── Launchpads ──────────────────────────────────────────────────────────
      doc.components.push(mk("launchpad-wirebond", "LP_IN", feedXL - LP_TIE_X, feedY, {
        padW: 0.28, padH: 0.28, taperLen: 0.18, traceWidth: 0.030, gap: 0.015,
      }, 0));
      doc.components.push(mk("launchpad-wirebond", "LP_OUT", feedXR + LP_TIE_X, feedY, {
        padW: 0.28, padH: 0.28, taperLen: 0.18, traceWidth: 0.030, gap: 0.015,
      }, 180));

      return doc;
    },
  },

  // =========================================================================
  // 6. 16Q Grid — 4×4 transmon grid with full bus and readout wiring
  // =========================================================================
  {
    id: "16q-grid",
    label: "16Q Grid",
    description: "4×4 transmon grid — horizontal/vertical bus resonators, readouts, feedline",
    build: () => {
      const doc = newDocument("16Q_Grid");
      doc.chipSize = { w: 14, h: 12 };

      const armLen = 0.20, gapQ = 0.018, clawW = 0.016;
      const pinOff = pinOffset(armLen, gapQ, clawW); // 0.234 mm

      const cols = 4, rows = 4;
      const hP = 2.2, vP = 2.0; // grid pitches
      const offX = -((cols - 1) * hP) / 2;
      const offY = -((rows - 1) * vP) / 2 + 0.6;

      const qParams = {
        armLength: armLen, armWidth: 0.035, pocket: 0.55,
        gap: gapQ, clawSize: 0.055, clawWidth: clawW,
      };

      // Build grid positions
      const grid: { id: string; x: number; y: number }[][] = [];
      let idx = 1;
      for (let r = 0; r < rows; r++) {
        grid.push([]);
        for (let c = 0; c < cols; c++) {
          const x = offX + c * hP;
          const y = offY + r * vP;
          const id = `Q${idx++}`;
          grid[r].push({ id, x, y });
          doc.components.push(mk("transmon-cross", id, x, y, qParams));
        }
      }

      const busTW = 0.026, busGap = 0.013, busAmp = 0.16;

      // Horizontal bus resonators
      let bi = 1;
      for (let r = 0; r < rows; r++) {
        for (let c = 0; c < cols - 1; c++) {
          const a = grid[r][c], b = grid[r][c + 1];
          const fromX = a.x + pinOff;
          const busLen = b.x - a.x - 2 * pinOff;
          doc.components.push(mk("bus-resonator", `BUS_H${bi++}`, fromX, a.y, {
            length: busLen, amplitude: busAmp,
            traceWidth: busTW, gap: busGap, fillet: 0.06,
            axis: "horizontal", autoTurns: true, pitch: 0.34,
            variant: "bus", couplingPad: false,
          }));
        }
      }

      // Vertical bus resonators
      for (let c = 0; c < cols; c++) {
        for (let r = 0; r < rows - 1; r++) {
          const a = grid[r][c], b = grid[r + 1][c];
          const fromY = a.y + pinOff;
          const busLen = b.y - a.y - 2 * pinOff;
          doc.components.push(mk("bus-resonator", `BUS_V${bi++}`, a.x, fromY, {
            length: busLen, amplitude: busAmp * 0.8,
            traceWidth: busTW, gap: busGap, fillet: 0.06,
            axis: "vertical", autoTurns: true, pitch: 0.28,
            variant: "bus", couplingPad: false,
          }));
        }
      }

      // Readout resonators — all go downward from south claw
      const feedY = grid[0][0].y - pinOff - 1.2 - 0.07;
      const rdoTW = 0.024, rdoGap = 0.012;

      for (let r = 0; r < rows; r++) {
        for (let c = 0; c < cols; c++) {
          const q = grid[r][c];
          const southPinY = q.y - pinOff;
          const rdoLen = Math.max(0.4, southPinY - feedY - 0.07);
          // Alternate x-offset to avoid resonator overlap on same column
          const xOff = (r % 2 === 0 ? 0.18 : -0.18);
          doc.components.push(mk("meander-resonator", `RR_${q.id}`, q.x + xOff, southPinY, {
            length: rdoLen, amplitude: 0.14,
            traceWidth: rdoTW, gap: rdoGap, fillet: 0.055,
            axis: "vertical", autoTurns: true, pitch: 0.26,
            variant: "readout", couplingPad: true,
          }, 180));
        }
      }

      // Feedline
      const feedXL = grid[0][0].x - 1.2;
      const feedXR = grid[0][cols - 1].x + 1.2;
      doc.components.push(mk("feedline", "FEEDLINE", 0, feedY, {
        waypoints: [{ x: feedXL, y: feedY }, { x: feedXR, y: feedY }],
        variant: "feedline", traceWidth: 0.032, gap: 0.016,
      }));

      // Launchpads
      doc.components.push(mk("launchpad-wirebond", "LP_IN", feedXL - LP_TIE_X, feedY, {
        padW: 0.28, padH: 0.28, taperLen: 0.18, traceWidth: 0.032, gap: 0.016,
      }, 0));
      doc.components.push(mk("launchpad-wirebond", "LP_OUT", feedXR + LP_TIE_X, feedY, {
        padW: 0.28, padH: 0.28, taperLen: 0.18, traceWidth: 0.032, gap: 0.016,
      }, 180));

      return doc;
    },
  },
];

export function getTemplate(id: string) {
  return templates.find(t => t.id === id);
}
