import { v4 as uuidv4 } from "uuid";

export type Ruid = string;

export function ruid(): Ruid {
  return uuidv4();
}
