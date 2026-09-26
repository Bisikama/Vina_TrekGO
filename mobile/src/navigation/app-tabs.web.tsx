import {
  Tabs,
  TabList,
  TabTrigger,
  TabSlot,
  TabListProps,
  TabTriggerSlotProps,
} from "expo-router/ui";
import { Pressable, StyleSheet, View } from "react-native";

import { ThemedText } from "@/components/themed-text";

function AppTabs() {
  return (
    <Tabs>
      <TabSlot style={styles.slot} />
      <TabList asChild>
        <WebNavigation>
          <TabTrigger name="home" href="/" asChild>
            <NavLink>Thuê thiết bị</NavLink>
          </TabTrigger>
          <TabTrigger name="explore" href="/explore" asChild>
            <NavLink>Khám phá</NavLink>
          </TabTrigger>
        </WebNavigation>
      </TabList>
    </Tabs>
  );
}

export default AppTabs;

function NavLink({ children, isFocused, ...props }: TabTriggerSlotProps) {
  return (
    <Pressable
      {...props}
      style={({ pressed }) => [
        styles.navLink,
        isFocused && styles.navLinkActive,
        pressed && styles.pressed,
      ]}
    >
      <ThemedText
        style={[styles.navLinkText, isFocused && styles.navLinkTextActive]}
      >
        {children}
      </ThemedText>
    </Pressable>
  );
}

function WebNavigation(props: TabListProps) {
  return (
    <View {...props} style={styles.header}>
      <View style={styles.statusBar}>
        <ThemedText style={styles.statusText}>
          Khám phá cung đường leo núi Việt Nam
        </ThemedText>
        <View style={styles.statusItems}>
          <ThemedText style={styles.statusText}>● Hệ thống an toàn</ThemedText>
          <ThemedText style={styles.statusText}>
            Thời tiết tốt · 24°C
          </ThemedText>
        </View>
      </View>
      <View style={styles.navigation}>
        <View style={styles.brand}>
                    <View style={styles.brandMark}>
            <ThemedText style={styles.brandLetter}>V</ThemedText>
          </View>
          <View>
            <ThemedText style={styles.brandName}>Trekking System</ThemedText>
            <ThemedText style={styles.brandTagline}>
              VIETNAM OUTDOORS
            </ThemedText>
          </View>
        </View>
        <View style={styles.links}>{props.children}</View>
        <View style={styles.accountArea}>
          <View style={styles.sosButton}>
            <ThemedText style={styles.sosText}>SOS</ThemedText>
          </View>
          <View style={styles.avatar}>
            <ThemedText style={styles.avatarText}>NH</ThemedText>
          </View>
          <View>
            <ThemedText style={styles.userName}>Nguyễn Hùng</ThemedText>
            <ThemedText style={styles.userRole}>Thành viên</ThemedText>
          </View>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  slot: { height: "100%" },
  header: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    zIndex: 20,
    backgroundColor: "#ffffff",
    borderBottomWidth: 1,
    borderBottomColor: "#e4e9e6",
  },
  statusBar: {
    minHeight: 28,
    paddingHorizontal: 32,
    backgroundColor: "#125238",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  statusItems: { flexDirection: "row", gap: 24 },
  statusText: { color: "#e8f3ed", fontSize: 11 },
  navigation: {
    width: "100%",
    maxWidth: 1320,
    minHeight: 72,
    paddingHorizontal: 28,
    alignSelf: "center",
    flexDirection: "row",
    alignItems: "center",
  },
  brand: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    marginRight: 44,
  },
  brandMark: {
    width: 38,
    height: 38,
    borderRadius: 12,
    backgroundColor: "#125238",
    alignItems: "center",
    justifyContent: "center",
  },
  brandLetter: { color: "#ffffff", fontWeight: "900", fontSize: 20 },
  brandName: { color: "#173d2d", fontWeight: "800", fontSize: 14 },
  brandTagline: { color: "#718078", fontSize: 8, letterSpacing: 1.2 },
  links: { flexDirection: "row", alignItems: "center", gap: 6, flex: 1 },
  navLink: {
    paddingHorizontal: 13,
    paddingVertical: 25,
    borderBottomWidth: 3,
    borderBottomColor: "transparent",
  },
  navLinkActive: { borderBottomColor: "#125238" },
  navLinkText: { color: "#5d6b64", fontSize: 13, fontWeight: "600" },
  navLinkTextActive: { color: "#125238" },
  accountArea: { flexDirection: "row", alignItems: "center", gap: 9 },
  sosButton: {
    paddingHorizontal: 13,
    paddingVertical: 8,
    borderRadius: 9,
    backgroundColor: "#fff0ed",
  },
  sosText: { color: "#b83828", fontWeight: "800", fontSize: 12 },
  avatar: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: "#dcebe3",
    alignItems: "center",
    justifyContent: "center",
  },
  avatarText: { color: "#125238", fontSize: 11, fontWeight: "800" },
  userName: { color: "#25362e", fontSize: 12, fontWeight: "700" },
  userRole: { color: "#7e8b84", fontSize: 10 },
  pressed: { opacity: 0.7 },
});
