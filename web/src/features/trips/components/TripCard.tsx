import Image from "next/image";
import Link from "next/link";
import { TripData } from "../data/mockTripsData";

interface TripCardProps {
  trip: TripData;
}

export const TripCard = ({ trip }: TripCardProps) => {
  const isFullyBooked = trip.slots.booked >= trip.slots.total;
  const progressPercent = (trip.slots.booked / trip.slots.total) * 100;

  return (
    <Link 
      href={`/trips/${trip.id}`}
      className="bg-white rounded-2xl overflow-hidden border border-gray-100 shadow-sm hover:shadow-md transition-shadow flex flex-col group cursor-pointer"
    >
      {/* Image & Top Badges */}
      <div className="relative h-48 w-full">
        <Image
          src={trip.image}
          alt={trip.title}
          fill
          className="object-cover group-hover:scale-105 transition-transform duration-500"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/20 to-transparent"></div>
        
        {/* Top Badges */}
        <div className="absolute top-3 left-3 flex items-center gap-1.5">
          <span className="bg-white/90 backdrop-blur-sm text-gray-900 text-xs font-bold px-2 py-1 rounded">
            {trip.duration}
          </span>
          <span className={`${trip.difficulty.color} backdrop-blur-sm text-xs font-bold px-2 py-1 rounded`}>
            {trip.difficulty.label}
          </span>
        </div>
        
        {trip.isVFRSVerified && (
          <div className="absolute top-3 right-3 bg-black/40 backdrop-blur-md text-white text-xs font-bold px-2 py-1 rounded flex items-center gap-1 border border-white/20">
            <svg className="w-3 h-3 text-emerald-400" viewBox="0 0 24 24" fill="none" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"></path></svg>
            VFRS Verified
          </div>
        )}

        {/* Bottom Location */}
        <div className="absolute bottom-3 left-3 text-white text-xs font-medium flex items-center gap-1">
          <svg className="w-3.5 h-3.5 text-amber-400" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z"></path><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 11a3 3 0 11-6 0 3 3 0 016 0z"></path></svg>
          {trip.location.name} • {trip.location.distance}
        </div>
      </div>

      {/* Content */}
      <div className="p-4 flex flex-col flex-1">
        {/* Date & Status */}
        <div className="flex items-center justify-between text-xs mb-2">
          <div className="flex items-center gap-1.5 text-gray-600 font-medium">
            <svg className="w-4 h-4 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"></path></svg>
            {trip.date.start} - {trip.date.end}/{trip.date.year}
          </div>
          <span className={`font-bold ${trip.status.color}`}>{trip.status.label}</span>
        </div>

        {/* Title */}
        <h3 className="text-[15px] font-bold text-gray-900 leading-snug mb-1 line-clamp-2 min-h-[44px]">
          {trip.title}
        </h3>
        
        {/* Description */}
        <p className="text-xs text-gray-500 line-clamp-2 mb-4 flex-1">
          {trip.description}
        </p>

        {/* Leader Info */}
        <div className="flex items-center gap-3 mb-4">
          <div className="relative">
            <Image src={trip.leader.avatar} alt={trip.leader.name} width={36} height={36} className="rounded-full object-cover" />
            <div className="absolute -bottom-1 -right-1 bg-white rounded-full p-0.5">
              <div className="bg-emerald-500 w-2.5 h-2.5 rounded-full border border-white"></div>
            </div>
          </div>
          <div className="flex-1">
            <div className="flex items-center gap-1.5">
              <span className="text-[13px] font-bold text-gray-900">{trip.leader.name}</span>
              <span className="bg-gray-100 text-gray-600 text-[10px] px-1.5 py-0.5 rounded font-medium">{trip.leader.badge}</span>
            </div>
            <div className="text-[11px] text-gray-500 font-medium mt-0.5">
              {trip.leader.experience}
            </div>
          </div>
          <div className="text-right">
            <div className="flex items-center gap-1 justify-end text-amber-500 text-[13px] font-bold">
              <svg className="w-3.5 h-3.5 fill-current" viewBox="0 0 20 20"><path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z"></path></svg>
              {trip.leader.rating}
            </div>
            <div className="text-[10px] text-gray-400 font-medium">({trip.leader.totalTrips} chuyến)</div>
          </div>
        </div>

        {/* Progress Bar */}
        <div className="mb-4">
          <div className="flex justify-between items-end mb-1.5 text-[11px]">
            <span className="text-gray-500 font-medium">Tình trạng chỗ:</span>
            <span className="font-bold text-gray-900">
              {trip.slots.booked} / {trip.slots.total} chỗ đã đặt 
              {trip.slots.statusText && (
                <span className={isFullyBooked ? 'text-gray-500 ml-1' : 'text-amber-600 ml-1'}>
                  ({trip.slots.statusText})
                </span>
              )}
            </span>
          </div>
          <div className="h-1.5 w-full bg-gray-100 rounded-full overflow-hidden">
            <div 
              className={`h-full rounded-full ${isFullyBooked ? 'bg-gray-400' : 'bg-[#1B5E41]'}`}
              style={{ width: `${progressPercent}%` }}
            ></div>
          </div>
        </div>

        {/* Footer: Price & Action */}
        <div className="flex items-center justify-between mt-auto pt-4 border-t border-gray-100">
          <div>
            <div className="text-[10px] text-gray-500 font-medium mb-0.5">Giá trọn gói / người</div>
            <div className="text-lg font-bold text-gray-900">
              {trip.price.toLocaleString('vi-VN')}đ
            </div>
          </div>
          <span 
            className={`
              px-4 py-2 rounded-lg text-xs font-bold transition-colors flex items-center justify-center
              ${trip.action.variant === 'primary' ? 'bg-[#1B5E41] hover:bg-[#154B36] text-white' : 
                trip.action.variant === 'secondary' ? 'bg-[#1B5E41]/10 hover:bg-[#1B5E41]/20 text-[#1B5E41]' :
                'bg-gray-100 text-gray-500 cursor-not-allowed'
              }
            `}
          >
            {trip.action.label}
          </span>
        </div>
      </div>
    </Link>
  );
};
