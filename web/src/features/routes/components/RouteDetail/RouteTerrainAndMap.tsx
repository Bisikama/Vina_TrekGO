import Image from "next/image";
import { RouteData } from "../../data/mockRoutesData";

export const RouteTerrainAndMap = ({ route }: { route: RouteData }) => {
  return (
    <div className="space-y-6">
      {/* 3D Map View Placeholder */}
      <div className="bg-white p-5 rounded-2xl border border-gray-100 shadow-sm">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-extrabold text-gray-900">Bản đồ vệ tinh & GPS Tracklog</h2>
          <button className="text-xs font-bold text-[#1B5E41] bg-emerald-50 px-3 py-1.5 rounded-lg hover:bg-emerald-100 transition-colors">
            Tải file .GPX
          </button>
        </div>
        <div className="relative h-[300px] sm:h-[400px] w-full rounded-xl overflow-hidden bg-gray-100">
          <Image 
            src={route.mapImage}
            alt={`Bản đồ lộ trình ${route.name}`}
            fill
            className="object-cover opacity-90"
          />
          {/* Overlay to make it look like a map UI */}
          <div className="absolute inset-0 ring-1 ring-inset ring-black/10 rounded-xl pointer-events-none"></div>
          <div className="absolute top-4 left-4 bg-white/90 backdrop-blur-sm p-3 rounded-lg border border-gray-200 shadow-lg max-w-[200px]">
            <div className="text-[10px] font-bold text-gray-500 uppercase mb-1">Cảnh báo địa hình</div>
            <div className="flex items-center gap-2 text-sm font-medium text-gray-800">
              <span className="w-2 h-2 rounded-full bg-red-500"></span>
              Đoạn vách đá hẹp
            </div>
            <div className="flex items-center gap-2 text-sm font-medium text-gray-800 mt-1">
              <span className="w-2 h-2 rounded-full bg-amber-500"></span>
              Độ dốc &gt; 30%
            </div>
          </div>
          
          <div className="absolute bottom-4 right-4 flex flex-col gap-2">
            <button className="w-10 h-10 bg-white rounded-lg shadow-lg flex items-center justify-center text-gray-700 hover:bg-gray-50">
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 6v6m0 0v6m0-6h6m-6 0H6"></path></svg>
            </button>
            <button className="w-10 h-10 bg-white rounded-lg shadow-lg flex items-center justify-center text-gray-700 hover:bg-gray-50">
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M20 12H4"></path></svg>
            </button>
          </div>
        </div>
      </div>

      {/* Elevation Profile Placeholder */}
      <div className="bg-white p-5 rounded-2xl border border-gray-100 shadow-sm">
        <h2 className="text-lg font-extrabold text-gray-900 mb-4">Mặt cắt độ cao (Elevation Profile)</h2>
        <div className="relative h-[200px] w-full rounded-xl overflow-hidden bg-[#F8FAFC] border border-gray-100 p-4">
          {/* We use an image here, but in a real app this would be a chart library like Recharts */}
          <div className="absolute inset-0 opacity-80 mix-blend-multiply">
            <Image 
              src={route.elevationProfileImage}
              alt="Mặt cắt độ cao"
              fill
              className="object-cover"
            />
          </div>
          
          {/* Overlay info */}
          <div className="relative z-10 flex justify-between h-full">
            <div className="flex flex-col justify-between">
              <div className="text-[10px] font-bold text-gray-500">{route.totalElevation}</div>
              <div className="text-[10px] font-bold text-gray-500">1.000m</div>
            </div>
            <div className="flex items-end text-[10px] font-bold text-gray-500 pt-2 w-full justify-between ml-2 border-t border-dashed border-gray-300 self-end">
              <span>0km</span>
              <span>{parseFloat(route.totalDistance) / 2}km</span>
              <span>{route.totalDistance}</span>
            </div>
          </div>
        </div>
        
        <div className="grid grid-cols-3 gap-4 mt-4">
          <div className="bg-gray-50 rounded-lg p-3 text-center border border-gray-100">
            <div className="text-[10px] font-bold text-gray-500 uppercase mb-1">Tổng dốc lên</div>
            <div className="text-sm font-extrabold text-gray-900">+ 1.850m</div>
          </div>
          <div className="bg-gray-50 rounded-lg p-3 text-center border border-gray-100">
            <div className="text-[10px] font-bold text-gray-500 uppercase mb-1">Tổng dốc xuống</div>
            <div className="text-sm font-extrabold text-gray-900">- 1.850m</div>
          </div>
          <div className="bg-gray-50 rounded-lg p-3 text-center border border-gray-100">
            <div className="text-[10px] font-bold text-gray-500 uppercase mb-1">Độ dốc trung bình</div>
            <div className="text-sm font-extrabold text-gray-900">12.5%</div>
          </div>
        </div>
      </div>
    </div>
  );
};
