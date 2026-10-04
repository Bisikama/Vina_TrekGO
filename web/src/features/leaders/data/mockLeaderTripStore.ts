export type CreatedLeaderTrip = {
  id?: string;
  name: string;
  place: string;
  date: string;
  fill: string;
  progress: number;
  status: string;
  image: string;
  price?: number;
  capacity?: number;
};

const key = "trekgo-mock-db";
type MockDb = { createdTrip: CreatedLeaderTrip | null; bookings: number };

function readDb(): MockDb {
  if (typeof window === "undefined") return { createdTrip: null, bookings: 0 };
  try {
    const value = window.localStorage.getItem(key);
    return value ? JSON.parse(value) as MockDb : { createdTrip: null, bookings: 0 };
  } catch {
    window.localStorage.removeItem(key);
    return { createdTrip: null, bookings: 0 };
  }
}

export function readCreatedLeaderTrip(): CreatedLeaderTrip | null {
  return readDb().createdTrip;
}

export function createdTripToTripData(trip: CreatedLeaderTrip) {
  const [booked, total] = trip.fill.split("/").map(Number);
  const [start = "01", end = "03", year = "2025"] = trip.date.split(/[\/-]/);
  return {
    id: trip.id || "leader-created-trip",
    duration: `${Math.max(1, Number(end) - Number(start) + 1)} ngày`,
    difficulty: { level: "medium", label: "Trung bình", color: "bg-blue-100 text-blue-700" },
    isVFRSVerified: false,
    location: { name: trip.place, distance: "Mock route" },
    image: trip.image,
    date: { start, end, year },
    status: { label: trip.status, color: "text-emerald-600" },
    title: trip.name,
    description: "Chuyến đi được tạo từ dữ liệu mock dùng để kiểm thử luồng đặt chuyến.",
    leader: { name: "Leader hiện tại", avatar: "/images/avatars/avatar-1.png", badge: "Leader", experience: "Kinh nghiệm trekking", rating: 5, totalTrips: 1, porters: 0 },
    slots: { booked: booked || 0, total: total || trip.capacity || 15, statusText: "Còn chỗ" },
    price: trip.price || 2850000,
    action: { label: "Đặt chuyến", variant: "primary" as const },
  };
}

export function saveCreatedLeaderTrip(trip: CreatedLeaderTrip) {
  window.localStorage.setItem(key, JSON.stringify({ ...readDb(), createdTrip: trip }));
  window.dispatchEvent(new Event("trekgo-mock-db-change"));
}

export function addMockBooking(tripId: string, quantity: number) {
  const db = readDb();
  if (db.createdTrip?.id === tripId) {
    const current = Number(db.createdTrip.fill.split("/")[0]) || 0;
    const total = Number(db.createdTrip.fill.split("/")[1]) || 15;
    const booked = Math.min(total, current + quantity);
    db.createdTrip = {
      ...db.createdTrip,
      fill: `${booked}/${total}`,
      progress: Math.round((booked / total) * 100),
    };
  }
  db.bookings += quantity;
  window.localStorage.setItem(key, JSON.stringify(db));
  window.dispatchEvent(new Event("trekgo-mock-db-change"));
}
