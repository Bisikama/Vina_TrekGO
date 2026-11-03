/**
 * FormField, Input, SelectField, Textarea — bộ thành phần biểu mẫu chuẩn.
 * Input nền `#F7F7F4`, focus viền `#2F6B4F` + nền trắng, lỗi viền `#DC2626`.
 * SelectField mở Modal danh sách (thay thế thẻ <select> của web).
 */
import { useState, type ReactNode } from "react";
import {
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
  type StyleProp,
  type TextInputProps,
  type TextStyle,
  type ViewStyle,
} from "react-native";

import { Colors, Radius, Spacing } from "@/constants/designTokens";

// ─── FormField ────────────────────────────────────────────────────────────────
export interface FormFieldProps {
  label?: ReactNode;
  /** Hiện dấu * đỏ cạnh label */
  required?: boolean;
  /** Gợi ý nhỏ bên dưới ô nhập */
  hint?: ReactNode;
  /** Thông báo lỗi màu #DC2626 */
  error?: ReactNode;
  children: ReactNode;
  style?: StyleProp<ViewStyle>;
}

export function FormField({ label, required, hint, error, children, style }: FormFieldProps) {
  return (
    <View style={[styles.field, style]}>
      {label ? (
        <View style={styles.labelRow}>
          <Text style={styles.label}>{label}</Text>
          {required ? <Text style={styles.requiredMark}>*</Text> : null}
        </View>
      ) : null}
      {children}
      {hint ? <Text style={styles.hint}>{hint}</Text> : null}
      {error ? <Text style={styles.error}>{error}</Text> : null}
    </View>
  );
}

// ─── Input ────────────────────────────────────────────────────────────────────
export interface InputProps extends TextInputProps {
  /** Đổi viền sang đỏ #DC2626 */
  hasError?: boolean;
  containerStyle?: StyleProp<ViewStyle>;
}

export function Input({ hasError, containerStyle, style, editable = true, onFocus, onBlur, ...rest }: InputProps) {
  const [focused, setFocused] = useState(false);

  const borderColor = hasError
    ? Colors.danger
    : focused && editable
      ? Colors.primary
      : Colors.border;
  const backgroundColor = !editable
    ? Colors.surfaceMuted
    : focused
      ? Colors.surface
      : Colors.canvas;

  return (
    <View
      style={[
        styles.inputShell,
        { borderColor, backgroundColor },
        containerStyle,
      ]}
    >
      <TextInput
        {...rest}
        editable={editable}
        placeholderTextColor={Colors.textSecondary}
        style={[styles.inputText, style]}
        onFocus={(event) => {
          setFocused(true);
          onFocus?.(event);
        }}
        onBlur={(event) => {
          setFocused(false);
          onBlur?.(event);
        }}
      />
    </View>
  );
}

// ─── Textarea ─────────────────────────────────────────────────────────────────
export interface TextareaProps extends TextInputProps {
  hasError?: boolean;
  containerStyle?: StyleProp<ViewStyle>;
}

export function Textarea({
  hasError,
  containerStyle,
  style,
  numberOfLines = 4,
  editable = true,
  onFocus,
  onBlur,
  ...rest
}: TextareaProps) {
  const [focused, setFocused] = useState(false);

  const borderColor = hasError
    ? Colors.danger
    : focused && editable
      ? Colors.primary
      : Colors.border;
  const backgroundColor = !editable
    ? Colors.surfaceMuted
    : focused
      ? Colors.surface
      : Colors.canvas;

  return (
    <View
      style={[
        styles.inputShell,
        styles.textareaShell,
        { borderColor, backgroundColor },
        containerStyle,
      ]}
    >
      <TextInput
        {...rest}
        editable={editable}
        multiline
        numberOfLines={numberOfLines}
        placeholderTextColor={Colors.textSecondary}
        textAlignVertical="top"
        style={[styles.inputText, styles.textareaText, style]}
        onFocus={(event) => {
          setFocused(true);
          onFocus?.(event);
        }}
        onBlur={(event) => {
          setFocused(false);
          onBlur?.(event);
        }}
      />
    </View>
  );
}

// ─── SelectField ──────────────────────────────────────────────────────────────
export interface SelectFieldOption {
  label: string;
  value: string;
  description?: string;
}

export interface SelectFieldProps {
  value?: string | null;
  options: SelectFieldOption[];
  onChange: (value: string) => void;
  placeholder?: string;
  /** Tiêu đề modal chọn (mặc định "Chọn một lựa chọn") */
  title?: string;
  hasError?: boolean;
  disabled?: boolean;
  style?: StyleProp<ViewStyle>;
}

