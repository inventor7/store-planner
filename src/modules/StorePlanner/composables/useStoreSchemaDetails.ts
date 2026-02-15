import { useQuery } from "@pinia/colada";
import type { MaybeRefOrGetter } from "vue";
import { http } from "@/shared/services/http";
import type { GetSchemaDetailsResponse } from "../types/storeSchemaApi.types";

export function useStoreSchemaDetails(
  schemaId: Ref<string | null>,
  options?: {
    enabled?: Ref<boolean>;
  },
) {
  return useQuery({
    key: () => ["store-schema", schemaId.value],
    query: async () => {
      if (!schemaId.value) throw new Error("Schema ID is required");
      const { data } = await http.get<GetSchemaDetailsResponse>(
        `/api/store-schema/${schemaId.value}/details`,
        {
          data: {},
        },
      );
      return data;
    },
    enabled: options?.enabled?.value ?? !!schemaId.value,
    staleTime: 24 * 60 * 60 * 1000,
  });
}
