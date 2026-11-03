import { apiRequest } from "@/lib/api-client";

// Phương án thuê bù đồ còn thiếu (POST /gear/plans/{id}/options). Số tiền là ƯỚC TÍNH.

type Envelope<T> = T | { data: T };

function unwrap<T>(payload: Envelope<T>): T {
  if (payload && typeof payload === "object" && "data" in payload && (payload as { data?: T }).data !== undefined) {
    return (payload as { data: T }).data;
  }
  return payload as T;
}

export type GearRentalLine = {
  requirementId?: string;
  productId: string;
  productName: string;
  quantity: number;
  rentalFee?: number;
  /** Cọc cả dòng; `deposit` là tên cũ (deprecated). */
  depositAmount?: number;
  deposit?: number;
  depositPerUnit?: number;
  depositExplanation?: { percentageOfReplacementValue: number | null } | null;
  grade?: "LIKE_NEW" | "GOOD_USED" | null;
};

export type GearRentalOptionSet = {
  setId: string;
  expiresAt?: string;
  options: { id: string; rentalLines: GearRentalLine[] }[];
};

export const lineDepositAmount = (line: GearRentalLine) =>
  typeof line.depositAmount === "number" ? line.depositAmount : typeof line.deposit === "number" ? line.deposit : null;

export async function generateGearRentalOptions(planId: string, expectedRevision: number, accessToken: string) {
  return unwrap(
    await apiRequest<Envelope<GearRentalOptionSet>>(`/api/v1/gear/plans/${encodeURIComponent(planId)}/options`, {
      method: "POST",
      accessToken,
      body: JSON.stringify({ expectedRevision, objective: "BALANCED" }),
    }),
  );
}
