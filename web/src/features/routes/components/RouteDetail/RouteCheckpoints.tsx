import { RouteData, Checkpoint } from "../../data/mockRoutesData";

const getCheckpointIcon = (type: Checkpoint['type']) => {
  switch (type) {
    case 'start':
      return <span className="text-xl">🏁</span>;
    case 'camp':
      return <span className="text-xl">⛺</span>;
    case 'peak':
      return <span className="text-xl">⛰️</span>;
    case 'rest':
      return <span className="text-xl">☕</span>;
    case 'end':
      return <span className="text-xl">🚌</span>;
    default:
      return <span className="text-xl">📍</span>;
  }
};

const getCheckpointColor = (type: Checkpoint['type']) => {
  switch (type) {
    case 'start':
    case 'end':
      return "bg-blue-100 text-blue-800 border-blue-200";
    case 'camp':
      return "bg-amber-100 text-amber-800 border-amber-200";
    case 'peak':
      return "bg-red-100 text-red-800 border-red-200";
    case 'rest':
      return "bg-gray-100 text-gray-800 border-gray-200";
    default:
      return "bg-gray-100 text-gray-800 border-gray-200";
  }
};

export const RouteCheckpoints = ({ route }: { route: RouteData }) => {
  return (
    <div className="bg-white p-5 rounded-2xl border border-gray-100 shadow-sm mt-6">
      <h2 className="text-lg font-extrabold text-gray-900 mb-6">Các trạm kiểm soát & Cột mốc</h2>
      
      <div className="relative pl-8">
        {/* Continuous timeline line */}
        <div className="absolute top-4 bottom-4 left-[15px] w-0.5 bg-gray-200"></div>

        <div className="space-y-8">
          {route.checkpoints.map((cp, idx) => (
            <div key={cp.id} className="relative">
              {/* Timeline dot/icon */}
              <div className={`absolute -left-[41px] w-10 h-10 rounded-full flex items-center justify-center border-4 border-white shadow-sm bg-white z-10`}>
                {getCheckpointIcon(cp.type)}
              </div>
              
              <div className="bg-gray-50 rounded-xl p-4 border border-gray-100 hover:border-emerald-200 transition-colors cursor-pointer group">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between mb-2 gap-2">
                  <div className="flex items-center gap-2">
                    <h3 className="text-[15px] font-bold text-gray-900 group-hover:text-[#1B5E41] transition-colors">{cp.name}</h3>
                    <span className={`text-[10px] font-bold px-2 py-0.5 rounded border ${getCheckpointColor(cp.type)} uppercase tracking-wider`}>
                      {cp.type === 'camp' ? 'Lán nghỉ' : cp.type === 'peak' ? 'Đỉnh núi' : cp.type === 'start' ? 'Bắt đầu' : cp.type === 'rest' ? 'Trạm nghỉ' : 'Kết thúc'}
                    </span>
                  </div>
                  
                  <div className="flex items-center gap-3 text-xs font-bold text-gray-500">
                    <span className="flex items-center gap-1">
                      <svg className="w-4 h-4 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6"></path></svg>
                      {cp.distanceFromStart}
                    </span>
                    <span className="flex items-center gap-1">
                      <svg className="w-4 h-4 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 11l7-7 7 7M5 19l7-7 7 7"></path></svg>
                      {cp.elevation}
                    </span>
                  </div>
                </div>
                
                <p className="text-sm text-gray-600 leading-relaxed">
                  {cp.description}
                </p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};
