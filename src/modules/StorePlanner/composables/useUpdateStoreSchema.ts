import { useMutation, useQueryCache } from "@pinia/colada";
import { http } from "@/shared/services/http";
import type { UpdateSchemaRequest } from "../types/storeSchemaApi.types";

export function useUpdateStoreSchema() {
  const queryCache = useQueryCache();

  return useMutation({
    mutation: async ({
      schemaId,
      jsonDescription,
    }: {
      schemaId: string;
      jsonDescription: string | object;
    }) => {
      const payload: UpdateSchemaRequest = { json_description: jsonDescription };
      const { data } = await http.post(`/api/store-schema/${schemaId}`, payload);
      return data;
    },
    onSuccess: (data, { schemaId }) => {
      queryCache.invalidateQueries({ key: ["store-schema", schemaId] });
    },
  });
}
