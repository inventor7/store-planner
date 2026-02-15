import { defineStore } from "pinia";
import { ref } from "vue";
import { getEntityList } from "@/shared/services/Common/getEntityList";
import { PlanningSync, type Planning, type WorkflowActivity } from "@/shared/models/Planning.Model";

export const useEditorSurveys = defineStore("editor-surveys", () => {
  const currentVisitId = ref<string | null>(null);
  const surveyDialogFixtureId = ref<string | null>(null);
  const presetActivity = ref<string | null>(null);

  const openSurveyDialog = (fixtureId: string) => {
    surveyDialogFixtureId.value = fixtureId;
  };

  const setSurveyVisited = async (survey: any) => {
    surveyDialogFixtureId.value = null;
  };

  const closeSurveyDialog = () => {
    surveyDialogFixtureId.value = null;
  };

  const fetchAvailableSurveys = async () => {
    const plannings = await getEntityList<Planning>(PlanningSync);
    // Logic to find relevant planning based on visit/partner could be refined
    const activePlanning = plannings[0];
    if (!activePlanning?.workflow_id?.workflow_activity_ids) return [];

    return activePlanning.workflow_id.workflow_activity_ids
      .filter((activity: WorkflowActivity) =>
        [
          "availability_survey",
          "stock_survey",
          "price_survey",
          "stock_and_price_survey",
          "promotion_survey",
        ].includes(activity.name),
      )
      .map((activity: WorkflowActivity) => ({
        surveyId: activity.name,
        name: activity.name.replace("_", " ").replace(/\b\w/g, (l: string) => l.toUpperCase()),
        status: "pending" as const,
      }));
  };

  const navigateToSurvey = (
    router: any,
    fixtureId: string,
    activityName: string,
    partnerId: string,
    audit: number = 0,
  ) => {
    // Logic from original store
    if (activityName === "availability_survey") {
      router.push({
        name: "partner-store-survey-availability",
        params: {
          visitId: currentVisitId.value || "no-visit",
          partnerId: partnerId || "no-partner",
          fixtureId: fixtureId,
        },
        query: {
          audit: audit,
        },
      });
      return;
    }

    // Handle other surveys (stock, price, etc.)
    const workflow = activityName.replace("_survey", "");
    router.push({
      name: "ActivityStockList",
      params: {
        visitId: currentVisitId.value || "no-visit",
        partnerId: partnerId || "no-partner",
      },
      query: {
        workflow: workflow,
        audit: audit,
        fixtureId: fixtureId, // Pass fixtureId to filter/highlight if supported
      },
    });
  };

  const setPresetActivity = (activity: string | null) => {
    presetActivity.value = activity;
  };

  return {
    currentVisitId,
    surveyDialogFixtureId,
    presetActivity,
    setPresetActivity,
    openSurveyDialog,
    closeSurveyDialog,
    fetchAvailableSurveys,
    navigateToSurvey,
  };
});
