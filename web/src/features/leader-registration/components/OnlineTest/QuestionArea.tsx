'use client';
import React, { useState } from 'react';

export const QuestionArea = () => {
  const [selectedAnswer, setSelectedAnswer] = useState<string | null>('B');

  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-8 min-h-[600px] flex flex-col">
      <div className="flex gap-2 mb-6 border-b border-gray-100 pb-4">
        <span className="bg-[#1B4332] text-white text-xs font-bold px-3 py-1 rounded-full">CÂU HỎI 14</span>
        <span className="bg-gray-100 text-gray-600 text-xs font-bold px-3 py-1 rounded-full">Mức độ: Vừa phải</span>
        <span className="bg-blue-50 text-blue-700 text-xs font-bold px-3 py-1 rounded-full">Trọng số: 2 Điểm</span>
        <span className="bg-gray-100 text-gray-600 text-xs font-bold px-3 py-1 rounded-full">Chủ đề: Sơ cấp cứu hoang dã & Hạ thân nhiệt</span>
        <button className="ml-auto text-[#D4A373] text-xs font-bold flex items-center gap-1.5 hover:text-[#B3875B] transition-colors border border-[#D4A373]/30 px-3 py-1 rounded-full">
          <svg className="w-3.5 h-3.5" fill="currentColor" viewBox="0 0 20 20"><path d="M5 4a2 2 0 012-2h6a2 2 0 012 2v14l-5-2.5L5 18V4z" /></svg>
          Đánh dấu xem lại
        </button>
      </div>

      <div className="flex-1">
        <h2 className="text-xl font-bold text-gray-900 leading-relaxed mb-4">
          Trong hành trình leo núi gặp mưa lớn nhiệt độ giảm đột ngột xuống 6°C tại sống lưng núi gió mạnh, một thành viên trong đoàn có dấu hiệu run rẩy dữ dội, nói lắp, bước đi loạng choạng và mất phương hướng. Là Mountain Leader, hành động xử lý ưu tiên số 1 theo quy chuẩn an toàn WFA là gì?
        </h2>
        <p className="text-sm text-gray-600 mb-6 italic">
          Tình huống mô phỏng thực địa yêu cầu áp dụng nguyên tắc kiểm soát hạ thân nhiệt cấp 2 (Moderate Hypothermia) trước khi tiến hành các biện pháp di chuyển đội hình.
        </p>

        <div className="bg-gray-50 border border-gray-200 rounded-xl p-4 mb-8 flex items-start gap-4">
          <div className="w-10 h-10 bg-blue-100 text-blue-600 rounded-lg flex items-center justify-center shrink-0">
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364 6.364l-.707-.707M6.343 6.343l-.707-.707m12.728 0l-.707.707M6.343 17.657l-.707.707M16 12a4 4 0 11-8 0 4 4 0 018 0z" /></svg>
          </div>
          <div>
            <div className="text-sm font-bold text-gray-900 mb-2">Dữ liệu khí tượng & sinh hiệu hiện trường:</div>
            <div className="grid grid-cols-2 gap-x-8 gap-y-1 text-xs text-gray-600">
              <div className="flex items-center gap-1.5"><span className="w-1 h-1 bg-gray-400 rounded-full"></span> Nhiệt độ môi trường: 6°C (Gió giật cấp 6)</div>
              <div className="flex items-center gap-1.5"><span className="w-1 h-1 bg-gray-400 rounded-full"></span> Triệu chứng: <b>Mất đồng điều vận (Ataxia), lơ mơ</b></div>
              <div className="flex items-center gap-1.5"><span className="w-1 h-1 bg-gray-400 rounded-full"></span> Tình trạng trang phục: <b>Ướt nước mưa lạnh</b></div>
            </div>
          </div>
        </div>

        <div className="space-y-4">
          <label className={`block border rounded-xl p-5 cursor-pointer transition-all ${selectedAnswer === 'A' ? 'border-[#1B4332] bg-green-50/30 ring-1 ring-[#1B4332]' : 'border-gray-200 hover:border-gray-300'}`}>
            <div className="flex items-start gap-4">
              <input type="radio" name="answer" checked={selectedAnswer === 'A'} onChange={() => setSelectedAnswer('A')} className="w-5 h-5 text-[#1B4332] border-gray-300 focus:ring-[#1B4332] mt-0.5" />
              <div>
                <div className="font-bold text-gray-900 text-sm mb-1">Phương án A</div>
                <div className="text-gray-700 text-sm">Cho thành viên uống ngay 1 ngụm rượu mạnh hoặc cà phê nóng đậm đặc để làm ấm thân nhiệt tức thì, sau đó yêu cầu ngồi thiền tĩnh tâm.</div>
              </div>
            </div>
          </label>

          <label className={`block border rounded-xl p-5 cursor-pointer transition-all ${selectedAnswer === 'B' ? 'border-[#1B4332] bg-green-50/50 ring-2 ring-[#1B4332] shadow-sm' : 'border-gray-200 hover:border-gray-300'}`}>
            <div className="flex items-start gap-4 relative">
              <input type="radio" name="answer" checked={selectedAnswer === 'B'} onChange={() => setSelectedAnswer('B')} className="w-5 h-5 text-[#1B4332] border-gray-300 focus:ring-[#1B4332] mt-0.5" />
              <div className="flex-1">
                <div className="flex items-center gap-2 mb-1">
                  <div className="font-bold text-gray-900 text-sm">Phương án B</div>
                  {selectedAnswer === 'B' && <span className="bg-[#1B4332] text-white text-[10px] font-bold px-2 py-0.5 rounded">LỰA CHỌN CỦA BẠN</span>}
                </div>
                <div className={`text-sm ${selectedAnswer === 'B' ? 'font-bold text-gray-900' : 'text-gray-700'}`}>Đưa ngay nạn nhân vào nơi tránh gió, thay toàn bộ quần áo ướt bằng đồ khô ấm, quấn chăn cứu sinh/túi ngủ lông vũ, bổ sung nước đường ấm ngọt và cách ly cơ thể nạn nhân khỏi mặt đất lạnh bằng thảm cách nhiệt.</div>
              </div>
            </div>
          </label>

          <label className={`block border rounded-xl p-5 cursor-pointer transition-all ${selectedAnswer === 'C' ? 'border-[#1B4332] bg-green-50/30 ring-1 ring-[#1B4332]' : 'border-gray-200 hover:border-gray-300'}`}>
            <div className="flex items-start gap-4">
              <input type="radio" name="answer" checked={selectedAnswer === 'C'} onChange={() => setSelectedAnswer('C')} className="w-5 h-5 text-[#1B4332] border-gray-300 focus:ring-[#1B4332] mt-0.5" />
              <div>
                <div className="font-bold text-gray-900 text-sm mb-1">Phương án C</div>
                <div className="text-gray-700 text-sm">Bắt buộc nạn nhân tiếp tục đi bộ thật nhanh để cơ bắp sinh nhiệt tự nhiên liên tục cho đến khi tới được trạm kiểm lâm hoặc lán nghỉ kế tiếp.</div>
              </div>
            </div>
          </label>

          <label className={`block border rounded-xl p-5 cursor-pointer transition-all ${selectedAnswer === 'D' ? 'border-[#1B4332] bg-green-50/30 ring-1 ring-[#1B4332]' : 'border-gray-200 hover:border-gray-300'}`}>
            <div className="flex items-start gap-4">
              <input type="radio" name="answer" checked={selectedAnswer === 'D'} onChange={() => setSelectedAnswer('D')} className="w-5 h-5 text-[#1B4332] border-gray-300 focus:ring-[#1B4332] mt-0.5" />
              <div>
                <div className="font-bold text-gray-900 text-sm mb-1">Phương án D</div>
                <div className="text-gray-700 text-sm">Cho nạn nhân ngồi trực tiếp lên mỏm đá nghỉ ngơi và xoa bóp dầu gió nóng thật mạnh vào toàn bộ vùng ngực và tứ chi của nạn nhân.</div>
              </div>
            </div>
          </label>
        </div>
      </div>

      <div className="flex items-center justify-between mt-8 pt-6 border-t border-gray-100">
        <button className="px-6 py-2.5 bg-gray-100 hover:bg-gray-200 text-gray-700 font-bold text-sm rounded-lg flex items-center gap-2 transition-colors">
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" /></svg>
          Câu trước (Câu 13)
        </button>
        <div className="text-xs text-gray-400">Phím tắt: [&larr;] Câu trước • [&rarr;] Tiếp theo</div>
        <button className="px-6 py-2.5 bg-[#1B4332] hover:bg-[#153426] text-white font-bold text-sm rounded-lg flex items-center gap-2 transition-colors">
          Câu tiếp theo (Câu 15)
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14 5l7 7m0 0l-7 7m7-7H3" /></svg>
        </button>
      </div>

      <div className="mt-6 bg-orange-50/50 border border-orange-100 rounded-xl p-4 flex items-start gap-3">
        <div className="w-6 h-6 text-orange-500 shrink-0 mt-0.5">
          <svg fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" /></svg>
        </div>
        <div className="flex-1">
          <div className="font-bold text-gray-900 text-sm mb-1">Ghi chú nghiệp vụ Leader</div>
          <div className="text-xs text-gray-600">Không chà xát tứ chi nạn nhân hạ thân nhiệt vì có thể đẩy máu lạnh vào tim gây loạn nhịp tim đột ngột (Afterdrop effect).</div>
        </div>
        <div className="bg-blue-100 text-blue-700 text-[10px] font-bold px-2 py-1 rounded">WFA Protocol v3.4</div>
      </div>
    </div>
  );
};
