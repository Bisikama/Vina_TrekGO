/**
 * ModalShell & ConfirmModal — hộp thoại chuẩn thay thế hoàn toàn Alert.alert
 * cho các thao tác quan trọng (hủy chuyến, rời nhóm, hủy đặt chỗ, thu hồi lời mời).
 * Nền mờ rgba(17, 24, 39, 0.55), card radius 16 (đồng bộ web).
 */
import { type ReactNode } from "react";
import {
  Modal,
  Pressable,
  StyleSheet,
  Text,
  View,
  type StyleProp,
  type TextStyle,
  type ViewStyle,
} from "react-native";

import { Button } from "./Button";
import { Colors, Radius, Spacing } from "@/constants/designTokens";

const OVERLAY_COLOR = "rgba(17, 24, 39, 0.55)";

// ─── ModalShell ───────────────────────────────────────────────────────────────
export interface ModalShellProps {
  visible: boolean;
  /** Ẩn modal; bấm nền mờ cũng gọi callback này (tắt bằng closeOnOverlayPress) */
  onClose?: () => void;
  title?: ReactNode;
  description?: ReactNode;
  children?: ReactNode;
  closeOnOverlayPress?: boolean;
  style?: StyleProp<ViewStyle>;
}

export function ModalShell({
  visible,
  onClose,
  title,
  description,
  children,
  closeOnOverlayPress = true,
  style,
}: ModalShellProps) {
  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onClose}
    >
      <Pressable
        style={styles.overlay}
        onPress={closeOnOverlayPress ? onClose : undefined}
      >
        {/* Pressable chặn sự kiện bấm lan xuống overlay khi bấm vào card */}
        <Pressable style={[styles.card, style]} onPress={() => undefined}>
          {title ? <Text style={styles.title}>{title}</Text> : null}
          {description ? (
            <Text style={styles.description}>{description}</Text>
          ) : null}
          {children}
        </Pressable>
      </Pressable>
    </Modal>
  );
}

// ─── ConfirmModal ─────────────────────────────────────────────────────────────
export interface ConfirmModalProps {
  visible: boolean;
  title: string;
  description?: ReactNode;
  confirmLabel?: string;
  cancelLabel?: string;
  /** "danger" cho thao tác hủy/xóa (mặc định), "primary" cho xác nhận nhanh */
  variant?: "primary" | "danger";
  /** Khóa cả 2 nút và hiện spinner trên nút chính */
  loading?: boolean;
  onConfirm: () => void;
  onClose: () => void;
  style?: StyleProp<ViewStyle>;
}

export function ConfirmModal({
  visible,
  title,
  description,
  confirmLabel = "Xác nhận",
  cancelLabel = "Quay lại",
  variant = "danger",
  loading = false,
  onConfirm,
  onClose,
  style,
}: ConfirmModalProps) {
  return (
    <ModalShell
      visible={visible}
      onClose={loading ? undefined : onClose}
      closeOnOverlayPress={!loading}
      style={style}
    >
      <Text style={styles.title}>{title}</Text>
      {description ? <Text style={styles.description}>{description}</Text> : null}
      <View style={styles.actionsRow}>
        <View style={styles.actionCol}>
          <Button
            label={cancelLabel}
            variant="outline"
            onPress={onClose}
            disabled={loading}
            fullWidth
          />
        </View>
        <View style={styles.actionCol}>
          <Button
            label={confirmLabel}
            variant={variant}
            onPress={onConfirm}
            loading={loading}
            fullWidth
          />
        </View>
      </View>
    </ModalShell>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────
const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: OVERLAY_COLOR,
    alignItems: "center",
    justifyContent: "center",
    padding: Spacing.lg,
  },
  card: {
    width: "100%",
    maxWidth: 400,
    backgroundColor: Colors.surface,
    borderRadius: Radius.lg,
    padding: Spacing.xl,
  },

  title: {
    color: Colors.textPrimary,
    fontSize: 17,
    fontWeight: "700",
  } as TextStyle,
  description: {
    marginTop: Spacing.sm,
    color: Colors.textSecondary,
    fontSize: 14,
    lineHeight: 20,
  },

  actionsRow: {
    flexDirection: "row",
    gap: Spacing.sm,
    marginTop: Spacing.xl,
  },
  actionCol: { flex: 1 },
});
