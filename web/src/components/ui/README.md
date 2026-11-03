# Vina TrekGO — Shared UI Component Library (`@/components/ui`)

Bộ thư viện UI Component dùng chung cho toàn bộ ứng dụng web **Vina TrekGO**, được thiết kế dựa trên quy chuẩn **Tactical Topographic Utility** tại [`web/DESIGN.md`](../../../DESIGN.md) và [`web/src/app/globals.css`](../../app/globals.css).

---

## 1. Quy chuẩn màu sắc & Typography cốt lõi (Design Tokens)

| Thành phần | Mã màu / Class | Ý nghĩa |
| :--- | :--- | :--- |
| **Canvas (Nền trang)** | `#F7F7F4` (`bg-[#F7F7F4]`) | Limestone White — giảm chói mắt, đồng bộ cảm giác bản đồ địa hình |
| **Surface (Thẻ/Card)** | `#FFFFFF` (`bg-white`) | Nền khối nội dung nổi trên nền Limestone |
| **Border (Viền mảnh)** | `#E5E7EB` (`border-[#E5E7EB]`) | Viền phân tách khối kiểu đường đồng mức (`1px solid`) |
| **Primary Brand** | `#2F6B4F` (`bg-[#2F6B4F]`) | Canopy Forest Green — nút hành động chính, trạng thái active |
| **Primary Hover / Deep** | `#1F4A36` / `#125238` | Deep Pine / Deep Forest — hover, tiêu đề nhấn mạnh, giá tiền |
| **Text Primary** | `#1F2937` (`text-[#1F2937]`) | Deep Charcoal — chữ chính |
| **Text Secondary** | `#6B7280` (`text-[#6B7280]`) | Slate Grey — nhãn phụ, mô tả |
| **Số liệu (Numerics)** | `tabular-nums` | Bắt buộc cho tiền tệ (`₫`), khoảng cách (`km`), độ cao (`m`), chỗ trống (`5/15`) |

---

## 2. Cách Import

Tất cả các component được export tập trung qua barrel file [`web/src/components/ui/index.ts`](./index.ts):

```tsx
import {
  PageShell,
  PageHeader,
  SurfaceCard,
  SurfaceSectionHeader,
  StepIndicator,
  Button,
  FormField,
  Input,
  Select,
  Textarea,
  StatusBadge,
  DifficultyBadge,
  TelemetryChip,
  LoadingState,
  EmptyState,
  ErrorAlert,
  InfoBanner,
  Modal,
  ConfirmModal,
  TripSummaryBanner,
  TripMetaGrid,
  PaginationBar,
} from "@/components/ui";
```

---

## 3. Danh sách 10 nhóm UI Component

### 3.1. `PageShell` & `PageHeader` ([`PageShell.tsx`](./PageShell.tsx))
Khung bao toàn trang (đảm bảo nền `#F7F7F4`, khoảng cách với Navbar cố định và giới hạn chiều rộng) cùng tiêu đề trang chuẩn.

- **`PageShellProps`**:
  - `maxWidth?: "sm" | "md" | "lg" | "5xl" | "xl" | "6xl" | "2xl" | "7xl" | "full"` (mặc định `"xl"`)
  - `withTopOffset?: boolean` (mặc định `true` để chừa khoảng trống cho Header)
  - `className?: string`
- **`PageHeaderProps`**:
  - `eyebrow?: string` — Nhãn phụ chữ in hoa phía trên tiêu đề (VD: `"Vina TrekGO · Khám Phá Chuyến Đi"`)
  - `title: React.ReactNode` — Tiêu đề chính của trang
  - `subtitle?: React.ReactNode` / `description?: React.ReactNode` — Mô tả ngắn bên dưới tiêu đề
  - `backHref?: string` & `backLabel?: string` — Link điều hướng quay lại trang trước
  - `badge?: React.ReactNode` — Huy hiệu trạng thái đặt cạnh tiêu đề
  - `actions?: React.ReactNode` — Cụm nút hành động bên phải header

