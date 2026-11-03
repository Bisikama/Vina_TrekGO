# Vina TrekGO Mobile — Shared UI Component Library (`@/components/ui`)

Bộ thư viện UI Component dùng chung cho ứng dụng mobile **Vina TrekGO** (React Native + Expo + TypeScript, `StyleSheet` + `react-native-safe-area-context`), đồng bộ 100% ngôn ngữ thiết kế **Tactical Topographic Utility** với bản Web — xem `Vina_TrekGO/web/DESIGN.md` và `Vina_TrekGO/web/src/components/ui/README.md` (repo web, cùng org).

> Quy tắc vàng: nền màn hình là Limestone `#F7F7F4`, card là trắng `#FFFFFF` + viền 1px `#E5E7EB` bo góc 12, nút/input bo góc 8, modal bo góc 16, badge/chip dạng pill. **Mọi số liệu** (giá `₫`, `km`, `m`, `5/15` chỗ, thời gian) bắt buộc kèm `Typography.tabularNums`.

---

## 1. Design Tokens (`@/constants/designTokens`)

| Token | Giá trị | Dùng cho |
| :--- | :--- | :--- |
| `Colors.canvas` | `#F7F7F4` | Nền toàn màn hình (Limestone White) |
| `Colors.surface` | `#FFFFFF` | Card / Modal / Sheet |
| `Colors.surfaceMuted` | `#EFEFE9` | Chip, nền phụ, trạng thái disabled |
| `Colors.border` | `#E5E7EB` | Viền 1px kiểu đường đồng mức |
| `Colors.primary` / `primaryDeep` / `primaryHover` | `#2F6B4F` / `#125238` / `#1F4A36` | Nút chính, active / tiêu đề + giá tiền / pressed |
| `Colors.accent` | `#F59E0B` | Trailhead Amber — cảnh báo nhẹ, điểm nhấn |
| `Colors.textPrimary` / `textSecondary` | `#1F2937` / `#6B7280` | Chữ chính / phụ |
| `Colors.danger*`, `success*`, `warning*`, `info*` | bg + text | Trạng thái ngữ cảnh |
| `Radius` | `sm:8 · md:12 · lg:16 · pill:9999` | Input/Button · Card · Modal · Badge |
| `Spacing` | `4 · 8 · 12 · 16 · 20 · 24` | Thang 4pt |
| `Typography.tabularNums` | `fontVariant: ["tabular-nums"]` | Spread vào style của mọi con số |
| `formatVnd(n)` / `formatNumber(n)` | `"1.500.000 ₫"` | Định dạng tiền/số |

---

## 2. Cách import

```tsx
import {
  ScreenShell,
  ScreenHeader,
  SurfaceCard,
  SurfaceSectionHeader,
  StepIndicator,
  Button,
  FormField,
  Input,
  SelectField,
  Textarea,
  StatusBadge,
  DifficultyBadge,
  TelemetryChip,
  LoadingState,
  EmptyState,
  ErrorAlert,
  InfoBanner,
  ModalShell,
  ConfirmModal,
  TripSummaryBanner,
  TripMetaGrid,
  PaginationBar,
  Colors,
  Spacing,
  Typography,
  formatVnd,
} from "@/components/ui";
```

---

## 3. 10 nhóm component

### 3.1. `ScreenShell` & `ScreenHeader` (`ScreenShell.tsx`)
Khung màn hình: bọc `SafeAreaView` nền `#F7F7F4`. Tương ứng `PageShell`/`PageHeader` của web.

- `ScreenShell`: `scrollable` (ScrollView), `keyboardAvoiding` (form), `refreshing` + `onRefresh` (pull-to-refresh), `contentContainerStyle`, `edges`.
- `ScreenHeader`: `onBack`/`backHref` ("← Quay lại"), `eyebrow` (in hoa màu primary), `title`, `subtitle`/`description`, `badge`, `rightActions`.

```tsx
<ScreenShell scrollable onRefresh={refetch} refreshing={refreshing}>
  <ScreenHeader
    eyebrow="Vina TrekGO · Chuyến đi công khai"
    title="Chinh phục đỉnh Bà Đen 2N1Đ"
    subtitle="Lịch trình, chi phí và điểm tập kết"
    badge={<StatusBadge status={trip.status} />}
    backHref="/(tabs)/trips"
  />
  {/* Nội dung */}
</ScreenShell>
```

