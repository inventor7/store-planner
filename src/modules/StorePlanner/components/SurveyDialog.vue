<script setup lang="ts">
import { computed, ref, onMounted, watch } from "vue";
import { useI18n } from "vue-i18n";
import { useEditorLayout } from "@/modules/StorePlanner/stores/useEditorLayout";
import { useEditorSurveys } from "@/modules/StorePlanner/stores/useEditorSurveys";
import { useEditorPlacements } from "@/modules/StorePlanner/stores/useEditorPlacements";
import { storeToRefs } from "pinia";
import { getTemplateById } from "@/modules/StorePlanner/data/fixtureTemplates";
import type { SurveyStatus } from "@/modules/StorePlanner/types/editor";
import { useRouter } from "vue-router";
import { useAuditActivities } from "../composables/useAuditActivities";
import type { AuditActivity } from "../composables/useAuditActivities";
import { usePartnerActivityShow } from "../composables/usePartnerActivityShow";
import type { Ruid } from "../utils/ruid/ruid";

interface AvailableSurvey {
  id: string;
  name: string;
  status: SurveyStatus;
  isConfigured: boolean;
  original?: AuditActivity;
}

const layoutStore = useEditorLayout();
const surveysStore = useEditorSurveys();
const placementsStore = useEditorPlacements();
const { t } = useI18n();

const { currentLayout } = storeToRefs(layoutStore);
const { currentVisitId, surveyDialogFixtureId } = storeToRefs(surveysStore);

const router = useRouter();

const partnerId = computed(() => currentLayout.value?.partnerId as Ruid);
const visitId = computed(() => currentVisitId.value as Ruid);

const { partner, visit } = usePartnerActivityShow(visitId.value, partnerId.value);

const {
  auditEfficy,
  activities: fetchActivities,
  syncAuditActivities,
  setIsVisited,
} = useAuditActivities(partner, visit);

onMounted(async () => {
  if (partner.value) {
    await fetchActivitiesData();
  }
});

watch(partner, async (newPartner) => {
  if (newPartner) {
    await fetchActivitiesData();
  }
});

watch(
  () => surveyDialogFixtureId.value,
  async (newId) => {
    if (newId) {
      await fetchActivitiesData();
    }
  },
);

const fixture = computed(() => {
  if (!surveyDialogFixtureId.value || !currentLayout.value) return null;
  return currentLayout.value.fixtures.find((f) => f.id === surveyDialogFixtureId.value);
});

const placement = computed(() => {
  if (!fixture.value) return null;
  return placementsStore.getPlacementForFixture(fixture.value.id);
});

const template = computed(() => {
  if (!fixture.value) return null;
  return getTemplateById(fixture.value.templateId);
});

const auditLoading = ref(true);

const fetchActivitiesData = async () => {
  auditLoading.value = true;
  await fetchActivities();
  await syncAuditActivities();
  auditLoading.value = false;
};

const activeSurveyId = ref<string | null>(null);

const relevantSurveyNames = [
  "availability_survey",
  "stock_survey",
  "price_survey",
  "stock_and_price_survey",
];

const getName = (name: string) => {
  const dic: Record<string, string> = {
    stock_and_price_survey: "Stock and Price Check",
    stock_survey: "Stock Compliance",
    price_survey: "Price Compliance",
    availability_survey: "Availability Check",
    promotion_survey: "Promotions Check",
    equipment: "PLV Check",
    image_recognition: "Visibility",
    loyalty_survey: "Check Fidelity",
    survey: "Survey",
  };

  return dic[name] || name.replace("_", " ").replace(/\b\w/g, (l) => l.toUpperCase());
};

const availableSurveysList = computed<AvailableSurvey[]>(() => {
  const list: AvailableSurvey[] = [];
  const auditActivities = auditEfficy.value;

  if (fixture.value) {
    const availabilityStatus =
      placement.value?.surveys.find((s) => s.surveyId === "availability_survey")?.status ||
      "pending";
    list.push({
      id: "availability_survey",
      name: getName("availability_survey"),
      status: availabilityStatus,
      isConfigured: true,
    });
  }

  auditActivities
    .filter(
      (a: AuditActivity) =>
        relevantSurveyNames.includes(a.name) && a.name !== "availability_survey",
    )
    .forEach((a: AuditActivity) => {
      const placementStatus =
        placement.value?.surveys.find((s) => s.surveyId === a.id)?.status || "pending";

      list.push({
        id: a.id || "",
        name: a.name || "",
        status: placementStatus,
        isConfigured: a.isConfigured || false,
        original: a,
      });
    });
  return list;
});

