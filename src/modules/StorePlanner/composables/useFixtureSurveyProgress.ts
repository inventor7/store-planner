/**
 * Composable to persist survey progress per-fixture in localStorage.
 * This ensures each shelf's survey state is isolated and doesn't mix with others.
 *
 * Storage key format: `fixture-survey-{partnerId}-{fixtureId}-{surveyType}`
 */

import { type Ref } from "vue";

export interface AvailabilitySurveyProductState {
  available: boolean;
  visible: boolean;
}

export interface FixtureSurveyProgress {
  fixtureId: string;
  surveyType: string;
  lastUpdated: string;
  productStates: Record<string, AvailabilitySurveyProductState>;
}

const STORAGE_PREFIX = "fixture-survey";

/**
 * Generate a unique storage key for a fixture's survey progress
 */
const getStorageKey = (partnerId: string, fixtureId: string, surveyType: string): string => {
  return `${STORAGE_PREFIX}-${partnerId}-${fixtureId}-${surveyType}`;
};

/**
 * Composable for managing per-fixture survey progress
 */
export const useFixtureSurveyProgress = (
  partnerId: Ref<string> | string,
  fixtureId: Ref<string> | string,
  surveyType: string = "availability",
) => {
  const getPartnerId = () => (typeof partnerId === "string" ? partnerId : partnerId.value);
  const getFixtureId = () => (typeof fixtureId === "string" ? fixtureId : fixtureId.value);

  /**
   * Load saved progress from localStorage
   */
  const loadProgress = (): FixtureSurveyProgress | null => {
    const key = getStorageKey(getPartnerId(), getFixtureId(), surveyType);
    try {
      const stored = localStorage.getItem(key);
      if (stored) {
        return JSON.parse(stored) as FixtureSurveyProgress;
      }
    } catch (e) {
      console.warn("Failed to load fixture survey progress:", e);
    }
    return null;
  };

  /**
   * Save progress to localStorage
   */
  const saveProgress = (productStates: Record<string, AvailabilitySurveyProductState>): void => {
    const key = getStorageKey(getPartnerId(), getFixtureId(), surveyType);
    const progress: FixtureSurveyProgress = {
      fixtureId: getFixtureId(),
      surveyType,
      lastUpdated: new Date().toISOString(),
      productStates,
    };
    try {
      localStorage.setItem(key, JSON.stringify(progress));
    } catch (e) {
      console.warn("Failed to save fixture survey progress:", e);
    }
  };

  /**
   * Clear progress from localStorage (call after successful save to backend)
   */
  const clearProgress = (): void => {
    const key = getStorageKey(getPartnerId(), getFixtureId(), surveyType);
    try {
      localStorage.removeItem(key);
    } catch (e) {
      console.warn("Failed to clear fixture survey progress:", e);
    }
  };

  /**
   * List all saved progress for a partner (useful for debugging/admin)
   */
  const listAllProgressForPartner = (): FixtureSurveyProgress[] => {
    const results: FixtureSurveyProgress[] = [];
    const prefix = `${STORAGE_PREFIX}-${getPartnerId()}-`;
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key?.startsWith(prefix)) {
        try {
          const stored = localStorage.getItem(key);
          if (stored) {
            results.push(JSON.parse(stored));
          }
        } catch (e) {
          // Skip invalid entries
        }
      }
    }
    return results;
  };

  return {
    loadProgress,
    saveProgress,
    clearProgress,
    listAllProgressForPartner,
  };
};
