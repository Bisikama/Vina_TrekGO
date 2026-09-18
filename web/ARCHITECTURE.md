# 🚀 Hướng Dẫn Phát Triển & Cấu Trúc Dự Án (Onboarding Guide)

Chào mừng bạn tham gia vào dự án **TREKKING-FRONTEND**! 

Dự án này sử dụng kiến trúc **Feature-Based Architecture** (Feature Slices / Bulletproof React) kết hợp với **Next.js App Router**, **TypeScript**, **Tailwind CSS**, **Zustand** và **Axios**.

Tài liệu này sẽ hướng dẫn bạn cách hiểu cấu trúc dự án, tuân thủ các quy tắc viết code và cách thêm một tính năng mới.

---

## 🛠️ Tech Stack Cốt Lõi

- **Framework:** Next.js (App Router)
- **Language:** TypeScript
- **Styling:** Tailwind CSS
- **Global State Management:** Zustand
- **HTTP Client:** Axios
- **Code Style:** Named Exports Only, Strict Separation of Concerns

---

## 📂 1. Cấu Trúc Thư Mục (Directory Layout)

```text
frontend/
├── src/
│   ├── app/                        # Next.js App Router (Routing, Layouts, Pages)
│   │   ├── (auth)/
│   │   │   └── login/page.tsx      # Route page: Render <LoginForm /> từ @/features/auth
│   │   ├── layout.tsx
│   │   └── page.tsx
│   │
│   ├── components/                 # Shared UI Components dùng chung toàn dự án
│   │   └── ui/                     # Basic Atomic Elements (Button, Input, Modal, Spinner...)
│   │
│   ├── lib/                        # Global Configurations & Utilities
│   │   └── axios.ts                # Shared Axios instance (Base URL, Interceptors...)
│   │
│   └── features/                   # ✨ TRÁI TIM CỦA DỰ ÁN: FEATURE-BASED MODULES
│       ├── auth/                   # Feature Auth
│       │   ├── components/         # UI Components dành riêng cho Auth (LoginForm.tsx,...)
│       │   ├── hooks/              # Custom Hooks chứa logic (useLogin.ts,...)
│       │   ├── services/           # API calls (auth.api.ts)
│       │   ├── store/              # Zustand Store (authStore.ts)
│       │   ├── types/              # TypeScript Types/Interfaces (auth.types.ts)
│       │   └── index.ts            # 🔒 PUBLIC API của feature Auth
│       │
│       ├── products/               # Feature Products
│       └── user-profile/           # Feature User Profile
```

---

## 📐 2. Quy Tắc Viết Code Bắt Buộc (Strict Coding Standards)

### 🔴 Quy tắc 1: KHÔNG dùng `default export` (Named Exports ONLY)
- ❌ **KHÔNG:** `export default function LoginForm() { ... }`
- ✅ **BẮT BUỘC:** `export const LoginForm = () => { ... }`
- *Lý do:* Giúp IDE auto-import chính xác 100%, refactor đổi tên nhất quán và tránh việc mỗi dev đặt một tên khác nhau khi import.

---

### 🔴 Quy tắc 2: Phân Tách Trách Nhiệm Rõ Ràng (Separation of Concerns)
Mỗi lớp trong một Feature chỉ làm đúng nhiệm vụ của nó:

1. **`types/*.types.ts`**: Chỉ định nghĩa TypeScript interfaces & types.
2. **`services/*.api.ts`**: Chỉ chứa logic gọi API (Axios). Không chứa React state.
3. **`store/*Store.ts`**: Chỉ chứa Zustand store quản lý state toàn cục của feature.
4. **`hooks/use*.ts`**: Chứa **toàn bộ logic kinh doanh** (state, loading, validate, gọi API, cập nhật Store). Đặt `"use client"` ở đầu file.
5. **`components/*.tsx`**: Là **Dumb UI Component**. KHÔNG viết API call, KHÔNG viết logic phức tạp trực tiếp trong JSX. Chỉ tiêu thụ data và handler từ Custom Hook. Đặt `"use client"` ở đầu file.

---

