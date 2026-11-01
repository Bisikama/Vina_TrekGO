import { apiClient } from "@/lib/axios";

// Phương án thuê bù đồ còn thiếu của Gear Advisor (POST /gear/plans/{id}/options).
// Mọi số tiền là ƯỚC TÍNH theo giá tại thời điểm tạo phương án; báo giá chính thức mới là số chốt.

type Envelope<T> = T | { data: T };
const unwrap = <T,>(payload: Envelope<T>) =>
  payload && typeof payload === "object" && "data" in payload
    ? (payload as { data: T }).data
    : (payload as T);

export type GearRentalLine = {
  requirementId?: string;
  category?: string;
  productId: string;
  productName: string;
  quantity: number;
  dailyPrice?: number;
  rentalFee?: number;
  /** Tiền cọc cả dòng. `deposit` là tên cũ (deprecated), chỉ dùng khi thiếu `depositAmount`. */
  depositAmount?: number;
  deposit?: number;
  depositPerUnit?: number;
  replacementValue?: number;
  depositExplanation?: { percentageOfReplacementValue: number | null; formula?: string } | null;
  availableCount?: number;
  grade?: "LIKE_NEW" | "GOOD_USED" | null;
};

export type GearRentalOption = {
  id: string;
  rentalLines: GearRentalLine[];
  summary?: Record<string, unknown>;
};

export type GearRentalOptionSet = {
  setId: string;
  revision?: number;
  expiresAt?: string;
  options: GearRentalOption[];
};

export const lineDepositAmount = (line: GearRentalLine) =>
  typeof line.depositAmount === "number" ? line.depositAmount : typeof line.deposit === "number" ? line.deposit : null;

export async function generateGearRentalOptions(planId: string, expectedRevision: number) {
  const response = await apiClient.post<Envelope<GearRentalOptionSet>>(
    `/api/v1/gear/plans/${encodeURIComponent(planId)}/options`,
    { expectedRevision, objective: "BALANCED" },
  );
  return unwrap(response.data);
}
