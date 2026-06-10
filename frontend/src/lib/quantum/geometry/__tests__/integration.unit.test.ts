import { describe, it, expect, beforeAll } from "vitest";
import { DEFAULT_LAYERS } from "../../model/document";
import { NetOverlay } from "../../../../components/quantum-editor/Canvas";
import { bootstrapRegistry } from "../../registry/builtins";

describe("Integration Unit Tests", () => {
  beforeAll(() => {
    // Initialize component registry so that kind lookups work
    bootstrapRegistry();
  });

  it("Pins layer default visibility is true", () => {
    const pinsLayer = DEFAULT_LAYERS.find(l => l.id === "pins");
    expect(pinsLayer).toBeDefined();
    expect(pinsLayer?.visible).toBe(true);
  });

  it("NetOverlay smoke test: synthetic doc with one NetEdge", () => {
    const doc = {
      components: [
        {
          id: "comp1",
          name: "Q1",
          kind: "transmon-cross",
          placement: { x: 0, y: 0, rotation: 0 },
          params: {}
        },
        {
          id: "comp2",
          name: "Q2",
          kind: "transmon-cross",
          placement: { x: 2, y: 2, rotation: 0 },
          params: {}
        }
      ],
      nets: [
        {
          // NetEdge.from.component references component ID (not name)
          from: { component: "comp1", pin: "north" },
          to: { component: "comp2", pin: "south" }
        }
      ],
      layers: [
        { id: "routes", visible: true }
      ]
    };

    const element = NetOverlay({
      doc,
      view: { cx: 0, cy: 0, zoom: 80 },
      zoom: 80,
      lod: 2,
      selectedId: null
    });

    expect(element).not.toBeNull();
    expect(element.type).toBe("g");
    expect(element.props.className).toBe("cad-net-overlay");
    expect(element.props.children.length).toBe(1);
    expect(element.props.children[0].type).toBe("line");
    expect(element.props.children[0].props.className).toBe("cad-net-flow");
  });

  it("NetOverlay empty nets: doc.nets = []", () => {
    const doc = {
      components: [],
      nets: [],
      layers: [
        { id: "routes", visible: true }
      ]
    };

    const element = NetOverlay({
      doc,
      view: { cx: 0, cy: 0, zoom: 80 },
      zoom: 80,
      lod: 2,
      selectedId: null
    });

    expect(element).not.toBeNull();
    expect(element.props.children.length).toBe(0);
  });

  it("NetOverlay stale-net safety: absent component id does not crash and renders no lines", () => {
    const doc = {
      components: [
        {
          id: "comp1",
          name: "Q1",
          kind: "transmon-cross",
          placement: { x: 0, y: 0, rotation: 0 },
          params: {}
        }
      ],
      nets: [
        {
          // comp1 exists but ABSENT_COMP does not — should be silently skipped
          from: { component: "comp1", pin: "north" },
          to: { component: "ABSENT_COMP", pin: "south" }
        }
      ],
      layers: [
        { id: "routes", visible: true }
      ]
    };

    // This should run without throwing any exceptions
    const element = NetOverlay({
      doc,
      view: { cx: 0, cy: 0, zoom: 80 },
      zoom: 80,
      lod: 2,
      selectedId: null
    });

    expect(element).not.toBeNull();
    expect(element.props.children.length).toBe(0);
  });
});
