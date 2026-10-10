import React from 'react';

export function DeliveryList() {
  return (
    <div className="p-8 space-y-6 bg-white min-h-full">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-black text-[#123f2d] tracking-tight">Quản lý Giao Nhận</h1>
          <p className="text-sm text-slate-500 mt-1">Quản lý vận đơn, điều phối giao đồ và thu hồi thiết bị cho khách thuê</p>
        </div>
        <div className="flex gap-3">
          <button className="px-4 py-2 border border-slate-200 text-slate-700 rounded-lg text-sm font-semibold hover:bg-slate-50 transition-colors">
            In phiếu hàng loạt
          </button>
          <button className="px-4 py-2 bg-[#0d5b3a] text-white rounded-lg text-sm font-semibold hover:bg-[#0a462c] shadow-sm transition-colors flex items-center gap-2">
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
            </svg>
            Tạo vận đơn mới
          </button>
        </div>
      </div>

      <div className="grid grid-cols-3 gap-6">
        {/* Column 1: Chờ giao */}
        <div className="bg-slate-50/50 rounded-xl border border-slate-200 p-4 min-h-[600px] flex flex-col gap-4">
          <div className="flex justify-between items-center mb-2">
            <h3 className="font-bold text-slate-700">Chờ Lấy Hàng / Giao</h3>
            <span className="bg-amber-100 text-amber-700 text-xs font-bold px-2.5 py-0.5 rounded-full">4</span>
          </div>

          <div className="bg-white p-4 rounded-lg border border-slate-200 shadow-sm hover:shadow transition-shadow cursor-pointer">
            <div className="flex justify-between items-start mb-3">
              <span className="text-xs font-bold text-[#0d5b3a] bg-emerald-50 px-2 py-1 rounded">VD-20241005-01</span>
              <span className="text-xs text-slate-500">Giao Tận Nơi</span>
            </div>
            <h4 className="font-semibold text-slate-900 mb-1">Anh Quang (0933.123.456)</h4>
            <p className="text-xs text-slate-500 mb-3">Số 12 ngõ 45, Trần Thái Tông, Cầu Giấy</p>
            <div className="text-xs space-y-1 text-slate-700">
              <div className="flex justify-between"><span>2x Lều Naturehike 4 người</span></div>
              <div className="flex justify-between"><span>4x Túi ngủ rằn ri</span></div>
            </div>
            <div className="mt-4 pt-3 border-t border-slate-100 flex gap-2">
              <button className="flex-1 py-1.5 bg-[#0d5b3a] text-white text-xs font-bold rounded hover:bg-[#0a462c]">Xác nhận lấy</button>
              <button className="flex-1 py-1.5 bg-slate-100 text-slate-600 text-xs font-bold rounded hover:bg-slate-200">Sửa</button>
            </div>
          </div>
          
          <div className="bg-white p-4 rounded-lg border border-slate-200 shadow-sm hover:shadow transition-shadow cursor-pointer">
            <div className="flex justify-between items-start mb-3">
              <span className="text-xs font-bold text-[#0d5b3a] bg-emerald-50 px-2 py-1 rounded">VD-20241005-03</span>
              <span className="text-xs text-blue-600 bg-blue-50 px-2 py-1 rounded">Khách tới lấy</span>
            </div>
            <h4 className="font-semibold text-slate-900 mb-1">Chị Hà (0988.765.432)</h4>
            <p className="text-xs text-amber-600 font-medium mb-3">Dự kiến lấy: 14:00 - Hôm nay</p>
            <div className="text-xs space-y-1 text-slate-700">
              <div className="flex justify-between"><span>1x Bếp ga mini bọc gió</span></div>
              <div className="flex justify-between"><span>5x Gậy Trekking sợi Carbon</span></div>
            </div>
            <div className="mt-4 pt-3 border-t border-slate-100 flex gap-2">
              <button className="flex-1 py-1.5 bg-[#0d5b3a] text-white text-xs font-bold rounded hover:bg-[#0a462c]">Xác nhận đã lấy</button>
              <button className="flex-1 py-1.5 bg-slate-100 text-slate-600 text-xs font-bold rounded hover:bg-slate-200">Sửa</button>
            </div>
          </div>
        </div>

        {/* Column 2: Đang mượn */}
        <div className="bg-slate-50/50 rounded-xl border border-slate-200 p-4 min-h-[600px] flex flex-col gap-4">
          <div className="flex justify-between items-center mb-2">
            <h3 className="font-bold text-slate-700">Đang Thuê / Đang Trải Nghiệm</h3>
            <span className="bg-blue-100 text-blue-700 text-xs font-bold px-2.5 py-0.5 rounded-full">28</span>
          </div>
          
          <div className="bg-white p-4 rounded-lg border border-slate-200 shadow-sm hover:shadow transition-shadow cursor-pointer opacity-80">
            <div className="flex justify-between items-start mb-3">
              <span className="text-xs font-bold text-slate-600 bg-slate-100 px-2 py-1 rounded">VD-20241002-14</span>
            </div>
            <h4 className="font-semibold text-slate-900 mb-1">Anh Tuấn</h4>
            <p className="text-xs text-blue-600 font-medium">Chuyến: Fan-2N1D</p>
            <div className="mt-3 pt-3 border-t border-slate-100 text-[11px] text-slate-500">
              Dự kiến trả: 18:00 - Ngày mai (06/10)
            </div>
          </div>
        </div>

        {/* Column 3: Cần thu hồi */}
        <div className="bg-slate-50/50 rounded-xl border border-slate-200 p-4 min-h-[600px] flex flex-col gap-4">
          <div className="flex justify-between items-center mb-2">
            <h3 className="font-bold text-slate-700">Cần Thu Hồi / Đang Trả</h3>
            <span className="bg-red-100 text-red-700 text-xs font-bold px-2.5 py-0.5 rounded-full">2</span>
          </div>
          
          <div className="bg-white p-4 rounded-lg border border-red-200 shadow-sm hover:shadow transition-shadow cursor-pointer">
            <div className="flex justify-between items-start mb-3">
              <span className="text-xs font-bold text-red-700 bg-red-50 px-2 py-1 rounded">VD-20241001-09</span>
              <span className="text-xs text-red-600 font-bold">Quá hạn 1 ngày</span>
            </div>
            <h4 className="font-semibold text-slate-900 mb-1">Chị Thủy (0912.444.555)</h4>
            <p className="text-xs text-slate-500 mb-3">Đã gọi xác nhận, đang trên đường qua trả</p>
            <div className="mt-4 pt-3 border-t border-slate-100 flex gap-2">
              <button className="flex-1 py-1.5 bg-blue-600 text-white text-xs font-bold rounded hover:bg-blue-700">Tiếp nhận hoàn trả</button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