### 🔴 Quy tắc 3: Quy Tắc Public API (`index.ts`)
- Mọi module bên ngoài (ví dụ: các trang trong `src/app/` hoặc các feature khác) **CHỈ ĐƯỢC IMPORT** thông qua file `index.ts` của feature đó.
- ✅ **ĐÚNG:** `import { LoginForm, useAuthStore } from "@/features/auth";`
- ❌ **SAI:** `import { LoginForm } from "@/features/auth/components/LoginForm";`
- *Lý do:* Giúp đóng gói logic nội bộ của feature. Bạn có thể tự do refactor lại thư mục bên trong feature mà không sợ hỏng code ở nơi khác.

---

### 🔴 Quy tắc 4: Shared vs Feature Components
- Nếu UI component đó **chỉ dành riêng cho 1 tính năng** (vd: `LoginForm`, `ProductCard`) ➡️ Đặt vào `src/features/<feature-name>/components/`.
- Nếu UI component đó là **thiết kế cơ bản dùng lại ở nhiều nơi** (vd: `Button`, `TextField`, `Modal`, `Table`) ➡️ Đặt vào `src/components/ui/`.

---

## 📝 3. Quy Trình Thêm Một Tính Năng Mới (Step-by-step)

Giả sử bạn cần làm tính năng **Danh Sách Sản Phẩm (`products`)**:

### Bước 1: Khai báo Types (`src/features/products/types/product.types.ts`)
```typescript
export interface Product {
  id: string;
  name: string;
  price: number;
  image: string;
}
```

### Bước 2: Tạo API Service (`src/features/products/services/product.api.ts`)
```typescript
import { apiClient } from "@/lib/axios";
import { Product } from "../types/product.types";

export const getProductsApi = async (): Promise<Product[]> => {
  const { data } = await apiClient.get<Product[]>("/products");
  return data;
};
```

### Bước 3: (Tùy chọn) Tạo Store nếu cần State toàn cục (`src/features/products/store/productStore.ts`)
```typescript
import { create } from "zustand";
import { Product } from "../types/product.types";

interface ProductState {
  selectedProduct: Product | null;
  setSelectedProduct: (product: Product | null) => void;
}

export const useProductStore = create<ProductState>((set) => ({
  selectedProduct: null,
  setSelectedProduct: (product) => set({ selectedProduct: product }),
}));
```

### Bước 4: Viết Custom Hook chứa Logic (`src/features/products/hooks/useProducts.ts`)
```typescript
"use client";

import { useState, useEffect } from "react";
import { getProductsApi } from "../services/product.api";
import { Product } from "../types/product.types";

export const useProducts = () => {
  const [products, setProducts] = useState<Product[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    getProductsApi()
      .then(setProducts)
      .catch((err) => setError(err.message))
      .finally(() => setIsLoading(false));
  }, []);

  return { products, isLoading, error };
};
```

### Bước 5: Viết UI Component (`src/features/products/components/ProductList.tsx`)
```tsx
"use client";

import React from "react";
import { useProducts } from "../hooks/useProducts";

export const ProductList = () => {
  const { products, isLoading, error } = useProducts();

  if (isLoading) return <div>Loading products...</div>;
  if (error) return <div>Error: {error}</div>;

  return (
    <div className="grid grid-cols-3 gap-4">
      {products.map((p) => (
        <div key={p.id} className="p-4 border rounded-lg">
          <h3>{p.name}</h3>
          <p>${p.price}</p>
        </div>
      ))}
    </div>
  );
};
```

### Bước 6: Export ra Public API (`src/features/products/index.ts`)
```typescript
export { ProductList } from "./components/ProductList";
export { useProductStore } from "./store/productStore";
export type { Product } from "./types/product.types";
```

### Bước 7: Sử dụng tại Route Page (`src/app/products/page.tsx`)
```tsx
import { ProductList } from "@/features/products";

export default function ProductsPage() {
  return (
    <main className="p-8">
      <h1 className="text-2xl font-bold mb-6">Products</h1>
      <ProductList />
    </main>
  );
}
```

---

## 💻 4. Lệnh Thao Tác Dự Án (Commands)

```bash
# Di chuyển vào thư mục frontend
cd frontend

# Chạy môi trường phát triển (Dev server)
npm run dev

# Kiểm tra Linter
npm run lint

# Build bản Production & Kiểm tra TypeScript Typecheck
npm run build

# Chạy bản build Production
npm start
```

---

🎯 **Chúc bạn code vui vẻ! Nếu có thắc mắc về kiến trúc, hãy hỏi Team Lead hoặc trao đổi trên kênh trao đổi của dự án.**
