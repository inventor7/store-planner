import { ref, type MaybeRef, toValue } from "vue";

export interface AuditActivity {
  id?: string;
  name: string;
  isVisited: boolean;
  audit_required: boolean;
  isConfigured?: boolean;
  original?: any;
}

/**
 * Stub for useAuditActivities to resolve SurveyDialog.vue imports.
 */
export function useAuditActivities(partner: MaybeRef<any>, visit: MaybeRef<any>) {
  const auditEfficy = ref<AuditActivity[]>([]);

  const activities = async () => {
    console.log("[useAuditActivities] Mock fetching activities");
    // Default simplified activities for the store planner
    auditEfficy.value = [
      { name: "availability_survey", isVisited: false, audit_required: true },
      { name: "stock_survey", isVisited: false, audit_required: false },
      { name: "price_survey", isVisited: false, audit_required: false },
    ];
  };

  const syncAuditActivities = async () => {
    console.log("[useAuditActivities] Mock syncing activities");
  };

  const setIsVisited = async (activity: AuditActivity) => {
    console.log("[useAuditActivities] Mock setting activity as visited:", activity.name);
    const item = auditEfficy.value.find((a) => a.name === activity.name);
    if (item) item.isVisited = true;
  };

  return {
    auditEfficy,
    activities,
    syncAuditActivities,
    setIsVisited,
    auditEfficyList: auditEfficy, // alias if needed
  };
}
