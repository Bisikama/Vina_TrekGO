export type DifficultyLevel = "Dễ" | "Trung bình" | "Khó" | "Thách thức";

export type TripType = "PUBLIC" | "PRIVATE";

export type TripStatus =
  | "UPCOMING"
  | "IN_PROGRESS"
  | "COMPLETED"
  | "CANCELLED";

export type CheckpointStatus = "PENDING" | "REACHED" | "COMPLETED";

export type RentalStatus =
  | "PAYMENT_CONFIRMED"
  | "PREPARING"
  | "READY_FOR_DELIVERY"
  | "DELIVERED_AT_PICKUP"
  | "IN_USE"
  | "RETURN_PENDING"
  | "RETURNED"
  | "DEPOSIT_REFUNDED";

export type PersonalTrailVisibility = "PRIVATE" | "PUBLIC";

export type PersonalTrailVerificationStatus =
  | "DRAFT"
  | "PENDING"
  | "VERIFIED"
  | "REJECTED";

export interface CheckpointMission {
  id: string;
  title: string;
  description: string;
  type: "PHOTO" | "QUIZ" | "QR";
  instruction: string;
  isDone: boolean;
  rewardPoints: number;
}

export interface Checkpoint {
  id: string;
  order: number;
  name: string;
  elevation?: number | null;
  distanceFromStartKm: number;
  status: CheckpointStatus;
  mission?: CheckpointMission;
  coords: {
    x: number;
    y: number;
  };
  realCoords?: {
    lat: number;
    lon: number;
  };
}

export interface Trail {
  id: string;
  name: string;
  region: string;
  difficulty: DifficultyLevel;
  distanceKm: number;
  elevationGainM: number;
  duration: string;
  price: number;
  isUnlocked: boolean;
  rating: number;
  reviewCount: number;
  imageUrl: string;
  description: string;
  highlights: string[];
  checkpoints: Checkpoint[];
  terrainType: string;
}

export interface PersonalTrailRoutePoint {
  id: string;
  x: number;
  y: number;
  lat?: number;
  lng?: number;
  elevation?: number;
  segmentId?: number;
}

export interface PersonalTrail {
  id: string;
  ownerId: string;
  name: string;
  region: string;
  difficulty: DifficultyLevel;
  distanceKm: number;
  elevationGainM: number;
  duration: string;
  terrainType: string;
  description: string;
  visibility: PersonalTrailVisibility;
  verificationStatus: PersonalTrailVerificationStatus;
  rejectionReason?: string;
  routePreset?: string;
  routePoints?: PersonalTrailRoutePoint[];
  gpsSegments: [number, number, number?][][]; // Phân đoạn toạ độ GPS 3D thực tế (GeoJSON MultiLineString) - Nguồn dữ liệu cốt lõi
  gpsRoute?: [number, number, number?][]; // [lng, lat, elev?][] toạ độ phẳng làm từ gpsSegments
  checkpoints: Checkpoint[];
  clientRecordingId?: string; // ID phiên ghi SQLite local_recordings (nếu tạo từ Live Trail Recorder)
  createdAt: string;
  updatedAt: string;
}

export interface CreatePersonalTrailInput {
  endedAt?: string;
  elapsedSeconds?: number;
  name: string;
  region: string;
  difficulty: DifficultyLevel;
  distanceKm: number;
  elevationGainM: number;
  duration: string;
  terrainType: string;
  description: string;
  routePreset?: string;
  routePoints?: PersonalTrailRoutePoint[];
  gpsSegments: [number, number, number?][][];
  gpsRoute?: [number, number, number?][];
  checkpoints?: Checkpoint[];
  submitForVerification?: boolean;
  clientRecordingId?: string;
}

export type CommunityAuthorRole = "TREKKER" | "LEADER";

export interface CommunityAuthor {
  id: string;
  name: string;
  avatar: string;
  role: CommunityAuthorRole;
  verified: boolean;
  badge?: string;
}

export interface CommunityProfile extends CommunityAuthor {
  coverImage: string;
  bio: string;
  location: string;
  joinedAt: string;
  followersCount: number;
  followingCount: number;
  completedTripsCount: number;
  totalDistanceKm: number;
  specialties: string[];
  isFollowing: boolean;
}

export type CommunityNotificationType =
  | "LIKE"
  | "COMMENT"
  | "FOLLOW"
  | "SAFETY"
  | "SYSTEM";

