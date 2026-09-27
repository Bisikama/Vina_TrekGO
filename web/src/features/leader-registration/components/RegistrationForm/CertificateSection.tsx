'use client';
import React, { useState } from 'react';

export const CertificateSection = () => {
  const [skills, setSkills] = useState({
    wfa: true,
    gps: true,
    srt: true,
    tourGuide: false
  });

  const toggleSkill = (key: keyof typeof skills) => {
    setSkills({...skills, [key]: !skills[key]});
  };

  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6 mb-6">
      <div className="flex items-center gap-3 mb-6">
        <div className="w-8 h-8 rounded bg-gray-100 text-gray-700 flex items-center justify-center font-bold text-sm">2</div>
        <div>
          <h3 className="font-bold text-gray-900 text-lg">Chứng chỉ & Kỹ năng sinh tồn thực địa</h3>
          <p className="text-xs text-gray-500">Chọn và xác nhận các năng lực đã được cấp bằng hợp lệ</p>
        </div>
      </div>

      <div className="mb-6">
        <label className="text-sm font-bold text-gray-900 block mb-3">Kỹ năng dã ngoại được chứng thực</label>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <label className={`flex items-center gap-3 p-3 border rounded-xl cursor-pointer transition-colors ${skills.wfa ? 'bg-green-50/50 border-green-200' : 'bg-white border-gray-200 hover:bg-gray-50'}`}>
            <input type="checkbox" checked={skills.wfa} onChange={() => toggleSkill('wfa')} className="w-4 h-4 text-green-600 rounded focus:ring-green-500" />
            <div>
              <div className="text-sm font-bold text-gray-900">Sơ cấp cứu hoang dã (WFA / WFR)</div>
              <div className="text-[10px] text-gray-500">Chuẩn quốc tế Wilderness Medical</div>
            </div>
          </label>
          <label className={`flex items-center gap-3 p-3 border rounded-xl cursor-pointer transition-colors ${skills.gps ? 'bg-green-50/50 border-green-200' : 'bg-white border-gray-200 hover:bg-gray-50'}`}>
            <input type="checkbox" checked={skills.gps} onChange={() => toggleSkill('gps')} className="w-4 h-4 text-green-600 rounded focus:ring-green-500" />
            <div>
              <div className="text-sm font-bold text-gray-900">Điều hướng GPS & Bản đồ địa hình</div>
              <div className="text-[10px] text-gray-500">Sử dụng la bàn quân sự và Garmin</div>
            </div>
          </label>
          <label className={`flex items-center gap-3 p-3 border rounded-xl cursor-pointer transition-colors ${skills.srt ? 'bg-green-50/50 border-green-200' : 'bg-white border-gray-200 hover:bg-gray-50'}`}>
            <input type="checkbox" checked={skills.srt} onChange={() => toggleSkill('srt')} className="w-4 h-4 text-green-600 rounded focus:ring-green-500" />
            <div>
              <div className="text-sm font-bold text-gray-900">Kỹ thuật dây neo & Vượt suối ghềnh</div>
              <div className="text-[10px] text-gray-500">Single Rope Technique (SRT)</div>
            </div>
          </label>
          <label className={`flex items-center gap-3 p-3 border rounded-xl cursor-pointer transition-colors ${skills.tourGuide ? 'bg-green-50/50 border-green-200' : 'bg-white border-gray-200 hover:bg-gray-50'}`}>
            <input type="checkbox" checked={skills.tourGuide} onChange={() => toggleSkill('tourGuide')} className="w-4 h-4 text-green-600 rounded focus:ring-green-500" />
            <div>
              <div className="text-sm font-bold text-gray-900">Chứng nhận HDV Du lịch Nội địa</div>
              <div className="text-[10px] text-gray-500">Cấp bởi Sở Du lịch (Ưu tiên xét duyệt)</div>
            </div>
          </label>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div>
          <label className="text-xs font-bold text-gray-700 block mb-1">Số hiệu chứng chỉ WFA *</label>
          <input type="text" defaultValue="WFA-2023-VN-08442" className="w-full border border-gray-200 rounded-lg p-2.5 text-sm focus:outline-none focus:ring-1 focus:ring-[#1B4332] bg-gray-50/50" />
        </div>
        <div>
          <label className="text-xs font-bold text-gray-700 block mb-1">Đơn vị cấp bằng *</label>
          <input type="text" defaultValue="IREC & Hội Chữ Thập Đỏ VN" className="w-full border border-gray-200 rounded-lg p-2.5 text-sm focus:outline-none focus:ring-1 focus:ring-[#1B4332] bg-gray-50/50" />
        </div>
        <div>
          <label className="text-xs font-bold text-gray-700 block mb-1">Ngày hết hạn *</label>
          <div className="relative">
            <input type="text" defaultValue="11/20/2025" className="w-full border border-gray-200 rounded-lg p-2.5 text-sm focus:outline-none focus:ring-1 focus:ring-[#1B4332] bg-gray-50/50" />
            <svg className="w-4 h-4 text-gray-400 absolute right-3 top-1/2 transform -translate-y-1/2 pointer-events-none" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg>
          </div>
        </div>
      </div>
    </div>
  );
};
