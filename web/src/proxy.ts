import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

export function proxy(request: NextRequest) {
  const path = request.nextUrl.pathname;

  // Giả lập lấy token từ cookie (Trong thực tế sẽ check token thật)
  const token = request.cookies.get('mock_token')?.value;

  // Các route không cần đăng nhập
  const isPublicPath = path.startsWith('/public');

  // Nếu người dùng cố vào các trang (user), (admin), (leader)... nhưng chưa có token
  if (!isPublicPath && !token) {
    return NextResponse.redirect(new URL('/public/login', request.url));
  }

  // Nếu đã đăng nhập mà cố vào lại trang login/register thì đá về trang chủ
  if (isPublicPath && token && path !== '/') {
    return NextResponse.redirect(new URL('/', request.url));
  }

  return NextResponse.next();
}

// Cấu hình áp dụng middleware cho những route nào
export const config = {
  matcher: [
    /*
     * Match all request paths except for the ones starting with:
     * - api (API routes)
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     * - public assets (images, etc)
     */
    '/((?!api|_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
};