```tsx
<PageShell maxWidth="xl">
  <PageHeader
    eyebrow="Vina TrekGO · Chuyến Đi Cá Nhân"
    title="Tổ chức chuyến đi mới"
    description="Điền thông tin bên dưới để tạo nhóm và mời bạn bè cùng tham gia."
    backHref="/my-trips"
    backLabel="Quay lại danh sách"
  />
  {/* Nội dung trang */}
</PageShell>
```

---

### 3.2. `SurfaceCard` & `SurfaceSectionHeader` ([`SurfaceCard.tsx`](./SurfaceCard.tsx))
Khối thẻ nội dung nền trắng (`#FFFFFF`), viền `#E5E7EB`, bo góc `12px` (`rounded-xl`).

- **`SurfaceCardProps`**:
  - `padding?: "none" | "sm" | "md" | "lg"` (mặc định `"md"`)
  - `interactive?: boolean` — Bật hiệu ứng hover đổi viền xanh `#2F6B4F/40` và đổ bóng nhẹ
  - `as?: "div" | "section" | "article"` (mặc định `"div"`)
- **`SurfaceSectionHeaderProps`**:
  - `title: React.ReactNode`
  - `subtitle?: React.ReactNode`
  - `action?: React.ReactNode`

```tsx
<SurfaceCard padding="md" interactive>
  <SurfaceSectionHeader
    title="Danh sách thành viên"
    subtitle="Quản lý các thành viên tham gia đoàn"
    action={<Button size="sm">Mời thêm</Button>}
  />
  {/* Nội dung thẻ */}
</SurfaceCard>
```

---

### 3.3. `StepIndicator` ([`StepIndicator.tsx`](./StepIndicator.tsx))
Thanh tiến trình đa bước dùng chung cho luồng **Leader tạo chuyến đi** (4 bước) và **Booking Checkout** (4 bước).

- **`StepIndicatorProps`**:
  - `steps: Array<{ key: string | number; label: string; description?: string }>`
  - `currentStepIndex: number` (bắt đầu từ `0`)
  - `onStepClick?: (index: number) => void`

```tsx
<StepIndicator
  currentStepIndex={1}
  steps={[
    { key: "route", label: "Chọn cung đường" },
    { key: "schedule", label: "Lịch trình & Chi phí" },
    { key: "team", label: "Đội ngũ & Dịch vụ" },
    { key: "review", label: "Kiểm tra & Xuất bản" },
  ]}
/>
```

---

### 3.4. `Button` ([`Button.tsx`](./Button.tsx))
Nút bấm chuẩn hóa màu sắc, kích thước, icon và trạng thái `loading`.

- **`ButtonProps`**:
  - `variant?: "primary" | "secondary" | "outline" | "ghost" | "danger"` (mặc định `"primary"`)
  - `size?: "sm" | "md" | "lg"` (mặc định `"md"`)
  - `loading?: boolean` — Hiển thị vòng xoay loading và tự động khóa nút
  - `leftIcon?: React.ReactNode` & `rightIcon?: React.ReactNode`
  - `fullWidth?: boolean`

```tsx
<Button variant="primary" size="md" loading={isSubmitting}>
  Xác nhận đặt chỗ
</Button>
```

---

### 3.5. `FormField`, `Input`, `Select`, `Textarea` ([`FormField.tsx`](./FormField.tsx))
Bộ thành phần biểu mẫu đồng nhất giao diện giữa các màn hình tạo chuyến đi, bộ lọc tìm kiếm và nhập thông tin hành khách.

- **`FormFieldProps`**:
  - `label?: React.ReactNode`
  - `required?: boolean` — Tự động hiển thị dấu `*` màu đỏ
  - `hint?: React.ReactNode` — Gợi ý nhỏ bên dưới ô nhập
  - `error?: React.ReactNode` — Thông báo lỗi màu đỏ `#DC2626`
