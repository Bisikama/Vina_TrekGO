"use client";

import React, { useState } from 'react';

type ComplaintStatus = 'Đang xử lý' | 'Chờ phản hồi' | 'Đã hoàn cọc';

interface Complaint {
  id: string;
  customerName: string;
  phone: string;
  reason: string;
  detail: string;
  amount: string;
  status: ComplaintStatus;
}

const initialComplaints: Complaint[] = [
  {
    id: "KN-8821",
    customerName: "Trần Lê Vũ",
    phone: "0981 234 567",
    reason: "Leader hủy chuyến phút chót",
    detail: "Chuyến: Fan-2N1D-05/10",
    amount: "1,500,000 đ",
    status: "Đang xử lý"
  },
  {
    id: "KN-8819",
    customerName: "Nguyễn Bảo Ngọc",
    phone: "0912 345 678",
    reason: "Thiết bị thuê bị lỗi (Lều)",
    detail: "Đơn thuê: RT-10922",
    amount: "500,000 đ",
    status: "Chờ phản hồi"
  },
  {
    id: "KN-8790",
    customerName: "Lê Văn Hùng",
    phone: "0934 567 890",
    reason: "Hủy chuyến do thời tiết bão",
    detail: "Chuyến: TaXua-2N1D-12/09",
    amount: "2,000,000 đ",
    status: "Đã hoàn cọc"
  }
];