watch(
  availableSurveysList,
  (newList) => {
    if (!auditLoading.value && newList.length > 0 && placement.value?.id) {
      placementsStore.syncPlacementsConfig(
        newList.map((s: AvailableSurvey) => ({
          id: s.id,
          isConfigured: s.isConfigured,
          status: "pending" as const,
        })),
        undefined,
      );
    }
  },
  { deep: true, immediate: true },
);

const close = () => {
  surveysStore.closeSurveyDialog();
};

const handleStartSurvey = (surveyId: string) => {
  const survey = availableSurveysList.value.find((s) => s.id === surveyId);
  if (!survey || !survey.isConfigured || survey.status === "complete") {
    return;
  }

  if (surveyId === "availability_survey") {
    if (currentLayout.value && surveyDialogFixtureId.value) {
      router.push({
        name: "partner-store-survey-availability",
        params: {
          visitId: currentVisitId.value || "no-visit",
          partnerId: currentLayout.value.partnerId || "no-partner",
          fixtureId: surveyDialogFixtureId.value,
        },
      });
      close();
    }
    return;
  }

  const workflowMapping: Record<string, string> = {
    stock_survey: "stock",
    price_survey: "price",
    stock_and_price_survey: "stock_and_price",
    promotion_survey: "promotion",
  };

  if (workflowMapping[surveyId]) {
    router.push({
      name: "ActivityStockList",
      params: {
        visitId: currentVisitId.value || "no-visit",
        partnerId: currentLayout.value?.partnerId || "no-partner",
      },
      query: {
        workflow: workflowMapping[surveyId],
        audit: 0,
        fixtureId: surveyDialogFixtureId.value,
      },
    });
    close();
  }

  activeSurveyId.value = surveyId;
};

const handleSkipSurvey = async (survey: AvailableSurvey) => {
  if (survey.original) {
    await setIsVisited(survey.original);
    if (placement.value) {
      await placementsStore.updatePlacementSurveyStatus(placement.value.id, survey.id, "complete");
    }
    await fetchActivities();
  }
};

const handleCompleteSurvey = async (status: SurveyStatus) => {
  if (placement.value && activeSurveyId.value) {
    await placementsStore.updatePlacementSurveyStatus(
      placement.value.id,
      activeSurveyId.value,
      status,
    );
    activeSurveyId.value = null;
  }
};

const handleAddPlacement = () => {
  if (fixture.value) {
    placementsStore.addPlacement(fixture.value.id);
  }
};

const getStatusColor = (status: SurveyStatus) => {
  switch (status) {
    case "complete":
      return "text-green-500";
    case "partial":
      return "text-amber-500";
    default:
      return "text-muted-foreground";
  }
};
</script>

