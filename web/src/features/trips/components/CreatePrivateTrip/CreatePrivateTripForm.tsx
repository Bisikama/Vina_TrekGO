"use client";

import React, { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { usePrivateTrips } from "../../hooks/usePrivateTrips";
import Link from "next/link";
import { SystemTrailMap } from "@/features/routes/components/SystemTrailMap";
import { apiClient } from "@/lib/axios";

export const CreatePrivateTripForm = () => {
  const router = useRouter();
  const { busy, error, sources, pickups, loadSources, loadPickups, create } = usePrivateTrips();
  
  const [sourceKey, setSourceKey] = useState("");
  
  const [formData, setFormData] = useState({
    title: "",
    description: "",
    startAt: "",
    endAt: "",
    capacity: 5,
    pickupPointId: ""
  });

  const getMinStartAt = () => {
    const now = new Date();
    now.setMinutes(now.getMinutes() - now.getTimezoneOffset());
    return now.toISOString().slice(0, 16);
  };

  const getMinEndAt = () => {
    if (formData.startAt) {
      return formData.startAt;
    }
    return getMinStartAt();
  };

  const [trailDetail, setTrailDetail] = useState<any>(null);
  const [loadingMap, setLoadingMap] = useState(false);

  useEffect(() => {
    loadSources();
  }, [loadSources]);

  const selectedSource = sources.find(s => `${s.type}:${s.id}` === sourceKey);

  useEffect(() => {
    if (selectedSource?.destinationId) {
      loadPickups(selectedSource.destinationId);
    }
    
    // Fetch 3D Map Data for SYSTEM trails
    if (selectedSource && selectedSource.type === 'SYSTEM') {
      setLoadingMap(true);
      apiClient.get(`/api/v1/system-trails/${selectedSource.id}`)
        .then(res => setTrailDetail(res.data))
        .catch(err => console.error("Failed to load trail 3D data:", err))
        .finally(() => setLoadingMap(false));
    } else {
      setTrailDetail(null);
    }
  }, [selectedSource, loadPickups]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    setFormData(prev => ({ ...prev, [e.target.name]: e.target.value }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedSource || !selectedSource.destinationId) return;

    if (!formData.pickupPointId) {
      alert("Vui lòng chọn một điểm tập kết hợp lệ.");
      return;
    }

    const filteredPoints = selectedSource.points.filter(p => selectedSource.type === 'PERSONAL' || (p as any).destinationId === selectedSource.destinationId || true); // We just pass all from frontend for now. 
    
    if (filteredPoints.length === 0) {
      alert("Tuyến đường này không có trạm nghỉ hợp lệ nào. Yêu cầu ít nhất 1 trạm nghỉ.");
      return;
    }

    const now = new Date();
    const startDate = new Date(formData.startAt);
    const endDate = new Date(formData.endAt);

    if (startDate <= now) {
      alert("Thời gian bắt đầu chuyến đi phải diễn ra trong tương lai.");
      return;
    }

    if (endDate <= startDate) {
      alert("Thời gian kết thúc chuyến đi phải sau thời gian bắt đầu.");
      return;
    }

    try {
      const startIso = startDate.toISOString();
      const endIso = endDate.toISOString();
      
      const created = await create({
        title: formData.title,
        description: formData.description,
        startAt: startIso,
        endAt: endIso,
        capacity: Number(formData.capacity),
        pickupPointId: formData.pickupPointId,
        type: selectedSource.type as 'PERSONAL' | 'SYSTEM',
        trailRef: selectedSource.id,
        destinationId: selectedSource.destinationId,
        checkpointIds: selectedSource.points.map(p => p.id)
      });
      
      if (created) {
        router.push(`/my-trips`);
      }
    } catch (err) {
      console.error(err);
    }
  };

  return (
    <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 pb-24">
      {/* Header */}
      <div className="mb-8 flex items-center justify-between">
        <div>
          <Link href="/my-trips" className="inline-flex items-center text-sm font-semibold text-gray-500 hover:text-gray-900 transition-colors mb-4">
            <svg className="w-4 h-4 mr-1.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M10 19l-7-7m0 0l7-7m-7 7h18" /></svg>
            Quay lại
          </Link>
          <h1 className="text-3xl font-extrabold text-gray-900 tracking-tight">Tổ chức chuyến đi mới</h1>
          <p className="text-gray-500 mt-2">Điền thông tin bên dưới để tạo nhóm và mời bạn bè cùng tham gia trekking.</p>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="flex flex-col space-y-8">
        
        {error && (
          <div className="p-4 bg-red-50 text-red-700 rounded-xl border border-red-200 flex items-start gap-3 shadow-sm">
            <svg className="w-5 h-5 shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" /></svg>
            <span className="font-medium text-sm">{error}</span>
          </div>
        )}

        <div className="flex flex-col lg:flex-row gap-8 items-stretch">
          
          {/* Cung đường */}
          <section className="bg-white rounded-2xl shadow-sm border border-gray-200 overflow-hidden w-full lg:w-1/2 flex flex-col">
            <div className="border-b border-gray-100 px-6 py-5 bg-gray-50/50">
              <h2 className="text-lg font-bold text-gray-900">1. Tuyến Đường Trekking</h2>
            </div>
            <div className="p-6">
              <label className="block text-sm font-semibold text-gray-700 mb-2">Chọn Tuyến Đường</label>
              <select 
                className="w-full px-4 py-3 rounded-xl border border-gray-300 bg-white shadow-sm focus:ring-2 focus:ring-[#1B4332] focus:border-[#1B4332] transition-colors font-medium text-gray-800"
                value={sourceKey}
                onChange={e => setSourceKey(e.target.value)}
                required
              >
                <option value="" disabled>-- Bấm để chọn tuyến đường --</option>
                {sources.map(s => (
                  <option key={`${s.type}:${s.id}`} value={`${s.type}:${s.id}`}>
                    {s.name} ({s.type === 'SYSTEM' ? 'Hệ thống' : 'Cá nhân'})
                  </option>
                ))}
              </select>

              {selectedSource && (
                <div className="mt-6">
                  <label className="block text-sm font-semibold text-gray-700 mb-3">Các Trạm Nghỉ Dự Kiến (Checkpoints)</label>
                  <div className="grid grid-cols-1 gap-3 max-h-60 overflow-y-auto pr-2 custom-scrollbar">
                    {selectedSource.points.map((p, index) => (
                      <div key={p.id} className="flex items-start gap-3 p-3.5 rounded-xl border border-gray-200 bg-gray-50/50">
                        <div>
                          <p className="text-sm font-bold text-[#1B4332]">
                            Trạm {index + 1}: {p.name}
                          </p>
                        </div>
                      </div>
                    ))}
                    {selectedSource.points.length === 0 && (
                      <div className="p-4 rounded-xl bg-gray-50 text-center text-gray-500 text-sm">
                        Không có trạm nghỉ nào trên tuyến đường này.
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>
          </section>

          {/* 3D Map Area */}
          <section className="bg-white rounded-2xl shadow-sm border border-gray-200 overflow-hidden w-full lg:w-1/2 flex flex-col min-h-[400px]">
            <div className="border-b border-gray-100 px-6 py-5 bg-gray-50/50 flex items-center justify-between">
              <div>
                <h2 className="text-lg font-bold text-gray-900 flex items-center gap-2">
                  <svg className="w-5 h-5 text-emerald-600" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3.055 11H5a2 2 0 012 2v1a2 2 0 002 2 2 2 0 012 2v2.945M8 3.935V5.5A2.5 2.5 0 0010.5 8h.5a2 2 0 012 2 2 2 0 104 0 2 2 0 012-2h1.064M15 20.488V18a2 2 0 012-2h3.064M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                  Bản đồ 3D Hành Trình
                </h2>
                <p className="text-sm text-gray-500 mt-1">Xem trước địa hình và các trạm nghỉ.</p>
              </div>
            </div>
            <div className="flex-1 relative bg-gray-100">
              {!selectedSource ? (
                <div className="absolute inset-0 flex flex-col items-center justify-center text-gray-400 p-8 text-center">
                  <svg className="w-16 h-16 mb-4 opacity-50" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M9 20l-5.447-2.724A1 1 0 013 16.382V5.618a1 1 0 011.447-.894L9 7m0 13l6-3m-6 3V7m6 10l4.553 2.276A1 1 0 0021 18.382V7.618a1 1 0 00-.553-.894L15 4m0 13V4m0 0L9 7" /></svg>
                  <p className="font-medium">Vui lòng chọn tuyến đường để xem bản đồ 3D</p>
                </div>
              ) : loadingMap ? (
                <div className="absolute inset-0 flex items-center justify-center bg-gray-100/80 backdrop-blur-sm z-10">
                   <svg className="animate-spin h-8 w-8 text-emerald-600" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg>
                </div>
              ) : trailDetail ? (
                <div className="absolute inset-0">
                  <SystemTrailMap trail={trailDetail} />
                </div>
              ) : (
                <div className="absolute inset-0 flex flex-col items-center justify-center text-gray-400 p-8 text-center bg-gray-50">
                  <svg className="w-12 h-12 mb-3 opacity-50 text-amber-500" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                  <p className="font-medium text-gray-600">Bản đồ 3D chưa khả dụng cho tuyến đường này</p>
                </div>
              )}
            </div>
          </section>

        </div>
        {/* Thông tin chuyến đi */}
        <section className="bg-white rounded-2xl shadow-sm border border-gray-200 overflow-hidden w-full">
          <div className="border-b border-gray-100 px-6 py-5 bg-gray-50/50">
            <h2 className="text-lg font-bold text-gray-900">2. Lịch Trình & Thông Tin</h2>
          </div>
          
          <div className="p-6 space-y-6">
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2">Tên chuyến đi</label>
              <input 
                type="text" 
                name="title"
                value={formData.title}
                onChange={handleChange}
                className="w-full px-4 py-3 rounded-xl border border-gray-300 shadow-sm focus:ring-2 focus:ring-[#1B4332] focus:border-[#1B4332] transition-colors font-medium"
                placeholder="Ví dụ: Leo núi cuối tuần cùng hội bạn thân"
                required
                maxLength={220}
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">Khởi hành</label>
                <input 
                  type="datetime-local" 
                  name="startAt"
                  value={formData.startAt}
                  onChange={handleChange}
                  min={getMinStartAt()}
                  className="w-full px-4 py-3 rounded-xl border border-gray-300 shadow-sm focus:ring-2 focus:ring-[#1B4332] focus:border-[#1B4332] transition-colors text-sm font-medium"
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">Kết thúc</label>
                <input 
                  type="datetime-local" 
                  name="endAt"
                  value={formData.endAt}
                  onChange={handleChange}
                  min={getMinEndAt()}
                  className="w-full px-4 py-3 rounded-xl border border-gray-300 shadow-sm focus:ring-2 focus:ring-[#1B4332] focus:border-[#1B4332] transition-colors text-sm font-medium"
                  required
                />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">Quy mô nhóm</label>
                <input 
                  type="number" 
                  name="capacity"
                  value={formData.capacity}
                  onChange={handleChange}
                  min={1}
                  className="w-full px-4 py-3 rounded-xl border border-gray-300 shadow-sm focus:ring-2 focus:ring-[#1B4332] focus:border-[#1B4332] transition-colors font-medium"
                  required
                />
              </div>
              
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">Điểm tập kết</label>
                <select 
                  name="pickupPointId"
                  value={formData.pickupPointId}
                  onChange={handleChange}
                  className="w-full px-4 py-3 rounded-xl border border-gray-300 bg-white shadow-sm focus:ring-2 focus:ring-[#1B4332] focus:border-[#1B4332] transition-colors font-medium disabled:opacity-50 disabled:bg-gray-50"
                  required
                  disabled={!selectedSource || pickups.length === 0}
                >
                  <option value="" disabled>{pickups.length > 0 ? "-- Chọn điểm hẹn --" : "Chưa có địa điểm"}</option>
                  {pickups.map(p => (
                    <option key={p.id} value={p.id}>{p.name}</option>
                  ))}
                </select>
              </div>
            </div>

          </div>
        </section>

          {/* Footer Actions */}
          <div className="flex flex-col-reverse sm:flex-row items-center justify-end gap-4 pt-4">
            <Link 
              href="/my-trips"
              className="w-full sm:w-auto px-6 py-3.5 rounded-xl font-bold text-gray-600 hover:bg-gray-100 transition-colors text-center"
            >
              Hủy bỏ
            </Link>
            <button 
              type="submit"
              disabled={busy || !selectedSource}
              className="w-full sm:w-auto px-8 py-3.5 rounded-xl font-bold text-white bg-[#1B4332] hover:bg-[#153426] shadow-lg shadow-[#1B4332]/20 transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
            >
              {busy ? (
                <>
                  <svg className="animate-spin h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg>
                  Đang xử lý...
                </>
              ) : (
                <>
                  Tạo Chuyến Đi
                  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M9 5l7 7-7 7" /></svg>
                </>
              )}
            </button>
          </div>

      </form>
    </div>
  );
};