export interface CommunityNotification {
  id: string;
  type: CommunityNotificationType;
  title: string;
  message: string;
  createdAt: string;
  isRead: boolean;
  actor?: CommunityAuthor;
  postId?: string;
  profileId?: string;
}

export interface CommunityComment {
  id: string;
  postId: string;
  author: CommunityAuthor;
  content: string;
  createdAt: string;
}

export interface CommunityPost {
  id: string;
  author: CommunityAuthor;
  content: string;
  imageUrl?: string;
  location?: string;
  trailName?: string;
  tags: string[];
  createdAt: string;
  likesCount: number;
  commentsCount: number;
  isLiked: boolean;
  isSaved: boolean;
  comments: CommunityComment[];
}

export interface CreateCommunityPostInput {
  content: string;
  imageUrl?: string;
  location?: string;
  trailName?: string;
  tags: string[];
}

export type CommunityReportReason =
  | "SPAM"
  | "HARASSMENT"
  | "DANGEROUS_INFORMATION"
  | "MISINFORMATION"
  | "OTHER";

export interface CommunityReport {
  id: string;
  postId: string;
  reporterId: string;
  reason: CommunityReportReason;
  detail?: string;
  createdAt: string;
  status: "SUBMITTED";
}

export interface TripParticipant {
  id: string;
  name: string;
  avatar: string;
  phone?: string;
  role: "LEADER" | "MEMBER" | "HOST";
  isOffRoute?: boolean;
  deviationMeters?: number;
  lastKnownLocation?: string;
}

export interface TripLogistics {
  pickupLocation: string;
  pickupTime: string;
  vehicleModel: string;
  vehiclePlate: string;
  driverName: string;
  driverPhone: string;
  notes: string;
}

export interface TripWeather {
  tempC: number;
  condition: string;
  rainRisk: boolean;
  rainChancePercent: number;
  humidityPercent: number;
  windSpeedKmh: number;
  riskNotice?: string;
}

export interface Trip {
  id: string;
  type: TripType;
  name: string;
  trailId: string;
  destination: string;
  startDate: string;
  endDate: string;
  durationDays: number;
  status: TripStatus;
  leader: {
    name: string;
    avatar: string;
    phone: string;
    rating: number;
    badge: string;
  };
  capacity: number;
  enrolledCount: number;
  pricePerPerson?: number;
  bookingCode?: string;
  inviteCode?: string;
  logistics?: TripLogistics;
  weather: TripWeather;
  participants: TripParticipant[];
  rentedItemsCount?: number;
}

export type GroupTripJoinMode = "INSTANT" | "APPROVAL";
export type GroupTripJoinStatus = "NONE" | "PENDING" | "JOINED";

export interface GroupTripMember {
  id: string;
  name: string;
  avatar: string;
  fitnessLevel: TrekkerFitnessLevel;
  role: "ORGANIZER" | "MEMBER";
}

export interface GroupTrip {
  id: string;
  title: string;
  destination: string;
  province: string;
  startDate: string;
  endDate: string;
  duration: string;
  difficulty: DifficultyLevel;
  imageUrl: string;
  description: string;
  organizer: CommunityAuthor;
  maxMembers: number;
  currentMembers: number;
  priceEstimate: number;
  meetingPoint: string;
  joinMode: GroupTripJoinMode;
  joinStatus: GroupTripJoinStatus;
  tags: string[];
  requirements: string[];
  members: GroupTripMember[];
}

export type EquipmentCategory =
  | "Tất cả"
  | "Tent"
  | "Backpack"
  | "Trekking Pole"
  | "Sleeping Bag"
  | "Accessories";

export interface EquipmentItem {
  id: string;
  name: string;
  category: EquipmentCategory;
  dailyRate: number;
  deposit: number;
  stock: number;
  imageUrl: string;
  specs: string[];
  description: string;
  rating: number;
}

export interface RentalOrderItem {
  item: EquipmentItem;
  quantity: number;
}

export interface RentalOrder {
  id: string;
  tripId: string;
  tripName: string;
  items: RentalOrderItem[];
  days: number;
  totalRentalFee: number;
  totalDeposit: number;
  totalPayment: number;
  status: RentalStatus;
  createdAt: string;
}

export interface UserProfile {
  id: string;
  name: string;
  email: string;
  avatar: string;
  role: 'TREKKER' | 'LEADER' | 'STAFF_DELIVERY';
  completedTripsCount: number;
  totalDistanceKm: number;
  unlockedTrailsCount: number;
  savedPoints: number;
}

