/**
 * AI Gear Advisor V3.1.3 — Requirement Constraint Evaluator (Pure TypeScript)
 * Zero NestJS, Prisma, AI SDK, or I/O imports.
 * Implements namespaces GR-CONSTRAINT-GTE, GR-CONSTRAINT-LTE, GR-CONSTRAINT-EQ according to MASTER Section 7.
 */

import { GearCategory } from './gear.types';

export type ConstraintOperator = 'GTE' | 'LTE' | 'EQ';

export type ConstraintEvaluationStatus = 'SATISFIED' | 'NOT_SATISFIED' | 'UNKNOWN';

export type ConstraintSourceType =
  | 'USER_REQUEST'
  | 'TRIP_OFFICIAL'
  | 'TEAM_POLICY_ASSUMPTION'
  | 'MANUFACTURER_FACT';

export interface ConstraintProvenance {
  source: ConstraintSourceType;
  reference: string;
}

export interface CanonicalFieldDefinition {
  field: string;
  categories: readonly GearCategory[];
  valueType: 'number' | 'boolean' | 'string';
  canonicalUnit?: string;
  allowedOperators: readonly ConstraintOperator[];
  min?: number;
  max?: number;
}

export const CANONICAL_FIELD_DEFINITIONS: Record<string, CanonicalFieldDefinition> = {
  waterproof_mm: {
    field: 'waterproof_mm',
    categories: ['JACKET', 'PANTS', 'RAIN_GEAR'],
    valueType: 'number',
    canonicalUnit: 'mm',
    allowedOperators: ['GTE', 'LTE', 'EQ'],
    min: 0,
  },
  temp_rating_c: {
    field: 'temp_rating_c',
    categories: ['JACKET', 'PANTS', 'SLEEPING_BAG'],
    valueType: 'number',
    canonicalUnit: 'C',
    allowedOperators: ['GTE', 'LTE', 'EQ'],
  },
  weight_g: {
    field: 'weight_g',
    categories: [
      'JACKET',
      'FOOTWEAR',
      'PANTS',
      'BACKPACK',
      'SLEEPING_BAG',
      'TENT',
      'TREKKING_POLE',
      'RAIN_GEAR',
    ],
    valueType: 'number',
    canonicalUnit: 'g',
    allowedOperators: ['GTE', 'LTE', 'EQ'],
    min: 0,
  },
  windproof: {
    field: 'windproof',
    categories: ['JACKET'],
    valueType: 'boolean',
    allowedOperators: ['EQ'],
  },
  waterproof: {
    field: 'waterproof',
    categories: ['FOOTWEAR', 'BACKPACK'],
    valueType: 'boolean',
    allowedOperators: ['EQ'],
  },
  ankle_support: {
    field: 'ankle_support',
    categories: ['FOOTWEAR'],
    valueType: 'boolean',
    allowedOperators: ['EQ'],
  },
  grip_level: {
    field: 'grip_level',
    categories: ['FOOTWEAR'],
    valueType: 'number',
    allowedOperators: ['GTE', 'LTE', 'EQ'],
    min: 1,
    max: 5,
  },
  insulated: {
    field: 'insulated',
    categories: ['PANTS'],
    valueType: 'boolean',
    allowedOperators: ['EQ'],
  },
  capacity_l: {
    field: 'capacity_l',
    categories: ['BACKPACK'],
    valueType: 'number',
    canonicalUnit: 'L',
    allowedOperators: ['GTE', 'LTE', 'EQ'],
    min: 0,
  },
  rain_cover: {
    field: 'rain_cover',
    categories: ['BACKPACK'],
    valueType: 'boolean',
    allowedOperators: ['EQ'],
  },
  sleeping_places: {
    field: 'sleeping_places',
    categories: ['TENT'],
    valueType: 'number',
    allowedOperators: ['GTE', 'LTE', 'EQ'],
    min: 1,
  },
  flysheet_waterproof_mm: {
    field: 'flysheet_waterproof_mm',
    categories: ['TENT'],
    valueType: 'number',
    canonicalUnit: 'mm',
    allowedOperators: ['GTE', 'LTE', 'EQ'],
    min: 0,
  },
  floor_waterproof_mm: {
    field: 'floor_waterproof_mm',
    categories: ['TENT'],
    valueType: 'number',
    canonicalUnit: 'mm',
    allowedOperators: ['GTE', 'LTE', 'EQ'],
    min: 0,
  },
  adjustable: {
    field: 'adjustable',
    categories: ['TREKKING_POLE'],
    valueType: 'boolean',
    allowedOperators: ['EQ'],
  },
  length_min_cm: {
    field: 'length_min_cm',
    categories: ['TREKKING_POLE'],
    valueType: 'number',
    canonicalUnit: 'cm',
    allowedOperators: ['GTE', 'LTE', 'EQ'],
    min: 0,
  },
  length_max_cm: {
    field: 'length_max_cm',
    categories: ['TREKKING_POLE'],
    valueType: 'number',
    canonicalUnit: 'cm',
    allowedOperators: ['GTE', 'LTE', 'EQ'],
    min: 0,
  },
  coverage: {
    field: 'coverage',
    categories: ['RAIN_GEAR'],
    valueType: 'string',
    allowedOperators: ['EQ'],
  },
};

