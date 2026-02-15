import type Konva from "konva";
// Auto-imported: useEditorTools

const GUIDELINE_OFFSET = 30; // Reduced distance for tighter snapping
const SNAP_THROTTLE_MS = 20;

export function useKonvaSnapping() {
  const toolsStore = useEditorTools();

  let lastSnapTime = 0;
  let rafId: number | null = null;

  /**
   * Returns possible snap lines in WORLD COORDINATES (relative to Layer)
   */
  // State for pre-calculated guides to improve performance
  let cachedGuideStops = {
    vertical: [] as number[],
    horizontal: [] as number[],
  };

  /**
   * Returns possible snap lines in WORLD COORDINATES (relative to Layer)
   */
  const getLineGuideStops = (node: Konva.Node) => {
    // We strictly use the Layer as the coordinate system origin
    const layer = node.getLayer();
    if (!layer) return { vertical: [], horizontal: [] };

    // Standard Grid stops (Origin)
    const vertical = [0];
    const horizontal = [0];

    // Find all other objects in the layer
    layer.find(".object").forEach((guideItem) => {
      // Skip the object currently being dragged
      if (guideItem === node) return;

      // Skip invisible items
      if (!guideItem.isVisible()) return;

      // CRITICAL FIX: Get bounding box relative to the LAYER, not the stage/screen
      const box = guideItem.getClientRect({ relativeTo: layer });

      vertical.push(box.x, box.x + box.width, box.x + box.width / 2);
      horizontal.push(box.y, box.y + box.height, box.y + box.height / 2);
    });

    return {
      vertical,
      horizontal,
    };
  };

  /**
   * Returns the edges of the dragging node in WORLD COORDINATES
   */
  const getObjectSnappingEdges = (node: Konva.Node) => {
    const layer = node.getLayer();
    if (!layer) return null;

    // CRITICAL FIX: Get bounding box relative to the LAYER
    const box = node.getClientRect({ relativeTo: layer });

    // CRITICAL FIX: Use local position (relative to parent layer), not absolute
    const pos = node.position();

    return {
      vertical: [
        {
          guide: Math.round(box.x),
          offset: Math.round(pos.x - box.x),
          snap: "start",
        },
        {
          guide: Math.round(box.x + box.width / 2),
          offset: Math.round(pos.x - box.x - box.width / 2),
          snap: "center",
        },
        {
          guide: Math.round(box.x + box.width),
          offset: Math.round(pos.x - box.x - box.width),
          snap: "end",
        },
      ],
      horizontal: [
        {
          guide: Math.round(box.y),
          offset: Math.round(pos.y - box.y),
          snap: "start",
        },
        {
          guide: Math.round(box.y + box.height / 2),
          offset: Math.round(pos.y - box.y - box.height / 2),
          snap: "center",
        },
        {
          guide: Math.round(box.y + box.height),
          offset: Math.round(pos.y - box.y - box.height),
          snap: "end",
        },
      ],
    };
  };

  /**
   * Logic to find the closest guide
   */
  const getGuides = (
    lineGuideStops: { vertical: number[]; horizontal: number[] },
    itemBounds: {
      vertical: { guide: number; offset: number; snap: string }[];
      horizontal: { guide: number; offset: number; snap: string }[];
    },
    scale: number,
  ) => {
    const resultV: any[] = [];
    const resultH: any[] = [];

    // Adjust threshold based on zoom level so snapping feels consistent
    const threshold = GUIDELINE_OFFSET / scale;

    lineGuideStops.vertical.forEach((lineGuide) => {
      itemBounds.vertical.forEach((itemBound) => {
        const diff = Math.abs(lineGuide - itemBound.guide);
        if (diff < threshold) {
          resultV.push({
            lineGuide,
            diff,
            snap: itemBound.snap,
            offset: itemBound.offset,
          });
        }
      });
    });

    lineGuideStops.horizontal.forEach((lineGuide) => {
      itemBounds.horizontal.forEach((itemBound) => {
        const diff = Math.abs(lineGuide - itemBound.guide);
        if (diff < threshold) {
          resultH.push({
            lineGuide,
            diff,
            snap: itemBound.snap,
            offset: itemBound.offset,
          });
        }
      });
    });

    const guides: any[] = [];

    const minV = resultV.sort((a, b) => a.diff - b.diff)[0];
    const minH = resultH.sort((a, b) => a.diff - b.diff)[0];

    if (minV) {
      guides.push({
        lineGuide: minV.lineGuide,
        offset: minV.offset,
        orientation: "V",
        snap: minV.snap,
      });
    }
    if (minH) {
      guides.push({
        lineGuide: minH.lineGuide,
        offset: minH.offset,
        orientation: "H",
        snap: minH.snap,
      });
    }
    return guides;
  };

  /**
   * Main Handler
   */
  const handleDragMoveSnap = (e: any) => {
    const now = performance.now();
    if (now - lastSnapTime < SNAP_THROTTLE_MS) return;
    lastSnapTime = now;

    const node = e.target;
    const stage = node.getStage();
    if (!stage) return;

    if (rafId) cancelAnimationFrame(rafId);

    rafId = requestAnimationFrame(() => {
      // Use CACHED stops instead of calculating on every frame
      const lineGuideStops = cachedGuideStops;
      const itemBounds = getObjectSnappingEdges(node);

      if (!itemBounds) return;

      const guides = getGuides(lineGuideStops, itemBounds, stage.scaleX());

      if (!guides.length) {
        toolsStore.clearSnappingGuides();
        return;
      }

      toolsStore.setSnappingGuides(
        guides.map((g) => ({
          orientation: g.orientation,
          lineGuide: g.lineGuide,
        })),
      );

      rafId = null;
    });
  };

  const prepareDragSnapping = (stage: Konva.Stage, node: Konva.Node) => {
    // Optimization: Calculate all possible snap stops ONCE when drag starts
    // This avoids querying the DOM/Konva tree on every mouse move
    cachedGuideStops = getLineGuideStops(node);
  };

  const clearGuides = () => {
    if (rafId) {
      cancelAnimationFrame(rafId);
      rafId = null;
    }
    toolsStore.clearSnappingGuides();
    // Clear cache to free memory
    cachedGuideStops = { vertical: [], horizontal: [] };
  };

  return {
    handleDragMoveSnap,
    prepareDragSnapping,
    clearGuides,
  };
}