export type TrekkerFitnessLevel = "BEGINNER" | "INTERMEDIATE" | "ADVANCED";
export type ProfileVisibility = "PUBLIC" | "FOLLOWERS" | "PRIVATE";

export interface TrekkerEmergencyContact {
  name: string;
  relationship: string;
  phone: string;
}

export interface TrekkerNotificationSettings {
  tripUpdates: boolean;
  safetyAlerts: boolean;
  communityActivities: boolean;
  promotions: boolean;
}

export interface TrekkerPrivacySettings {
  profileVisibility: ProfileVisibility;
  activityVisibility: ProfileVisibility;
  allowFollowRequests: boolean;
}

export interface TrekkerAccount {
  phone: string;
  dateOfBirth: string;
  gender: "MALE" | "FEMALE" | "OTHER";
  address: string;
  bio: string;
  bloodType: string;
  allergies: string;
  medicalConditions: string;
  medications: string;
  fitnessLevel: TrekkerFitnessLevel;
  emergencyContact: TrekkerEmergencyContact;
  notifications: TrekkerNotificationSettings;
  privacy: TrekkerPrivacySettings;
}

export type UserNotificationCategory =
  | "BOOKING"
  | "RENTAL"
  | "GROUP_TRIP"
  | "PERSONAL_TRAIL"
  | "SYSTEM";

export interface UserNotification {
  id: string;
  category: UserNotificationCategory;
  title: string;
  message: string;
  createdAt: string;
  isRead: boolean;
  route: string;
}

export type SupportTicketCategory =
  | "BOOKING"
  | "RENTAL"
  | "ACCOUNT"
  | "TECHNICAL"
  | "OTHER";

export interface SupportTicket {
  id: string;
  category: SupportTicketCategory;
  subject: string;
  description: string;
  createdAt: string;
  status: "SUBMITTED";
}

export interface LiveNavTelemetry {
  distanceCompletedKm: number;
  totalDistanceKm: number;
  elapsedTimeString: string;
  averageSpeedKmh: number;
  currentElevationM: number;
  elevationGainM: number;
  activeCheckpointsCompleted: number;
  totalCheckpoints: number;
  nextCheckpointName: string;
  nextCheckpointDistanceM: number;
  batteryPercent: number;
  gpsAccuracyMeters: number;
  offlineSyncSec: number;
  isOnRoute: boolean;
  deviationMeters: number;
  isWarningDismissed: boolean;
}

export type FieldWorkflowStatus = 'PENDING' | 'IN_PROGRESS' | 'COMPLETED';
export type LeaderMemberAttendance = 'PENDING' | 'CHECKED_IN' | 'NO_SHOW';
export type LeaderGpsStatus = 'OK' | 'LOST';
export type DeliveryItemStatus = 'PENDING' | 'OK' | 'MISSING' | 'DAMAGED';

export interface DeliveryItemState {
  status: DeliveryItemStatus;
  note: string;
}

export interface ReturnItemState {
  status: DeliveryItemStatus;
  note: string;
}

export interface FieldWorkflowState {
  leaderTripStatus: 'PREPARING' | 'IN_PROGRESS' | 'COMPLETED';
  leaderPretripApproved: boolean;
  leaderAttendance: { memberName: string; status: LeaderMemberAttendance }[];
  requiredCheckpointIds: string[];
  completedCheckpointIds: string[];
  leaderSafetyAlert: {
    status: 'ACTIVE' | 'RESOLVED';
    selectedOption: string | null;
  };
  gpsStatus: LeaderGpsStatus;
  isOnline: boolean;
  pendingSyncCount: number;
  leaderReportSent: boolean;
  handoverRequested: boolean;
  deliveryStatus: FieldWorkflowStatus;
  packageReceived: boolean;
  arrivedAtPickup: boolean;
  deliveryVerified: boolean;
  deliveryItems: DeliveryItemState[];
  deliveryPhotoUri: string | null;
  deliverySigned: boolean;
  returnStatus: FieldWorkflowStatus;
  returnArrived: boolean;
  returnVerified: boolean;
  returnItems: ReturnItemState[];
  returnConditionRecorded: boolean;
  returnSigned: boolean;
  depositStatus: 'HELD' | 'PENDING_INSPECTION' | 'REFUNDED';
  lastUpdated: string;
}

export * from "./recording";