export class ConstraintValidationError extends Error {
  readonly code = 'INVALID_CONSTRAINT_CONFIGURATION';
  constructor(message: string) {
    super(message);
    this.name = 'ConstraintValidationError';
  }
}

export interface RequirementConstraintInput {
  id: string;
  requirementId?: string;
  category?: GearCategory;
  field: string;
  operator: string;
  expected: number | string | boolean;
  unit?: string;
  source?: string;
  reference?: string;
  evidence?: string;
}

export interface ConstraintSubjectInput {
  id: string;
  category: GearCategory;
  attributes: Record<string, unknown>;
}

export interface ConstraintEvaluationResult {
  constraintId: string;
  requirementId: string;
  subjectId: string;
  category: GearCategory;
  ruleNamespace: 'GR-CONSTRAINT-GTE' | 'GR-CONSTRAINT-LTE' | 'GR-CONSTRAINT-EQ';
  field: string;
  operator: ConstraintOperator;
  expected: number | string | boolean;
  actual: unknown;
  unit?: string;
  status: ConstraintEvaluationStatus;
  source: ConstraintSourceType;
  reference: string;
  message?: string;
}

export interface SubjectRequirementEvaluationResult {
  subjectId: string;
  requirementId: string;
  category: GearCategory;
  status: ConstraintEvaluationStatus;
  constraintResults: ConstraintEvaluationResult[];
}

const ALLOWED_SOURCES: readonly ConstraintSourceType[] = [
  'USER_REQUEST',
  'TRIP_OFFICIAL',
  'TEAM_POLICY_ASSUMPTION',
  'MANUFACTURER_FACT',
];

/**
 * Validates a constraint configuration strictly against canonical schemas, categories, and units.
 * Rejects invalid operators, cross-category fields, wrong types, non-finite numbers, and unit mismatches.
 */