- **`Input` / `Select` / `Textarea`**:
  - Hỗ trợ đầy đủ HTML attributes chuẩn của React cùng prop `hasError?: boolean`.

```tsx
<FormField label="Tên chuyến đi" required error={errors.title}>
  <Input
    name="title"
    placeholder="Ví dụ: Chinh phục Tà Năng - Phan Dũng"
    hasError={Boolean(errors.title)}
  />
</FormField>
```

---

### 3.6. `StatusBadge`, `DifficultyBadge`, `TelemetryChip` ([`StatusBadge.tsx`](./StatusBadge.tsx))
Hệ thống nhãn trạng thái và chỉ số địa hình chuẩn hóa toàn dự án.

- **`StatusBadge`**:
  - Tự động nhận diện mã trạng thái của tất cả các phân hệ:
    - **Trip**: `DRAFT`, `OPEN`, `PUBLISHED`, `ACTIVE`, `IN_PROGRESS`, `FULL`, `CLOSED`, `COMPLETED`, `CANCELLED`
    - **Booking**: `HOLD`, `PENDING_PAYMENT`, `CONFIRMED`, `EXPIRED`, `CANCELLED`
    - **Payment**: `PENDING`, `SUCCESS`, `PAID`, `FAILED`, `REFUNDED`
    - **Member / Invitation**: `JOINED`, `ACCEPTED`, `INVITED`, `DECLINED`, `LEFT`, `REVOKED`
    - **Dispute**: `OPEN_DISPUTE`, `UNDER_REVIEW`, `RESOLVED_REFUND`, `RESOLVED_NO_REFUND`
- **`DifficultyBadge`**:
  - Chuẩn hóa hiển thị độ khó cung đường: `EASY` (Dễ), `MEDIUM`/`MODERATE` (Trung bình), `HARD` (Khó), `EXTREME` (Rất khó).
- **`TelemetryChip`**:
  - Hiển thị thông số kỹ thuật (`tabular-nums`) như độ dài (`km`), độ cao (`m`), thời lượng.

```tsx
<StatusBadge status={trip.status} />
<DifficultyBadge difficulty="HARD" />
<TelemetryChip label="Quãng đường" value="18.5 km" />
```

---

### 3.7. `LoadingState`, `EmptyState`, `ErrorAlert`, `InfoBanner` ([`StateBlock.tsx`](./StateBlock.tsx))
Các khối hiển thị trạng thái dữ liệu của màn hình.

- **`LoadingState`**: Hiển thị vòng xoay `#2F6B4F` cùng thông điệp đang tải (`message` hoặc `label`).
- **`EmptyState`**: Khung viền nét đứt hiển thị khi danh sách rỗng, hỗ trợ `icon`, `title`, `description`, và nút `action`.
- **`ErrorAlert`**: Hộp cảnh báo lỗi nền `#FEF2F2` viền trái đỏ `#DC2626`, hỗ trợ nút `onRetry` ("Thử lại") và `onDismiss`.
- **`InfoBanner`**: Banner thông báo theo ngữ cảnh (`tone` / `variant`: `"info" | "success" | "warning"`).

```tsx
{error && <ErrorAlert message={error} onRetry={refetch} />}
{isLoading && <LoadingState label="Đang tải danh sách chuyến đi…" />}
{!isLoading && items.length === 0 && (
  <EmptyState
    title="Chưa có chuyến đi nào"
    description="Hãy tạo chuyến đi đầu tiên của bạn."
    action={<Button>Tạo chuyến đi</Button>}
  />
)}
```

---

### 3.8. `Modal` & `ConfirmModal` ([`ConfirmModal.tsx`](./ConfirmModal.tsx))
Hộp thoại xác nhận dùng lớp phủ mờ `backdrop-blur-xs`, thay thế hoàn toàn `window.confirm()` và `window.alert()` của trình duyệt.

