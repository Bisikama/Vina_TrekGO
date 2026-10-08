'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import axios from 'axios';
import { resendRegistrationApi, verifyRegistrationApi } from '../services/auth.api';
import { useAuthStore } from '../store/authStore';

export function VerifyRegistration({ email, onSuccess }: { email: string; onSuccess?: () => void }) {
  const router = useRouter();
  const [otp, setOtp] = useState(''); const [error, setError] = useState(''); const [notice, setNotice] = useState(''); const [busy, setBusy] = useState(false);
  const run = async (task: () => Promise<void>) => { setBusy(true); setError(''); try { await task(); } catch (e) { setError(axios.isAxiosError(e) ? e.response?.data?.error?.message ?? 'Không thể xác thực. Vui lòng thử lại.' : 'Không thể kết nối máy chủ.'); } finally { setBusy(false); } };
  return <form className="space-y-4" onSubmit={(e) => { e.preventDefault(); void run(async () => {
    const result = await verifyRegistrationApi(email, otp);
    useAuthStore.getState().setAuth(result.user, result.accessToken, result.refreshToken);
    document.cookie = 'mock_token=valid_mock_token; path=/; max-age=3600';
    if (onSuccess) onSuccess(); else router.push('/trips');
  }); }}>
    <h2 className="text-2xl font-bold">Xác thực email</h2><p>Nhập mã 6 chữ số được gửi đến {email}.</p>
    {error && <p role="alert" className="text-red-700">{error}</p>}{notice && <p role="status">{notice}</p>}
    <label className="block">Mã OTP<input required inputMode="numeric" autoComplete="one-time-code" pattern="[0-9]{6}" maxLength={6} value={otp} onChange={(e) => setOtp(e.target.value)} className="mt-1 w-full rounded-lg border p-3" /></label>
    <button disabled={busy} className="rounded-lg bg-green-900 p-3 text-white disabled:opacity-50">{busy ? 'Đang xử lý…' : 'Xác thực tài khoản'}</button>
    <button type="button" disabled={busy} className="ml-4 underline" onClick={() => void run(async () => { const result = await resendRegistrationApi(email); setNotice(result.message); })}>Gửi lại mã</button>
  </form>;
}
