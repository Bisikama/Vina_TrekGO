# Quy ước phát triển Mobile

Tài liệu này là nguồn quy ước chính khi phát triển ứng dụng mobile Vina Trekgo. Mọi code mới và mọi lần refactor cần tuân theo tài liệu này. Ứng dụng đang dùng Expo SDK 57, React Native, TypeScript strict và Expo Router.

## 1. Nguyên tắc chung

- Ưu tiên code dễ đọc, dễ kiểm thử và dễ xóa hơn là abstraction sớm.
- Mỗi file chỉ nên có một trách nhiệm chính.
- Route chỉ điều hướng; screen ghép giao diện; feature chứa nghiệp vụ; component dùng chung chỉ chứa UI tổng quát.
- Không đặt component, type, utility hoặc API client trong `src/app` vì Expo Router xem file trong đó là route.
- Không gọi API trực tiếp trong component trình bày giao diện.
- Không dùng `any`. Dữ liệu từ bên ngoài phải có type và được kiểm tra khi cần.
- Không tạo barrel export (`index.ts`) cho toàn bộ project. Chỉ dùng `index.tsx` làm entry của một screen hoặc component phức tạp.
- Dùng alias `@/` cho import từ `src`; tránh chuỗi import tương đối dài như `../../../`.
- File và thư mục dùng `kebab-case`; component, type và enum dùng `PascalCase`; biến và hàm dùng `camelCase`.

## 2. Cấu trúc thư mục

```text
mobile/
├── assets/                    # Ảnh, font và tài nguyên tĩnh
├── scripts/                   # Script phục vụ phát triển/build
├── src/
│   ├── app/                   # Route và _layout của Expo Router, không chứa UI lớn
│   ├── screens/               # Phần thân của từng màn hình
│   │   └── home/
│   │       ├── components/    # Component chỉ Home sử dụng
│   │       └── index.tsx
│   ├── features/              # Nghiệp vụ theo domain khi bắt đầu có tính năng
│   │   └── tours/
│   │       ├── api/           # Hàm gọi API và query keys
│   │       ├── components/    # UI chỉ thuộc feature tours
│   │       ├── hooks/         # Query/mutation và logic tái sử dụng trong feature
│   │       ├── schemas/       # Schema form hoặc validation
│   │       └── types/         # Type riêng của feature
│   ├── components/            # UI dùng lại giữa ít nhất hai screen/feature
│   │   └── ui/                # Primitive: button, input, text, empty state...
│   ├── navigation/            # Tab/stack navigator dùng ở root layout
│   ├── providers/             # Query, auth, theme và provider cấp ứng dụng
│   ├── services/              # API client, secure storage, logging
│   ├── hooks/                 # Hook thật sự dùng xuyên feature
│   ├── constants/             # Theme và hằng số toàn ứng dụng
│   ├── types/                 # Type toàn ứng dụng hoặc type sinh từ OpenAPI
│   └── utils/                 # Hàm thuần, không phụ thuộc UI
├── app.json
├── package.json
└── tsconfig.json
```

Không tạo sẵn thư mục rỗng. Tạo `features`, `services`, `providers` hoặc thư mục con khi tính năng đầu tiên thực sự cần đến chúng.

## 3. Trách nhiệm của từng lớp

### Route (`src/app`)

Route phải mỏng: đọc route params khi cần và render screen. Navigation layout phải nằm trong `_layout.tsx`.

```tsx
import { TourDetailScreen } from '@/screens/tour-detail';

export default function TourDetailRoute() {
  return <TourDetailScreen />;
}
```

Dynamic route dùng tên `[id].tsx`; nhóm route dùng `(auth)`, `(tabs)` hoặc tên thể hiện mục đích. Luôn duy trì route `/` hợp lệ.

### Screen (`src/screens`)

Screen chịu trách nhiệm ghép các section, xử lý trạng thái hiển thị và gọi hook của feature. Component chỉ dùng bởi screen đó đặt cạnh screen trong `components/`.

Không chuyển một component vào `src/components` chỉ vì có khả năng sẽ tái sử dụng. Chỉ chuyển khi nó đã được dùng bởi ít nhất hai screen/feature và có API props rõ ràng.

### Feature (`src/features`)

Feature gom logic theo nghiệp vụ như `auth`, `tours`, `bookings`, `profile`. Một feature có thể chứa API, hook, schema, type và component riêng. Feature không được import code nội bộ của feature khác; nếu logic thực sự dùng chung, đưa nó lên `services`, `components`, `hooks`, `types` hoặc `utils`.

### Shared component (`src/components`)

- Dùng named export.
- Props phải được khai báo bằng type rõ ràng.
- Hỗ trợ trạng thái cần thiết như pressed, disabled, loading và accessibility.
- Cho phép caller chỉnh layout qua `style`, nhưng màu sắc và nhận diện chính nên đến từ theme/variant.
- Ưu tiên composition bằng `children` thay vì thêm quá nhiều props mô tả nội dung.
- Style colocate ở cuối file với `StyleSheet.create`; không tạo file `.styles.ts` riêng nếu chưa có lý do thực tế.

