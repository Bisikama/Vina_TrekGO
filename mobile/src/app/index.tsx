import { useApp } from "@/context/AppContext";
import { useAuth } from "@/features/auth/AuthContext";
import { Redirect, type Href } from "expo-router";

export default function RootIndex() {
  const { isAuthenticated, user } = useAuth();
  const { authRole } = useApp();

  const effectiveRole = user?.role || authRole;

  if (isAuthenticated || authRole) {
    if (effectiveRole === "STAFF_INVENTORY") {
      return <Redirect href={"/inventory-operations" as Href} />;
    }
    if (effectiveRole === "STAFF_DELIVERY" || effectiveRole === "LEADER") {
      return <Redirect href={"/field-operations" as Href} />;
    }
    return <Redirect href="/(tabs)" />;
  }

  return <Redirect href="/auth/login" />;
}
