import type { FixtureTemplate } from "@/modules/StorePlanner/types/editor";

export interface FixtureVisualConfig {
  mainRect: {
    width: number;
    height: number;
    fill: string;
    stroke: string;
    strokeWidth: number;
    cornerRadius: number | number[];
  };
  details: Array<{
    type: "Line" | "Rect" | "Circle" | "Arc" | "Path";
    config: Record<string, unknown>;
  }>;
}

/**
 * Generates Konva shape configurations for different fixture types.
 * CRITICAL: Uses template's ORIGINAL dimensions to determine structure,
 * then scales positions to actual width/height to maintain consistent appearance.
 */
export function getFixtureVisuals(
  template: FixtureTemplate,
  width: number,
  height: number,
  customColor?: string,
): FixtureVisualConfig {
  const strokeColor = "#334155";
  const strokeWidth = 1;
  const color = customColor || template.color || "#e2e8f0";

  // IMPORTANT: Use template dimensions for structural decisions
  const templateWidth = template.width;
  const templateHeight = template.height;

  // Base config
  const config: FixtureVisualConfig = {
    mainRect: {
      width,
      height,
      fill: color,
      stroke: strokeColor,
      strokeWidth,
      cornerRadius: 2,
    },
    details: [],
  };

  switch (template.category) {
    case "shelves":
      addShelfDetails(
        config,
        width,
        height,
        templateWidth,
        templateHeight,
        strokeColor,
      );
      break;

    case "fridges":
      addFridgeDetails(
        config,
        width,
        height,
        templateWidth,
        templateHeight,
        customColor,
        template,
      );
      break;

    case "checkout":
      addCheckoutDetails(
        config,
        width,
        height,
        templateWidth,
        templateHeight,
        customColor,
      );
      break;

    case "furniture":
      addFurnitureDetails(config, width, height, template.id);
      break;

    case "zones":
      addZoneDetails(config, width, height, color);
      break;

    case "structures":
      addStructureDetails(config, width, height, template.id);
      break;
  }

  return config;
}

function addShelfDetails(
  config: FixtureVisualConfig,
  width: number,
  height: number,
  templateWidth: number,
  templateHeight: number,
  strokeColor: string,
) {
  config.mainRect.stroke = "#3D3D3D";

  // FIXED: Use template height to determine shelf count
  const shelfCount = Math.max(2, Math.floor(templateHeight / 20));
  const step = height / shelfCount; // Scale to actual height

  for (let i = 1; i < shelfCount; i++) {
    config.details.push({
      type: "Line",
      config: {
        points: [4, i * step, width - 4, i * step],
        stroke: "#4A4A4A",
        strokeWidth: 0.5,
        dash: [4, 2],
        listening: false,
        perfectDrawEnabled: false,
      },
    });
  }

  // Spine line
  config.details.push({
    type: "Line",
    config: {
      points: [width / 2, 4, width / 2, height - 4],
      stroke: "#5A5A5A",
      strokeWidth: 0.8,
      listening: false,
      perfectDrawEnabled: false,
    },
  });
}

function addFridgeDetails(
  config: FixtureVisualConfig,
  width: number,
  height: number,
  templateWidth: number,
  templateHeight: number,
  customColor?: string,
  template?: FixtureTemplate,
) {
  config.mainRect.fill = customColor || template?.color || "#e0f2fe";
  config.mainRect.stroke = "#5A7A8A";
  config.mainRect.cornerRadius = 3;

  // Inner frame
  config.details.push({
    type: "Rect",
    config: {
      x: 4,
      y: 4,
      width: width - 8,
      height: height - 8,
      stroke: "#7AAFCF",
      strokeWidth: 0.5,
      cornerRadius: 2,
      listening: false,
      perfectDrawEnabled: false,
    },
  });

  // CRITICAL FIX: Use template.doors OR templateWidth to determine door count
  // This ensures the number of doors is FIXED regardless of resize
  let doorCount: number;

  if (template?.doors) {
    // Use explicit door count from template
    doorCount = template.doors;
  } else {
    // Fallback: determine from TEMPLATE width, not actual width
    doorCount = Math.max(1, Math.floor(templateWidth / 40));
  }

  const doorWidth = width / doorCount; // Scale door positions to actual width

  for (let i = 0; i < doorCount; i++) {
    // Separator lines (skip first)
    if (i > 0) {
      config.details.push({
        type: "Line",
        config: {
          points: [i * doorWidth, 6, i * doorWidth, height - 6],
          stroke: "#5A7A8A",
          strokeWidth: 0.8,
          listening: false,
          perfectDrawEnabled: false,
        },
      });
    }

    // Handles - positioned proportionally
    const handleX = (i + 0.9) * doorWidth - 12;
    config.details.push({
      type: "Rect",
      config: {
        x: handleX,
        y: height / 2 - 8,
        width: 6,
        height: 16,
        fill: "#4A6A7A",
        cornerRadius: 1,
        listening: false,
        perfectDrawEnabled: false,
      },
    });
  }
}

