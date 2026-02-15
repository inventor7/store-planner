export type FixtureCategory =
  | "shelves"
  | "fridges"
  | "checkout"
  | "structures"
  | "furniture"
  | "zones"
  | "my-templates"
  | "floors"
  | "areas";

export type StructureType = "wall" | "door" | "window";

export interface Product {
  id: string;
  name: string;
  sku: string;
  price: number;
  color: string;
  width: number;
  height: number;
  category: string;
}

export interface ShelfSlot {
  id: string;
  productId: string | null; // null = empty space
  facings: number; // how many product units side by side
  depth?: number; // how many units deep
  quantity?: number; // manual override or calculated
  fences?: number; // number of front fences
  customPrice?: number; // Override product price
  priceLabel: boolean;
}

export interface ShelfLevel {
  id: string;
  slots: ShelfSlot[];
  height: number; // cm from bottom
}

export interface FixtureContents {
  levels: ShelfLevel[];
}

export interface FixtureTemplate {
  id: string;
  name: string;
  category: FixtureCategory;
  width: number; // in cm
  height: number; // in cm (depth for top view)
  color: string;
  depth?: number;
  shelves?: number;
  doors?: number;
  totalHeight?: number; // 3D height in cm
  description?: string;
  label?: string; // Custom title/label for the schema
  icon?: string; // Icon identifier
  temperature?: number; // Only for fridges
  defaultContents?: FixtureContents;
  images?: string[];
  imageUrl?: string; // Primary image URL for image-based fixtures (2D rendering)
  // For floors
  floorType?: string;
  // For wall-attached fixtures (doors, windows)
  isWallAttached?: boolean;
}

export interface PlacedFixture {
  id: string;
  templateId: string;
  x: number;
  y: number;
  rotation: number; // 0, 90, 180, 270
  width: number;
  height: number;
  height3D: number;
  customColor?: string;
  collectionId?: string;
  label?: string;
  description?: string;
  icon?: string;
  temperature?: number; // Saved temperature setting
  contents?: FixtureContents;
  locked?: boolean;
  surveyPhotos?: {
    id: string;
    url: string;
    timestamp: string;
  }[];
  surveyData?: {
    stockLevel?: "high" | "medium" | "low" | "out_of_stock";
    notes?: string;
    lastChecked?: string;
  };
  usageType?: string; // e.g. "Food", "Electronics"
}

// Wall node for node-based building
export interface WallNode {
  id: string;
  x: number;
  y: number;
}

export interface WallSegment {
  id: string;
  startNodeId: string;
  endNodeId: string;
  thickness: number;
  type: StructureType;
  doorSwing?: "left" | "right" | "sliding";
  doorType?: "entrance" | "exit" | "standard";
  flipped?: boolean;
  locked?: boolean;
  width?: number; // for doors/windows
  height?: number; // for doors/windows/walls
}

export interface FloorArea {
  id: string;
  name: string;
  nodeIds: string[]; // Ordered IDs of nodes forming the polygon
  floorTypeId: string; // References floorTypes data
  visible: boolean;
  lockedSize: boolean;
  lockedDimension: boolean;
  rotation?: number; // Rotation angle in degrees (default 0)
}

export interface StoreFloor {
  id: string;
  name: string;
  level: number;
  floorType?: string; // Default floor type for the whole level
  width?: number;
  height?: number;
  nodes: WallNode[];
  walls: WallSegment[];
  fixtures: PlacedFixture[];
  areas: FloorArea[]; // Detected rooms/areas
}

export type SurveyStatus = "pending" | "partial" | "complete";

export interface Placement {
  id: string;
  fixtureId: string;
  surveys: {
    surveyId: string;
    name: string;
    status: SurveyStatus;
    isConfigured?: boolean;
  }[];
}

export interface StoreLayout {
  id: string;
  partnerId?: string;
  name: string;
  width: number;
  height: number;
  nodes: WallNode[];
  walls: WallSegment[];
  fixtures: PlacedFixture[];
  areas: FloorArea[];
  floors: StoreFloor[];
  placements: Placement[];
  currentFloorId: string;
  floorType?: string;
  createdAt: string;
  updatedAt: string;
}

export type ToolType =
  | "select"
  | "move"
  | "rotate"
  | "duplicate"
  | "delete"
  | "drawWall"
  | "drawWindow"
  | "drawDoor"
  | "corner";

export interface EditorState {
  currentLayout: StoreLayout | null;
  selectedFixtureId: string | null;
  selectedWallId: string | null;
  selectedNodeId: string | null;
  activeTool: ToolType;
  zoom: number;
  panOffset: { x: number; y: number };
  isLibraryOpen: boolean;
  libraryCategory: FixtureCategory | "all" | "my-templates" | "favorites";
  savedLayouts: StoreLayout[];
  isProductEditorOpen: boolean;
  editingFixtureId: string | null;
  isDrawingWall: boolean;
  drawingStartNodeId: string | null;
  viewMode: "top" | "face";
  isViewModeOpen: boolean;
  editorMode: "design" | "survey" | "products" | "merch";
  selectedShelfLevelId: string | null;
  placingProductId: string | null;
  isProductsPanelExpanded: boolean;
}
