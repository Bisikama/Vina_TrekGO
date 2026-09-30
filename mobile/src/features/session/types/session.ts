export type AppRole =
  | 'TREKKER'
  | 'LEADER'
  | 'STAFF_BASE'
  | 'STAFF_FIELD'
  | 'ADMIN';

export type AppSession = {
  user: {
    id: string;
    displayName: string;
    avatarUrl: string;
  };

  role: AppRole;
  vfrsLevel: number;
};