"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export default function InviteEntryPage() {
  const [code, setCode] = useState("");
  const router = useRouter();

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (code.trim()) {
      router.push(`/invite/${code.trim()}`);
    }
  };

  return (
    <div className="min-h-screen bg-[#F7F7F4] flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-8 w-full max-w-md">
        <div className="text-center mb-8">
          <div className="w-12 h-12 bg-emerald-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <svg className="w-6 h-6 text-emerald-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 15l-2 5L9 9l11 4-5 2zm0 0l5 5M7.188 2.239l.777 2.897M5.136 7.965l-2.898-.777M13.95 4.05l-2.122 2.122m-5.657 5.656l-2.12 2.122" />
            </svg>
          </div>
          <h1 className="text-2xl font-bold text-gray-900">Tham gia chuyến đi</h1>
          <p className="text-gray-500 text-sm mt-2">Nhập mã mời được gửi từ trưởng đoàn để tham gia nhóm.</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label htmlFor="code" className="block text-sm font-bold text-gray-700 mb-1.5">
              Mã mời (Invite Code)
            </label>
            <input
              type="text"
              id="code"
              value={code}
              onChange={(e) => setCode(e.target.value)}
              placeholder="VD: 1nfyeSxeSLf-..."
              className="w-full px-4 py-3 bg-gray-50 border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500/50 focus:border-emerald-500 transition-colors tracking-widest text-center font-medium"
              required
            />
          </div>
          
          <button
            type="submit"
            disabled={!code.trim()}
            className="w-full py-3 px-4 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 disabled:hover:bg-emerald-600 text-white font-bold rounded-xl transition-colors shadow-sm shadow-emerald-200"
          >
            Tìm chuyến đi
          </button>
        </form>
      </div>
    </div>
  );
}
