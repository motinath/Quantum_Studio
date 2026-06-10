import { describe, it, expect } from "vitest";
import { transmonCross } from "../transmon-cross";
import { transmonPocket } from "../transmon-pocket";
import { meanderResonator } from "../resonator-meander";
import { capCoupler } from "../coupler";
import { routeCPW } from "../route";
import { shapeVisible } from "../lod";

describe("Geometry Unit Tests", () => {
  it("Transmon Cross LOD teardown visibility shape counts", () => {
    const geo = transmonCross();
    
    // lod = 1: only L1 shapes visible
    const lod1 = geo.shapes.filter(s => shapeVisible(s, 1));
    expect(lod1.length).toBe(2);

    // lod = 2: only L2 shapes visible
    const lod2 = geo.shapes.filter(s => shapeVisible(s, 2));
    expect(lod2.length).toBe(4);

    // lod = 3: L2 and L3 shapes visible
    const lod3 = geo.shapes.filter(s => shapeVisible(s, 3));
    expect(lod3.length).toBe(17);

    // lod = 4: L2, L3, and L4 shapes visible
    const lod4 = geo.shapes.filter(s => shapeVisible(s, 4));
    expect(lod4.length).toBe(19);
  });

  it("Transmon Pocket two-island check", () => {
    const geo = transmonPocket();
    const pads = geo.shapes.filter(
      s => s.fill === "var(--cad-qubit-pad)" && (s.minDetail ?? 1) <= 2 && s.maxDetail === 4
    );
    expect(pads.length).toBe(2);
  });

  it("Resonator readout variant color checks", () => {
    const geo = meanderResonator({ variant: "readout" });
    const trace = geo.shapes.find(s => s.layer === "metal" && (s.minDetail ?? 1) === 2);
    expect(trace?.fill).toBe("var(--cad-readout)");
  });

  it("Resonator bus variant color checks", () => {
    const geo = meanderResonator({ variant: "bus" });
    const trace = geo.shapes.find(s => s.layer === "metal" && (s.minDetail ?? 1) === 2);
    expect(trace?.fill).toBe("var(--cad-bus)");
  });

  it("Coupler finger count check", () => {
    const geo = capCoupler();
    const couplerShapes = geo.shapes.filter(
      s => s.fill === "var(--cad-coupler)" && (s.minDetail ?? 1) <= 2 && s.maxDetail !== 1
    );
    expect(couplerShapes.length).toBe(6); // 2 backing bars + 4 interdigitated fingers
  });

  it("Route empty waypoint guard check", () => {
    // Single waypoint
    const geoSingle = routeCPW({ waypoints: [{ x: 0, y: 0 }] });
    expect(geoSingle.shapes.length).toBe(0);
    expect(geoSingle.pins.length).toBe(0);
    expect(geoSingle.bbox).toEqual({ x: 0, y: 0, w: 0, h: 0 });

    // Empty waypoints
    const geoEmpty = routeCPW({ waypoints: [] });
    expect(geoEmpty.shapes.length).toBe(0);
  });

  it("Feedline variant color check", () => {
    const geo = routeCPW({ waypoints: [{ x: 0, y: 0 }, { x: 1, y: 1 }], variant: "feedline" });
    const trace = geo.shapes.find(s => s.layer === "metal" && (s.minDetail ?? 1) === 2);
    expect(trace?.fill).toBe("var(--cad-feedline)");
  });
});
