import { Colors } from "@/constants/theme";
import { AppProvider, useApp } from "@/context/AppContext";
import { AuthProvider, useAuth } from "@/features/auth/AuthContext";
import { RentalSelectionProvider } from "@/features/rentals/RentalSelectionContext";
import { Stack, useRouter, useSegments, type Href } from "expo-router";
import { StatusBar } from "expo-status-bar";
import React, { useEffect, useState } from "react";
import { ActivityIndicator, Platform, StyleSheet, Text, TextInput, View } from "react-native";
import * as SQLite from "expo-sqlite";
import { useDrizzleStudio } from "expo-drizzle-studio-plugin";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { getDatabase } from "@/services/storage/recordingDatabase";
import "@/services/location/backgroundLocationTask";
import { TripGpsLifecycle } from '@/features/trip-gps/TripGpsLifecycle';

// Global font setup: Áp dụng font Roboto cho toàn bộ Text và TextInput của dự án
const defaultFont = Platform.select({
  ios: "Roboto",
  android: "Roboto",
  default: "Roboto, system-ui, sans-serif",
});

if ((Text as any).defaultProps == null) {
  (Text as any).defaultProps = {};
}
(Text as any).defaultProps.style = [
  { fontFamily: defaultFont },
  (Text as any).defaultProps.style,
];

if ((TextInput as any).defaultProps == null) {
  (TextInput as any).defaultProps = {};
}
(TextInput as any).defaultProps.style = [
  { fontFamily: defaultFont },
  (TextInput as any).defaultProps.style,
];
export default function RootLayout() {
  const [db, setDb] = useState<SQLite.SQLiteDatabase | null>(null);

  useEffect(() => {
    getDatabase()
      .then((database) => {
        setDb(database);
        if (__DEV__) {
          console.log("[SQLite] Drizzle Studio sẵn sàng: http://localhost:8081/_expo/plugins/expo-drizzle-studio-plugin");
          console.log("[AsyncStorage] DevTools sẵn sàng: http://localhost:8081/_expo/plugins/@dev-plugins/async-storage");
        }
      })
      .catch((err) => {
        console.warn("[RootLayout] Khởi tạo SQLite cho Drizzle Studio thất bại:", err);
      });
  }, []);

  useDrizzleStudio(db);
  

  return (
    <SafeAreaProvider>
      <AuthProvider>
        <TripGpsLifecycle />
        <AppProvider>
          <RentalSelectionProvider>
            <RootNavigator />
          </RentalSelectionProvider>
        </AppProvider>
      </AuthProvider>
    </SafeAreaProvider>

  );
}

function RootNavigator() {
  const router = useRouter();
  const segments = useSegments();
  const { isAuthenticated, isLoading, user } = useAuth();
  const { authRole } = useApp();

  useEffect(() => {
    if (isLoading) return;

    const rootSegment = (segments[0] as string | undefined) || "";
    const isInAuthGroup = rootSegment === "auth";
    const isInFieldOps = rootSegment === "field-operations";
    const isInInventoryOps = rootSegment === "inventory-operations";
    const isInTabs = rootSegment === "(tabs)";

    // Determine current effective role (from auth token or mock switcher)
    const effectiveRole = user?.role || authRole;

    if (!isAuthenticated && !authRole && !isInAuthGroup) {
      router.replace("/auth/login" as Href);
      return;
    }

    if (isAuthenticated || authRole) {
      // Role-based routing when logged in
      if (effectiveRole === "STAFF_INVENTORY") {
        if (!isInInventoryOps) {
          router.replace("/inventory-operations" as Href);
        }
      } else if (effectiveRole === "STAFF_DELIVERY") {
        // Staff Delivery is dedicated to field-operations
        if (isInAuthGroup || isInTabs) {
          router.replace("/field-operations" as Href);
        }
      } else if (effectiveRole === "LEADER") {
        if (isInAuthGroup) {
          router.replace("/field-operations" as Href);
        }
      } else {
        // Regular User / Trekker should not access field-operations
        if (isInAuthGroup || isInFieldOps || isInInventoryOps) {
          router.replace("/(tabs)" as Href);
        }
      }
    }
  }, [isAuthenticated, isLoading, router, segments, user, authRole]);

  if (isLoading) {
    return (
      <View style={styles.loadingContainer}>
        <StatusBar style="light" />
        <ActivityIndicator size="large" color={Colors.primary} />
        <Text style={styles.loadingText}>Đang khôi phục phiên TrekGo...</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <StatusBar style="dark" />
      <Stack
        screenOptions={{
          headerShown: false,
          contentStyle: { backgroundColor: Colors.surface },
          animation: Platform.OS === "ios" ? "default" : "fade",
        }}
      >
        <Stack.Screen name="index" options={{ headerShown: false }} />
        <Stack.Screen name="auth" options={{ headerShown: false }} />
        <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
        <Stack.Screen name="field-operations" options={{ headerShown: false }} />
        <Stack.Screen name="inventory-operations" options={{ headerShown: false }} />
        <Stack.Screen
          name="navigation"
          options={{
            headerShown: false,
            presentation: "fullScreenModal",
            animation: "slide_from_bottom",
          }}
        />
      </Stack>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.surface,
  },
  loadingContainer: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    gap: 14,
    backgroundColor: Colors.inkDeep,
  },
  loadingText: {
    color: Colors.onPrimaryDark,
    fontSize: 12,
    fontWeight: "700",
  },
});
