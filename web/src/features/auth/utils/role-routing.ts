import { UserRole } from "../types/auth.types";

const ROLE_DASHBOARDS: Record<string, string> = {
  [UserRole.USER]: "/dashboard",
  [UserRole.LEADER]: "/leader",
  [UserRole.ADMIN]: "/admin",
  [UserRole.STAFF]: "/staff",
  [UserRole.STAFF_INVENTORY]: "/staff",
  [UserRole.STAFF_DELIVERY]: "/delivery",
};

export const getDashboardForRole = (role?: string | null): string => {
  const normalizedRole = role?.trim().toUpperCase();
  return ROLE_DASHBOARDS[normalizedRole ?? ""] ?? "/public/login";
};
