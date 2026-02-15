import { defineStore } from "pinia";
import { useEditorLayout } from "./useEditorLayout";
import { useEditorSelection } from "./useEditorSelection";
import { useEditorTools } from "./useEditorTools";
import { generateId, createDefaultContents } from "@/modules/StorePlanner/utils/editorUtils";
import { getTemplateById as getStaticTemplateById } from "@/modules/StorePlanner/data/fixtureTemplates";
import type { FixtureTemplate, PlacedFixture } from "@/modules/StorePlanner/types/editor";

export const useEditorFixtures = defineStore("editor-fixtures", () => {
  const layoutStore = useEditorLayout();
  const selectionStore = useEditorSelection();
  const toolsStore = useEditorTools();

  const getTemplate = (id: string): FixtureTemplate | undefined => {
    return getStaticTemplateById(id) || layoutStore.customTemplates.find((t) => t.id === id);
  };

  // Removed canPlaceProduct as it moved to useEditorProducts

  const addFixture = (templateId: string, x: number, y: number, wallId?: string) => {
    if (!layoutStore.currentLayout) return;

    const template = getTemplate(templateId);
    if (!template) {
      console.warn(`Template not found: ${templateId}`);
      return;
    }

    // For wall-attached fixtures (doors, windows), find the nearest wall to snap to
    let finalX = x;
    let finalY = y;
    let finalWidth = template.width;
    let finalHeight = template.height;
    let finalRotation = 0; // Default rotation

    if (template.isWallAttached) {
      // If a specific wall ID is provided, use that wall; otherwise find the nearest
      let nearestWall;
      if (wallId) {
        const wall = layoutStore.currentLayout.walls.find((w) => w.id === wallId);
        if (wall) {
          const startNode = layoutStore.currentLayout.nodes.find((n) => n.id === wall.startNodeId);
          const endNode = layoutStore.currentLayout.nodes.find((n) => n.id === wall.endNodeId);

          if (startNode && endNode) {
            nearestWall = {
              id: wall.id,
              centerX: (startNode.x + endNode.x) / 2,
              centerY: (startNode.y + endNode.y) / 2,
              thickness: wall.thickness,
              angle: (Math.atan2(endNode.y - startNode.y, endNode.x - startNode.x) * 180) / Math.PI,
              startNode,
              endNode,
            };
          }
        }
      } else {
        // Find the nearest wall to snap to
        nearestWall = findNearestWall(x, y, template.width, template.height);
      }

      if (nearestWall) {
        // Align the fixture with the wall
        const wallAngle = nearestWall.angle || 0;
        const wallThickness = nearestWall.thickness || 20;

        // For wall-attached fixtures, the depth should match the wall thickness
        finalWidth = template.width; // Width remains as specified
        finalHeight = wallThickness; // Depth matches wall thickness
        finalRotation = wallAngle; // Match the wall's rotation

        // Position the fixture at the wall's centerline
        finalX = nearestWall.centerX;
        finalY = nearestWall.centerY;
      }
    }

    const fixture: PlacedFixture = {
      id: generateId(),
      templateId,
      x: finalX,
      y: finalY,
      rotation: finalRotation,
      width: finalWidth,
      height: finalHeight,
      height3D: template.totalHeight || 200,
      temperature: template.temperature,
      contents: template.defaultContents
        ? JSON.parse(JSON.stringify(template.defaultContents))
        : template.category === "shelves" || template.category === "fridges"
          ? createDefaultContents(template.shelves || 4)
          : undefined,
    };

    if (layoutStore.currentLayout) {
      layoutStore.currentLayout.fixtures.push(fixture);
      layoutStore.commit();
      selectionStore.selectFixture(fixture.id);
      toolsStore.closeLibrary();
    }
  };

  // Helper function to find the nearest wall to snap to
  const findNearestWall = (x: number, y: number, width: number, height: number) => {
    if (!layoutStore.currentLayout) return null;

    const MAX_SNAP_DISTANCE = 50; // Maximum distance to snap to a wall

    let nearestWall = null;
    let minDistance = Infinity;

    for (const wall of layoutStore.currentLayout.walls) {
      // Get the wall's start and end nodes
      const startNode = layoutStore.currentLayout.nodes.find((n) => n.id === wall.startNodeId);
      const endNode = layoutStore.currentLayout.nodes.find((n) => n.id === wall.endNodeId);

      if (!startNode || !endNode) continue;

      // Calculate the wall's center point
      const centerX = (startNode.x + endNode.x) / 2;
      const centerY = (startNode.y + endNode.y) / 2;

      // Calculate distance to the wall's center
      const distance = Math.sqrt(Math.pow(centerX - x, 2) + Math.pow(centerY - y, 2));

      // Check if this wall is closer than the current nearest
      if (distance < minDistance && distance < MAX_SNAP_DISTANCE) {
        // Calculate the wall's angle
        const angle =
          (Math.atan2(endNode.y - startNode.y, endNode.x - startNode.x) * 180) / Math.PI;

        minDistance = distance;
        nearestWall = {
          id: wall.id,
          centerX,
          centerY,
          thickness: wall.thickness,
          angle,
          startNode,
          endNode,
        };
      }
    }

    return nearestWall;
  };

  const updateFixture = async (
    id: string,
    updates: Partial<PlacedFixture>,
    shouldCommit = true,
  ) => {
    if (!layoutStore.currentLayout) return;
    const fixture = layoutStore.currentLayout.fixtures.find((f) => f.id === id);
    if (fixture) {
      Object.assign(fixture, updates);
      if (shouldCommit) {
        layoutStore.commit();
        // PERFORMANCE: Auto-save handled by exit/background
      }
    }
  };

  const deleteFixture = async (id: string) => {
    if (!layoutStore.currentLayout) return;
    layoutStore.currentLayout.fixtures = layoutStore.currentLayout.fixtures.filter(
      (f) => f.id !== id,
    );

    if (layoutStore.currentLayout.placements) {
      layoutStore.currentLayout.placements = layoutStore.currentLayout.placements.filter(
        (p) => p.fixtureId !== id,
      );
    }

    layoutStore.commit();
    if (selectionStore.selectedFixtureId === id) {
      selectionStore.selectFixture(null);
    }
    // PERFORMANCE: Auto-save handled by exit/background
  };

  const duplicateFixture = async (id: string) => {
    if (!layoutStore.currentLayout) return;

    const fixture = layoutStore.currentLayout.fixtures.find((f) => f.id === id);
    if (!fixture) return;

    const newFixture: PlacedFixture = {
      ...fixture,
      id: generateId(),
      x: fixture.x + 20,
      y: fixture.y + 20,
    };

    layoutStore.currentLayout.fixtures.push(newFixture);
    layoutStore.commit();
    selectionStore.selectFixture(newFixture.id);
    // PERFORMANCE: Auto-save handled by exit/background
  };

  const rotateFixture = async (id: string, delta?: number) => {
    if (!layoutStore.currentLayout) return;
    const fixture = layoutStore.currentLayout.fixtures.find((f) => f.id === id);
    if (fixture) {
      if (delta !== undefined) {
        fixture.rotation = (fixture.rotation + delta) % 360;
        if (fixture.rotation < 0) fixture.rotation += 360;
      } else {
        const newRotation = (fixture.rotation + 90) % 360;
        fixture.rotation = newRotation;
        const temp = fixture.width;
        fixture.width = fixture.height;
        fixture.height = temp;
      }
      layoutStore.commit();
    }
  };

  // Removed product actions as they moved to useEditorProducts

  const toggleFavorite = (templateId: string) => {
    const index = layoutStore.favoriteTemplateIds.indexOf(templateId);
    if (index === -1) {
      layoutStore.favoriteTemplateIds.push(templateId);
    } else {
      layoutStore.favoriteTemplateIds.splice(index, 1);
    }
  };

  // Removed shelf slot actions as they moved to useEditorProducts

  const addSurveyPhoto = (
    fixtureId: string,
    photo: { id: string; url: string; timestamp: string },
  ) => {
    if (!layoutStore.currentLayout) return;
    const fixture = layoutStore.currentLayout.fixtures.find((f) => f.id === fixtureId);
    if (fixture) {
      if (!fixture.surveyPhotos) fixture.surveyPhotos = [];
      fixture.surveyPhotos.push(photo);
      layoutStore.commit();
    }
  };

  const updateFixtureSurveyData = async (
    fixtureId: string,
    data: Partial<NonNullable<PlacedFixture["surveyData"]>>,
  ) => {
    if (!layoutStore.currentLayout) return;
    const fixture = layoutStore.currentLayout.fixtures.find((f) => f.id === fixtureId);
    if (fixture) {
      if (!fixture.surveyData) {
        fixture.surveyData = {
          stockLevel: "high",
          notes: "",
          lastChecked: new Date().toISOString(),
        };
      }
      Object.assign(fixture.surveyData, data);
      fixture.surveyData.lastChecked = new Date().toISOString();
      layoutStore.commit();
      // PERFORMANCE: Auto-save handled by exit/background
    }
  };

  const removeSurveyPhoto = (fixtureId: string, photoId: string) => {
    if (!layoutStore.currentLayout) return;
    const fixture = layoutStore.currentLayout.fixtures.find((f) => f.id === fixtureId);
    if (fixture && fixture.surveyPhotos) {
      fixture.surveyPhotos = fixture.surveyPhotos.filter((p) => p.id !== photoId);
      layoutStore.commit();
    }
  };

  const toggleFixtureLock = (fixtureId: string) => {
    if (!layoutStore.currentLayout) return;
    const fixture = layoutStore.currentLayout.fixtures.find((f) => f.id === fixtureId);
    if (fixture) {
      fixture.locked = !fixture.locked;
      layoutStore.commit();
    }
  };

  // Helpers from original store that manipulate fixtures
  const moveFixtureToBack = (fixtureId: string) => {
    if (!layoutStore.currentLayout) return;
    const index = layoutStore.currentLayout.fixtures.findIndex((f) => f.id === fixtureId);
    if (index > 0) {
      const [fixture] = layoutStore.currentLayout.fixtures.splice(index, 1);
      if (fixture) layoutStore.currentLayout.fixtures.unshift(fixture);
      layoutStore.commit();
    }
  };

  const moveFixtureToFront = (fixtureId: string) => {
    if (!layoutStore.currentLayout) return;
    const index = layoutStore.currentLayout.fixtures.findIndex((f) => f.id === fixtureId);
    if (index !== -1 && index < layoutStore.currentLayout.fixtures.length - 1) {
      const [fixture] = layoutStore.currentLayout.fixtures.splice(index, 1);
      if (fixture) layoutStore.currentLayout.fixtures.push(fixture);
      layoutStore.commit();
    }
  };

  const saveCustomTemplate = (fixture: PlacedFixture, name: string) => {
    const tmpl = getTemplate(fixture.templateId);
    const newTmpl: FixtureTemplate = {
      id: generateId(),
      name,
      category: tmpl ? tmpl.category : "shelves",
      width: fixture.width,
      height: fixture.height,
      totalHeight: fixture.height3D,
      color: fixture.customColor || tmpl?.color || "#8B7355",
      defaultContents: fixture.contents,
      description: "Custom Template",
    };
    layoutStore.customTemplates.push(newTmpl);
    updateFixture(fixture.id, { templateId: newTmpl.id });
    layoutStore.commit();
  };

  const deleteCustomTemplate = (id: string) => {
    layoutStore.customTemplates = layoutStore.customTemplates.filter((t: any) => t.id !== id);
  };

  return {
    getTemplate,
    addFixture,
    updateFixture,
    deleteFixture,
    duplicateFixture,
    rotateFixture,
    toggleFavorite,
    addSurveyPhoto,
    updateFixtureSurveyData,
    removeSurveyPhoto,
    toggleFixtureLock,
    moveFixtureToBack,
    moveFixtureToFront,
    saveCustomTemplate,
    deleteCustomTemplate,
  };
});