- **`ConfirmModalProps`**:
  - `open: boolean`
  - `title: string`
  - `description: React.ReactNode`
  - `confirmLabel?: string` (mặc định `"Xác nhận"`)
  - `cancelLabel?: string` (mặc định `"Quay lại"`)
  - `variant?: "primary" | "danger"` (mặc định `"danger"` cho các thao tác hủy/xóa)
  - `loading?: boolean`
  - `onConfirm: () => void`
  - `onCancel: () => void`

```tsx
<ConfirmModal
  open={showCancelModal}
  title="Hủy chuyến đi này?"
  description="Hành động này sẽ thông báo tới toàn bộ thành viên và không thể hoàn tác."
  confirmLabel="Xác nhận hủy"
  variant="danger"
  loading={busy}
  onConfirm={handleCancelTrip}
  onCancel={() => setShowCancelModal(false)}
/>
```

---

### 3.9. `TripSummaryBanner` & `TripMetaGrid` ([`TripSummaryBanner.tsx`](./TripSummaryBanner.tsx))
Banner tóm tắt thông tin cốt lõi của chuyến đi (dùng ở đầu trang Chi tiết chuyến đi công khai, Phòng chuyến đi cá nhân, và Checkout).

- **`TripSummaryBannerProps`**:
  - `title: string`
  - `status?: string`
  - `subtitle?: React.ReactNode` / `destinationName?: string`
  - Hỗ trợ truyền trực tiếp các trường nhanh (`startAt`, `endAt`, `pickupName`, `capacityLabel`, `priceLabel`, `leaderName`) hoặc mảng `metaItems?: TripMetaItem[]` tùy biến
  - `actions?: React.ReactNode`

```tsx
<TripSummaryBanner
  title={trip.title}
  status={trip.status}
  destinationName={trip.destination?.name}
  startAt="06:00 15/11/2026"
  endAt="18:00 16/11/2026"
  pickupName="Bến xe Miền Đông"
  capacityLabel="Còn 8/15 chỗ"
  priceLabel="2.500.000 ₫ / người"
/>
```

---

### 3.10. `PaginationBar` ([`PaginationBar.tsx`](./PaginationBar.tsx))
Thanh phân trang đồng bộ số liệu `tabular-nums` cho các trang danh sách.

- **`PaginationBarProps`**:
  - `page: number`
  - `pageSize: number`
  - `total: number`
  - `onPageChange: (nextPage: number) => void`
  - `itemLabel?: string` (VD: `"chuyến"`, `"đơn"`)
  - `disabled?: boolean`

```tsx
<PaginationBar
  page={page}
  pageSize={pageSize}
  total={total}
  onPageChange={setPage}
  itemLabel="chuyến"
/>
```

---

## 4. Cấu trúc thư mục

```text
web/src/components/ui/
├── Button.tsx             # Nút bấm chuẩn (Primary, Secondary, Outline, Ghost, Danger)
├── ConfirmModal.tsx       # Modal & ConfirmModal thay thế confirm()/alert()
├── FormField.tsx          # FormField, Input, Select, Textarea
├── PageShell.tsx          # PageShell & PageHeader
├── PaginationBar.tsx      # Thanh phân trang chuẩn tabular-nums
├── StateBlock.tsx         # LoadingState, EmptyState, ErrorAlert, InfoBanner
├── StatusBadge.tsx        # StatusBadge, DifficultyBadge, TelemetryChip
├── StepIndicator.tsx      # Thanh tiến trình đa bước
├── SurfaceCard.tsx        # SurfaceCard & SurfaceSectionHeader
├── TripSummaryBanner.tsx  # TripSummaryBanner & TripMetaGrid
├── index.ts               # Barrel export tập trung (@/components/ui)
└── README.md              # Tài liệu hướng dẫn sử dụng bộ UI Component
```

