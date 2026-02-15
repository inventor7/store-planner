/**
 * Stub for getEntityList.
 */
export async function getEntityList<T>(Model: any): Promise<T[]> {
  console.log("[getEntityList] Mock fetching list for model:", Model.modelName);
  return [];
}
