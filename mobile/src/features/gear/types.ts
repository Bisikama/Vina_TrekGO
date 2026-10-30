export type GearCategory =
  | "JACKET"
  | "FOOTWEAR"
  | "PANTS"
  | "BACKPACK"
  | "SLEEPING_BAG"
  | "TENT"
  | "TREKKING_POLE"
  | "RAIN_GEAR";

export type GearCondition = "NEW" | "GOOD" | "WORN" | "POOR";

export type UserGearItem = {
  id: string;
  name: string;
  category: GearCategory;
  brand: string | null;
  condition: GearCondition;
  attributes: Record<string, unknown>;
  photoRef: string | null;
  source: "MANUAL" | "AI_IMAGE" | "AI_LINK";
  version: number;
  createdAt: string;
  updatedAt: string;
};

export type CreateUserGearInput = {
  name: string;
  category: GearCategory;
  brand?: string;
  condition: GearCondition;
  attributes?: Record<string, unknown>;
  photoRef?: string;
};
