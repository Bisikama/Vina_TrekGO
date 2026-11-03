export type GearCategory =
  | "JACKET"
  | "FOOTWEAR"
  | "PANTS"
  | "BACKPACK"
  | "SLEEPING_BAG"
  | "TENT"
  | "TREKKING_POLE"
  | "RAIN_GEAR";

/** Backend trả chữ thường; vẫn chấp nhận chữ hoa khi gửi lên. */
export type GearCondition = "new" | "good" | "worn" | "poor";
export type GearSource = "manual" | "ai_image" | "ai_link";

export type GearAttributeSource = "USER" | "AI_IMAGE" | "AI_LINK" | "VERIFIED_CATALOG";
export type GearAttributeProvenance = { source: GearAttributeSource; referenceId?: string | null };

export type UserGearItem = {
  id: string;
  name: string;
  category: GearCategory;
  brand: string | null;
  condition: GearCondition;
  attributes: Record<string, unknown>;
  photoRef: string | null;
  photos?: { id: string; storageRef: string; position: number }[];
  /** URL ảnh đã ký, do client lấy qua media delivery (không có trong response gốc). */
  photoUrl?: string;
  source: GearSource;
  version: number;
  createdAt: string;
  updatedAt: string;
  /** Nguồn từng thông số; null/thiếu = dữ liệu cũ, không suy ra nguồn. */
  attributeProvenance?: Record<string, GearAttributeProvenance> | null;
};

export type CreateUserGearInput = {
  name: string;
  category: GearCategory;
  brand?: string | null;
  condition: GearCondition;
  attributes?: Record<string, unknown>;
  photoRef?: string | null;
  acknowledgeDuplicate?: boolean;
};

export type GearCapabilityStatus = { enabled: boolean; configured: boolean; messageVi: string };
export type GearCapabilities = {
  aiProvider: string | null;
  ruleBasedAdvice: GearCapabilityStatus;
  aiAdvice: GearCapabilityStatus;
  imageExtraction: GearCapabilityStatus;
  linkExtraction: GearCapabilityStatus;
};

export type GearEvidence = { id: string; fieldPath: string; originalText: string; sourceLocator?: string | null };
export type GearExtractionDraft = {
  id: string;
  sourceType: "IMAGE" | "LINK";
  status: "PENDING" | "READY" | "FAILED" | "CONFIRMED";
  extractedData: {
    name?: string | null;
    brand?: string | null;
    category?: GearCategory | null;
    condition?: GearCondition | null;
    attributes?: Record<string, unknown>;
    warnings?: string[];
    fieldsUnknown?: string[];
    url?: string | null;
    evidence?: GearEvidence[];
    _cacheHit?: boolean;
  };
  manualEntry?: { required: boolean; reasonCode: string; messageVi: string } | null;
  extractionFieldProvenance?: Record<string, "FOUND" | "MISSING"> | null;
  version: number;
  expiresAt: string;
};

/** Hồ sơ sản phẩm đã được TrekGo kiểm duyệt (danh mục sản phẩm cá nhân). */
export type GearCatalogEntry = {
  id: string;
  name: string;
  brand: string | null;
  category: GearCategory;
  attributes: Record<string, unknown>;
  evidence: Record<string, string>;
  version: number;
  reviewedAt: string | null;
};