export function SelectField({
  value,
  options,
  onChange,
  placeholder = "Chọn…",
  title = "Chọn một lựa chọn",
  hasError,
  disabled = false,
  style,
}: SelectFieldProps) {
  const [open, setOpen] = useState(false);
  const selected = options.find((option) => option.value === value) ?? null;

  return (
    <View style={style}>
      <Pressable
        onPress={() => !disabled && setOpen(true)}
        disabled={disabled}
        style={[
          styles.inputShell,
          styles.selectShell,
          hasError && styles.selectError,
          disabled && styles.selectDisabled,
        ]}
      >
        <Text
          style={[styles.selectText, !selected && styles.selectPlaceholder]}
          numberOfLines={1}
        >
          {selected ? selected.label : placeholder}
        </Text>
        <Text style={styles.selectChevron}>▾</Text>
      </Pressable>

      <Modal
        visible={open}
        transparent
        animationType="fade"
        onRequestClose={() => setOpen(false)}
      >
        <Pressable
          style={styles.modalOverlay}
          onPress={() => setOpen(false)}
        >
          <Pressable style={styles.sheet} onPress={() => undefined}>
            <View style={styles.sheetHeader}>
              <Text style={styles.sheetTitle}>{title}</Text>
              <Pressable onPress={() => setOpen(false)} hitSlop={8}>
                <Text style={styles.sheetClose}>✕</Text>
              </Pressable>
            </View>
            <ScrollView style={styles.optionsList} nestedScrollEnabled>
              {options.length === 0 ? (
                <Text style={styles.emptyOptions}>Chưa có lựa chọn nào</Text>
              ) : (
                options.map((option, index) => {
                  const isSelected = option.value === value;
                  return (
                    <Pressable
                      key={option.value}
                      onPress={() => {
                        onChange(option.value);
                        setOpen(false);
                      }}
                      style={({ pressed }) => [
                        styles.optionRow,
                        index > 0 && styles.optionDivider,
                        pressed && styles.optionPressed,
                      ]}
                    >
                      <View style={styles.optionTextCol}>
                        <Text
                          style={[
                            styles.optionLabel,
                            isSelected && styles.optionLabelSelected,
                          ]}
                        >
                          {option.label}
                        </Text>
                        {option.description ? (
                          <Text style={styles.optionDescription}>
                            {option.description}
                          </Text>
                        ) : null}
                      </View>
                      {isSelected ? (
                        <Text style={styles.optionCheck}>✓</Text>
                      ) : null}
                    </Pressable>
                  );
                })
              )}
            </ScrollView>
          </Pressable>
        </Pressable>
      </Modal>
    </View>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────
const styles = StyleSheet.create({
  field: { gap: Spacing.sm },
  labelRow: {
    flexDirection: "row",
    alignItems: "flex-end",
    gap: 2,
  },
  label: {
    color: Colors.textPrimary,
    fontSize: 14,
    fontWeight: "600",
  } as TextStyle,
  requiredMark: {
    color: Colors.danger,
    fontSize: 14,
    fontWeight: "700",
  },
  hint: {
    color: Colors.textSecondary,
    fontSize: 12,
    lineHeight: 16,
  },
  error: {
    color: Colors.danger,
    fontSize: 12,
    fontWeight: "500",
  },

  inputShell: {
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: Radius.sm, // Inputs: 8px theo DESIGN.md
    backgroundColor: Colors.canvas,
    minHeight: 46,
    justifyContent: "center",
    paddingHorizontal: Spacing.md,
  },
  inputText: {
    color: Colors.textPrimary,
    fontSize: 15,
    paddingVertical: Spacing.sm + 2,
  },
  textareaShell: {
    minHeight: 104,
    paddingVertical: Spacing.md,
  },
  textareaText: {
    minHeight: 76,
    textAlignVertical: "top",
  },

  selectShell: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.sm,
    backgroundColor: Colors.canvas,
  },
  selectError: { borderColor: Colors.danger },
  selectDisabled: { opacity: 0.6 },
  selectText: {
    flex: 1,
    color: Colors.textPrimary,
    fontSize: 15,
  },
  selectPlaceholder: { color: Colors.textSecondary },
  selectChevron: {
    color: Colors.textSecondary,
    fontSize: 14,
  },

  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(17, 24, 39, 0.55)",
    alignItems: "center",
    justifyContent: "center",
    padding: Spacing.lg,
  },
  sheet: {
    width: "100%",
    maxHeight: "72%",
    backgroundColor: Colors.surface,
    borderRadius: Radius.lg,
    paddingVertical: Spacing.md,
  },
  sheetHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: Spacing.lg,
    paddingBottom: Spacing.sm,
  },
  sheetTitle: {
    color: Colors.textPrimary,
    fontSize: 16,
    fontWeight: "700",
  } as TextStyle,
  sheetClose: {
    color: Colors.textSecondary,
    fontSize: 16,
  },
  optionsList: { flexGrow: 0 },
  emptyOptions: {
    color: Colors.textSecondary,
    fontSize: 13,
    padding: Spacing.lg,
    textAlign: "center",
  },
  optionRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.sm,
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.md,
  },
  optionDivider: {
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: Colors.border,
  },
  optionPressed: { backgroundColor: Colors.canvas },
  optionTextCol: { flex: 1 },
  optionLabel: {
    color: Colors.textPrimary,
    fontSize: 15,
  },
  optionLabelSelected: {
    color: Colors.primaryDeep,
    fontWeight: "700",
  },
  optionDescription: {
    marginTop: 2,
    color: Colors.textSecondary,
    fontSize: 12,
  },
  optionCheck: {
    color: Colors.primary,
    fontSize: 15,
    fontWeight: "700",
  },
});
