import { Ionicons } from "@expo/vector-icons";
import { Tabs } from "expo-router";
import {
  type ColorValue,
  Platform,
  StyleSheet,
  View,
} from "react-native";

import { Colors, Radius, Shadows } from "@/constants/theme";
import { useApp } from "@/context/AppContext";
import { useAuth } from "@/features/auth/AuthContext";

export default function TabLayout() {
  const { user } = useApp();
  const { user: authUser } = useAuth();
  const isLeader = authUser?.role === "LEADER" || user.role === "LEADER";

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarShowLabel: true,
        tabBarActiveTintColor: Colors.ink,
        tabBarInactiveTintColor: Colors.onSurfaceMuted,
        tabBarStyle: {
          height: Platform.OS === "ios" ? 84 : 64,
          paddingTop: 8,
          paddingBottom: Platform.OS === "ios" ? 24 : 8,
          borderTopWidth: 1,
          borderTopColor: "rgba(0, 0, 0, 0.06)",
          backgroundColor: "rgba(251, 249, 243, 0.98)",
          ...Shadows.card,
        },
        tabBarLabelStyle: {
          marginTop: 2,
          fontSize: 9,
          fontWeight: "700",
        },
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: "Home",
          tabBarIcon: ({ focused, color }) => (
            <TabIcon
              focused={focused}
              color={color}
              activeIcon="home"
              inactiveIcon="home-outline"
            />
          ),
        }}
      />

      <Tabs.Screen
        name="explore"
        options={{
          title: "Explore",
          tabBarIcon: ({ focused, color }) => (
            <TabIcon
              focused={focused}
              color={color}
              activeIcon="compass"
              inactiveIcon="compass-outline"
            />
          ),
        }}
      />

      <Tabs.Screen
        name="community"
        options={{
          title: "Community",
          tabBarIcon: ({ focused, color }) => (
            <TabIcon
              focused={focused}
              color={color}
              activeIcon="people"
              inactiveIcon="people-outline"
            />
          ),
        }}
      />

      <Tabs.Screen
        name="trips"
        options={{
          title: isLeader ? "Chuyến đi" : "Trips",
          tabBarIcon: ({ focused, color }) => (
            <TabIcon
              focused={focused}
              color={color}
              activeIcon="trail-sign"
              inactiveIcon="trail-sign-outline"
            />
          ),
        }}
      />

      <Tabs.Screen
        name="rental"
        options={{
          title: isLeader ? "Điều hành" : "Rental",
          tabBarIcon: ({ focused, color }) => (
            <TabIcon
              focused={focused}
              color={color}
              activeIcon={isLeader ? "shield-checkmark" : "basket"}
              inactiveIcon={isLeader ? "shield-checkmark-outline" : "basket-outline"}
            />
          ),
        }}
      />

      <Tabs.Screen
        name="profile"
        options={{
          title: "Profile",
          tabBarIcon: ({ focused, color }) => (
            <TabIcon
              focused={focused}
              color={color}
              activeIcon="person"
              inactiveIcon="person-outline"
            />
          ),
        }}
      />
    </Tabs>
  );
}

function TabIcon({
  focused,
  color,
  activeIcon,
  inactiveIcon,
}: {
  focused: boolean;
  color: ColorValue;
  activeIcon: keyof typeof Ionicons.glyphMap;
  inactiveIcon: keyof typeof Ionicons.glyphMap;
}) {
  const iconColor =
    typeof color === "number" || color == null
      ? Colors.onSurface
      : color;

  return (
    <View style={[styles.iconContainer, focused && styles.iconActiveContainer]}>
      <Ionicons
        name={focused ? activeIcon : inactiveIcon}
        size={19}
        color={focused ? Colors.onPrimary : iconColor}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  iconContainer: {
    width: 34,
    height: 27,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: Radius.full,
  },
  iconActiveContainer: {
    backgroundColor: Colors.primary,
  },
});
