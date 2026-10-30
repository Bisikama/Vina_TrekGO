import { Ionicons } from "@expo/vector-icons";
import React, { ReactNode, useState } from "react";
import {
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TextInputProps,
  TouchableOpacity,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { TrekGoLogo } from "@/components/TrekGoLogo";
import { Colors, Radius, Shadows } from "@/constants/theme";

export function AuthScaffold({
  eyebrow,
  title,
  description,
  children,
  footer,
}: {
  eyebrow: string;
  title: string;
  description: string;
  children: ReactNode;
  footer?: ReactNode;
}) {
  return (
    <SafeAreaView style={styles.safeArea}>
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : undefined}
        style={styles.flex}
      >
        <ScrollView
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
          contentContainerStyle={styles.scrollContent}
        >
          <View style={styles.hero}>
            <View style={styles.glowLarge} />
            <View style={styles.glowSmall} />
            <View style={styles.logoCard}>
              <TrekGoLogo size={29} />
            </View>
            <Text style={styles.eyebrow}>{eyebrow}</Text>
            <Text style={styles.title}>{title}</Text>
            <Text style={styles.description}>{description}</Text>

            <View style={styles.featureRow}>
              <Feature icon="shield-checkmark" label="An toàn" />
              <Feature icon="trail-sign" label="Khám phá" />
              <Feature icon="people" label="Đồng hành" />
            </View>
          </View>

          <View style={styles.formCard}>{children}</View>
          {footer ? <View style={styles.footer}>{footer}</View> : null}
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

function Feature({
  icon,
  label,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
}) {
  return (
    <View style={styles.featurePill}>
      <Ionicons name={icon} size={13} color={Colors.primary} />
      <Text style={styles.featureText}>{label}</Text>
    </View>
  );
}

export function AuthField({
  label,
  icon,
  secureTextEntry,
  error,
  ...inputProps
}: TextInputProps & {
  label: string;
  icon: keyof typeof Ionicons.glyphMap;
  error?: string;
}) {
  const [passwordVisible, setPasswordVisible] = useState(false);
  const isPassword = Boolean(secureTextEntry);

  return (
    <View style={styles.fieldBlock}>
      <Text style={styles.fieldLabel}>{label}</Text>
      <View style={[styles.inputWrap, error && styles.inputWrapError]}>
        <Ionicons name={icon} size={18} color={Colors.primaryDark} />
        <TextInput
          {...inputProps}
          style={styles.input}
          secureTextEntry={isPassword && !passwordVisible}
          placeholderTextColor={Colors.onSurfaceMuted}
          selectionColor={Colors.primaryDark}
        />
        {isPassword ? (
          <TouchableOpacity
            onPress={() => setPasswordVisible((current) => !current)}
            hitSlop={10}
          >
            <Ionicons
              name={passwordVisible ? "eye-off-outline" : "eye-outline"}
              size={19}
              color={Colors.onSurfaceMuted}
            />
          </TouchableOpacity>
        ) : null}
      </View>
      {error ? <Text style={styles.fieldError}>{error}</Text> : null}
    </View>
  );
}

export function AuthSubmitButton({
  label,
  loadingLabel,
  isLoading,
  onPress,
  disabled,
}: {
  label: string;
  loadingLabel: string;
  isLoading: boolean;
  onPress: () => void;
  disabled?: boolean;
}) {
  return (
    <TouchableOpacity
      style={[
        styles.submitButton,
        (isLoading || disabled) && styles.submitButtonDisabled,
      ]}
      onPress={onPress}
      activeOpacity={0.84}
      disabled={isLoading || disabled}
    >
      <Text style={styles.submitText}>{isLoading ? loadingLabel : label}</Text>
      <Ionicons
        name={isLoading ? "hourglass-outline" : "arrow-forward"}
        size={18}
        color={Colors.onPrimary}
      />
    </TouchableOpacity>
  );
}

export function AuthError({ message }: { message: string | null }) {
  if (!message) return null;

  return (
    <View style={styles.errorCard}>
      <Ionicons name="alert-circle" size={18} color={Colors.error} />
      <Text style={styles.errorText}>{message}</Text>
    </View>
  );
}

export const authStyles = StyleSheet.create({
  formTitle: {
    color: Colors.onSurface,
    fontSize: 19,
    fontWeight: "900",
  },
  formDescription: {
    marginTop: 5,
    marginBottom: 20,
    color: Colors.onSurfaceVariant,
    fontSize: 12,
    lineHeight: 18,
  },
  linkButton: {
    alignSelf: "flex-end",
    marginTop: -2,
    marginBottom: 16,
  },
  linkText: {
    color: Colors.primaryDark,
    fontSize: 12,
    fontWeight: "800",
  },
  footerRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 5,
  },
  footerText: {
    color: Colors.onSurfaceVariant,
    fontSize: 12,
  },
  footerLink: {
    color: Colors.primaryDark,
    fontSize: 12,
    fontWeight: "900",
  },
  noticeCard: {
    marginBottom: 16,
    padding: 12,
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 9,
    borderRadius: Radius.md,
    backgroundColor: Colors.primaryPale,
  },
  noticeText: {
    flex: 1,
    color: Colors.onPrimaryContainer,
    fontSize: 11,
    lineHeight: 17,
    fontWeight: "600",
  },
});

const styles = StyleSheet.create({
  flex: { flex: 1 },
  safeArea: { flex: 1, backgroundColor: Colors.inkDeep },
  scrollContent: { flexGrow: 1, backgroundColor: Colors.surface },
  hero: {
    minHeight: 282,
    overflow: "hidden",
    paddingHorizontal: 22,
    paddingTop: 24,
    paddingBottom: 30,
    backgroundColor: Colors.inkDeep,
  },
  glowLarge: {
    position: "absolute",
    top: -85,
    right: -75,
    width: 235,
    height: 235,
    borderRadius: Radius.full,
    backgroundColor: "rgba(159, 232, 112, 0.14)",
  },
  glowSmall: {
    position: "absolute",
    bottom: -75,
    left: -45,
    width: 170,
    height: 170,
    borderRadius: Radius.full,
    backgroundColor: "rgba(159, 232, 112, 0.08)",
  },
  logoCard: {
    alignSelf: "flex-start",
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: Radius.lg,
    backgroundColor: Colors.surface,
  },
  eyebrow: {
    marginTop: 25,
    color: Colors.primary,
    fontSize: 10,
    fontWeight: "900",
    letterSpacing: 1.4,
  },
  title: {
    maxWidth: 330,
    marginTop: 7,
    color: Colors.onPrimaryDark,
    fontSize: 30,
    lineHeight: 35,
    fontWeight: "900",
    letterSpacing: -0.8,
  },
  description: {
    maxWidth: 340,
    marginTop: 8,
    color: "rgba(255,255,255,0.72)",
    fontSize: 12,
    lineHeight: 18,
  },
  featureRow: {
    marginTop: 18,
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 7,
  },
  featurePill: {
    paddingHorizontal: 9,
    paddingVertical: 5,
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    borderWidth: 1,
    borderColor: "rgba(159,232,112,0.25)",
    borderRadius: Radius.full,
    backgroundColor: "rgba(255,255,255,0.06)",
  },
  featureText: { color: Colors.onPrimaryDark, fontSize: 9, fontWeight: "800" },
  formCard: {
    marginTop: -18,
    marginHorizontal: 14,
    padding: 20,
    borderRadius: Radius.xl,
    backgroundColor: Colors.surfaceContainerLowest,
    ...Shadows.card,
  },
  fieldBlock: { marginBottom: 14 },
  fieldLabel: {
    marginBottom: 7,
    color: Colors.onSurface,
    fontSize: 11,
    fontWeight: "800",
  },
  inputWrap: {
    minHeight: 50,
    paddingHorizontal: 13,
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    borderWidth: 1,
    borderColor: Colors.surfaceContainerHighest,
    borderRadius: Radius.md,
    backgroundColor: Colors.surfaceContainerLow,
  },
  inputWrapError: { borderColor: Colors.error },
  input: {
    flex: 1,
    paddingVertical: 12,
    color: Colors.onSurface,
    fontSize: 13,
  },
  fieldError: { marginTop: 5, color: Colors.error, fontSize: 10, fontWeight: "700" },
  submitButton: {
    minHeight: 52,
    paddingHorizontal: 18,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 9,
    borderRadius: Radius.full,
    backgroundColor: Colors.primary,
  },
  submitButtonDisabled: { opacity: 0.55 },
  submitText: { color: Colors.onPrimary, fontSize: 13, fontWeight: "900" },
  errorCard: {
    marginBottom: 14,
    padding: 11,
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 8,
    borderWidth: 1,
    borderColor: "rgba(186,26,26,0.2)",
    borderRadius: Radius.md,
    backgroundColor: Colors.errorContainer,
  },
  errorText: { flex: 1, color: Colors.onErrorContainer, fontSize: 11, lineHeight: 16, fontWeight: "700" },
  footer: { paddingHorizontal: 18, paddingTop: 20, paddingBottom: 28 },
});
