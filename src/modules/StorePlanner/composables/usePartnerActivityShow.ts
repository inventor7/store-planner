import { ref } from "vue";
import { computedAsync } from "@vueuse/core";

/**
 * Stub for usePartnerActivityShow to resolve SurveyDialog.vue imports.
 * In a full integration, this would fetch partner and visit details from the database/API.
 */
export function usePartnerActivityShow(eventId: any, partnerId: any) {
  // Use computedAsync stubs
  const partner = computedAsync(async () => {
    return { _ruid: partnerId, name: "Mock Partner" };
  });

  const visit = computedAsync(async () => {
    return { _ruid: eventId, name: "Mock Visit" };
  });

  return {
    partner,
    visit,
  };
}