### 3.2. `SurfaceCard` & `SurfaceSectionHeader` (`SurfaceCard.tsx`)
Thẻ trắng viền `#E5E7EB` bo 12. `padding?: "none" | "sm" | "md" | "lg"`; có `onPress` thì dùng `Pressable` (nhấn đổi viền primary + opacity).

```tsx
<SurfaceCard padding="md" onPress={() => openTrip(trip.id)}>
  <SurfaceSectionHeader
    title="Danh sách thành viên"
    subtitle="Quản lý thành viên tham gia đoàn"
    action={<Button size="sm" label="Mời thêm" />}
  />
</SurfaceCard>
```

### 3.3. `StepIndicator` (`StepIndicator.tsx`)
Thanh tiến trình đa bước. Bước đã qua: `✓` nền primary; hiện tại: viền `primaryDeep`; chưa tới: nền xám.

```tsx
<StepIndicator
  currentStepIndex={1}
  steps={[
    { key: "route", label: "Chọn cung đường" },
    { key: "schedule", label: "Lịch trình & Chi phí" },
    { key: "review", label: "Kiểm tra & Xuất bản" },
  ]}
/>
```

### 3.4. `Button` (`Button.tsx`)
Pressable, `minHeight` 44/48/52 theo size. `variant`: `primary | secondary | outline | ghost | danger`; `loading` hiện spinner + khóa nút; `leftIcon`/`rightIcon`; `fullWidth`.

```tsx
<Button label="Xác nhận đặt chỗ" loading={isSubmitting} onPress={handleBooking} />
<Button label="Hủy chuyến" variant="danger" onPress={() => setShowCancel(true)} />
```

### 3.5. `FormField`, `Input`, `SelectField`, `Textarea` (`FormField.tsx`)
`FormField`: `label` + `*` đỏ khi `required`, `hint`, `error` màu `#DC2626`.
`Input`/`Textarea`: nền `#F7F7F4`, focus viền `#2F6B4F` + nền trắng, `hasError` viền đỏ.
`SelectField`: mở Modal danh sách `options` (thay `<select>` của web), có dấu `✓` cho lựa chọn hiện tại.

```tsx
<FormField label="Tên chuyến đi" required error={errors.title}>
  <Input
    value={title}
    onChangeText={setTitle}
    placeholder="Ví dụ: Chinh phục Tà Năng - Phan Dũng"
    hasError={Boolean(errors.title)}
  />
</FormField>

<FormField label="Điểm tập kết" required>
  <SelectField
    value={pickupId}
    onChange={setPickupId}
    options={pickups.map((p) => ({ label: p.name, value: p.id }))}
    title="Chọn điểm tập kết"
  />
</FormField>
```

### 3.6. `StatusBadge`, `DifficultyBadge`, `TelemetryChip` (`StatusBadge.tsx`)
- `StatusBadge`: tự ánh xạ mã trạng thái sang màu + nhãn tiếng Việt — Trip (`DRAFT`, `OPEN`, `PUBLISHED`, `ACTIVE`, `IN_PROGRESS`, `FULL`, `CLOSED`, `COMPLETED`, `CANCELLED`), Booking (`HOLD`, `PENDING_PAYMENT`, `CONFIRMED`, `EXPIRED`, `CANCELLED`, `CHECKED_IN`, `PARTIAL_CHECKIN`, `NO_SHOW`), Payment (`PENDING`, `SUCCESS`, `PAID`, `FAILED`, `REFUNDED`), Member/Invite (`JOINED`, `ACCEPTED`, `INVITED`, `DECLINED`, `LEFT`, `REVOKED`), Dispute (`OPEN_DISPUTE`, `UNDER_REVIEW`, `RESOLVED_REFUND`, `RESOLVED_NO_REFUND`). Mã lạ → neutral, có thể ghi đè `label`/`tone`.
- `DifficultyBadge`: `EASY`→Dễ, `MEDIUM`/`MODERATE`→Trung bình, `HARD`→Khó, `EXTREME`→Rất khó (đúng bảng màu DESIGN.md).
- `TelemetryChip`: `label` + `value` với `tabular-nums`.

```tsx
<StatusBadge status={trip.status} />
<DifficultyBadge difficulty="HARD" />
<TelemetryChip label="Quãng đường" value="18.5 km" />
```

