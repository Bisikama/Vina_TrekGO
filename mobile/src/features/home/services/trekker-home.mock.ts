import type { TrekkerHomeData } from '@/features/home/types/trekker-home';

const mockHomeData: TrekkerHomeData = {
  condition: {
    gpsStatus: 'ACTIVE',
    temperature: 18,
    weather: 'Mây nhẹ',
  },

  upcomingTrip: {
    id: 'trip_fansipan_001',
    code: 'FSP-2026-10',
    name: 'Chinh phục Fansipan',
    startsIn: '48 GIỜ NỮA',
    schedule: '02–04 Tháng 10, 2026',
    leaderName: 'Hoàng Nam',
    imageUrl:
      'https://images.unsplash.com/photo-1464822759023-fed622ff2c3b?auto=format&fit=crop&w=1200&q=85',
  },

  equipment: {
    completed: 8,
    total: 10,
  },

  rentalOrder: {
    id: 'RNT-2026-1042',
    statusLabel: 'Đang chuẩn bị',
    itemCount: 4,
  },

  trails: [
    {
      id: 'trail_001',
      name: 'Lảo Thẩn săn mây',
      location: 'Lào Cai',
      difficulty: 'Trung bình',
      duration: '2 ngày 1 đêm',
      rating: 4.9,
      imageUrl:
        'https://images.unsplash.com/photo-1551632811-561732d1e306?auto=format&fit=crop&w=900&q=80',
    },
    {
      id: 'trail_002',
      name: 'Tà Năng – Phan Dũng',
      location: 'Lâm Đồng',
      difficulty: 'Khá',
      duration: '3 ngày 2 đêm',
      rating: 4.8,
      imageUrl:
        'https://images.unsplash.com/photo-1500534623283-312aade485b7?auto=format&fit=crop&w=900&q=80',
    },
  ],
};

function wait(
  milliseconds: number,
  signal?: AbortSignal,
) {
  return new Promise<void>(
    (resolve, reject) => {
      const timeoutId = setTimeout(
        resolve,
        milliseconds,
      );

      signal?.addEventListener(
        'abort',
        () => {
          clearTimeout(timeoutId);

          const error = new Error(
            'Request aborted',
          );

          error.name = 'AbortError';
          reject(error);
        },
        {
          once: true,
        },
      );
    },
  );
}

export async function getTrekkerHome(
  signal?: AbortSignal,
): Promise<TrekkerHomeData> {
  await wait(350, signal);

  return mockHomeData;
}