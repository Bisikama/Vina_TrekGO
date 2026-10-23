/**
 * AI Gear Advisor V3.1.1 — Domain Types & Enums
 * Pure TypeScript domain definitions (zero NestJS, Prisma, or external SDK imports).
 */

export type CoreGearCategory =
  | 'JACKET'
  | 'FOOTWEAR'
  | 'PANTS'
  | 'BACKPACK'
  | 'SLEEPING_BAG';

export type ExtendedGearCategory =
  | 'TENT'
  | 'TREKKING_POLE'
  | 'RAIN_GEAR';

export const CORE_GEAR_CATEGORIES: readonly CoreGearCategory[] = [
  'JACKET',
  'FOOTWEAR',
  'PANTS',
  'BACKPACK',
  'SLEEPING_BAG',
] as const;

export const EXTENDED_GEAR_CATEGORIES: readonly ExtendedGearCategory[] = [
  'TENT',
  'TREKKING_POLE',
  'RAIN_GEAR',
] as const;

export function isCoreGearCategory(category: string): category is CoreGearCategory {
  return (CORE_GEAR_CATEGORIES as readonly string[]).includes(category);
}

export function isExtendedGearCategory(category: string): category is ExtendedGearCategory {
  return (EXTENDED_GEAR_CATEGORIES as readonly string[]).includes(category);
}

export type GearCategory = CoreGearCategory | ExtendedGearCategory;

export type GearRuleCategory =
  | 'JACKET'
  | 'FOOTWEAR'
  | 'PANTS'
  | 'BACKPACK'
  | 'SLEEPING_BAG'
  | 'GENERAL';

export type GearCondition = 'NEW' | 'GOOD' | 'WORN' | 'POOR';

export type GearItemSource = 'MANUAL' | 'AI_IMAGE' | 'AI_LINK';

export type GearExtractionSourceType = 'IMAGE' | 'LINK';

export type GearExtractionStatus = 'PENDING' | 'READY' | 'FAILED' | 'CONFIRMED';

export type GearPlanContextMode = 'TRIP' | 'MANUAL';

export type GearOptionObjective = 'ECONOMICAL' | 'LIGHTWEIGHT' | 'BALANCED';

export type GearAdviceSource = 'AI' | 'CACHE' | 'RULE_FALLBACK';

export type GearVerdict = 'SUITABLE' | 'NOT_SUITABLE';

export interface UserGearItemDomain {
  id: string;
  userId: string;
  name: string;
  category: GearCategory;
  brand: string | null;
  condition: GearCondition;
  attributes: Record<string, unknown>;
  photoRef: string | null;
  source: GearItemSource;
  version: number;
  createdAt: Date;
  updatedAt: Date;
}

export interface GearRequirementRuleMetadata {
  id: string;
  category: GearRuleCategory;
  defaultVerdict: GearVerdict | null;
  templateVi: string;
  isActive: boolean;
  ruleVersion: string;
}

export interface ExtractionMetadata {
  sourceRef?: string | null;
  productUrl?: string | null;
  promptVersion?: string;
  modelVersion?: string;
  schemaVersion?: string;
  evidence?: Record<string, unknown> | null;
  fieldsUnknown?: string[];
}

export interface GearExtractionDraftDomain {
  id: string;
  userId: string;
  sourceType: GearExtractionSourceType;
  sourceHash: string;
  status: GearExtractionStatus;
  extractedData: Record<string, unknown> | null;
  metadata?: ExtractionMetadata | null;
  confirmedItemId: string | null;
  confirmationPayloadHash: string | null;
  version: number;
  expiresAt: Date;
  createdAt: Date;
  updatedAt: Date;
}

export interface GearExtractionCacheDomain {
  id: string;
  ownerScope: string;
  contentHash: string;
  promptVersion: string;
  modelVersion: string;
  schemaVersion: string;
  status: string;
  resultJson: Record<string, unknown>;
  expiresAt: Date;
  createdAt: Date;
}

export interface GearExtractionLeaseDomain {
  id: string;
  resourceKey: string;
  ownerToken: string;
  fencingToken: number;
  leaseExpiresAt: Date;
  createdAt: Date;
  updatedAt: Date;
}

export interface GearPlanDomain {
  id: string;
  userId: string;
  title: string;
  contextMode: GearPlanContextMode;
  tripId: string | null;
  selectedItemIds: string[];
  preferences: Record<string, unknown>;
  canonicalContext: Record<string, unknown>;
  inputRevision: number;
  evaluatedRevision: number | null;
  progressVersion: number;
  progressJson: unknown[];
  createdAt: Date;
  updatedAt: Date;
}

export interface GearPlanRevisionDomain {
  id: string;
  planId: string;
  revision: number;
  contentHash: string;
  inputSnapshot: Record<string, unknown>;
  resultSnapshot: Record<string, unknown>;
  contextVersion: string;
  ruleVersions: Record<string, unknown>;
  createdAt: Date;
}

export interface OptionSetSearchScope {
  inputHash?: string;
  catalogSnapshotVersion?: string;
  checkedAt?: string | Date;
  pricingSnapshot?: Record<string, unknown>;
  [key: string]: unknown;
}

export interface GearPlanOptionSetDomain {
  id: string;
  planRevisionId: string;
  objective: GearOptionObjective;
  searchScope: OptionSetSearchScope;
  optionsJson: unknown[];
  expiresAt: Date;
  createdAt: Date;
}

export interface GearAdviceRunDomain {
  id: string;
  planRevisionId: string;
  source: GearAdviceSource;
  status: string;
  promptVersion: string;
  modelVersion: string;
  contextHash: string;
  narrativeVi: string;
  factRefs: unknown[];
  actionRefs: unknown[];
  candidateRefs: unknown[];
  disclaimerVi: string;
  latencyMs: number | null;
  tokenUsage: Record<string, unknown> | null;
  createdAt: Date;
}

export interface GearQuoteLinkDomain {
  id: string;
  planRevisionId: string;
  quoteId: string;
  userId: string;
  verifiedAt: Date;
  createdAt: Date;
}

export interface ProductTechnicalProfileDomain {
  id: string;
  productId: string;
  category: GearCategory;
  attributes: Record<string, unknown>;
  schemaVersion: string;
  sources?: Record<string, unknown>;
  version: number;
  createdAt: Date;
  updatedAt: Date;
}