function addCheckoutDetails(
  config: FixtureVisualConfig,
  width: number,
  height: number,
  templateWidth: number,
  templateHeight: number,
  customColor?: string,
) {
  config.mainRect.fill = customColor || "#e2e8f0";
  config.mainRect.stroke = "#3A3A3A";

  // Conveyor belt area
  config.details.push({
    type: "Rect",
    config: {
      x: 8,
      y: height * 0.2,
      width: width - 40,
      height: height * 0.4,
      fill: "#2A2A2A",
      stroke: "#4A4A4A",
      strokeWidth: 0.5,
      cornerRadius: 1,
      listening: false,
      perfectDrawEnabled: false,
    },
  });

  // FIXED: Use template width for line count
  const checkLines = Math.max(3, Math.floor(templateWidth / 30));
  const lineSpacing = (width - 40) / (checkLines - 1);

  for (let i = 0; i < checkLines; i++) {
    config.details.push({
      type: "Line",
      config: {
        points: [
          20 + i * lineSpacing,
          height * 0.25,
          20 + i * lineSpacing,
          height * 0.55,
        ],
        stroke: "#5A5A5A",
        strokeWidth: 0.3,
        listening: false,
        perfectDrawEnabled: false,
      },
    });
  }

  // Register area (scales with actual size)
  config.details.push({
    type: "Rect",
    config: {
      x: width - 30,
      y: height * 0.15,
      width: 22,
      height: height * 0.5,
      fill: "#4A4A4A",
      cornerRadius: 2,
      listening: false,
      perfectDrawEnabled: false,
    },
  });

  // Screen/POS
  config.details.push({
    type: "Rect",
    config: {
      x: width - 26,
      y: height * 0.2,
      width: 14,
      height: height * 0.25,
      fill: "#1A1A3A",
      cornerRadius: 1,
      listening: false,
      perfectDrawEnabled: false,
    },
  });
}

function addFurnitureDetails(
  config: FixtureVisualConfig,
  width: number,
  height: number,
  id: string,
) {
  config.mainRect.stroke = "#3A3A3A";

  if (id.includes("rack")) {
    config.mainRect.cornerRadius = height / 2;

    config.details.push({
      type: "Circle",
      config: {
        x: width / 2,
        y: height / 2,
        radius: Math.min(width, height) / 4,
        stroke: "#2A2A2A",
        strokeWidth: 1,
        fill: "transparent",
        listening: false,
        perfectDrawEnabled: false,
      },
    });
  } else {
    config.mainRect.cornerRadius = 3;

    // Fixed 4 legs (not dependent on size)
    const legRadius = 2;
    const legs = [
      { x: 6, y: 6 },
      { x: width - 6, y: 6 },
      { x: 6, y: height - 6 },
      { x: width - 6, y: height - 6 },
    ];

    legs.forEach((leg) => {
      config.details.push({
        type: "Circle",
        config: {
          x: leg.x,
          y: leg.y,
          radius: legRadius,
          fill: "#2A2A2A",
          listening: false,
          perfectDrawEnabled: false,
        },
      });
    });
  }
}

function addZoneDetails(
  config: FixtureVisualConfig,
  width: number,
  height: number,
  color: string,
) {
  config.mainRect.fill = color;
  config.mainRect.stroke = "#64748b";
  config.mainRect.strokeWidth = 2;

  config.details.push({
    type: "Rect",
    config: {
      x: 5,
      y: 5,
      width: width - 10,
      height: height - 10,
      stroke: "#94a3b8",
      strokeWidth: 1,
      dash: [5, 5],
      fill: "transparent",
      listening: false,
      perfectDrawEnabled: false,
    },
  });
}

function addStructureDetails(
  config: FixtureVisualConfig,
  width: number,
  height: number,
  id: string,
) {
  if (id.includes("window")) {
    config.mainRect.fill = "#A8D4E6";
    config.mainRect.stroke = "#6A6A6A";

    config.details.push({
      type: "Line",
      config: {
        points: [width / 2, 2, width / 2, height - 2],
        stroke: "#6A6A6A",
        strokeWidth: 0.5,
        listening: false,
        perfectDrawEnabled: false,
      },
    });

    config.details.push({
      type: "Rect",
      config: {
        x: width * 0.1,
        y: height * 0.2,
        width: width * 0.3,
        height: height * 0.3,
        fill: "rgba(255,255,255,0.4)",
        cornerRadius: 1,
        listening: false,
        perfectDrawEnabled: false,
      },
    });
  } else {
    config.mainRect.stroke = "#2A2A2A";

    config.details.push({
      type: "Path",
      config: {
        data: `M ${width * 0.1} ${height * 0.5} A ${width * 0.4} ${width * 0.4} 0 0 1 ${width * 0.5} ${height * 0.1}`,
        stroke: "#6A6A6A",
        strokeWidth: 0.5,
        dash: [3, 2],
        listening: false,
        perfectDrawEnabled: false,
      },
    });

    config.details.push({
      type: "Rect",
      config: {
        x: width * 0.15,
        y: height * 0.3,
        width: width * 0.7,
        height: height * 0.4,
        fill: "#5A5A5A",
        cornerRadius: 1,
        listening: false,
        perfectDrawEnabled: false,
      },
    });
  }
}