### 3.7. `LoadingState`, `EmptyState`, `ErrorAlert`, `InfoBanner` (`StateBlock.tsx`)
- `LoadingState`: spinner `#2F6B4F` + `message`/`label`.
- `EmptyState`: viền nét đứt, `icon`/`title`/`description`/`action`.
- `ErrorAlert`: nền `#FEF2F2`, viền trái 4px `#DC2626`, nút **Thử lại** (`onRetry`) + **Đóng** (`onDismiss`).
- `InfoBanner`: `tone`/`variant` = `info | success | warning`.

```tsx
{error && <ErrorAlert message={error} onRetry={refetch} />}
{isLoading && <LoadingState label="Đang tải danh sách chuyến đi…" />}
{!isLoading && items.length === 0 && (
  <EmptyState
    title="Chưa có chuyến đi nào"
    description="Hãy tạo chuyến đi đầu tiên của bạn."
    action={<Button label="Tạo chuyến đi" onPress={goCreate} />}
  />
)}
```

### 3.8. `ModalShell` & `ConfirmModal` (`ConfirmModal.tsx`)
RN `Modal` (`transparent`, `animationType="fade"`) + nền mờ `rgba(17,24,39,0.55)`, card bo 16.
**Thay thế hoàn toàn `Alert.alert`** khi xác nhận thao tác quan trọng (hủy chuyến, rời nhóm, hủy đặt chỗ, thu hồi lời mời). `variant?: "primary" | "danger"`, `loading` khóa cả 2 nút.

```tsx
<ConfirmModal
  visible={showCancelModal}
  title="Hủy chuyến đi này?"
  description="Hành động này sẽ thông báo tới toàn bộ thành viên và không thể hoàn tác."
  confirmLabel="Xác nhận hủy"
  variant="danger"
  loading={busy}
  onConfirm={handleCancelTrip}
  onClose={() => setShowCancelModal(false)}
/>
```

### 3.9. `TripSummaryBanner` & `TripMetaGrid` (`TripSummaryBanner.tsx`)
Thẻ tóm tắt đầu trang chuyến đi: tên + `StatusBadge`, điểm đến, thời gian, điểm tập kết, sức chứa `remainingSlots/capacity`, giá vé `₫/người`, leader. Truyền số thô (`remainingSlots`, `capacity`, `pricePerPax`) là tự format; hoặc dùng `capacityLabel`/`priceLabel`/`metaItems` tùy biến.

```tsx
<TripSummaryBanner
  title={trip.title}
  status={trip.status}
  destinationName={trip.destination?.name}
  startAt={trip.startAt}
  endAt={trip.endAt}
  pickupName="Bến xe Miền Đông"
  remainingSlots={8}
  capacity={15}
  pricePerPax={trip.pricePerPax}
  leaderName={trip.leader?.fullName}
/>
```

### 3.10. `PaginationBar` (`PaginationBar.tsx`)
`← Trước | Trang X / Y · Tổng Z {itemLabel} | Sau →`, tabular-nums, tự tính tổng trang từ `total/pageSize`.

```tsx
<PaginationBar page={page} pageSize={12} total={total} onPageChange={setPage} itemLabel="chuyến" />
```

---

## 4. Cấu trúc thư mục

```text
mobile/src/components/ui/
├── Button.tsx              # Button (primary/secondary/outline/ghost/danger)
├── ConfirmModal.tsx        # ModalShell & ConfirmModal (thay Alert.alert)
├── FormField.tsx           # FormField, Input, SelectField, Textarea
├── PaginationBar.tsx        # Thanh phân trang tabular-nums
├── ScreenShell.tsx         # ScreenShell & ScreenHeader (= PageShell của web)
├── StateBlock.tsx          # LoadingState, EmptyState, ErrorAlert, InfoBanner
├── StatusBadge.tsx         # StatusBadge, DifficultyBadge, TelemetryChip
├── StepIndicator.tsx       # Thanh tiến trình đa bước
├── SurfaceCard.tsx         # SurfaceCard & SurfaceSectionHeader
├── TripSummaryBanner.tsx   # TripSummaryBanner & TripMetaGrid
├── index.ts                # Barrel export tập trung (@/components/ui)
└── README.md               # Tài liệu này
```

Design tokens nằm tại `src/constants/designTokens.ts` (export qua barrel này).
