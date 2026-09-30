import type { AppSession } from '@/features/session/types/session';

const demoSession: AppSession = {
  user: {
    id: 'user_001',
    displayName: 'Nguyễn An',
    avatarUrl:
      'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=160&q=80',
  },

  role: 'TREKKER',
  vfrsLevel: 2,
};

export async function getDemoSession(): Promise<AppSession> {
  return demoSession;
}