export function validateConstraintConfiguration(
  constraint: RequirementConstraintInput,
  category?: GearCategory
): {
  fieldDef: CanonicalFieldDefinition;
  operator: ConstraintOperator;
  source: ConstraintSourceType;
  reference: string;
  targetCategory: GearCategory;
} {
  // 1. Validate operator
  if (
    constraint.operator !== 'GTE' &&
    constraint.operator !== 'LTE' &&
    constraint.operator !== 'EQ'
  ) {
    throw new ConstraintValidationError(
      `Invalid constraint operator '${constraint.operator}'. Allowed operators: GTE, LTE, EQ.`
    );
  }
  const operator: ConstraintOperator = constraint.operator;

  // 2. Validate field existence
  const fieldDef = CANONICAL_FIELD_DEFINITIONS[constraint.field];
  if (!fieldDef) {
    throw new ConstraintValidationError(
      `Unknown constraint field '${constraint.field}'. Field is not defined in canonical catalog.`
    );
  }

  // 3. Determine target category and validate cross-category
  const targetCategory = category ?? constraint.category;
  if (!targetCategory) {
    throw new ConstraintValidationError(
      `Constraint for field '${constraint.field}' must have a category specified.`
    );
  }
  if (!fieldDef.categories.includes(targetCategory)) {
    throw new ConstraintValidationError(
      `Field '${constraint.field}' is not allowed for category '${targetCategory}'. Allowed categories: ${fieldDef.categories.join(', ')}.`
    );
  }

  // 4. Validate operator applicability to field type
  if (!fieldDef.allowedOperators.includes(operator)) {
    throw new ConstraintValidationError(
      `Operator '${operator}' is not allowed for field '${constraint.field}'. Allowed operators: ${fieldDef.allowedOperators.join(', ')}.`
    );
  }

  // 5. Validate expected value type and bounds
  if (fieldDef.valueType === 'number') {
    if (
      typeof constraint.expected !== 'number' ||
      !Number.isFinite(constraint.expected) ||
      Number.isNaN(constraint.expected)
    ) {
      throw new ConstraintValidationError(
        `Expected value for numeric field '${constraint.field}' must be a finite number, got '${typeof constraint.expected}'.`
      );
    }
    if (fieldDef.min !== undefined && constraint.expected < fieldDef.min) {
      throw new ConstraintValidationError(
        `Expected value ${constraint.expected} for field '${constraint.field}' is below minimum ${fieldDef.min}.`
      );
    }
    if (fieldDef.max !== undefined && constraint.expected > fieldDef.max) {
      throw new ConstraintValidationError(
        `Expected value ${constraint.expected} for field '${constraint.field}' exceeds maximum ${fieldDef.max}.`
      );
    }
  } else if (fieldDef.valueType === 'boolean') {
    if (typeof constraint.expected !== 'boolean') {
      throw new ConstraintValidationError(
        `Expected value for boolean field '${constraint.field}' must be a boolean, got '${typeof constraint.expected}'.`
      );
    }
  } else if (fieldDef.valueType === 'string') {
    if (typeof constraint.expected !== 'string' || constraint.expected.trim() === '') {
      throw new ConstraintValidationError(
        `Expected value for string field '${constraint.field}' must be a non-empty string.`
      );
    }
  }

  // 6. Validate canonical unit compatibility
  if (fieldDef.canonicalUnit) {
    if (constraint.unit) {
      if (constraint.unit.trim().toLowerCase() !== fieldDef.canonicalUnit.toLowerCase()) {
        throw new ConstraintValidationError(
          `Unit mismatch for field '${constraint.field}': constraint specifies '${constraint.unit}', but canonical unit is '${fieldDef.canonicalUnit}'.`
        );
      }
    }
  } else if (constraint.unit) {
    throw new ConstraintValidationError(
      `Field '${constraint.field}' is dimensionless and cannot accept a unit ('${constraint.unit}').`
    );
  }

  // 7. Validate provenance source and reference
  const source = (constraint.source ?? 'USER_REQUEST') as ConstraintSourceType;
  if (!ALLOWED_SOURCES.includes(source)) {
    throw new ConstraintValidationError(
      `Invalid constraint source '${constraint.source}'. Allowed sources: ${ALLOWED_SOURCES.join(', ')}.`
    );
  }
  const reference = constraint.reference ?? constraint.evidence ?? 'User configured constraint';
  if (typeof reference !== 'string' || reference.trim() === '') {
    throw new ConstraintValidationError(
      `Constraint provenance reference must be a non-empty string.`
    );
  }

  return { fieldDef, operator, source, reference, targetCategory };
}

