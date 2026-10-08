'use client';
import { useState } from 'react';
import { LoginForm } from '@/features/auth/components/LoginForm';
import { RegisterForm } from '@/features/auth/components/RegisterForm';

// Reuse shared authentication forms and keep the selected trip/booking after login.
export function BookingSignIn() {
  const [mode, setMode] = useState<'login' | 'register' | null>(null);
  return <div className="space-y-4"><p>Đăng nhập để tiếp tục đặt chỗ và theo dõi thanh toán.</p>
    <div className="flex gap-4"><button onClick={() => setMode('login')} className="rounded-lg bg-green-900 px-4 py-2 text-white">Đăng nhập</button><button onClick={() => setMode('register')} className="rounded-lg border px-4 py-2">Tạo tài khoản</button></div>
    {mode && <section aria-label={mode === 'login' ? 'Đăng nhập' : 'Đăng ký'} className="rounded-lg border bg-white p-4">{mode === 'login' ? <LoginForm onSuccess={() => setMode(null)} /> : <RegisterForm onSuccess={() => setMode('login')} />}</section>}
  </div>;
}
