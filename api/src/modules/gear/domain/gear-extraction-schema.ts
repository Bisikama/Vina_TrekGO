import { z } from 'zod';
import { CORE_GEAR_CATEGORIES, EXTENDED_GEAR_CATEGORIES, GearCategory } from './gear.types';
import {
  CANONICAL_CATEGORY_FIELD_KEYS,
  validateAttributesForCategory,
} from '../application/dtos/user-gear.dto';

const ALL_GEAR_CATEGORIES: readonly string[] = [
  ...CORE_GEAR_CATEGORIES,
  ...EXTENDED_GEAR_CATEGORIES,
];

export interface ExtractionEvidence {
  id: string;
  fieldPath: string;
  originalText: string;
  sourceLocator?: string;
  unit?: string;
}

export const extractionEvidenceSchema = z.object({
  id: z.string(),
  fieldPath: z.string(),
  originalText: z.string(),
  sourceLocator: z.preprocess((value) => value === null ? undefined : value, z.string().optional()),
  unit: z.preprocess((value) => value === null ? undefined : value, z.string().optional()),
});

export const gearExtractionWireSchema = z.object({
  category: z.string().nullable().optional(),
  name: z.string().nullable().optional(),
  brand: z.string().nullable().optional(),
  attributes: z.record(z.string(), z.unknown()).default({}),
  evidence: z.array(extractionEvidenceSchema).default([]),
  warnings: z.array(z.string()).default([]),
  fieldsUnknown: z.array(z.string()).default([]),
  needsConfirmation: z.boolean().default(true),
});

export type GearExtractionWire = z.infer<typeof gearExtractionWireSchema>;

export interface DomainExtractionResult {
  category: GearCategory | null;
  name: string | null;
  brand: string | null;
  attributes: Record<string, unknown>;
  evidence: ExtractionEvidence[];
  warnings: string[];
  fieldsUnknown: string[];
  needsConfirmation: boolean;
}

export function normalizeExtractionResult(raw: unknown): DomainExtractionResult {
  const parsed = gearExtractionWireSchema.parse(raw);

  let category: GearCategory | null = null;
  if (parsed.category) {
    const upper = parsed.category.toUpperCase().trim() as GearCategory;
    if (ALL_GEAR_CATEGORIES.includes(upper)) {
      category = upper;
    }
  }

  const warnings = [...(parsed.warnings || [])];
  const fieldsUnknown = [...(parsed.fieldsUnknown || [])];
  let normalizedAttributes: Record<string, unknown> = {};

  if (category) {
    const allowedKeys = CANONICAL_CATEGORY_FIELD_KEYS[category] || [];
    const filteredAttrs: Record<string, unknown> = {};

    for (const [key, val] of Object.entries(parsed.attributes || {})) {
      if (allowedKeys.includes(key)) {
        if (val !== undefined && val !== null) {
          filteredAttrs[key] = val;
        }
      } else {
        warnings.push(`Thuộc tính '${key}' không thuộc lược đồ của danh mục ${category}`);
      }
    }

    try {
      normalizedAttributes = validateAttributesForCategory(category, filteredAttrs);
    } catch {
      // If validation fails on types, record in warnings
      warnings.push(`Giá trị thuộc tính kỹ thuật không hợp lệ cho ${category}`);
      normalizedAttributes = {};
    }

    // B06 Evidence verification: each technical non-null attribute MUST have matching evidence
    const evidenceFieldPaths = new Set(
      (parsed.evidence || []).map((e) => e.fieldPath.replace(/^attributes\./, '')),
    );

    for (const [key, val] of Object.entries(normalizedAttributes)) {
      if (val !== null && val !== undefined) {
        if (!evidenceFieldPaths.has(key)) {
          delete normalizedAttributes[key];
          warnings.push(`Thuộc tính '${key}' bị loại bỏ khỏi kết quả do không có bằng chứng trích xuất tương ứng`);
          if (!fieldsUnknown.includes(key)) {
            fieldsUnknown.push(key);
          }
        }
      }
    }

    for (const key of allowedKeys) {
      if (normalizedAttributes[key] === undefined || normalizedAttributes[key] === null) {
        if (!fieldsUnknown.includes(key)) {
          fieldsUnknown.push(key);
        }
      }
    }
  } else {
    normalizedAttributes = {};
  }

  return {
    category,
    name: parsed.name?.trim() || null,
    brand: parsed.brand?.trim() || null,
    attributes: normalizedAttributes,
    evidence: parsed.evidence || [],
    warnings,
    fieldsUnknown,
    needsConfirmation: true,
  };
}
