import { defineStore } from "pinia";
import { ref, watch, onMounted } from "vue";
import type { ToolType, FixtureCategory } from "@/modules/StorePlanner/types/editor";
import { useEditorLayout } from "./useEditorLayout";
import { StatusBar } from "@capacitor/status-bar";
import { Capacitor } from "@capacitor/core";

const SETTINGS_KEY = "efficy_editor_settings";

export const useEditorTools = defineStore("editor-tools", () => {
  const activeTool = ref<ToolType>("select");

  const zoom = ref(1);
  const panOffset = ref({ x: 0, y: 0 });

  const isLibraryOpen = ref(false);
  const libraryCategory = ref<FixtureCategory | "all" | "my-templates" | "favorites">("all");

  const isAIScanning = ref(false);
  const isAIEnabled = ref(false);
  const isMagicScanOpen = ref(false);

  const viewMode = ref<"top" | "face">("top");
  const isViewModeOpen = ref(false);

  const isStructurePanelOpen = ref(false);
  const editorMode = ref<"design" | "survey" | "products" | "merch">("design");
  const isReadonly = ref(false);

  const isRightPropertiesPanelExpanded = ref(false);
  const showMinimap = ref(true);

  const showFloorSheet = ref(false);
  const showEditFloorSheet = ref(false);
  const showFloorTabs = ref(false);

  const isProductEditorOpen = ref(false);
  const editingFixtureId = ref<string | null>(null);
  const isProductsPanelExpanded = ref(false);
  const placingProductId = ref<string | null>(null);

  const isWallResizing = ref(false);

  const isDrawingWall = ref(false);
  const drawingStartNodeId = ref<string | null>(null);

  const presetActivity = ref<string | null>(null);

  const globalSnackbar = ref({
    show: false,
    text: "",
    color: "success",
  });
  const takeSnapshot = ref<(() => Promise<string | null>) | null>(null);

  const pendingCornerPos = ref<{
    wallId: string;
    x: number;
    y: number;
  } | null>(null);

  const snappingGuides = ref<
    { orientation: "V" | "H"; lineGuide: number; targetFixtureId?: string }[]
  >([]);

  // --- PERSISTENCE LOGIC ---
  const loadSettings = () => {
    try {
      const saved = localStorage.getItem(SETTINGS_KEY);
      if (saved) {
        const settings = JSON.parse(saved);
        if (typeof settings.isAIEnabled !== "undefined") {
          isAIEnabled.value = settings.isAIEnabled;
        }
        if (typeof settings.isAIScanning !== "undefined") {
          isAIScanning.value = settings.isAIScanning;
        }
      }
    } catch (e) {
      console.error("Failed to load editor settings", e);
    }
  };

  const saveSettings = () => {
    try {
      localStorage.setItem(
        SETTINGS_KEY,
        JSON.stringify({
          isAIEnabled: isAIEnabled.value,
          isAIScanning: isAIScanning.value,
        }),
      );
    } catch (e) {
      console.error("Failed to save editor settings", e);
    }
  };

  // Watch for changes and persist
  watch([isAIEnabled, isAIScanning], saveSettings);

  // Load on creation
  loadSettings();

  const setActiveTool = (tool: ToolType) => {
    activeTool.value = tool;
  };

  const setPendingCorner = (wallId: string, x: number, y: number) => {
    pendingCornerPos.value = { wallId, x, y };
  };

  const setLibraryCategory = (category: FixtureCategory | "all" | "my-templates" | "favorites") => {
    libraryCategory.value = category;
  };

  const clearPendingCorner = () => {
    pendingCornerPos.value = null;
  };

  const resetView = async () => {
    if (Capacitor.isNativePlatform()) await StatusBar.hide();

    const layoutStore = useEditorLayout();
    const layout = layoutStore.currentLayout;

    if (!layout) {
      zoom.value = 1;
      panOffset.value = { x: 0, y: 0 };
      return;
    }

    // 1. Calculate bounds of all actual content
    let minX = Infinity,
      minY = Infinity,
      maxX = -Infinity,
      maxY = -Infinity;

    // Check all nodes
    if (layout.nodes && layout.nodes.length > 0) {
      layout.nodes.forEach((node) => {
        minX = Math.min(minX, node.x);
        minY = Math.min(minY, node.y);
        maxX = Math.max(maxX, node.x);
        maxY = Math.max(maxY, node.y);
      });
    }

    // Check all fixtures
    // FIX: Fixtures are Top-Left anchored, not center anchored.
    if (layout.fixtures && layout.fixtures.length > 0) {
      layout.fixtures.forEach((fixture) => {
        const fx = fixture.x || 0;
        const fy = fixture.y || 0;
        const fw = fixture.width || 100;
        const fh = fixture.height || 100;

        // Rotate logic (approximate bounding box for rotation)
        // If rotated, the bounding box is larger, but for "Fit View" simple box is usually enough.
        // We will just use the unrotated box to be safe and simple, or basic rect logic.
        // Top-Left anchor:
        minX = Math.min(minX, fx);
        minY = Math.min(minY, fy);
        maxX = Math.max(maxX, fx + fw);
        maxY = Math.max(maxY, fy + fh);
      });
    }

    // Check walls (to include wall thickness)
    if (layout.walls && layout.walls.length > 0) {
      // Walls are defined by nodes, but have thickness (usually 20px).
      // We add a safety buffer to the node bounds later (padding).
    }

    // If no content found, use layout dimensions as fallback
    if (!isFinite(minX) || !isFinite(minY)) {
      const floorW = layoutStore.currentFloor?.width || layout.width || 1000;
      const floorH = layoutStore.currentFloor?.height || layout.height || 800;
      minX = 0;
      minY = 0;
      maxX = floorW;
      maxY = floorH;
    }

    // 2. Calculate content dimensions with padding
    const contentPadding = 300; // Increased padding per user request
    const contentWidth = maxX - minX + contentPadding * 2;
    const contentHeight = maxY - minY + contentPadding * 2;
    const contentCenterX = (minX + maxX) / 2;
    const contentCenterY = (minY + maxY) / 2;

    // 3. Get Screen Dimensions (Stage Dimensions)
    // The Konva Stage width is (Window - LeftToolbar).
    // We want to center within the STAGE coordinate system.
    const sidebarWidth = 64; // Left Toolbar width
    const stageW = window.innerWidth - sidebarWidth;
    const stageH = window.innerHeight;

    // 4. Calculate "Fit" Scale based on actual content
    const scaleX = stageW / contentWidth;
    const scaleY = stageH / contentHeight;

    // Choose the smaller scale to ensure it fits both width and height
    // Clamp to max 1.0 to ensure 100% view at most (user prefers not too close)
    const newZoom = Math.min(scaleX, scaleY, 1.0);

    // 5. Calculate Center Position
    // We want the contentCenter to be at the SCREEN Center (not just stage center).
    // Screen Center X relative to Canvas = (WindowWidth / 2) - CanvasLeftOffset
    // CanvasLeftOffset is approx 64px (Left Toolbar).
    const stageCenterX = window.innerWidth / 2 - 64;
    const stageCenterY = stageH / 2;

    // Pan formula: Pan + (Point * Zoom) = ScreenPoint (StagePoint)
    // Pan = StagePoint - (Point * Zoom)
    const newX = stageCenterX - contentCenterX * newZoom;
    const newY = stageCenterY - contentCenterY * newZoom;

    // 6. Apply
    zoom.value = newZoom;
    panOffset.value = { x: newX, y: newY };
  };

  const setZoom = (val: number) => {
    zoom.value = Math.max(0.1, Math.min(3, val));
  };

  const setPanOffset = (offset: { x: number; y: number }) => {
    panOffset.value = offset;
  };

  const setEditorMode = (mode: "design" | "survey" | "products" | "merch") => {
    if (isReadonly.value && mode === "design") return;
    editorMode.value = mode;
  };

  const setReadonly = (val: boolean) => {
    isReadonly.value = val;
    if (val) {
      editorMode.value = "survey"; // Force survey/view mode
      activeTool.value = "select";
      isLibraryOpen.value = false;
      isProductEditorOpen.value = false;
    }
  };

  const openLibrary = (category?: FixtureCategory | "all" | "my-templates" | "favorites") => {
    isLibraryOpen.value = true;
    if (category) libraryCategory.value = category;
  };

  const closeLibrary = () => {
    isLibraryOpen.value = false;
  };

  const setViewModeOpen = (isOpen: boolean) => {
    isViewModeOpen.value = isOpen;
    viewMode.value = isOpen ? "face" : "top";
  };

  const openProductEditor = (fixtureId: string) => {
    editingFixtureId.value = fixtureId;
    isProductEditorOpen.value = true;
  };

  const closeProductEditor = () => {
    isProductEditorOpen.value = false;
    editingFixtureId.value = null;
  };

  const setProductsPanelExpanded = (expanded: boolean) => {
    isProductsPanelExpanded.value = expanded;
  };

  const setPlacingProductId = (productId: string | null) => {
    placingProductId.value = productId;
  };

  const showSnackbar = (text: string, color = "success") => {
    globalSnackbar.value = { show: true, text, color };
  };

  const setSnappingGuides = (guides: { orientation: "V" | "H"; lineGuide: number }[]) => {
    snappingGuides.value = guides;
  };

  const toggleFloorTabs = () => {
    showFloorTabs.value = !showFloorTabs.value;
  };

  const hideFloorTabs = () => {
    showFloorTabs.value = false;
  };

  const clearSnappingGuides = () => {
    snappingGuides.value = [];
  };

  const setWallResizing = (val: boolean) => {
    isWallResizing.value = val;
  };

  const startDrawingWall = (startNodeId: string) => {
    isDrawingWall.value = true;
    drawingStartNodeId.value = startNodeId;
  };

  const cancelDrawingWall = () => {
    isDrawingWall.value = false;
    drawingStartNodeId.value = null;
  };

  return {
    activeTool,
    zoom,
    panOffset,
    isLibraryOpen,
    libraryCategory,
    isAIScanning,
    isAIEnabled,
    isMagicScanOpen,
    viewMode,
    isViewModeOpen,
    isStructurePanelOpen,
    editorMode,
    isReadonly,
    isRightPropertiesPanelExpanded,
    showMinimap,
    showFloorSheet,
    showEditFloorSheet,
    showFloorTabs,
    isProductEditorOpen,
    editingFixtureId,
    isProductsPanelExpanded,
    placingProductId,
    pendingCornerPos,
    snappingGuides,
    presetActivity,
    globalSnackbar,
    isWallResizing,
    isDrawingWall,
    drawingStartNodeId,

    setActiveTool,
    setPendingCorner,
    setLibraryCategory,
    setSnappingGuides,
    clearSnappingGuides,
    clearPendingCorner,
    setZoom,
    setPanOffset,
    setEditorMode,
    setReadonly,
    resetView,
    openLibrary,
    closeLibrary,
    setViewModeOpen,
    openProductEditor,
    closeProductEditor,
    setProductsPanelExpanded,
    setPlacingProductId,
    showSnackbar,
    takeSnapshot,
    toggleFloorTabs,
    hideFloorTabs,
    setWallResizing,
    startDrawingWall,
    cancelDrawingWall,
  };
});
