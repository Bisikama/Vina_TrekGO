import React from 'react';
import Link from 'next/link';

interface MyRouteCardProps {
  image: string;
  altitude: string;
  statusBadge: React.ReactNode;
  privacyBadge: React.ReactNode;
  title: string;
  location: string;
  difficulty: string;
  distance: string;
  elevation: string;
  checkpoints: string;
  tracklogStatus: React.ReactNode;
  tags: React.ReactNode[];
  code: string;
  updatedAt: string;
  actions: React.ReactNode;
  errorBox?: React.ReactNode;
  waypoints?: string;
  hdop?: string;
}

export const MyRouteCard = ({
  image, altitude, statusBadge, privacyBadge, title, location, difficulty,
  distance, elevation, checkpoints, tracklogStatus, tags, code, updatedAt, actions, errorBox, waypoints, hdop
}: MyRouteCardProps) => {
  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden mb-4 flex flex-col md:flex-row">
      <div className="w-full md:w-[280px] h-48 md:h-auto relative shrink-0">
        <img src={image} className="w-full h-full object-cover" alt={title} />
        <div className="absolute top-3 left-3 bg-white/90 backdrop-blur-sm px-2 py-1 rounded text-[10px] font-bold text-gray-700 flex items-center gap-1">
          <svg className="w-3 h-3 text-blue-500" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" /></svg>
          Độ cao {altitude}
        </div>
        {(hdop || waypoints) && (
          <div className="absolute bottom-3 left-3 right-3 flex justify-between text-[10px] font-medium text-white drop-shadow-md">
            {hdop && <span>📈 {hdop}</span>}
            {waypoints && <span>{waypoints}</span>}
          </div>
        )}
      </div>
      
      <div className="p-5 flex-1 flex flex-col">
        <div className="flex flex-col md:flex-row justify-between items-start gap-2 mb-3">
          <div className="flex flex-wrap items-center gap-2">
            {statusBadge}
            {privacyBadge}
          </div>
          <div className="text-xs text-gray-500 flex items-center gap-1 shrink-0">
            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
            Cập nhật: {updatedAt}
          </div>
        </div>
        
        <h3 className="font-bold text-gray-900 text-lg mb-1">{title}</h3>
        <div className="text-sm text-gray-500 mb-4 flex items-center gap-1.5">
          <svg className="w-4 h-4 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" /></svg>
          {location} • Độ khó: <span className="font-semibold text-gray-700">{difficulty}</span>
        </div>
        
        {errorBox && (
          <div className="mb-4 bg-red-50 border border-red-100 rounded-lg p-3 text-xs text-red-800 flex items-start gap-2">
            <svg className="w-4 h-4 text-red-500 shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" /></svg>
            <div>{errorBox}</div>
          </div>
        )}
        
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 py-4 border-t border-b border-gray-100 mb-4">
          <div>
            <div className="text-[10px] text-gray-500 font-bold uppercase mb-1">Quãng đường</div>
            <div className="font-semibold text-gray-900 text-sm flex items-center gap-1.5">
              <svg className="w-4 h-4 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" /></svg>
              {distance}
            </div>
          </div>
          <div>
            <div className="text-[10px] text-gray-500 font-bold uppercase mb-1">Độ cao tích lũy</div>
            <div className="font-semibold text-gray-900 text-sm flex items-center gap-1.5">
              <svg className="w-4 h-4 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" /></svg>
              {elevation}
            </div>
          </div>
          <div>
            <div className="text-[10px] text-gray-500 font-bold uppercase mb-1">Trạm dừng chân</div>
            <div className="font-semibold text-gray-900 text-sm flex items-center gap-1.5">
              <svg className="w-4 h-4 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 21v-4m0 0V5a2 2 0 012-2h6.5l1 1H21l-3 6 3 6h-8.5l-1-1H5a2 2 0 00-2 2zm9-13.5V9" /></svg>
              {checkpoints}
            </div>
          </div>
          <div>
            <div className="text-[10px] text-gray-500 font-bold uppercase mb-1">Dữ liệu Tracklog</div>
            {tracklogStatus}
          </div>
        </div>
        
        <div className="flex flex-wrap gap-3 mb-4">
          {tags.map((tag, idx) => (
            <div key={idx} className="text-xs text-gray-600 flex items-center gap-1.5">
              <svg className="w-3.5 h-3.5 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" /></svg>
              {tag}
            </div>
          ))}
        </div>
        
        <div className="flex items-center justify-between mt-auto pt-2">
          <div className="text-xs font-mono text-gray-400 bg-gray-50 px-2 py-1 rounded border border-gray-100">
            Mã ID: {code}
          </div>
          <div className="flex gap-2">
            {actions}
          </div>
        </div>
      </div>
    </div>
  );
};
