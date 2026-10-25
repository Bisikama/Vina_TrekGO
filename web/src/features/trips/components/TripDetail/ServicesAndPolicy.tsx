import { TripData } from "../../data/mockTripsData";

export const ServicesAndPolicy = ({ trip }: { trip: TripData }) => {
  const meetingTimeFormatted = trip.date.rawStart
    ? `${new Date(trip.date.rawStart).toLocaleTimeString("vi-VN", {
        hour: "2-digit",
        minute: "2-digit",
      })} – Ngày ${new Date(trip.date.rawStart).toLocaleDateString("vi-VN")}`
    : "Đúng giờ theo thông báo của Leader";

  return (
    <div className="space-y-8">
      {/* Services */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="bg-emerald-50/50 p-6 rounded-2xl border border-emerald-100/60">
          <h3 className="text-[13px] font-extrabold text-emerald-800 mb-4 flex items-center gap-2">
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M5 13l4 4L19 7"></path></svg>
            Dịch vụ bao gồm (Included)
          </h3>
          <ul className="space-y-3">
            {(trip.includedServices && trip.includedServices.length > 0
              ? trip.includedServices
              : [
                  "Bảo hiểm tai nạn du lịch & Cứu hộ VFRS mức 100.000.000đ/người",
                  "Leader chuyên nghiệp đồng hành có chứng chỉ sơ cấp cứu WFA",
                  "Hỗ trợ trang thiết bị y tế & túi sơ cứu chuyên dụng dã ngoại",
                  "Chi phí tổ chức, điều phối đoàn và bảo đảm an toàn trên tuyến",
                ]
            ).map((item, idx) => (
              <li key={idx} className="flex gap-2.5 text-sm text-gray-700 leading-snug">
                <svg className="w-4 h-4 text-emerald-500 shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M5 13l4 4L19 7"></path></svg>
                {item}
              </li>
            ))}
          </ul>
        </div>

        <div className="bg-gray-50/80 p-6 rounded-2xl border border-gray-100">
          <h3 className="text-[13px] font-extrabold text-gray-800 mb-4 flex items-center gap-2">
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M6 18L18 6M6 6l12 12"></path></svg>
            Không bao gồm (Excluded)
          </h3>
          <ul className="space-y-3">
            {(trip.excludedServices && trip.excludedServices.length > 0
              ? trip.excludedServices
              : [
                  "Chi phí cá nhân phát sinh ngoài chương trình",
                  "Trang thiết bị cắm trại cá nhân chưa đăng ký thuê thêm",
                  "Thuế VAT và các khoản chi tiêu ngoài cam kết của đoàn",
                ]
            ).map((item, idx) => (
              <li key={idx} className="flex gap-2.5 text-sm text-gray-600 leading-snug">
                <svg className="w-4 h-4 text-gray-400 shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M6 18L18 6M6 6l12 12"></path></svg>
                {item}
              </li>
            ))}
          </ul>
        </div>
      </div>

      {/* Equipment (nếu có dữ liệu trang bị cụ thể) */}
      {(trip.requiredEquipment?.length || trip.suggestedEquipment?.length) ? (
        <div>
          <h3 className="text-xl font-extrabold text-gray-900 mb-4">Danh mục trang bị bắt buộc &amp; Đề xuất</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {trip.requiredEquipment && trip.requiredEquipment.length > 0 && (
              <div className="bg-white p-5 rounded-xl border border-gray-200">
                <div className="text-sm font-bold text-red-600 mb-3 flex items-center gap-2">
                  <span className="bg-red-100 w-6 h-6 rounded flex items-center justify-center">⚠️</span>
                  Trang bị bắt buộc
                </div>
                <ul className="space-y-3">
                  {trip.requiredEquipment.map((item, idx) => (
                    <li key={idx} className="flex items-center justify-between text-sm">
                      <span className="text-gray-700 font-medium">{item.name}</span>
                      <span className="text-[10px] font-bold text-[#1B5E41] bg-emerald-50 px-2 py-1 rounded border border-emerald-100">
                        {item.action}
                      </span>
                    </li>
                  ))}
                </ul>
              </div>
            )}
            {trip.suggestedEquipment && trip.suggestedEquipment.length > 0 && (
              <div className="bg-white p-5 rounded-xl border border-gray-200">
                <div className="text-sm font-bold text-blue-600 mb-3 flex items-center gap-2">
                  <span className="bg-blue-100 w-6 h-6 rounded flex items-center justify-center">🎒</span>
                  Thiết bị đề xuất
                </div>
                <ul className="space-y-3">
                  {trip.suggestedEquipment.map((item, idx) => (
                    <li key={idx} className="flex items-center justify-between text-sm">
                      <span className="text-gray-700 font-medium">{item.name}</span>
                      <span className="text-[10px] font-bold text-gray-500 bg-gray-100 px-2 py-1 rounded border border-gray-200">
                        {item.action}
                      </span>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        </div>
      ) : null}

      {/* Meeting Point & Policies */}
      <div className="bg-blue-50/50 p-6 rounded-2xl border border-blue-100">
        <h3 className="text-sm font-extrabold text-gray-900 mb-4">Điểm đón &amp; Thời gian xuất phát</h3>
        <div className="space-y-3 text-sm text-gray-700 mb-6">
          <div className="flex gap-2.5">
            <svg className="w-5 h-5 text-blue-500 shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"></path></svg>
            <p><strong>Thời gian tập kết:</strong> Lúc {meetingTimeFormatted}</p>
          </div>
          <div className="flex gap-2.5">
            <svg className="w-5 h-5 text-blue-500 shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z"></path></svg>
            <p>
              <strong>Điểm đón tập kết:</strong>{" "}
              {trip.pickup?.name ? (
                <>
                  <strong className="text-slate-900">{trip.pickup.name}</strong>
                  {trip.pickup.address ? ` (${trip.pickup.address})` : ""}
                </>
              ) : (
                "Điểm đón xác thực theo cung đường của đoàn"
              )}
            </p>
          </div>
        </div>

        <h3 className="text-sm font-extrabold text-gray-900 mb-4">Chính sách hoàn hủy &amp; Đổi chuyến</h3>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-center">
          <div className="bg-white p-3 rounded-lg border border-gray-200">
            <div className="text-[10px] text-gray-500 font-bold mb-1">Trước 7 ngày</div>
            <div className="text-emerald-600 font-extrabold text-sm mb-1">Hoàn 100%</div>
            <div className="text-[9px] text-gray-400">Trừ phí thanh toán (nếu có)</div>
          </div>
          <div className="bg-white p-3 rounded-lg border border-gray-200">
            <div className="text-[10px] text-gray-500 font-bold mb-1">Trước 4 ngày</div>
            <div className="text-amber-500 font-extrabold text-sm mb-1">Hoàn 70%</div>
            <div className="text-[9px] text-gray-400">Hoặc đổi chuyến (phí 10%)</div>
          </div>
          <div className="bg-white p-3 rounded-lg border border-gray-200">
            <div className="text-[10px] text-gray-500 font-bold mb-1">Trước 2 ngày</div>
            <div className="text-red-500 font-extrabold text-sm mb-1">Hoàn 30%</div>
            <div className="text-[9px] text-gray-400">Khó đổi chuyến</div>
          </div>
          <div className="bg-gray-100 p-3 rounded-lg border border-gray-200 flex flex-col justify-center">
            <div className="text-gray-900 font-extrabold text-xs">Hủy Chuyến Phút Chót</div>
            <div className="text-red-600 font-extrabold text-sm">Mất 100%</div>
          </div>
        </div>
      </div>
    </div>
  );
};
