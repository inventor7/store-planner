export interface FixtureCollection {
  id: string;
  name: string;
  color: string;
}

export const ITEM_COLLECTIONS: FixtureCollection[] = [
  { id: "dairy", name: "Dairy", color: "#F97316" }, // Orange-500
  { id: "beverages", name: "Beverages", color: "#3B82F6" }, // Blue-500
  { id: "snacks", name: "Snacks", color: "#EAB308" }, // Yellow-500
  { id: "bakery", name: "Bakery", color: "#78350F" }, // Amber-900 (Brownish)
  { id: "meat-deli", name: "Meat & Deli", color: "#EF4444" }, // Red-500
  { id: "frozen", name: "Frozen Foods", color: "#06B6D4" }, // Cyan-500
  { id: "produce", name: "Produce", color: "#22C55E" }, // Green-500
  { id: "canned", name: "Canned Goods", color: "#84CC16" }, // Lime-500
  { id: "personal-care", name: "Personal Care", color: "#EC4899" }, // Pink-500
  { id: "home-care", name: "Home Care", color: "#64748B" }, // Slate-500
  { id: "alcohol", name: "Alcohol", color: "#4F46E5" }, // Indigo-600
  { id: "promotions", name: "Promotions", color: "#FACC15" }, // Yellow-400
  { id: "electronics", name: "Electronics", color: "#1E293B" }, // Slate-800
  { id: "checkout", name: "Checkout Area", color: "#334155" }, // Slate-700
];

export const getCollectionById = (id: string) =>
  ITEM_COLLECTIONS.find((c) => c.id === id);
