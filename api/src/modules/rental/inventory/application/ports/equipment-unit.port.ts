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
    /** Ngưỡng hao mòn của sản phẩm; null = không giới hạn. */
    maxRentalCycles: number | null;
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

  /** Mã lô nhập (các unit nhập cùng đợt dùng chung). */
  intakeBatchCode: string | null;
  /** Hạn dùng (YYYY-MM-DD): từ ngày này unit không còn được cho thuê. */
  expiresAt: string | null;
  isExpired: boolean;
  /** Ghi chú thực trạng riêng của unit lúc nhập. */
  conditionNotes: string | null;
  /** Số lượt thuê đã hoàn tất. */
  rentalCount: number;
  /** rentalCount / maxRentalCycles (0–100); null khi sản phẩm không đặt ngưỡng. */
  wearPercent: number | null;

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
  batchCode?: string;
  /** YYYY-MM-DD: chỉ lấy unit có hạn dùng trước hoặc đúng ngày này. */
  expiringBefore?: string;
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
  /**
   * Món còn trong vòng cho thuê (không LOST/RETIRED) đã hoặc sẽ hết hạn dùng trong 30 ngày (lịch VN).
   * Tính trên toàn kho, không theo bộ lọc, để kho luôn thấy cảnh báo.
   */
  expiringSoon: number;
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
  batchCode?: string;
  expiresAt?: string;
  conditionNotes?: string;
}

export interface UpdateEquipmentUnitMetadataInput {
  id: string;
  expectedVersion: number;
  homeInventoryLocationId?: string;
  serialNumber?: string | null;
  acquiredAt?: string | null;
  batchCode?: string | null;
  expiresAt?: string | null;
  conditionNotes?: string | null;
  /** Người sửa: kéo dài/xoá hạn dùng chỉ ADMIN; thay đổi hạn dùng được ghi audit. */
  actorId: string;
  actorRole: string;
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
  batchCode?: string;
  expiresAt?: string;
  conditionNotes?: string;
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
  /** Ngừng sử dụng (RETIRED) thay vì về kệ. */
  retire?: boolean;
  actorId?: string;
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
  /** AVAILABLE units whose shelf life has run out become RETIRED. Returns how many were withdrawn. */
  retireExpiredUnits(now: Date): Promise<number>;
}