/**
 * Pure evaluation function for a single requirement constraint against a specific subject (item).
 * Strictly preserves item identity, verifies canonical types, handles unknown without coercion to 0.
 */
export function evaluateRequirementConstraint(
  constraint: RequirementConstraintInput,
  subject: ConstraintSubjectInput
): ConstraintEvaluationResult {
  const { fieldDef, operator, source, reference, targetCategory } =
    validateConstraintConfiguration(constraint, subject.category);

  const requirementId = constraint.requirementId ?? constraint.id;
  const ruleNamespace = `GR-CONSTRAINT-${operator}` as const;
  const actual = subject.attributes[constraint.field];

  // If actual is null or undefined -> UNKNOWN (not 0, not false)
  if (actual === null || actual === undefined) {
    return {
      constraintId: constraint.id,
      requirementId,
      subjectId: subject.id,
      category: targetCategory,
      ruleNamespace,
      field: constraint.field,
      operator,
      expected: constraint.expected,
      actual: null,
      unit: fieldDef.canonicalUnit,
      status: 'UNKNOWN',
      source,
      reference,
      message: `Thông số ${constraint.field} chưa có dữ liệu để đánh giá ràng buộc.`,
    };
  }

  let status: ConstraintEvaluationStatus = 'UNKNOWN';

  if (fieldDef.valueType === 'number') {
    if (typeof actual === 'number' && Number.isFinite(actual) && !Number.isNaN(actual)) {
      const exp = constraint.expected as number;
      if (operator === 'GTE') {
        status = actual >= exp ? 'SATISFIED' : 'NOT_SATISFIED';
      } else if (operator === 'LTE') {
        status = actual <= exp ? 'SATISFIED' : 'NOT_SATISFIED';
      } else if (operator === 'EQ') {
        status = actual === exp ? 'SATISFIED' : 'NOT_SATISFIED';
      }
    } else {
      // Type mismatch on actual value
      status = 'NOT_SATISFIED';
    }
  } else if (fieldDef.valueType === 'boolean') {
    if (typeof actual === 'boolean') {
      status = actual === constraint.expected ? 'SATISFIED' : 'NOT_SATISFIED';
    } else {
      status = 'NOT_SATISFIED';
    }
  } else if (fieldDef.valueType === 'string') {
    if (typeof actual === 'string') {
      status =
        actual.trim().toLowerCase() === String(constraint.expected).trim().toLowerCase()
          ? 'SATISFIED'
          : 'NOT_SATISFIED';
    } else {
      status = 'NOT_SATISFIED';
    }
  }

  return {
    constraintId: constraint.id,
    requirementId,
    subjectId: subject.id,
    category: targetCategory,
    ruleNamespace,
    field: constraint.field,
    operator,
    expected: constraint.expected,
    actual,
    unit: fieldDef.canonicalUnit,
    status,
    source,
    reference,
  };
}

/**
 * Evaluates all constraints for a specific requirement on a single subject.
 * Evaluates constraints with AND logic on the exact subject identity without cross-item contamination.
 */
export function evaluateSubjectRequirementConstraints(
  subject: ConstraintSubjectInput,
  requirementId: string,
  constraints: RequirementConstraintInput[]
): SubjectRequirementEvaluationResult {
  const constraintResults = constraints.map((c) =>
    evaluateRequirementConstraint({ ...c, requirementId }, subject)
  );

  let status: ConstraintEvaluationStatus = 'SATISFIED';

  if (constraintResults.some((r) => r.status === 'NOT_SATISFIED')) {
    status = 'NOT_SATISFIED';
  } else if (constraintResults.some((r) => r.status === 'UNKNOWN')) {
    status = 'UNKNOWN';
  }

  return {
    subjectId: subject.id,
    requirementId,
    category: subject.category,
    status,
    constraintResults,
  };
}