export function ComplaintsList() {
  const [complaints, setComplaints] = useState<Complaint[]>(initialComplaints);
  const [selectedComplaint, setSelectedComplaint] = useState<Complaint | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);

  const openModal = (complaint: Complaint) => {
    setSelectedComplaint(complaint);
    setIsModalOpen(true);
  };

  const closeModal = () => {
    setSelectedComplaint(null);
    setIsModalOpen(false);
  };

  const handleRefund = () => {
    if (!selectedComplaint) return;
    setComplaints(prev => prev.map(c => 
      c.id === selectedComplaint.id ? { ...c, status: 'Đã hoàn cọc' } : c
    ));
    closeModal();
  };

  const handleUpdateStatus = (newStatus: ComplaintStatus) => {
    if (!selectedComplaint) return;
    setComplaints(prev => prev.map(c => 
      c.id === selectedComplaint.id ? { ...c, status: newStatus } : c
    ));
    closeModal();
  };

  const stats = {
    total: complaints.length,
    processing: complaints.filter(c => c.status === 'Đang xử lý' || c.status === 'Chờ phản hồi').length,
    refunded: complaints.filter(c => c.status === 'Đã hoàn cọc').length,
  };

  return (
    <div className="p-8 space-y-6 bg-[#FDFDFD] min-h-full">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-black text-[#0F172A] tracking-tight">Xử lý Khiếu nại & Hoàn cọc</h1>
          <p className="text-sm text-gray-500 mt-1">Quản lý các yêu cầu khiếu nại dịch vụ và hoàn trả tiền cọc cho khách hàng</p>
        </div>
        <div className="flex gap-3">
          <button className="px-4 py-2 bg-white border border-gray-200 text-gray-700 rounded-lg text-sm font-semibold hover:bg-gray-50 shadow-sm transition-colors">
            Xuất báo cáo
          </button>
        </div>
      </div>

      <div className="grid grid-cols-4 gap-4">
        <div className="bg-white p-5 rounded-xl border border-gray-100 shadow-sm">
          <div className="text-sm font-medium text-gray-500 mb-1">Tổng khiếu nại</div>
          <div className="text-2xl font-black text-gray-900">{stats.total}</div>
        </div>
        <div className="bg-white p-5 rounded-xl border border-gray-100 shadow-sm">
          <div className="text-sm font-medium text-amber-600 mb-1">Đang xử lý</div>
          <div className="text-2xl font-black text-amber-700">{stats.processing}</div>
        </div>
        <div className="bg-white p-5 rounded-xl border border-gray-100 shadow-sm">
          <div className="text-sm font-medium text-emerald-600 mb-1">Đã hoàn cọc</div>
          <div className="text-2xl font-black text-emerald-700">{stats.refunded}</div>
        </div>
        <div className="bg-white p-5 rounded-xl border border-gray-100 shadow-sm">
          <div className="text-sm font-medium text-red-600 mb-1">Cần can thiệp gấp</div>
          <div className="text-2xl font-black text-red-700">1</div>
        </div>
      </div>

      <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
        <div className="p-4 border-b border-gray-100 flex gap-4 bg-gray-50/50">
          <input 
            type="text" 
            placeholder="Tìm kiếm theo mã đơn, sđt..." 
            className="px-4 py-2 bg-white border border-gray-200 rounded-lg text-sm flex-1 focus:outline-none focus:border-[#1B5E41] focus:ring-1 focus:ring-[#1B5E41]"
          />
          <select className="px-4 py-2 bg-white border border-gray-200 rounded-lg text-sm text-gray-700 focus:outline-none">
            <option>Tất cả trạng thái</option>
            <option>Đang chờ xử lý</option>
            <option>Đã hoàn cọc</option>
          </select>
        </div>
        
        <table className="w-full text-left text-sm">
          <thead className="bg-gray-50/50 text-gray-500 font-medium">
            <tr>
              <th className="px-6 py-4">Mã Khiếu nại</th>
              <th className="px-6 py-4">Khách hàng</th>
              <th className="px-6 py-4">Lý do</th>
              <th className="px-6 py-4">Tiền cọc</th>
              <th className="px-6 py-4">Trạng thái</th>
              <th className="px-6 py-4 text-right">Thao tác</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {complaints.map(complaint => (
              <tr key={complaint.id} className="hover:bg-gray-50/50 transition-colors">
                <td className={`px-6 py-4 font-semibold ${complaint.status === 'Đã hoàn cọc' ? 'text-gray-500' : 'text-[#1B5E41]'}`}>{complaint.id}</td>
                <td className="px-6 py-4">
                  <div className="font-semibold text-gray-900">{complaint.customerName}</div>
                  <div className="text-xs text-gray-500">{complaint.phone}</div>
                </td>
                <td className="px-6 py-4">
                  <div className="text-gray-900">{complaint.reason}</div>
                  <div className="text-xs text-gray-500">{complaint.detail}</div>
                </td>
                <td className="px-6 py-4 font-medium text-gray-900">{complaint.amount}</td>
                <td className="px-6 py-4">
                  {complaint.status === 'Đang xử lý' && (
                    <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-amber-100 text-amber-700">
                      <span className="w-1.5 h-1.5 rounded-full bg-amber-500"></span>
                      Đang xử lý
                    </span>
                  )}
                  {complaint.status === 'Chờ phản hồi' && (
                    <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-red-100 text-red-700">
                      <span className="w-1.5 h-1.5 rounded-full bg-red-500"></span>
                      Chờ phản hồi
                    </span>
                  )}
                  {complaint.status === 'Đã hoàn cọc' && (
                    <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-emerald-100 text-emerald-700">
                      <span className="w-1.5 h-1.5 rounded-full bg-emerald-500"></span>
                      Đã hoàn cọc
                    </span>
                  )}
                </td>
                <td className="px-6 py-4 text-right">
                  <button onClick={() => openModal(complaint)} className={`${complaint.status === 'Đã hoàn cọc' ? 'text-gray-500 hover:text-gray-700' : 'text-[#1B5E41] hover:text-[#0f3625]'} font-semibold text-sm`}>
                    {complaint.status === 'Đã hoàn cọc' ? 'Xem chi tiết' : 'Xử lý ngay'}
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {isModalOpen && selectedComplaint && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-lg overflow-hidden flex flex-col">
            <div className="px-6 py-4 border-b border-gray-100 flex justify-between items-center bg-gray-50">
              <h3 className="font-bold text-gray-900 text-lg">Chi tiết khiếu nại {selectedComplaint.id}</h3>
              <button onClick={closeModal} className="text-gray-400 hover:text-gray-600">
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
              </button>
            </div>
            
            <div className="p-6 space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <div className="text-xs text-gray-500 font-medium">Khách hàng</div>
                  <div className="font-semibold text-gray-900">{selectedComplaint.customerName}</div>
                  <div className="text-sm text-gray-600">{selectedComplaint.phone}</div>
                </div>
                <div>
                  <div className="text-xs text-gray-500 font-medium">Trạng thái hiện tại</div>
                  <div className="font-semibold text-gray-900 mt-1">{selectedComplaint.status}</div>
                </div>
              </div>

              <div className="bg-gray-50 rounded-lg p-4 border border-gray-100">
                <div className="text-xs text-gray-500 font-medium mb-1">Nội dung khiếu nại</div>
                <div className="font-medium text-gray-900">{selectedComplaint.reason}</div>
                <div className="text-sm text-gray-600">{selectedComplaint.detail}</div>
              </div>

              <div>
                <div className="text-xs text-gray-500 font-medium">Số tiền cọc cần hoàn</div>
                <div className="text-xl font-black text-gray-900 mt-1">{selectedComplaint.amount}</div>
              </div>
            </div>

            <div className="px-6 py-4 border-t border-gray-100 bg-gray-50 flex justify-end gap-3">
              <button onClick={closeModal} className="px-4 py-2 bg-white border border-gray-200 text-gray-700 rounded-lg text-sm font-semibold hover:bg-gray-100">
                Đóng
              </button>
              {selectedComplaint.status !== 'Đã hoàn cọc' && (
                <>
                  <button onClick={() => handleUpdateStatus('Chờ phản hồi')} className="px-4 py-2 bg-amber-100 text-amber-700 rounded-lg text-sm font-semibold hover:bg-amber-200">
                    Chờ phản hồi thêm
                  </button>
                  <button onClick={handleRefund} className="px-4 py-2 bg-[#1B5E41] text-white rounded-lg text-sm font-semibold hover:bg-[#154b34]">
                    Xác nhận hoàn cọc
                  </button>
                </>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
