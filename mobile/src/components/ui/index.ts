/**
 * Vina TrekGO — Shared UI Component Library (Mobile)
 * Barrel export tập trung. Dùng: `import { Button, SurfaceCard, ... } from "@/components/ui";`
 * Ngôn ngữ thiết kế: "Tactical Topographic Utility" — xem DESIGN.md của web và README.md cùng thư mục.
 */

// Design tokens
export {
  Colors,
  Radius,
  Spacing,
  Typography,
  formatNumber,
  formatVnd,
} from "@/constants/designTokens";
export type { DesignColor } from "@/constants/designTokens";

// 1. ScreenShell & ScreenHeader
export { ScreenShell, ScreenHeader } from "./ScreenShell";
export type { ScreenShellProps, ScreenHeaderProps } from "./ScreenShell";

// 2. SurfaceCard & SurfaceSectionHeader
export { SurfaceCard, SurfaceSectionHeader } from "./SurfaceCard";
export type { SurfaceCardProps, SurfaceSectionHeaderProps } from "./SurfaceCard";

// 3. StepIndicator
export { StepIndicator } from "./StepIndicator";
export type { StepIndicatorProps, StepIndicatorStep } from "./StepIndicator";

// 4. Button
export { Button } from "./Button";
export type { ButtonProps, ButtonVariant, ButtonSize } from "./Button";

// 5. FormField, Input, SelectField, Textarea
export { FormField, Input, SelectField, Textarea } from "./FormField";
export type {
  FormFieldProps,
  InputProps,
  TextareaProps,
  SelectFieldProps,
  SelectFieldOption,
} from "./FormField";

// 6. StatusBadge, DifficultyBadge, TelemetryChip
export { StatusBadge, DifficultyBadge, TelemetryChip, STATUS_META } from "./StatusBadge";
export type {
  StatusBadgeProps,
  StatusTone,
  DifficultyBadgeProps,
  TelemetryChipProps,
} from "./StatusBadge";

// 7. LoadingState, EmptyState, ErrorAlert, InfoBanner
export {
  LoadingState,
  EmptyState,
  ErrorAlert,
  InfoBanner,
} from "./StateBlock";
export type {
  LoadingStateProps,
  EmptyStateProps,
  ErrorAlertProps,
  InfoBannerProps,
  InfoBannerTone,
} from "./StateBlock";

// 8. ModalShell & ConfirmModal
export { ModalShell, ConfirmModal } from "./ConfirmModal";
export type { ModalShellProps, ConfirmModalProps } from "./ConfirmModal";

// 9. TripSummaryBanner & TripMetaGrid
export { TripSummaryBanner, TripMetaGrid } from "./TripSummaryBanner";
export type {
  TripSummaryBannerProps,
  TripMetaGridProps,
  TripMetaItem,
} from "./TripSummaryBanner";

// 10. PaginationBar
export { PaginationBar } from "./PaginationBar";
export type { PaginationBarProps } from "./PaginationBar";
