import { defineStore } from "pinia";
import { useEditorLayout } from "./useEditorLayout";
import { useEditorSurveys } from "./useEditorSurveys";
import { generateId } from "@/modules/StorePlanner/utils/editorUtils";

export const useEditorPlacements = defineStore("editor-placements", () => {
  const layoutStore = useEditorLayout();
  const surveysStore = useEditorSurveys(); // To fetch available surveys

  const addPlacement = async (fixtureId: string) => {
    if (!layoutStore.currentLayout) return;
    if (!layoutStore.currentLayout.placements) {
      layoutStore.currentLayout.placements = [];
    }
    const exists = layoutStore.currentLayout.placements.find((p) => p.fixtureId === fixtureId);
    if (exists) return; // Already has placement

    const availableSurveys = await surveysStore.fetchAvailableSurveys();

    const placement = {
      id: generateId(),
      fixtureId,
      surveys:
        availableSurveys.length > 0
          ? availableSurveys
          : [
              {
                surveyId: "availability_survey",
                name: "Availability Survey",
                status: "pending" as const,
              },
              {
                surveyId: "stock_survey",
                name: "Stock Survey",
                status: "pending" as const,
              },
              {
                surveyId: "price_survey",
                name: "Price Survey",
                status: "pending" as const,
              },
            ],
    };
    layoutStore.currentLayout.placements.push(placement);
    layoutStore.commit();
  };

  const deletePlacement = async (placementId: string) => {
    if (!layoutStore.currentLayout) return;
    layoutStore.currentLayout.placements = layoutStore.currentLayout.placements.filter(
      (p) => p.id !== placementId,
    );
    layoutStore.commit();
  };

  const getPlacementForFixture = (fixtureId: string) => {
    if (!layoutStore.currentLayout) return null;
    return layoutStore.currentLayout.placements?.find((p) => p.fixtureId === fixtureId) || null;
  };

  const updatePlacementSurveyStatus = async (
    placementId: string,
    surveyId: string,
    status: "pending" | "partial" | "complete",
  ) => {
    if (!layoutStore.currentLayout) return;
    const placement = layoutStore.currentLayout.placements.find((p) => p.id === placementId);
    if (!placement) return;
    const survey = placement.surveys.find((s) => s.surveyId === surveyId);
    if (survey) {
      survey.status = status;
      layoutStore.commit();
      // PERFORMANCE: Auto-save handled by exit/background
    }
  };

  const syncPlacementsConfig = async (
    config: {
      id: string;
      isConfigured: boolean;
      status: "pending" | "partial" | "complete";
    }[],
    placementId?: string,
  ) => {
    if (!layoutStore.currentLayout) return;

    let changed = false;
    layoutStore.currentLayout.placements?.forEach((p) => {
      // Only sync status if it's the specific placement (MANDATORY for isolation)
      const isTarget = placementId && p.id === placementId;

      p.surveys.forEach((ps) => {
        const cfg = config.find((c) => c.id === ps.surveyId);
        if (cfg) {
          // ALWAYS sync configured status globally
          if (ps.isConfigured !== cfg.isConfigured) {
            ps.isConfigured = cfg.isConfigured;
            changed = true;
          }
          // ONLY sync status if isolated to this placement
          if (isTarget && ps.status !== cfg.status) {
            ps.status = cfg.status;
            changed = true;
          }
        } else {
          if (ps.isConfigured !== false) {
            ps.isConfigured = false;
            changed = true;
          }
        }
      });
    });

    if (changed) {
      layoutStore.commit();
      // PERFORMANCE: Auto-save handled by exit/background
    }
  };

  return {
    addPlacement,
    deletePlacement,
    getPlacementForFixture,
    updatePlacementSurveyStatus,
    syncPlacementsConfig,
  };
});
