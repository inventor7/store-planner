export interface GetSchemaDetailsResponse {
  state: string;
  location_ids: StoreSchemaLocationDetails[];
  partner_id: string;
  json_description: string;
}

export interface UpdateSchemaRequest {
  json_description: string | object;
}

export interface StoreSchemaLocationDetails {
  location_type: string;
  ref: string;
}
