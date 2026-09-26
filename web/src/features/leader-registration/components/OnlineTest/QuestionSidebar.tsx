'use client';
import React, { useState } from 'react';

export const QuestionSidebar = () => {
  const [activeQuestion] = useState(14);
  const questions = Array.from({ length: 30 }, (_, i) => i + 1);

  const getQuestionState = (q: number) => {
    if (q === 6 || q === 22) return 'marked';
    if (q === activeQuestion) return 'active';
    if (q < 14 && q !== 6) return 'answered';
    return 'unanswered';
  };

  return (
    <div className="space-y-6">
      {/* Grid */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-5">
        <div className="flex justify-between items-center mb-4">
          <h3 className="font-bold text-gray-900 flex items-center gap-2">
            <svg className="w-5 h-5 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2V6zM14 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V6zM4 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2v-2zM14 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2v-2z" /></svg>
            Bảng Câu Hỏi (30 Câu)
          </h3>
          <span className="text-[10px] bg-blue-50 text-blue-600 px-2 py-1 rounded font-medium">Tự động lưu</span>
        </div>

        <div className="grid grid-cols-2 gap-2 text-xs mb-6">
          <div className="flex items-center gap-1.5"><div className="w-3 h-3 bg-[#1B4332] rounded flex items-center justify-center"><svg className="w-2 h-2 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" /></svg></div> Đã trả lời (13)</div>
          <div className="flex items-center gap-1.5"><div className="w-3 h-3 bg-green-500 rounded text-white flex items-center justify-center text-[8px] font-bold">14</div> Đang làm (1)</div>
          <div className="flex items-center gap-1.5"><div className="w-3 h-3 bg-[#D4A373] rounded flex items-center justify-center"><svg className="w-2 h-2 text-white" fill="currentColor" viewBox="0 0 20 20"><path d="M5 4a2 2 0 012-2h6a2 2 0 012 2v14l-5-2.5L5 18V4z" /></svg></div> Đánh dấu (2)</div>
          <div className="flex items-center gap-1.5"><div className="w-3 h-3 border border-gray-300 rounded flex items-center justify-center text-[8px] text-gray-400 font-bold">•</div> Chưa làm (14)</div>
        </div>

        <div className="grid grid-cols-5 gap-2 mb-6">
          {questions.map((q) => {
            const state = getQuestionState(q);
            return (
              <button
                key={q}
                className={`h-10 rounded-lg text-sm font-bold flex items-center justify-center transition-all ${
                  state === 'answered' ? 'bg-[#1B4332] text-white hover:bg-[#153426]' :
                  state === 'active' ? 'bg-green-500 text-white shadow-md transform scale-105' :
                  state === 'marked' ? 'bg-[#D4A373] text-white hover:bg-[#B3875B]' :
                  'bg-white border border-gray-200 text-gray-600 hover:border-gray-400'
                }`}
              >
                {state === 'marked' ? (
                  <div className="flex items-center gap-0.5">
                    {q}<svg className="w-2.5 h-2.5" fill="currentColor" viewBox="0 0 20 20"><path d="M5 4a2 2 0 012-2h6a2 2 0 012 2v14l-5-2.5L5 18V4z" /></svg>
                  </div>
                ) : (
                  q
                )}
              </button>
            );
          })}
        </div>

        <button 
          onClick={() => {
            window.location.href = '/leader-registration/progress';
          }}
          className="w-full bg-[#1B4332] hover:bg-[#153426] text-white font-bold py-3.5 rounded-xl transition-colors flex items-center justify-center gap-2 shadow-sm"
        >
          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
          Nộp Bài Thi Ngay
        </button>
        <div className="text-center text-[10px] text-gray-500 mt-2">Bạn còn <span className="font-bold text-gray-900">17</span> câu hỏi chưa hoàn tất</div>
      </div>

      {/* Rules */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-5">
        <h3 className="font-bold text-gray-900 mb-4 flex items-center gap-2">
          <svg className="w-5 h-5 text-green-500" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" /></svg>
          Quy Chế Sát Hạch VFRS
        </h3>
        
        <div className="space-y-3 mb-4">
          <div className="bg-red-50 rounded-lg p-3 border border-red-100 flex items-start gap-2.5">
            <svg className="w-4 h-4 text-red-500 shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" /></svg>
            <div>
              <div className="text-xs font-bold text-red-900">Cảnh báo giám sát màn hình</div>
              <div className="text-[10px] text-red-700 mt-0.5">Rời khỏi cửa sổ bài thi hoặc chuyển tab sẽ bị ghi nhận lỗi. Vi phạm <b>0 / 3 lần</b>.</div>
            </div>
          </div>
          <div className="bg-yellow-50 rounded-lg p-3 border border-yellow-100 flex items-start gap-2.5">
            <svg className="w-4 h-4 text-yellow-600 shrink-0 mt-0.5" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M10 2a1 1 0 011 1v1.323l3.954 1.582 1.599-.8a1 1 0 01.894 1.79l-1.233.616 1.738 5.42a1 1 0 01-.285 1.05A3.989 3.989 0 0115 15a3.989 3.989 0 01-2.667-1.019 1 1 0 01-.285-1.05l1.715-5.349L11 6.477V16h2a1 1 0 110 2H7a1 1 0 110-2h2V6.477L6.237 7.582l1.715 5.349a1 1 0 01-.285 1.05A3.989 3.989 0 015 15a3.989 3.989 0 01-2.667-1.019 1 1 0 01-.285-1.05l1.738-5.42-1.233-.617a1 1 0 01.894-1.788l1.599.799L9 4.323V3a1 1 0 011-1zm-5 8.274l-.818 2.552c.25.112.526.174.818.174.292 0 .569-.062.818-.174L5 10.274zm10 0l-.818 2.552c.25.112.526.174.818.174.292 0 .569-.062.818-.174L15 10.274z" clipRule="evenodd" /></svg>
            <div>
              <div className="text-xs font-bold text-yellow-900">Tiêu chuẩn cấp chứng chỉ</div>
              <div className="text-[10px] text-yellow-800 mt-0.5">Cần tối thiểu <b>24 / 30 câu đúng (≥ 80%)</b> để đạt chuẩn và chuyển sang vòng phỏng vấn thực địa.</div>
            </div>
          </div>
        </div>
        
        <div className="flex justify-between text-[10px] text-gray-500 pt-3 border-t border-gray-100">
          <span>Mã thí sinh: <b>VN-LDR-8821</b></span>
          <span>Mã đề: <b>VFRS-A2</b></span>
        </div>
      </div>
    </div>
  );
};
