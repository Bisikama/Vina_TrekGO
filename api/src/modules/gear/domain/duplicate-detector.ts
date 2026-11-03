import { GearCategory } from './gear.types';

export const ALL_CATEGORY_SCHEMA_FIELDS: Record<GearCategory, readonly string[]> = {
  JACKET: ['waterproof_mm', 'temp_rating_c', 'weight_g', 'windproof'],
  FOOTWEAR: ['waterproof', 'ankle_support', 'grip_level', 'weight_g'],
  PANTS: ['waterproof_mm', 'temp_rating_c', 'insulated'],
  BACKPACK: ['capacity_l', 'rain_cover', 'waterproof', 'weight_g'],
  SLEEPING_BAG: ['temp_rating_c', 'weight_g'],
  TENT: ['sleeping_places', 'flysheet_waterproof_mm', 'floor_waterproof_mm', 'weight_g'],
  TREKKING_POLE: ['adjustable', 'length_min_cm', 'length_max_cm', 'weight_g'],
  RAIN_GEAR: ['waterproof_mm', 'coverage', 'weight_g'],
};

export interface DuplicateCheckItem {
  id?: string;
  name?: string;
  category: GearCategory;
  condition: string;
  attributes: Record<string, unknown>;
  createdAt?: Date | string;
}

export interface SimilarityResult {
  similar: boolean;
  matchedFields: string[];
}

export interface DuplicateWarningDetails {
  similarItem: {
    id: string;
    name: string;
  };
  matchedFields: string[];
  similarCount: number;
}

/**
 * Pure, deterministic similarity predicate according to MASTER V3.1.5 Section 1.1.G (G2).
 *
 * Rules:
 * - Category must match.
 * - Condition must match (case-insensitive normalized).
 * - Iterates through canonical category schema fields in stable order.
 * - Unknown values (null or undefined) on either side are skipped.
 * - If both have known values (including 0, false, negative numbers):
 *   - If a !== b: returns { similar: false, matchedFields: [] } immediately.
 *   - If a === b: adds field to matchedFields.
 * - Returns { similar: matchedFields.length >= 1, matchedFields }.
 */
export function checkItemSimilarity(
  newItem: DuplicateCheckItem,
  existingItem: DuplicateCheckItem
): SimilarityResult {
  if (newItem.category !== existingItem.category) {
    return { similar: false, matchedFields: [] };
  }

  const condA = newItem.condition.trim().toUpperCase();
  const condB = existingItem.condition.trim().toUpperCase();
  if (condA !== condB) {
    return { similar: false, matchedFields: [] };
  }

  const fields = ALL_CATEGORY_SCHEMA_FIELDS[newItem.category] ?? [];
  const matchedFields: string[] = [];

  for (const field of fields) {
    const a = newItem.attributes ? newItem.attributes[field] : undefined;
    const b = existingItem.attributes ? existingItem.attributes[field] : undefined;

    const isUnknownA = a === null || a === undefined;
    const isUnknownB = b === null || b === undefined;

    if (isUnknownA || isUnknownB) {
      continue;
    }

    if (a !== b) {
      return { similar: false, matchedFields: [] };
    }

    matchedFields.push(field);
  }

  return {
    similar: matchedFields.length >= 1,
    matchedFields,
  };
}

/**
 * Evaluates candidate against a list of existing owned items (Section 1.1.G G3).
 * If similar items exist, returns DuplicateWarningDetails representing the most
 * recently created match (createdAt DESC, tie id ASC).
 */
export function findSimilarItems(
  newItem: DuplicateCheckItem,
  existingItems: DuplicateCheckItem[]
): DuplicateWarningDetails | null {
  const matches: Array<{
    item: DuplicateCheckItem;
    matchedFields: string[];
  }> = [];

  for (const existing of existingItems) {
    const sim = checkItemSimilarity(newItem, existing);
    if (sim.similar) {
      matches.push({
        item: existing,
        matchedFields: sim.matchedFields,
      });
    }
  }

  if (matches.length === 0) {
    return null;
  }

  // Sort matches: createdAt DESC, tie id ASC
  matches.sort((a, b) => {
    const timeA = a.item.createdAt ? new Date(a.item.createdAt).getTime() : 0;
    const timeB = b.item.createdAt ? new Date(b.item.createdAt).getTime() : 0;
    if (timeA !== timeB) {
      return timeB - timeA; // DESC
    }
    const idA = a.item.id ?? '';
    const idB = b.item.id ?? '';
    return idA.localeCompare(idB); // ASC
  });

  const rep = matches[0];
  return {
    similarItem: {
      id: rep.item.id ?? '',
      name: rep.item.name ?? '',
    },
    matchedFields: rep.matchedFields,
    similarCount: matches.length,
  };
}

