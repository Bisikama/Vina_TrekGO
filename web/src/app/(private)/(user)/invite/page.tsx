"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { SurfaceCard, Button } from "@/components/ui";

export default function InviteEntryPage() {
  const [code, setCode] = useState("");
  const router = useRouter();

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const normalized = code.trim().toUpperCase().replace(/[^A-Z0-9]/g, "");
    if (normalized.length === 6) {
      router.push(`/invite/${normalized}`);
    }
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const cleaned = e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 6);
    setCode(cleaned);
  };

  return (
    <div className="min-h-screen bg-[#F7F7F4] flex items-center justify-center p-4">
      <SurfaceCard padding="lg" className="w-full max-w-md shadow-sm">
        <div className="text-center mb-8">
          <div className="w-12 h-12 bg-emerald-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <svg className="w-6 h-6 text-emerald-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 15l-2 5L9 9l11 4-5 2zm0 0l5 5M7.188 2.239l.777 2.897M5.136 7.965l-2.898-.777M13.95 4.05l-2.122 2.122m-5.657 5.656l-2.12 2.122" />
            </svg>
          </div>
          <h1 className="text-2xl font-bold text-gray-900">Tham gia chuyến đi</h1>
          <p className="text-gray-500 text-sm mt-2">
            Nhập mã mời 6 ký tự được gửi từ trưởng đoàn để tham gia nhóm.
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-5">
          <div>
            <label htmlFor="code" className="block text-sm font-bold text-gray-700 mb-2">
              Mã mời (6 ký tự)
            </label>
            <input
              type="text"
              id="code"
              maxLength={6}
              autoCapitalize="characters"
              autoCorrect="off"
              spellCheck="false"
              value={code}
              onChange={handleChange}
              placeholder="VD: K7X9P2"
              className="w-full px-4 py-3.5 bg-gray-50 border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500/50 focus:border-emerald-500 transition-colors tracking-[0.3em] text-center font-mono text-xl font-bold uppercase text-gray-900"
              required
            />
            <p className="text-xs text-gray-400 mt-2 text-center">
              Gồm 6 chữ cái in hoa và số
            </p>
          </div>

          <Button
            type="submit"
            variant="primary"
            disabled={code.length !== 6}
            className="w-full py-3"
          >
            Tìm chuyến đi
          </Button>
        </form>
      </SurfaceCard>
    </div>
  );
}
