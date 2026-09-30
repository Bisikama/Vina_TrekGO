export type TrekkerHomeData = {
  condition: {
    gpsStatus: 'ACTIVE' | 'INACTIVE';
    temperature: number;
    weather: string;
  };

  upcomingTrip: {
    id: string;
    code: string;
    name: string;
    startsIn: string;
    schedule: string;
    leaderName: string;
    imageUrl: string;
  };

  equipment: {
    completed: number;
    total: number;
  };

  rentalOrder: {
    id: string;
    statusLabel: string;
    itemCount: number;
  };

  trails: {
    id: string;
    name: string;
    location: string;
    difficulty: string;
    duration: string;
    rating: number;
    imageUrl: string;
  }[];
};