<template>
  <Dialog :open="!!surveyDialogFixtureId" @update:open="(val) => !val && close()">
    <DialogContent class="max-w-[450px] p-0 rounded-2xl overflow-hidden border-none shadow-2xl">
      <!-- Header -->
      <div class="p-4 border-b bg-muted/20 flex justify-between items-center gap-4">
        <DialogHeader>
          <DialogTitle class="text-lg font-bold">
            {{ template?.name || "Fixture" }}
          </DialogTitle>
        </DialogHeader>
        <Button variant="ghost" size="icon" class="h-8 w-8 text-muted-foreground" @click="close">
          <IMdiClose class="w-4 h-4" />
        </Button>
      </div>

      <!-- Main Content -->
      <div class="p-6">
        <!-- No Placement Yet -->
        <div v-if="!placement" class="text-center py-8">
          <div
            class="icon-circle w-16 h-16 rounded-full bg-muted flex items-center justify-center mx-auto mb-4"
          >
            <IMdiTagPlus class="text-muted-foreground w-8 h-8" />
          </div>
          <p class="text-sm text-muted-foreground mb-6">
            {{
              t("storePlanner.editor.surveys.noPlacement") ||
              "This fixture doesn't have a survey placement yet."
            }}
          </p>
          <Button class="font-bold" @click="handleAddPlacement">
            <IMdiPlus class="mr-2 w-4 h-4" />
            Add Placement
          </Button>
        </div>

        <!-- Survey List -->
        <div v-else-if="!activeSurveyId">
          <p class="text-xs font-bold text-muted-foreground uppercase tracking-widest mb-4">
            Select a survey to complete:
          </p>
          <div class="survey-list flex flex-col gap-2">
            <div
              v-for="survey in availableSurveysList"
              :key="survey.id"
              @click="handleStartSurvey(survey.id)"
              class="survey-item p-4 rounded-xl border border-border flex items-center gap-4 transition-all cursor-pointer hover:bg-accent/50 hover:border-primary/30 group"
              :class="{
                'opacity-60': survey.status === 'complete',
                'pointer-events-none': survey.status === 'complete' || !survey.isConfigured,
              }"
            >
              <div class="shrink-0">
                <component
                  :is="
                    !survey.isConfigured
                      ? 'IMdiCloseCircleOutline'
                      : survey.status === 'complete'
                        ? 'IMdiCheckCircle'
                        : survey.status === 'partial'
                          ? 'IMdiCircleHalfFull'
                          : 'IMdiCircleOutline'
                  "
                  :class="[
                    !survey.isConfigured
                      ? 'text-muted-foreground/50'
                      : getStatusColor(survey.status),
                  ]"
                  class="w-6 h-6"
                />
              </div>

              <div class="flex-1 min-w-0">
                <h4 class="text-sm font-bold truncate">{{ survey.name }}</h4>
                <p class="text-xs text-muted-foreground">
                  {{
                    !survey.isConfigured
                      ? "Inactive / Not Configured"
                      : survey.status === "complete"
                        ? "Completed"
                        : survey.status === "partial"
                          ? "Partial"
                          : "Pending"
                  }}
                </p>
              </div>

              <div class="flex items-center gap-2">
                <Badge
                  v-if="survey.status === 'complete' && survey.isConfigured"
                  variant="default"
                  class="bg-green-500 hover:bg-green-600 text-[10px]"
                >
                  DONE
                </Badge>
                <Badge
                  v-if="!survey.isConfigured"
                  variant="outline"
                  class="text-[10px] text-muted-foreground"
                >
                  DISABLED
                </Badge>

                <!-- No Activity button -->
                <Button
                  v-if="survey.isConfigured && survey.status !== 'complete'"
                  variant="ghost"
                  size="icon"
                  class="h-8 w-8 text-destructive hover:bg-destructive/10"
                  @click.stop="handleSkipSurvey(survey)"
                >
                  <IMdiCloseBoxOutline class="w-4 h-4" />
                </Button>

                <IMdiChevronRight
                  v-if="survey.isConfigured"
                  class="w-5 h-5 text-muted-foreground/50 group-hover:text-primary"
                />
              </div>
            </div>

            <!-- Show message if no surveys configured -->
            <div
              v-if="availableSurveysList.length === 0"
              class="text-center py-6 text-muted-foreground text-sm"
            >
              No surveys configured for this partner.
            </div>
          </div>
        </div>

        <!-- Active Survey Screen (Inline for now) -->
        <div v-else class="survey-screen min-h-[200px]">
          <Button variant="ghost" size="icon" class="mb-4 h-8 w-8" @click="activeSurveyId = null">
            <IMdiArrowLeft class="w-5 h-5" />
          </Button>

          <h3 class="text-lg font-bold mb-2">
            {{ placement?.surveys.find((s) => s.surveyId === activeSurveyId)?.name }}
          </h3>

          <p class="text-sm text-muted-foreground mb-8">
            Complete the survey checks below for this fixture.
          </p>

          <div class="flex flex-col gap-3">
            <Button
              class="h-12 w-full font-bold bg-green-500 hover:bg-green-600"
              @click="handleCompleteSurvey('complete')"
            >
              <IMdiCheck class="mr-2 w-5 h-5" />
              Mark as Complete
            </Button>
            <Button
              variant="secondary"
              class="h-12 w-full font-bold"
              @click="handleCompleteSurvey('partial')"
            >
              <IMdiCircleHalfFull class="mr-2 w-5 h-5" />
              Mark as Partial
            </Button>
            <Button variant="ghost" class="h-12 w-full font-bold" @click="activeSurveyId = null">
              Cancel
            </Button>
          </div>
        </div>
      </div>
    </DialogContent>
  </Dialog>
</template>

<style scoped>
/* Scoped styles removed in favor of Tailwind utility classes */
</style>
