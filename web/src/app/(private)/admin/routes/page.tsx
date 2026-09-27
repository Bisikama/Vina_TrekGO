import React from 'react';
import Link from 'next/link';

export default function AdminRoutesPage() {
  return (
    <div className="p-6">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Quản lý Cung đường</h1>
        <button className="bg-[#1B5E41] hover:bg-[#154B36] text-white px-4 py-2 rounded-lg text-sm font-bold transition-colors">
          + Tạo cung đường mới
        </button>
      </div>
      
      <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
        <table className="w-full text-left text-sm text-gray-600">
           <thead className="text-xs uppercase bg-gray-50 text-gray-500 border-b border-gray-200">
              <tr>
                 <th className="py-3 px-4 font-bold">Mã / Tên tuyến</th>
                 <th className="py-3 px-4 font-bold">Vùng núi</th>
                 <th className="py-3 px-4 font-bold">Cấp độ</th>
                 <th className="py-3 px-4 font-bold">Trạng thái</th>
                 <th className="py-3 px-4 font-bold text-right">Thao tác</th>
              </tr>
           </thead>
           <tbody className="divide-y divide-gray-100">
              <tr className="hover:bg-gray-50 transition-colors">
                 <td className="py-3 px-4">
                    <div className="font-bold text-gray-900">Sống Lưng Khủng Long Tà Xùa</div>
                    <div className="text-xs text-gray-500 font-mono">#TRL-TX01</div>
                 </td>
                 <td className="py-3 px-4">Tà Xùa (Sơn La)</td>
                 <td className="py-3 px-4">Cấp 3 (Thử thách)</td>
                 <td className="py-3 px-4">
                    <span className="bg-emerald-100 text-emerald-800 text-[10px] font-bold px-2 py-0.5 rounded border border-emerald-200">Public</span>
                 </td>
                 <td className="py-3 px-4 text-right">
                    <Link href="/admin/routes/TRL-TX01" className="text-[#1B5E41] hover:underline font-medium">Chỉnh sửa</Link>
                 </td>
              </tr>
           </tbody>
        </table>
      </div>
    </div>
  );
}
