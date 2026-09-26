"use client";

import { useState } from "react";
import { TripData } from "../../data/mockTripsData";

export const ItineraryAccordion = ({ trip }: { trip: TripData }) => {
  // Mở mặc định tất cả các ngày (hoặc ngày đầu tiên tuỳ thiết kế)
  const [openDays, setOpenDays] = useState<number[]>(trip.itinerary?.map((_, idx) => idx) || []);

  const toggleDay = (index: number) => {
    if (openDays.includes(index)) {
      setOpenDays(openDays.filter(i => i !== index));
    } else {
      setOpenDays([...openDays, index]);
    }
  };

  if (!trip.itinerary || trip.itinerary.length === 0) return null;

  return (
    <div className="mb-10">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-xl font-extrabold text-gray-900">Lịch trình chi tiết từng ngày</h2>
        <button 
          onClick={() => setOpenDays(openDays.length > 0 ? [] : trip.itinerary!.map((_, idx) => idx))}
          className="text-xs font-bold text-[#1B5E41] bg-[#1B5E41]/10 px-3 py-1.5 rounded-lg hover:bg-[#1B5E41]/20 transition-colors"
        >
          {openDays.length > 0 ? "Thu gọn tất cả" : "Mở rộng tất cả"}
        </button>
      </div>

      <div className="flex flex-col gap-4">
        {trip.itinerary.map((day, idx) => {
          const isOpen = openDays.includes(idx);
          return (
            <div key={idx} className="bg-white border border-gray-100 rounded-xl overflow-hidden shadow-sm">
              <button 
                onClick={() => toggleDay(idx)}
                className="w-full flex items-center justify-between p-4 bg-gray-50/50 hover:bg-gray-50 transition-colors text-left"
              >
                <div className="flex items-center gap-3">
                  <div className="bg-white border border-gray-200 w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold text-gray-700 shadow-sm shrink-0">
                    {idx}
                  </div>
                  <div>
                    <div className="text-[11px] font-bold text-[#1B5E41] uppercase tracking-wide mb-0.5">{day.day}</div>
                    <div className="text-sm font-bold text-gray-900">{day.title}</div>
                  </div>
                </div>
                <div className={`text-gray-400 transition-transform ${isOpen ? "rotate-180" : ""}`}>
                  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7"></path></svg>
                </div>
              </button>

              {isOpen && (
                <div className="p-4 bg-white border-t border-gray-50">
                  <div className="relative border-l-2 border-gray-100 ml-4 pl-6 pb-2 space-y-6">
                    {day.activities.map((act, actIdx) => (
                      <div key={actIdx} className="relative">
                        {/* Timeline dot */}
                        <div className={`absolute -left-[31px] w-3 h-3 rounded-full border-2 border-white ${act.isHighlight ? 'bg-amber-500 ring-2 ring-amber-100' : 'bg-gray-300'}`}></div>
                        
                        <div className="flex flex-col sm:flex-row gap-2 sm:gap-4">
                          {act.time && (
                            <div className="text-xs font-bold text-gray-900 bg-gray-100 px-2 py-1 rounded w-fit h-fit shrink-0">
                              {act.time}
                            </div>
                          )}
                          <div className="text-sm text-gray-600 leading-relaxed pt-0.5">
                            {act.isHighlight ? (
                              <span className="bg-amber-50 text-amber-800 font-medium px-1 rounded mr-1">Tâm điểm:</span>
                            ) : null}
                            {act.description}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
};
