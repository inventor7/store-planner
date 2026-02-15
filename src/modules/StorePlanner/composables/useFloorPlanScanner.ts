import { ref } from "vue";
import { useSurveyCamera } from "./useSurveyCamera";
import { useEditorLayout } from "@/modules/StorePlanner/stores/useEditorLayout";
import { useEditorTools } from "@/modules/StorePlanner/stores/useEditorTools";
import { fixtureTemplates } from "@/modules/StorePlanner/data/fixtureTemplates";
import { useI18n } from "vue-i18n";

export function useFloorPlanScanner() {
  const { t } = useI18n();
  const isScanning = ref(false);
  const error = ref<string | null>(null);
  const { takePhoto } = useSurveyCamera();
  const editorLayoutStore = useEditorLayout();
  const editorToolsStore = useEditorTools();

  const handleScan = async () => {
    // 1. Immediate UI Feedback
    isScanning.value = true;
    editorToolsStore.isAIScanning = true;
    error.value = null;

    try {
      // 2. Capture/Select Image
      const photo = await takePhoto();
      if (!photo || !photo.webPath) {
        editorToolsStore.isAIScanning = false;
        isScanning.value = false;
        return; // User cancelled
      }

      // Convert webPath (blob URL) to Blob
      const response = await fetch(photo.webPath);
      const blob = await response.blob();

      // 3. Call AI Service
      // const { floorPlanAIService } = await import("@/modules/StorePlanner/services/FloorPlanAIService");
      // const layoutData = await floorPlanAIService.convertSketchToLayout(blob);

      // 4. Post-Process & Apply
      // if (layoutData) {
      //   const straightenedData = straightenLayout(layoutData);
      //   applyGeneratedLayout(straightenedData);
      // }

      console.log("Floor plan scan would be processed here");
    } catch (e: any) {
      console.error("Scan failed", e);
      const msg = t("storePlanner.editor.magicScan.scanFailed");
      error.value = msg;
      editorToolsStore.showSnackbar(msg, "error");
      editorToolsStore.isAIScanning = false;
    } finally {
      isScanning.value = false;
      setTimeout(() => {
        editorToolsStore.isAIScanning = false;
      }, 1500); // Allow animation to finish "Finalizing" phase
    }
  };

  /**
   * Enforces strict 90-degree angles for lines within a 30-degree threshold.
   */
  const straightenLayout = (data: any) => {
    const nodes = JSON.parse(JSON.stringify(data.nodes));
    const walls = JSON.parse(JSON.stringify(data.walls));
    const output = { ...data, nodes, walls };

    const TOLERANCE = 30;

    walls.forEach((wall: any) => {
      const startNode = nodes.find((n: any) => n.id === wall.startNodeId);
      const endNode = nodes.find((n: any) => n.id === wall.endNodeId);

      if (!startNode || !endNode) return;

      const dx = endNode.x - startNode.x;
      const dy = endNode.y - startNode.y;
      const angleRad = Math.atan2(dy, dx);
      let angleDeg = angleRad * (180 / Math.PI);

      if (angleDeg < 0) angleDeg += 360;

      const isHorizontal =
        Math.abs(angleDeg) <= TOLERANCE ||
        Math.abs(angleDeg - 180) <= TOLERANCE ||
        Math.abs(angleDeg - 360) <= TOLERANCE;

      const isVertical =
        Math.abs(angleDeg - 90) <= TOLERANCE || Math.abs(angleDeg - 270) <= TOLERANCE;

      if (isHorizontal) {
        const avgY = (startNode.y + endNode.y) / 2;
        startNode.y = avgY;
        endNode.y = avgY;
      } else if (isVertical) {
        const avgX = (startNode.x + endNode.x) / 2;
        startNode.x = avgX;
        endNode.x = avgX;
      }
    });

    return output;
  };

  const applyGeneratedLayout = (data: any) => {
    if (!editorLayoutStore.currentLayout) {
      editorLayoutStore.createNewLayout(
        t("storePlanner.editor.magicScan.scannedLayoutName"),
        data.width || 800,
        data.height || 600,
      );
    }

    const layout = editorLayoutStore.currentLayout;
    if (!layout) return;

    if (data.width) layout.width = data.width;
    if (data.height) layout.height = data.height;

    layout.nodes = [];
    layout.walls = [];
    layout.fixtures = [];

    data.nodes.forEach((n: any) => {
      layout.nodes.push({
        id: n.id || Math.random().toString(36).substr(2, 9),
        x: n.x,
        y: n.y,
      });
    });

    data.walls.forEach((w: any) => {
      layout.walls.push({
        id: Math.random().toString(36).substr(2, 9),
        startNodeId: w.startNodeId,
        endNodeId: w.endNodeId,
        thickness: w.thickness || 15,
        type: w.type || "wall",
      });
    });

    data.fixtures.forEach((f: any) => {
      let templateId = "shelf-gondola-medium";

      const aiType = f.type?.toLowerCase();
      const aiLabel = f.label?.toLowerCase() || "";
      const aiCat = f.category?.toLowerCase() || "";

      if (
        aiType === "fridge" ||
        aiCat.includes("fridge") ||
        aiLabel.includes("cooler") ||
        aiLabel.startsWith("f")
      ) {
        if (aiLabel.includes("f3") || aiLabel.includes("3 door") || f.width > 160) {
          templateId = "fridge-upright-large";
        } else if (aiLabel.includes("f1") || aiLabel.includes("1 door") || f.width < 100) {
          templateId = "fridge-upright-small";
        } else {
          templateId = "fridge-upright-medium";
        }
      } else if (
        aiType === "zone" ||
        aiLabel === "z" ||
        aiLabel.includes("promo") ||
        aiLabel.includes("zone")
      ) {
        templateId = "zone-promotional";
      } else if (aiType === "counter" || aiLabel.includes("checkout")) {
        templateId = "checkout-standard";
      } else if (aiType === "shelf" || aiCat.includes("shelf")) {
        templateId = "shelf-gondola-medium";
      } else if (aiType === "table") {
        templateId = "table-display";
      }

      const exists = fixtureTemplates.some((t) => t.id === templateId);
      if (!exists) {
        templateId = "shelf-gondola-medium";
      }

      let contents = undefined;
      if (f.shelfLevels && templateId.includes("shelf")) {
        contents = {
          levels: Array.from({ length: f.shelfLevels }, () => ({
            id: Math.random().toString(36).substr(2, 9),
            height: 40,
            slots: [],
          })),
        };
      }

      layout.fixtures.push({
        id: Math.random().toString(36).substr(2, 9),
        templateId: templateId,
        x: f.x,
        y: f.y,
        rotation: f.rotation || 0,
        width: f.width || 120,
        height: f.height || 60,
        height3D: 180,
        surveyData: f.label
          ? {
              notes: `Label: ${f.label}`,
              stockLevel: "high",
              lastChecked: new Date().toISOString(),
            }
          : undefined,
        contents: contents,
      });
    });

    editorLayoutStore.saveCurrentLayout();
  };

  return {
    isScanning,
    error,
    handleScan,
  };
}
