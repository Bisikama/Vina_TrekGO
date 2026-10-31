import { Colors, Shadows } from "@/constants/theme";
import {
  LeaderCreateTripScreen,
  LeaderDashboardScreen,
  LeaderProfileScreen,
  LeaderTripsScreen,
} from "@/features/leaders/screens";
import { Ionicons } from "@expo/vector-icons";
import React, { useState } from "react";
import { Platform, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

export type LeaderTabKey = "dashboard" | "trips" | "create" | "profile";

interface TabConfig {
  key: LeaderTabKey;
  label: string;
  activeIcon: keyof typeof Ionicons.glyphMap;
  inactiveIcon: keyof typeof Ionicons.glyphMap;
}

const LEADER_TABS: TabConfig[] = [
  {
    key: "dashboard",
    label: "Chỉ huy",
    activeIcon: "grid",
    inactiveIcon: "grid-outline",
  },
  {
    key: "trips",
    label: "Chuyến đi",
    activeIcon: "trail-sign",
    inactiveIcon: "trail-sign-outline",
  },
  {
    key: "create",
    label: "Tạo chuyến",
    activeIcon: "add-circle",
    inactiveIcon: "add-circle-outline",
  },
  {
    key: "profile",
    label: "Cá nhân",
    activeIcon: "person",
    inactiveIcon: "person-outline",
  },
];

interface LeaderNavigationShellProps {
  onLogout?: () => void;
  initialTab?: LeaderTabKey;
}

export function LeaderNavigationShell({
  onLogout,
  initialTab = "dashboard",
}: LeaderNavigationShellProps) {
  const [activeTab, setActiveTab] = useState<LeaderTabKey>(initialTab);
  const insets = useSafeAreaInsets();

  const handleNavigateTab = (tab: LeaderTabKey) => {
    setActiveTab(tab);
  };

  return (
    <View style={styles.container}>
      {/* Vùng nội dung màn hình chính theo Tab */}
      <View style={styles.contentArea}>
        {activeTab === "dashboard" && (
          <LeaderDashboardScreen onNavigateTab={handleNavigateTab} />
        )}
        {activeTab === "trips" && (
          <LeaderTripsScreen onNavigateTab={handleNavigateTab} />
        )}
        {activeTab === "create" && (
          <LeaderCreateTripScreen onNavigateTab={handleNavigateTab} />
        )}
        {activeTab === "profile" && (
          <LeaderProfileScreen onLogout={onLogout} />
        )}
      </View>

      {/* Thanh điều hướng ở dưới (Bottom Navigation Bar) */}
      <View
        style={[
          styles.bottomBar,
          {
            paddingBottom: Math.max(10, insets.bottom),
            height: Platform.OS === "ios" ? 64 + insets.bottom : 64,
          },
        ]}
      >
        {LEADER_TABS.map((tab) => {
          const isActive = activeTab === tab.key;
          const isCreate = tab.key === "create";

          if (isCreate) {
            return (
              <TouchableOpacity
                key={tab.key}
                style={styles.createTabButton}
                activeOpacity={0.88}
                onPress={() => setActiveTab("create")}
              >
                <View style={[styles.createIconCircle, isActive && styles.createIconCircleActive]}>
                  <Ionicons name="add" size={26} color="#0e0f0c" />
                </View>
                <Text style={[styles.tabLabel, isActive && styles.tabLabelActive]}>
                  {tab.label}
                </Text>
              </TouchableOpacity>
            );
          }

          return (
            <TouchableOpacity
              key={tab.key}
              style={styles.tabButton}
              activeOpacity={0.75}
              onPress={() => setActiveTab(tab.key)}
            >
              <Ionicons
                name={isActive ? tab.activeIcon : tab.inactiveIcon}
                size={22}
                color={isActive ? "#0e0f0c" : "#868685"}
              />
              <Text style={[styles.tabLabel, isActive && styles.tabLabelActive]}>
                {tab.label}
              </Text>
            </TouchableOpacity>
          );
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#e8ebe6", // Sage canvas soft
  },
  contentArea: {
    flex: 1,
  },
  bottomBar: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-around",
    backgroundColor: "#ffffff",
    borderTopWidth: 1,
    borderTopColor: "rgba(14, 15, 12, 0.08)",
    ...Shadows.card,
    paddingTop: 6,
  },
  tabButton: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    gap: 3,
  },
  createTabButton: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    marginTop: -16,
    gap: 2,
  },
  createIconCircle: {
    width: 46,
    height: 46,
    borderRadius: 23,
    backgroundColor: "#9fe870", // Wise lime green
    alignItems: "center",
    justifyContent: "center",
    ...Shadows.card,
  },
  createIconCircleActive: {
    backgroundColor: "#cdffad",
    transform: [{ scale: 1.05 }],
  },
  tabLabel: {
    fontSize: 10,
    fontWeight: "600",
    color: "#868685",
  },
  tabLabelActive: {
    color: "#0e0f0c",
    fontWeight: "800",
  },
});