## 4. Data flow và state

Luồng chuẩn cho dữ liệu server:

```text
Route -> Screen -> feature hook -> feature API -> shared API client -> NestJS
```

- Server state: dùng TanStack Query khi được cài đặt; query key phải nằm cạnh API/hook của feature.
- Form state: dùng React Hook Form; schema validation dùng Zod khi được cài đặt.
- Token: lưu bằng `expo-secure-store`, không lưu access/refresh token trong AsyncStorage.
- Client state dùng chung: chỉ thêm Zustand khi state không thuộc server, form, route hoặc component local.
- State cục bộ: ưu tiên `useState` hoặc `useReducer` gần nơi sử dụng.
- Không copy kết quả query sang global store.

Màn hình tải dữ liệu phải phân biệt bốn trạng thái: loading, error, empty và content. Khi refetch lỗi nhưng đã có cache, tiếp tục hiển thị dữ liệu cũ và báo lỗi không chặn toàn màn hình.

## 5. API và authentication

- Base URL lấy từ `EXPO_PUBLIC_API_URL`; không hardcode URL trong feature.
- API client dùng chung chịu trách nhiệm header JSON, bearer token, chuẩn hóa lỗi và refresh token.
- Mỗi feature chỉ khai báo endpoint thuộc domain của mình.
- Response/request type nên được sinh từ OpenAPI của NestJS hoặc khai báo rõ ràng; không ép kiểu mù bằng `as`.
- Không log token, mật khẩu, CCCD hoặc dữ liệu nhạy cảm.
- Khi refresh token thất bại, xóa session và đưa người dùng về auth flow.

## 6. UI và theme

- Dùng giá trị trong `src/constants/theme.ts`; không rải hex color, font size hoặc spacing lặp lại trong screen.
- Tôn trọng light/dark mode và safe area.
- Nội dung bấm được phải có pressed feedback và accessibility role/label phù hợp.
- Danh sách dài dùng `FlatList`/`FlashList`, không render bằng `ScrollView.map`.
- Ảnh ứng dụng ưu tiên `expo-image`.
- Khác biệt nhỏ giữa platform dùng `Platform.select`; khác biệt lớn dùng file `.ios.tsx`, `.android.tsx`, `.web.tsx` với cùng props.
- Cài native dependency bằng `npx expo install <package>` để giữ phiên bản tương thích SDK 57.

## 7. TypeScript và import

- Giữ `strict: true`.
- Dùng `import type` cho import chỉ là type.
- Ưu tiên union type cụ thể thay cho `string` khi tập giá trị đã biết.
- Hàm public, hook và API function cần tên thể hiện hành vi, ví dụ `getTours`, `useTourDetail`, `createBooking`.
- Thứ tự import: package bên ngoài, dòng trống, alias nội bộ. Để formatter/linter xử lý chi tiết còn lại.
- Không dùng default export cho component thông thường. Expo Router route và platform entry có thể dùng default export theo yêu cầu framework.

## 8. Cách thêm một tính năng

Ví dụ thêm tính năng danh sách tour:

1. Tạo `src/features/tours/api/get-tours.ts` và type/schema liên quan.
2. Tạo `src/features/tours/hooks/use-tours.ts` để quản lý query và cache.
3. Tạo component riêng của feature trong `src/features/tours/components` nếu cần.
4. Tạo `src/screens/tours/index.tsx` để xử lý loading/error/empty/content.
5. Tạo route mỏng trong `src/app/tours/index.tsx` hoặc group phù hợp.
6. Chỉ chuyển UI sang `src/components` sau khi có nhu cầu dùng chung thực tế.
7. Thêm test cạnh logic quan trọng, ví dụ `format-price.test.ts` cạnh `format-price.ts`.

## 9. Definition of Done

Trước khi hoàn thành một thay đổi:

- `npm run lint` chạy thành công.
- `npx tsc --noEmit` chạy thành công.
- App mở được trên platform bị ảnh hưởng; thay đổi navigation phải kiểm tra cả deep link/route trực tiếp khi có liên quan.
- Không có warning mới trong console.
- Đã kiểm tra loading, error, empty, content nếu màn hình có dữ liệu.
- Đã kiểm tra light/dark mode, safe area và kích thước chữ lớn đối với UI mới.
- Không chứa secret, token hoặc URL môi trường bị hardcode.
- File mới nằm đúng lớp và không tạo abstraction chưa được sử dụng.

## 10. Ngoại lệ

Nếu cần phá vỡ quy ước vì giới hạn platform hoặc thư viện, ghi chú ngắn ngay tại code hoặc pull request: quy tắc nào bị phá, lý do, và phạm vi ảnh hưởng. Không tạo một kiến trúc thứ hai song song với cấu trúc trên.
