export const EQUIPMENT_UNIT_PORT = Symbol('EQUIPMENT_UNIT_PORT');

export type EquipmentUnitStatusValue = 
  | 'AVAILABLE' | 'PICKED' | 'PACKED' | 'RENTED' 
  | 'RETURN_PENDING' | 'CLEANING' | 'MAINTENANCE' 
  | 'DAMAGED' | 'LOST' | 'RETIRED';

export type EquipmentConditionValue = 'NEW' | 'GOOD' | 'FAIR' | 'DAMAGED' | 'LOST';

export interface EquipmentUnitView {
  id: string;
  assetCode: string;
  qrCode: string | null;
  serialNumber: string | null;

  product: {
    id: string;
    sku: string;
    name: string;
  };

  homeInventoryLocation: {
    id: string;
    code: string;
    name: string;
  };

  currentInventoryLocation: {
    id: string;
    code: string;
    name: string;
  } | null;

  status: EquipmentUnitStatusValue;
  condition: EquipmentConditionValue;

  expectedReadyAt: string | null;
  acquiredAt: string | null;
  retiredAt: string | null;

  version: number;
}

export interface EquipmentUnitHistoryEvent {
  type: string;
  occurredAt: string;
  actor?: string;
  details?: Record<string, unknown>;
}

export interface ListEquipmentUnitsParams {
  page: number;
  pageSize: number;
  productId?: string;
  status?: EquipmentUnitStatusValue;
  condition?: EquipmentConditionValue;
  inventoryLocationId?: string;
  q?: string;
}

export interface EquipmentUnitCounts {
  total: number;
  available: number;
  picked: number;
  packed: number;
  rented: number;
  returnPending: number;
  cleaning: number;
  maintenance: number;
  damaged: number;
  lost: number;
  retired: number;
}

export interface PaginatedEquipmentUnitResult {
  items: EquipmentUnitView[];
  pagination: {
    page: number;
    pageSize: number;
    totalItems: number;
    totalPages: number;
  };
  counts: EquipmentUnitCounts;
}

export interface CreateEquipmentUnitPayload {
  productId: string;
  homeInventoryLocationId: string;
  currentInventoryLocationId: string;
  assetCode: string;
  qrCode: string;
  serialNumber?: string;
  condition: EquipmentConditionValue;
  status: EquipmentUnitStatusValue;
  acquiredAt?: string;
}

export interface UpdateEquipmentUnitMetadataInput {
  id: string;
  expectedVersion: number;
  homeInventoryLocationId?: string;
  serialNumber?: string | null;
  acquiredAt?: string | null;
}

export interface BatchCreateEquipmentUnitItem {
  productId: string;
  homeInventoryLocationId: string;
  currentInventoryLocationId: string;
  assetCode: string;
  qrCode: string;
  serialNumber?: string;
  condition: EquipmentConditionValue;
  status: EquipmentUnitStatusValue;
  acquiredAt?: string;
}

export interface MaintenanceRecordView {
  id: string;
  status: 'OPEN' | 'IN_PROGRESS' | 'COMPLETED' | 'CANCELLED';
  reason: string;
  notes: string | null;
  startAt: string;
  completedAt: string | null;
  version: number;
}

export interface StartMaintenancePayload {
  unitId: string;
  expectedVersion: number;
  inventoryLocationId: string;
  staffId: string;
  reason: string;
  notes?: string | null;
}

export interface CompleteMaintenancePayload {
  unitId: string;
  expectedVersion: number;
  resultingCondition: EquipmentConditionValue;
}

export interface ChangeMaintenancePortResult {
  unit: EquipmentUnitView;
  maintenance: MaintenanceRecordView;
}

export interface DowngradeUnitGradePayload {
  unitId: string;
  expectedVersion: number;
  actorId: string;
  idempotencyKey: string;
  reason: string;
  note?: string;
  evidenceIds?: string[];
}

export interface DowngradeUnitGradeResult {
  unit: EquipmentUnitView;
  gradeReview: {
    id: string;
    decision: 'DOWNGRADE';
    fromProductId: string;
    toProductId: string;
    shortageOrderIds: string[];
  };
}

export interface EquipmentUnitPort {
  listUnits(params: ListEquipmentUnitsParams): Promise<{ items: EquipmentUnitView[]; total: number; counts: EquipmentUnitCounts }>;
  getUnitById(id: string): Promise<EquipmentUnitView | null>;
  getUnitsByIds(ids: string[]): Promise<EquipmentUnitView[]>;
  findByAssetCode(assetCode: string): Promise<EquipmentUnitView | null>;
  createUnit(payload: CreateEquipmentUnitPayload): Promise<EquipmentUnitView>;
  createBatch(payloads: BatchCreateEquipmentUnitItem[]): Promise<EquipmentUnitView[]>;
  updateMetadata(input: UpdateEquipmentUnitMetadataInput): Promise<EquipmentUnitView>;
  getHistory(id: string): Promise<EquipmentUnitHistoryEvent[]>;
  startMaintenance(payload: StartMaintenancePayload): Promise<ChangeMaintenancePortResult>;
  completeMaintenance(payload: CompleteMaintenancePayload): Promise<ChangeMaintenancePortResult>;
  downgradeGrade(payload: DowngradeUnitGradePayload): Promise<DowngradeUnitGradeResult>;
}
