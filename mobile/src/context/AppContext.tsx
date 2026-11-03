import React, { createContext, useCallback, useContext, useEffect, useRef, useState } from "react";
import { Alert } from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import * as Network from "expo-network";
import { ApiError } from "@/lib/api-client";

import {
  CommunityNotification,
  CommunityPost,
  CommunityProfile,
  CommunityReport,
  CommunityReportReason,
  CreateCommunityPostInput,
  CreatePersonalTrailInput,
  EquipmentItem,
  GroupTrip,
  LiveNavTelemetry,
  PersonalTrail,
  PersonalTrailVerificationStatus,
  RentalOrder,
  SupportTicket,
  SupportTicketCategory,
  Trail,
  TrekkerAccount,
  Trip,
  UserNotification,
  UserProfile,
  LeaderMemberAttendance,
  DeliveryItemStatus,
  DeliveryItemState,
  ReturnItemState,
  FieldWorkflowState,
} from "@/types";

import {
  initialLiveTelemetry,
  mockEquipment,
  mockRentalOrders,
  mockTrails,
  mockTrips,
  mockUserProfile,
} from "@/data/mockData";
import { readStoredAuth } from "@/features/auth/storage";
import { useAuth } from "@/features/auth/AuthContext";
import {
  accountStorage,
  OfflineMapPackage,
  offlineMapStorage,
  recordingDatabase,
  trailStorage,
  syncService,
} from "@/services/storage";
import {
  personalTrailApi,
  convertBackendTrailToPersonalTrail,
  mapDifficultyToBackend,
} from "@/services/api/personalTrailApi";

function isUUID(str?: string): boolean {
  if (!str || typeof str !== "string") return false;
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
    str,
  );
}

export interface RentalSettlement {
  orderId: string;
  returnMethod: string;
  requestedAt: string;
  inspectedAt?: string;
  inspectionResult?: "PASSED" | "DEDUCTION";
  deductionAmount: number;
  deductionReason?: string;
  refundAmount: number;
  refundedAt?: string;
}

export type {
  LeaderMemberAttendance,
  DeliveryItemStatus,
  DeliveryItemState,
  ReturnItemState,
  FieldWorkflowState,
} from "@/types";

export interface PrivateTripActionResult {
  ok: boolean;
  message: string;
  trip?: Trip;
}

export interface GroupTripActionResult {
  ok: boolean;
  message: string;
  status?: GroupTrip["joinStatus"];
}

interface AppContextType {
  user: UserProfile;
  setUser: React.Dispatch<React.SetStateAction<UserProfile>>;
  toggleUserRole: () => void;
  authRole: "STAFF_DELIVERY" | "LEADER" | null;
  signOut: () => void;
  trekkerAccount: TrekkerAccount;
  updateUserProfile: (input: Partial<UserProfile>) => void;
  updateTrekkerAccount: (input: Partial<TrekkerAccount>) => void;

  trips: Trip[];
  activeTrip: Trip;
  createPrivateTrip: (tripData: Partial<Trip>) => Trip;
  joinPrivateTrip: (inviteCode: string) => PrivateTripActionResult;
  leavePrivateTrip: (tripId: string) => PrivateTripActionResult;
  cancelPrivateTrip: (tripId: string) => PrivateTripActionResult;
  bookPublicTrip: (tripId: string, participantsCount: number) => void;

  groupTrips: GroupTrip[];
  joinGroupTrip: (groupTripId: string) => GroupTripActionResult;
  cancelGroupTripRequest: (groupTripId: string) => GroupTripActionResult;
  leaveGroupTrip: (groupTripId: string) => GroupTripActionResult;

  userNotifications: UserNotification[];
  markUserNotificationRead: (notificationId: string) => void;
  markAllUserNotificationsRead: () => void;
  deleteUserNotification: (notificationId: string) => void;

  savedTrailIds: string[];
  toggleSavedTrail: (trailId: string) => void;

  offlinePackages: Record<string, OfflineMapPackage>;
  downloadOfflineTrail: (trailId: string) => Promise<void>;
  removeOfflineTrail: (trailId: string) => Promise<void>;
  isTrailOfflineReady: (trailId: string) => boolean;
  isStorageHydrated: boolean;

  supportTickets: SupportTicket[];
  createSupportTicket: (input: {
    category: SupportTicketCategory;
    subject: string;
    description: string;
  }) => SupportTicket;

  trails: Trail[];
  unlockTrail: (trailId: string) => void;

  personalTrails: PersonalTrail[];
  createPersonalTrail: (input: CreatePersonalTrailInput) => Promise<PersonalTrail>;
  updatePersonalTrail: (
    trailId: string,
    input: CreatePersonalTrailInput,
  ) => Promise<void>;
  submitPersonalTrail: (
    trailId: string,
    noteToAdmin?: string,
  ) => Promise<boolean>;
  deletePersonalTrail: (trailId: string) => Promise<void>;
  refreshPersonalTrails: () => Promise<void>;
  clearAllDatabaseData: () => Promise<void>;

  communityPosts: CommunityPost[];
  communityProfiles: CommunityProfile[];
  communityNotifications: CommunityNotification[];
  communityReports: CommunityReport[];
  createCommunityPost: (input: CreateCommunityPostInput) => CommunityPost;
  toggleCommunityPostLike: (postId: string) => void;
  toggleCommunityPostSaved: (postId: string) => void;
  addCommunityComment: (postId: string, content: string) => void;
  toggleCommunityFollow: (profileId: string) => void;
  markCommunityNotificationRead: (notificationId: string) => void;
  markAllCommunityNotificationsRead: () => void;
  reportCommunityPost: (
    postId: string,
    reason: CommunityReportReason,
    detail?: string,
  ) => void;

  equipment: EquipmentItem[];
  rentalOrders: RentalOrder[];
  rentalSettlements: Record<string, RentalSettlement>;
  cart: {
    item: EquipmentItem;
    quantity: number;
  }[];
  addToCart: (item: EquipmentItem, quantity: number) => void;
    setCartQuantity: (item: EquipmentItem, quantity: number) => void;
  removeFromCart: (itemId: string) => void;
  checkoutRental: (tripId: string, days: number) => void;
  confirmRentalPickup: (orderId: string) => void;
  requestRentalReturn: (orderId: string, returnMethod: string) => void;
  completeRentalInspection: (orderId: string) => void;
  confirmRentalDepositRefund: (orderId: string) => void;

  telemetry: LiveNavTelemetry;
  activeTrail: Trail;
  toggleDeviation: () => void;
  dismissDeviationWarning: () => void;
  reconnectToRoute: () => void;
  completeCheckpointMission: (checkpointId: string) => void;
  resolveMemberAlert: (memberId: string) => void;

  fieldWorkflow: FieldWorkflowState;
  setLeaderMemberAttendance: (memberName: string, status: LeaderMemberAttendance) => void;
  completeLeaderCheckpoint: (checkpointId: string) => void;
  resolveLeaderSafetyAlert: (selectedOption: string) => void;
  toggleLeaderGpsStatus: () => void;
  toggleLeaderOnlineStatus: () => void;
  approveLeaderPretrip: () => void;
  startLeaderTrip: () => void;
  completeLeaderTrip: () => void;
  sendLeaderReport: () => void;
  receiveDeliveryPackage: (packageCode: string) => boolean;
  markArrivedAtPickup: () => void;
  setDeliveryVerified: (verified: boolean) => void;
  setDeliveryItem: (index: number, status: DeliveryItemStatus, note: string) => void;
  setDeliveryPhoto: (uri: string | null) => void;
  setDeliverySigned: (signed: boolean) => void;
  completeDelivery: () => void;
  markReturnArrived: () => void;
  setReturnVerified: (verified: boolean) => void;
  setReturnItem: (index: number, status: DeliveryItemStatus, note: string) => void;
  setReturnConditionRecorded: (recorded: boolean) => void;
  setReturnSigned: (signed: boolean) => void;
  completeReturn: () => void;
  enableReturnDemo: () => void;
  resetFieldWorkflow: () => void;
}

const AppContext = createContext<AppContextType | undefined>(undefined);

const initialTrekkerAccount: TrekkerAccount = {
  phone: "0903 456 789",
  dateOfBirth: "18/09/2003",
  gender: "MALE",
  address: "Thành phố Hồ Chí Minh",
  bio: "Trekker cuối tuần, yêu rừng thông và những cung đường săn mây.",
  bloodType: "O+",
  allergies: "Không ghi nhận",
  medicalConditions: "Không có bệnh nền",
  medications: "Không sử dụng thuốc định kỳ",
  fitnessLevel: "INTERMEDIATE",
  emergencyContact: {
    name: "Nguyễn Minh Tâm",
    relationship: "Người thân",
    phone: "0912 345 678",
  },
  notifications: {
    tripUpdates: true,
    safetyAlerts: true,
    communityActivities: true,
    promotions: false,
  },
  privacy: {
    profileVisibility: "PUBLIC",
    activityVisibility: "FOLLOWERS",
    allowFollowRequests: true,
  },
};

const initialGroupTrips: GroupTrip[] = [
  {
    id: "group-ta-nang-01",
    title: "Ghép đoàn săn mây Tà Năng – Phan Dũng",
    destination: "Tà Năng – Phan Dũng",
    province: "Lâm Đồng",
    startDate: "16/10/2026",
    endDate: "18/10/2026",
    duration: "3 ngày 2 đêm",
    difficulty: "Trung bình",
    imageUrl:
      "https://images.unsplash.com/photo-1464822759023-fed622ff2c3b?auto=format&fit=crop&w=1200&q=80",
    description:
      "Nhóm nhỏ ưu tiên trải nghiệm chậm, săn mây bình minh và cắm trại trên sống lưng đồi cỏ.",
    organizer: {
      id: "community-leader-linh",
      name: "Trần Gia Linh",
      avatar:
        "https://images.unsplash.com/photo-1494790108377-be9c29b29330?auto=format&fit=crop&w=240&q=80",
      role: "LEADER",
      verified: true,
      badge: "Verified Leader",
    },
    maxMembers: 10,
    currentMembers: 7,
    priceEstimate: 1850000,
    meetingPoint: "Bến xe Miền Đông mới, TP.HCM",
    joinMode: "APPROVAL",
    joinStatus: "NONE",
    tags: ["Săn mây", "Cắm trại", "Chụp ảnh"],
    requirements: [
      "Thể lực trung bình",
      "Có giày trekking",
      "Không bệnh tim mạch nặng",
    ],
    members: [
      {
        id: "community-leader-linh",
        name: "Trần Gia Linh",
        avatar:
          "https://images.unsplash.com/photo-1494790108377-be9c29b29330?auto=format&fit=crop&w=240&q=80",
        fitnessLevel: "ADVANCED",
        role: "ORGANIZER",
      },
      {
        id: "group-member-1",
        name: "Hoàng Nam",
        avatar:
          "https://images.unsplash.com/photo-1500648767791-00dcc994a43e?auto=format&fit=crop&w=240&q=80",
        fitnessLevel: "INTERMEDIATE",
        role: "MEMBER",
      },
      {
        id: "group-member-2",
        name: "Bảo Ngọc",
        avatar:
          "https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=240&q=80",
        fitnessLevel: "INTERMEDIATE",
        role: "MEMBER",
      },
    ],
  },
  {
    id: "group-bidoup-02",
    title: "Cuối tuần chinh phục Bidoup",
    destination: "Vườn quốc gia Bidoup – Núi Bà",
    province: "Lâm Đồng",
    startDate: "24/10/2026",
    endDate: "25/10/2026",
    duration: "2 ngày 1 đêm",
    difficulty: "Khó",
    imageUrl:
      "https://images.unsplash.com/photo-1551632811-561732d1e306?auto=format&fit=crop&w=1200&q=80",
    description:
      "Đoàn dành cho trekker đã có kinh nghiệm, tốc độ ổn định và ưu tiên an toàn rừng già.",
    organizer: {
      id: "community-leader-minh",
      name: "Lê Nhật Minh",
      avatar:
        "https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?auto=format&fit=crop&w=240&q=80",
      role: "LEADER",
      verified: true,
      badge: "Top Organizer",
    },
    maxMembers: 8,
    currentMembers: 5,
    priceEstimate: 2250000,
    meetingPoint: "Quảng trường Lâm Viên, Đà Lạt",
    joinMode: "APPROVAL",
    joinStatus: "PENDING",
    tags: ["Rừng già", "Đỉnh cao", "Thử thách"],
    requirements: [
      "Đã hoàn thành ít nhất 2 cung",
      "Thể lực khá",
      "Mang áo mưa cá nhân",
    ],
    members: [
      {
        id: "community-leader-minh",
        name: "Lê Nhật Minh",
        avatar:
          "https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?auto=format&fit=crop&w=240&q=80",
        fitnessLevel: "ADVANCED",
        role: "ORGANIZER",
      },
    ],
  },
  {
    id: "group-chua-chan-03",
    title: "Trekking Núi Chứa Chan cho người mới",
    destination: "Núi Chứa Chan",
    province: "Đồng Nai",
    startDate: "01/11/2026",
    endDate: "01/11/2026",
    duration: "Trong ngày",
    difficulty: "Dễ",
    imageUrl:
      "https://images.unsplash.com/photo-1486911278844-a81c5267e227?auto=format&fit=crop&w=1200&q=80",
    description:
      "Chuyến làm quen trekking với nhịp độ nhẹ, phù hợp người mới và nhóm bạn nhỏ.",
    organizer: {
      id: "community-user-thao",
      name: "Nguyễn Thanh Thảo",
      avatar:
        "https://images.unsplash.com/photo-1527980965255-d3b416303d12?auto=format&fit=crop&w=240&q=80",
      role: "TREKKER",
      verified: false,
    },
    maxMembers: 12,
    currentMembers: 9,
    priceEstimate: 650000,
    meetingPoint: "Bưu điện trung tâm TP.HCM",
    joinMode: "INSTANT",
    joinStatus: "NONE",
    tags: ["Người mới", "Trong ngày", "Kết bạn"],
    requirements: [
      "Sức khỏe ổn định",
      "Mang tối thiểu 1.5L nước",
      "Có mặt đúng giờ",
    ],
    members: [
      {
        id: "community-user-thao",
        name: "Nguyễn Thanh Thảo",
        avatar:
          "https://images.unsplash.com/photo-1527980965255-d3b416303d12?auto=format&fit=crop&w=240&q=80",
        fitnessLevel: "INTERMEDIATE",
        role: "ORGANIZER",
      },
    ],
  },
];

const initialUserNotifications: UserNotification[] = [
  {
    id: "notification-booking-1",
    category: "BOOKING",
    title: "Booking đã được xác nhận",
    message: "Vé QR cho chuyến trekking sắp tới đã sẵn sàng trong My Trips.",
    createdAt: "10 phút trước",
    isRead: false,
    route: "/(tabs)/trips",
  },
  {
    id: "notification-rental-1",
    category: "RENTAL",
    title: "Đơn thuê đang được chuẩn bị",
    message:
      "Kho đã tiếp nhận đơn và đang chuẩn bị thiết bị cho chuyến đi của bạn.",
    createdAt: "1 giờ trước",
    isRead: false,
    route: "/(tabs)/rental",
  },
  {
    id: "notification-group-1",
    category: "GROUP_TRIP",
    title: "Yêu cầu ghép đoàn đang chờ duyệt",
    message: "Trưởng nhóm Bidoup sẽ phản hồi yêu cầu tham gia của bạn.",
    createdAt: "Hôm qua",
    isRead: false,
    route: "/group-trips",
  },
  {
    id: "notification-trail-1",
    category: "PERSONAL_TRAIL",
    title: "Cung đường đã được xác minh",
    message: "Cung đường cá nhân của bạn đã đạt trạng thái VERIFIED.",
    createdAt: "2 ngày trước",
    isRead: true,
    route: "/personal-trails",
  },
  {
    id: "notification-trail-2",
    category: "PERSONAL_TRAIL",
    title: "Cần chỉnh sửa cung đường",
    message:
      "Admin yêu cầu bổ sung checkpoint và mô tả an toàn trước khi duyệt lại.",
    createdAt: "3 ngày trước",
    isRead: true,
    route: "/personal-trails",
  },
];

function formatNow() {
  return new Date().toLocaleString("vi-VN");
}

function normalizeInviteCode(value: string) {
  return value.trim().toUpperCase();
}

const initialCommunityPosts: CommunityPost[] = [
  {
    id: "community-post-pinhatt",
    author: {
      id: "leader-hoang-nam",
      name: "Hoàng Nam",
      avatar: "https://i.pravatar.cc/200?img=12",
      role: "LEADER",
      verified: true,
      badge: "Verified Leader",
    },
    content:
      "Sáng nay Pinhatt có mây thấp và gió khá mạnh ở đoạn sống núi. Đoàn đi sau 9 giờ nên mang áo gió, giữ khoảng cách và tránh đứng lâu tại mép đá.",
    imageUrl:
      "https://images.unsplash.com/photo-1500530855697-b586d89ba3ee?auto=format&fit=crop&w=1200&q=80",
    location: "Đỉnh Pinhatt, Lâm Đồng",
    trailName: "Đường mòn săn hoàng hôn Pinhatt",
    tags: ["Cảnh báo", "Pinhatt", "Thời tiết"],
    createdAt: "35 phút trước",
    likesCount: 128,
    commentsCount: 2,
    isLiked: false,
    isSaved: true,
    comments: [
      {
        id: "comment-pinhatt-1",
        postId: "community-post-pinhatt",
        author: {
          id: "trekker-minh-anh",
          name: "Minh Anh",
          avatar: "https://i.pravatar.cc/200?img=47",
          role: "TREKKER",
          verified: false,
        },
        content: "Cảm ơn Leader, nhóm mình sẽ xuất phát sớm hơn dự kiến.",
        createdAt: "20 phút trước",
      },
      {
        id: "comment-pinhatt-2",
        postId: "community-post-pinhatt",
        author: {
          id: "leader-khanh-linh",
          name: "Khánh Linh",
          avatar: "https://i.pravatar.cc/200?img=32",
          role: "LEADER",
          verified: true,
          badge: "Top Organizer",
        },
        content: "Đoạn CP2 cũng hơi trơn, nhớ kiểm tra đế giày trước khi lên.",
        createdAt: "12 phút trước",
      },
    ],
  },
  {
    id: "community-post-ta-nang",
    author: {
      id: "trekker-minh-anh",
      name: "Minh Anh",
      avatar: "https://i.pravatar.cc/200?img=47",
      role: "TREKKER",
      verified: false,
      badge: "Mountain Explorer",
    },
    content:
      "Hoàn thành cung Tà Năng – Phan Dũng lần đầu tiên! Cảm ơn mọi người đã chia sẻ checklist nước và đồ chống nắng. View cuối ngày thật sự xứng đáng.",
    imageUrl:
      "https://images.unsplash.com/photo-1464822759023-fed622ff2c3b?auto=format&fit=crop&w=1200&q=80",
    location: "Tà Năng – Phan Dũng",
    trailName: "Tà Năng – Phan Dũng",
    tags: ["Review chuyến đi", "Tà Năng", "Tân binh"],
    createdAt: "2 giờ trước",
    likesCount: 84,
    commentsCount: 1,
    isLiked: true,
    isSaved: false,
    comments: [
      {
        id: "comment-ta-nang-1",
        postId: "community-post-ta-nang",
        author: {
          id: "leader-hoang-nam",
          name: "Hoàng Nam",
          avatar: "https://i.pravatar.cc/200?img=12",
          role: "LEADER",
          verified: true,
          badge: "Verified Leader",
        },
        content: "Chúc mừng bạn đã hoàn thành cung đầu tiên nhé!",
        createdAt: "1 giờ trước",
      },
    ],
  },
  {
    id: "community-post-gear",
    author: {
      id: "leader-khanh-linh",
      name: "Khánh Linh",
      avatar: "https://i.pravatar.cc/200?img=32",
      role: "LEADER",
      verified: true,
      badge: "Top Organizer",
    },
    content:
      "Checklist nhanh cho chuyến 2 ngày 1 đêm: áo mưa nhẹ, đèn pin đội đầu, túi ngủ phù hợp nhiệt độ và tối thiểu 2 lít nước/người. Đừng mang balo quá 20% cân nặng cơ thể.",
    location: "Cộng đồng TrekGo",
    tags: ["Kinh nghiệm", "Trang bị", "Checklist"],
    createdAt: "Hôm qua",
    likesCount: 206,
    commentsCount: 0,
    isLiked: false,
    isSaved: false,
    comments: [],
  },
];

const initialCommunityProfiles: CommunityProfile[] = [
  {
    id: mockUserProfile.id,
    name: mockUserProfile.name,
    avatar: mockUserProfile.avatar,
    coverImage:
      "https://images.unsplash.com/photo-1464278533981-50106e6176b1?auto=format&fit=crop&w=1200&q=80",
    role: mockUserProfile.role === "LEADER" ? "LEADER" : "TREKKER",
    verified: mockUserProfile.role === "LEADER",
    badge:
      mockUserProfile.role === "LEADER" ? "Verified Leader" : "Trail Explorer",
    bio: "Yêu những cung đường nhiều cây xanh, thích ghi lại checklist và kinh nghiệm cho người mới.",
    location: "TP. Hồ Chí Minh",
    joinedAt: "Tham gia từ 08/2026",
    followersCount: 126,
    followingCount: 48,
    completedTripsCount: mockUserProfile.completedTripsCount,
    totalDistanceKm: mockUserProfile.totalDistanceKm,
    specialties: ["Trekking cuối tuần", "Checklist", "Ảnh hành trình"],
    isFollowing: false,
  },
  {
    id: "leader-hoang-nam",
    name: "Hoàng Nam",
    avatar: "https://i.pravatar.cc/200?img=12",
    coverImage:
      "https://images.unsplash.com/photo-1464822759023-fed622ff2c3b?auto=format&fit=crop&w=1200&q=80",
    role: "LEADER",
    verified: true,
    badge: "Verified Leader",
    bio: "Leader chuyên tuyến Tây Nguyên, ưu tiên an toàn đoàn và kỹ năng xử lý thời tiết xấu.",
    location: "Đà Lạt, Lâm Đồng",
    joinedAt: "Tham gia từ 04/2025",
    followersCount: 2840,
    followingCount: 119,
    completedTripsCount: 68,
    totalDistanceKm: 1246,
    specialties: ["Tây Nguyên", "An toàn tuyến", "Sơ cứu"],
    isFollowing: true,
  },
  {
    id: "trekker-minh-anh",
    name: "Minh Anh",
    avatar: "https://i.pravatar.cc/200?img=47",
    coverImage:
      "https://images.unsplash.com/photo-1551632811-561732d1e306?auto=format&fit=crop&w=1200&q=80",
    role: "TREKKER",
    verified: false,
    badge: "Mountain Explorer",
    bio: "Tân binh mê săn mây, đang chinh phục từng cung đường đẹp của Việt Nam.",
    location: "Biên Hòa, Đồng Nai",
    joinedAt: "Tham gia từ 09/2026",
    followersCount: 318,
    followingCount: 92,
    completedTripsCount: 7,
    totalDistanceKm: 86,
    specialties: ["Săn mây", "Review chuyến đi", "Người mới"],
    isFollowing: false,
  },
  {
    id: "leader-khanh-linh",
    name: "Khánh Linh",
    avatar: "https://i.pravatar.cc/200?img=32",
    coverImage:
      "https://images.unsplash.com/photo-1500530855697-b586d89ba3ee?auto=format&fit=crop&w=1200&q=80",
    role: "LEADER",
    verified: true,
    badge: "Top Organizer",
    bio: "Leader tuyến dài ngày, thích chia sẻ cách chuẩn bị hành lý gọn và đủ.",
    location: "Hà Nội",
    joinedAt: "Tham gia từ 11/2024",
    followersCount: 4210,
    followingCount: 204,
    completedTripsCount: 94,
    totalDistanceKm: 2084,
    specialties: ["Tuyến dài ngày", "Trang bị", "Điều phối đoàn"],
    isFollowing: true,
  },
];

const initialCommunityNotifications: CommunityNotification[] = [
  {
    id: "community-notification-safety",
    type: "SAFETY",
    title: "Cảnh báo tuyến Pinhatt",
    message:
      "Gió mạnh và mây thấp tại đoạn sống núi. Kiểm tra bài cập nhật trước khi khởi hành.",
    createdAt: "20 phút trước",
    isRead: false,
    postId: "community-post-pinhatt",
  },
  {
    id: "community-notification-comment",
    type: "COMMENT",
    title: "Khánh Linh đã bình luận",
    message: "Checklist này rất phù hợp cho đoàn đi cuối tuần.",
    createdAt: "1 giờ trước",
    isRead: false,
    actor: {
      id: "leader-khanh-linh",
      name: "Khánh Linh",
      avatar: "https://i.pravatar.cc/200?img=32",
      role: "LEADER",
      verified: true,
      badge: "Top Organizer",
    },
    profileId: "leader-khanh-linh",
  },
  {
    id: "community-notification-follow",
    type: "FOLLOW",
    title: "Minh Anh đã theo dõi bạn",
    message: "Bạn có thêm một người đồng hành mới trong Community.",
    createdAt: "Hôm qua",
    isRead: true,
    actor: {
      id: "trekker-minh-anh",
      name: "Minh Anh",
      avatar: "https://i.pravatar.cc/200?img=47",
      role: "TREKKER",
      verified: false,
      badge: "Mountain Explorer",
    },
    profileId: "trekker-minh-anh",
  },
];

const FIELD_WORKFLOW_STORAGE_KEY = "trekgo.field-workflow.v1";

const initialFieldWorkflow: FieldWorkflowState = {
  leaderTripStatus: "PREPARING",
  leaderPretripApproved: false,
  leaderAttendance: [
    { memberName: "Nguyễn Minh Bảo", status: "CHECKED_IN" },
    { memberName: "Trần Văn Bình", status: "CHECKED_IN" },
    { memberName: "Lê Hồng Phúc", status: "PENDING" },
    { memberName: "Nguyễn Thị Thu Hà", status: "CHECKED_IN" },
    { memberName: "Phạm Đức Anh", status: "CHECKED_IN" },
    { memberName: "Vũ Quốc Khánh", status: "CHECKED_IN" },
    { memberName: "Đặng Mai Lan", status: "PENDING" },
    { memberName: "Hoàng Kim Ngân", status: "CHECKED_IN" },
  ],
  requiredCheckpointIds: ["cp-01", "cp-02", "cp-03", "cp-04", "cp-05"],
  completedCheckpointIds: ["cp-01"],
  leaderSafetyAlert: { status: "ACTIVE", selectedOption: null },
  gpsStatus: "OK",
  isOnline: true,
  pendingSyncCount: 0,
  leaderReportSent: false,
  handoverRequested: false,
  deliveryStatus: "PENDING",
  packageReceived: false,
  arrivedAtPickup: false,
  deliveryVerified: false,
  deliveryItems: [
    { status: "PENDING", note: "" },
    { status: "PENDING", note: "" },
    { status: "PENDING", note: "" },
    { status: "PENDING", note: "" },
  ],
  deliveryPhotoUri: null,
  deliverySigned: false,
  returnStatus: "PENDING",
  returnArrived: false,
  returnVerified: false,
  returnItems: [
    { status: "PENDING", note: "" },
    { status: "PENDING", note: "" },
    { status: "PENDING", note: "" },
    { status: "PENDING", note: "" },
  ],
  returnConditionRecorded: false,
  returnSigned: false,
  depositStatus: "HELD",
  lastUpdated: new Date().toISOString(),
};

export const AppProvider: React.FC<{
  children: React.ReactNode;
}> = ({ children }) => {
  const { user: authenticatedUser } = useAuth();
  const accountIdRef = useRef(authenticatedUser?.id);
  const trailRefreshRef = useRef(0);
  useEffect(() => {
    accountIdRef.current = authenticatedUser?.id;
    return () => { trailRefreshRef.current += 1; };
  }, [authenticatedUser?.id]);
  const [authRole, setAuthRole] = useState<"STAFF_DELIVERY" | "LEADER" | null>(null);
  const [localUser, setUser] = useState<UserProfile>(mockUserProfile);
  const user: UserProfile = authenticatedUser
    ? {
        ...localUser,
        id: authenticatedUser.id,
        name:
          authenticatedUser.fullName ||
          authenticatedUser.name ||
          authenticatedUser.email.split("@")[0],
        email: authenticatedUser.email,
        avatar:
          authenticatedUser.avatarUrl ||
          authenticatedUser.avatar ||
          localUser.avatar,
        role: authenticatedUser.role === "LEADER" ? "LEADER" : "TREKKER",
      }
    : localUser;

  const signOut = useCallback(() => {
    setAuthRole(null);
    setUser(mockUserProfile);
  }, []);

  const [fieldWorkflow, setFieldWorkflow] = useState<FieldWorkflowState>(initialFieldWorkflow);
  const [workflowHydrated, setWorkflowHydrated] = useState(false);

  useEffect(() => {
    AsyncStorage.getItem(FIELD_WORKFLOW_STORAGE_KEY)
      .then((value) => {
        if (value) {
          const stored = JSON.parse(value) as Partial<FieldWorkflowState> & {
            deliveryItems?: (boolean | DeliveryItemState)[];
            returnItems?: (boolean | ReturnItemState)[];
          };
          const deliveryItems =
            stored.deliveryItems?.map((item) =>
              typeof item === "boolean"
                ? ({ status: item ? "OK" : "PENDING", note: "" } as DeliveryItemState)
                : item,
            ) ?? initialFieldWorkflow.deliveryItems;
          const returnItems =
            stored.returnItems?.map((item) =>
              typeof item === "boolean"
                ? ({ status: item ? "OK" : "PENDING", note: "" } as ReturnItemState)
                : item,
            ) ?? initialFieldWorkflow.returnItems;
          setFieldWorkflow({
            ...initialFieldWorkflow,
            ...stored,
            deliveryItems,
            returnItems,
          });
        }
      })
      .catch(() => undefined)
      .finally(() => setWorkflowHydrated(true));
  }, []);

  useEffect(() => {
    if (!workflowHydrated) return;
    AsyncStorage.setItem(
      FIELD_WORKFLOW_STORAGE_KEY,
      JSON.stringify(fieldWorkflow),
    ).catch(() => undefined);
  }, [fieldWorkflow, workflowHydrated]);

  const updateFieldWorkflow = useCallback(
    (update: Partial<FieldWorkflowState>) => {
      setFieldWorkflow((prev) => ({
        ...prev,
        ...update,
        lastUpdated: new Date().toISOString(),
      }));
    },
    [],
  );

  const approveLeaderPretrip = useCallback(
    () => updateFieldWorkflow({ leaderPretripApproved: true }),
    [updateFieldWorkflow],
  );

  const setLeaderMemberAttendance = useCallback(
    (memberName: string, status: LeaderMemberAttendance) => {
      setFieldWorkflow((prev) => ({
        ...prev,
        leaderAttendance: prev.leaderAttendance.map((item) =>
          item.memberName === memberName ? { ...item, status } : item,
        ),
        lastUpdated: new Date().toISOString(),
      }));
    },
    [],
  );

  const startLeaderTrip = useCallback(() => {
    setFieldWorkflow((prev) => {
      const checkedInMembers = prev.leaderAttendance.filter(
        (item) => item.status === "CHECKED_IN",
      ).length;
      const allProcessed = prev.leaderAttendance.every(
        (item) => item.status !== "PENDING",
      );
      if (!prev.leaderPretripApproved || !allProcessed || checkedInMembers === 0) {
        return prev;
      }
      return {
        ...prev,
        leaderTripStatus: "IN_PROGRESS",
        gpsStatus: "OK",
        lastUpdated: new Date().toISOString(),
      };
    });
  }, []);

  const completeLeaderCheckpoint = useCallback((checkpointId: string) => {
    setFieldWorkflow((prev) => {
      if (
        prev.leaderTripStatus !== "IN_PROGRESS" ||
        prev.completedCheckpointIds.includes(checkpointId)
      ) {
        return prev;
      }
      return {
        ...prev,
        completedCheckpointIds: [...prev.completedCheckpointIds, checkpointId],
        lastUpdated: new Date().toISOString(),
      };
    });
  }, []);

  const resolveLeaderSafetyAlert = useCallback(
    (selectedOption: string) => {
      updateFieldWorkflow({
        leaderSafetyAlert: {
          status: "RESOLVED",
          selectedOption,
        },
      });
    },
    [updateFieldWorkflow],
  );

  const toggleLeaderGpsStatus = useCallback(() => {
    setFieldWorkflow((prev) => ({
      ...prev,
      gpsStatus: prev.gpsStatus === "LOST" ? "OK" : "LOST",
      lastUpdated: new Date().toISOString(),
    }));
  }, []);

  const toggleLeaderOnlineStatus = useCallback(() => {
    setFieldWorkflow((prev) => {
      const nextOnline = !prev.isOnline;
      return {
        ...prev,
        isOnline: nextOnline,
        pendingSyncCount: nextOnline ? 0 : Math.max(prev.pendingSyncCount, 3),
        lastUpdated: new Date().toISOString(),
      };
    });
  }, []);

  const completeLeaderTrip = useCallback(() => {
    setFieldWorkflow((prev) => {
      if (
        prev.completedCheckpointIds.length < prev.requiredCheckpointIds.length
      ) {
        return prev;
      }
      return {
        ...prev,
        leaderTripStatus: "COMPLETED",
        handoverRequested: true,
        lastUpdated: new Date().toISOString(),
      };
    });
  }, []);

  const sendLeaderReport = useCallback(() => {
    updateFieldWorkflow({ leaderReportSent: true });
  }, [updateFieldWorkflow]);

  const receiveDeliveryPackage = useCallback(
    (_packageCode: string) => {
      updateFieldWorkflow({ packageReceived: true });
      return true;
    },
    [updateFieldWorkflow],
  );

  const markArrivedAtPickup = useCallback(() => {
    updateFieldWorkflow({ arrivedAtPickup: true });
  }, [updateFieldWorkflow]);

  const setDeliveryVerified = useCallback(
    (verified: boolean) => {
      updateFieldWorkflow({ deliveryVerified: verified });
    },
    [updateFieldWorkflow],
  );

  const setDeliveryItem = useCallback(
    (index: number, status: DeliveryItemStatus, note: string) => {
      setFieldWorkflow((prev) => ({
        ...prev,
        deliveryItems: prev.deliveryItems.map((item, itemIndex) =>
          itemIndex === index ? { status, note } : item,
        ),
        lastUpdated: new Date().toISOString(),
      }));
    },
    [],
  );

  const setDeliveryPhoto = useCallback(
    (uri: string | null) => {
      updateFieldWorkflow({ deliveryPhotoUri: uri });
    },
    [updateFieldWorkflow],
  );

  const setDeliverySigned = useCallback(
    (signed: boolean) => {
      updateFieldWorkflow({ deliverySigned: signed });
    },
    [updateFieldWorkflow],
  );

  const completeDelivery = useCallback(() => {
    updateFieldWorkflow({
      deliveryStatus: "COMPLETED",
      returnStatus: "PENDING",
      depositStatus: "HELD",
    });
  }, [updateFieldWorkflow]);

  const markReturnArrived = useCallback(() => {
    updateFieldWorkflow({ returnArrived: true, returnStatus: "IN_PROGRESS" });
  }, [updateFieldWorkflow]);

  const setReturnVerified = useCallback(
    (verified: boolean) => {
      updateFieldWorkflow({ returnVerified: verified });
    },
    [updateFieldWorkflow],
  );

  const setReturnItem = useCallback(
    (index: number, status: DeliveryItemStatus, note: string) => {
      setFieldWorkflow((prev) => ({
        ...prev,
        returnItems: prev.returnItems.map((item, itemIndex) =>
          itemIndex === index ? { status, note } : item,
        ),
        lastUpdated: new Date().toISOString(),
      }));
    },
    [],
  );

  const setReturnConditionRecorded = useCallback(
    (recorded: boolean) => {
      updateFieldWorkflow({ returnConditionRecorded: recorded });
    },
    [updateFieldWorkflow],
  );

  const setReturnSigned = useCallback(
    (signed: boolean) => {
      updateFieldWorkflow({ returnSigned: signed });
    },
    [updateFieldWorkflow],
  );

  const completeReturn = useCallback(() => {
    updateFieldWorkflow({
      returnStatus: "COMPLETED",
      depositStatus: "PENDING_INSPECTION",
    });
  }, [updateFieldWorkflow]);

  const enableReturnDemo = useCallback(() => {
    updateFieldWorkflow({
      deliveryStatus: "COMPLETED",
      returnStatus: "IN_PROGRESS",
      packageReceived: true,
      arrivedAtPickup: true,
      deliveryVerified: true,
      returnArrived: true,
      handoverRequested: true,
    });
  }, [updateFieldWorkflow]);

  const resetFieldWorkflow = useCallback(() => {
    setFieldWorkflow({
      ...initialFieldWorkflow,
      lastUpdated: new Date().toISOString(),
    });
  }, []);

  const [trekkerAccount, setTrekkerAccount] = useState<TrekkerAccount>(
    initialTrekkerAccount,
  );
  const [groupTrips, setGroupTrips] = useState<GroupTrip[]>(initialGroupTrips);
  const [userNotifications, setUserNotifications] = useState<
    UserNotification[]
  >(initialUserNotifications);
  const [savedTrailIds, setSavedTrailIds] = useState<string[]>([
    "trail-pinhatt",
  ]);
  const [supportTickets, setSupportTickets] = useState<SupportTicket[]>([]);
  const [trips, setTrips] = useState<Trip[]>(mockTrips);
  const [trails, setTrails] = useState<Trail[]>(mockTrails);

  const [personalTrails, setPersonalTrails] = useState<PersonalTrail[]>([]);
  const [communityPosts, setCommunityPosts] = useState<CommunityPost[]>(
    initialCommunityPosts,
  );
  const [communityProfiles, setCommunityProfiles] = useState<
    CommunityProfile[]
  >(initialCommunityProfiles);
  const [communityNotifications, setCommunityNotifications] = useState<
    CommunityNotification[]
  >(initialCommunityNotifications);
  const [communityReports, setCommunityReports] = useState<CommunityReport[]>(
    [],
  );
  const [equipment] = useState<EquipmentItem[]>(mockEquipment);
  const [rentalOrders, setRentalOrders] =
    useState<RentalOrder[]>(mockRentalOrders);
  const [rentalSettlements, setRentalSettlements] = useState<
    Record<string, RentalSettlement>
  >({});
  const [cart, setCart] = useState<
    {
      item: EquipmentItem;
      quantity: number;
    }[]
  >([]);
  const [telemetry, setTelemetry] =
    useState<LiveNavTelemetry>(initialLiveTelemetry);
  const [offlinePackages, setOfflinePackages] = useState<
    Record<string, OfflineMapPackage>
  >({});
  const [isStorageHydrated, setIsStorageHydrated] = useState(false);

  useEffect(() => {
    let isMounted = true;

    async function hydrateStorage() {
      try {
        const [
          storedSavedTrails,
          storedOfflinePackages,
          storedAccount,
          storedCart,
        ] = await Promise.all([
          trailStorage.getSavedTrailIds(),
          offlineMapStorage.getPackages(),
          accountStorage.getTrekkerAccount(),
          accountStorage.getRentalCart(),
        ]);

        if (!isMounted) return;

        if (storedSavedTrails) {
          setSavedTrailIds(storedSavedTrails);
        }
        // Chạy migration sang SQLite (nếu chưa chạy) cho các trail cá nhân cũ
        recordingDatabase.migrateFromAsyncStorage().catch((err) => {
          console.warn("[AppContext] Lỗi migration SQLite:", err);
        });
        if (storedOfflinePackages) {
          setOfflinePackages(storedOfflinePackages);
        }
        if (storedAccount) {
          setTrekkerAccount(storedAccount);
        }
        if (storedCart) {
          setCart(storedCart);
        }
      } catch (error) {
        console.warn("[AppContext] Lỗi hydrate dữ liệu AsyncStorage:", error);
      } finally {
        if (isMounted) {
          setIsStorageHydrated(true);
        }
      }
    }

    hydrateStorage();

    // Khởi động tiến trình tự động đồng bộ Outbox khi online (định kỳ 15s + khi app active)
    syncService.startAutoSync(15_000);

    return () => {
      isMounted = false;
      syncService.stopAutoSync();
    };
  }, []);

  // Tự động kích hoạt đồng bộ outbox ngay khi người dùng đăng nhập thành công
  useEffect(() => {
    if (authenticatedUser) {
      syncService.processSyncOutbox().catch(console.warn);
    }
  }, [authenticatedUser]);

  const activeTrip =
    trips.find(
      (trip) =>
        trip.type === "PUBLIC" &&
        trip.status === "UPCOMING" &&
        Boolean(trip.bookingCode),
    ) || trips[0];
  const activeTrail = trails[0];

  const toggleUserRole = () => {
    setUser((current) => ({
      ...current,
      role: current.role === "TREKKER" ? "LEADER" : "TREKKER",
    }));
  };

  const updateUserProfile = (input: Partial<UserProfile>) => {
    setUser((current) => ({ ...current, ...input }));

    setCommunityProfiles((current) =>
      current.map((profile) =>
        profile.id === user.id
          ? {
              ...profile,
              name: input.name ?? profile.name,
              avatar: input.avatar ?? profile.avatar,
            }
          : profile,
      ),
    );
  };

  const updateTrekkerAccount = (input: Partial<TrekkerAccount>) => {
    setTrekkerAccount((current) => {
      const next = { ...current, ...input };
      accountStorage.saveTrekkerAccount(next);
      return next;
    });
  };

  const joinGroupTrip = (groupTripId: string): GroupTripActionResult => {
    const selected = groupTrips.find((trip) => trip.id === groupTripId);

    if (!selected)
      return { ok: false, message: "Không tìm thấy chuyến ghép đoàn." };
    if (selected.joinStatus === "JOINED")
      return {
        ok: true,
        message: "Bạn đã tham gia chuyến này.",
        status: "JOINED",
      };
    if (selected.joinStatus === "PENDING")
      return {
        ok: true,
        message: "Yêu cầu của bạn đang chờ duyệt.",
        status: "PENDING",
      };
    if (selected.currentMembers >= selected.maxMembers)
      return { ok: false, message: "Chuyến đi đã đủ thành viên." };

    const nextStatus = selected.joinMode === "INSTANT" ? "JOINED" : "PENDING";
    setGroupTrips((current) =>
      current.map((trip) =>
        trip.id !== groupTripId
          ? trip
          : {
              ...trip,
              joinStatus: nextStatus,
              currentMembers:
                nextStatus === "JOINED"
                  ? trip.currentMembers + 1
                  : trip.currentMembers,
              members:
                nextStatus === "JOINED"
                  ? [
                      ...trip.members,
                      {
                        id: user.id,
                        name: user.name,
                        avatar: user.avatar,
                        fitnessLevel: trekkerAccount.fitnessLevel,
                        role: "MEMBER" as const,
                      },
                    ]
                  : trip.members,
            },
      ),
    );

    return {
      ok: true,
      status: nextStatus,
      message:
        nextStatus === "JOINED"
          ? "Bạn đã tham gia nhóm thành công."
          : "Đã gửi yêu cầu. Trưởng nhóm sẽ duyệt hồ sơ của bạn.",
    };
  };

  const cancelGroupTripRequest = (
    groupTripId: string,
  ): GroupTripActionResult => {
    setGroupTrips((current) =>
      current.map((trip) =>
        trip.id === groupTripId && trip.joinStatus === "PENDING"
          ? { ...trip, joinStatus: "NONE" }
          : trip,
      ),
    );
    return { ok: true, message: "Đã rút yêu cầu tham gia.", status: "NONE" };
  };

  const leaveGroupTrip = (groupTripId: string): GroupTripActionResult => {
    setGroupTrips((current) =>
      current.map((trip) =>
        trip.id === groupTripId && trip.joinStatus === "JOINED"
          ? {
              ...trip,
              joinStatus: "NONE",
              currentMembers: Math.max(0, trip.currentMembers - 1),
              members: trip.members.filter((member) => member.id !== user.id),
            }
          : trip,
      ),
    );
    return {
      ok: true,
      message: "Bạn đã rời chuyến ghép đoàn.",
      status: "NONE",
    };
  };

  const markUserNotificationRead = (notificationId: string) => {
    setUserNotifications((current) =>
      current.map((notification) =>
        notification.id === notificationId
          ? { ...notification, isRead: true }
          : notification,
      ),
    );
  };

  const markAllUserNotificationsRead = () => {
    setUserNotifications((current) =>
      current.map((notification) => ({ ...notification, isRead: true })),
    );
  };

  const deleteUserNotification = (notificationId: string) => {
    setUserNotifications((current) =>
      current.filter((notification) => notification.id !== notificationId),
    );
  };

  const toggleSavedTrail = (trailId: string) => {
    setSavedTrailIds((current) => {
      const next = current.includes(trailId)
        ? current.filter((id) => id !== trailId)
        : [trailId, ...current];
      trailStorage.saveTrailIds(next);
      return next;
    });
  };

  const createSupportTicket = (input: {
    category: SupportTicketCategory;
    subject: string;
    description: string;
  }) => {
    const ticket: SupportTicket = {
      id: `SUP-${Date.now().toString().slice(-6)}`,
      category: input.category,
      subject: input.subject.trim(),
      description: input.description.trim(),
      createdAt: new Date().toLocaleString("vi-VN"),
      status: "SUBMITTED",
    };

    setSupportTickets((current) => [ticket, ...current]);
    return ticket;
  };

  const createPrivateTrip = (tripData: Partial<Trip>) => {
    const inviteCode =
      tripData.inviteCode ||
      `TG-${Math.random().toString(36).substring(2, 7).toUpperCase()}`;

    const newTrip: Trip = {
      id: `trip-private-${Date.now()}`,
      type: "PRIVATE",
      name: tripData.name?.trim() || "Private Trekking Expedition",
      trailId: tripData.trailId || "trail-pinhatt",
      destination: tripData.destination || "Đà Lạt",
      startDate: tripData.startDate || "15 Tháng 11, 2026",
      endDate: tripData.endDate || tripData.startDate || "17 Tháng 11, 2026",
      durationDays: tripData.durationDays || 2,
      status: "UPCOMING",
      leader: {
        name: `${user.name} (Host)`,
        avatar: user.avatar,
        phone: "0909 111 222",
        rating: 5,
        badge: "Private Trip Host",
      },
      capacity: tripData.capacity || 8,
      enrolledCount: 1,
      inviteCode: normalizeInviteCode(inviteCode),
      weather: {
        tempC: 19,
        condition: "Mây rải rác",
        rainRisk: false,
        rainChancePercent: 20,
        humidityPercent: 78,
        windSpeedKmh: 12,
      },
      participants: [
        {
          id: user.id,
          name: `${user.name} (Host)`,
          avatar: user.avatar,
          role: "HOST",
        },
      ],
    };

    // Giữ Public Trip đã xác nhận ở đầu danh sách để không làm sai
    // card chính, QR và flow check-in hiện tại trong tab Trips.
    setTrips((current) => [...current, newTrip]);

    return newTrip;
  };

  const joinPrivateTrip = (rawInviteCode: string): PrivateTripActionResult => {
    const inviteCode = normalizeInviteCode(rawInviteCode);

    if (!inviteCode) {
      return {
        ok: false,
        message: "Vui lòng nhập mã mời.",
      };
    }

    let selectedTrip = trips.find(
      (trip) =>
        trip.type === "PRIVATE" &&
        normalizeInviteCode(trip.inviteCode || "") === inviteCode,
    );

    if (!selectedTrip && inviteCode === "TG-DEMO") {
      const demoTrip: Trip = {
        id: `trip-private-demo-${Date.now()}`,
        type: "PRIVATE",
        name: "Cắm trại Núi Chứa Chan cùng hội bạn",
        trailId: "trail-pinhatt",
        destination: "Xuân Lộc, Đồng Nai",
        startDate: "08 Tháng 11, 2026",
        endDate: "09 Tháng 11, 2026",
        durationDays: 2,
        status: "UPCOMING",
        leader: {
          name: "Minh Quân (Host)",
          avatar:
            "https://images.unsplash.com/photo-1500648767791-00dcc994a43e?auto=format&fit=crop&w=200&q=80",
          phone: "0903 456 789",
          rating: 4.9,
          badge: "Private Trip Host",
        },
        capacity: 8,
        enrolledCount: 3,
        inviteCode: "TG-DEMO",
        weather: {
          tempC: 24,
          condition: "Nắng nhẹ",
          rainRisk: false,
          rainChancePercent: 15,
          humidityPercent: 70,
          windSpeedKmh: 10,
        },
        participants: [
          {
            id: "demo-host",
            name: "Minh Quân (Host)",
            avatar:
              "https://images.unsplash.com/photo-1500648767791-00dcc994a43e?auto=format&fit=crop&w=200&q=80",
            role: "HOST",
          },
          {
            id: "demo-member-1",
            name: "Bảo Ngọc",
            avatar:
              "https://images.unsplash.com/photo-1494790108377-be9c29b29330?auto=format&fit=crop&w=200&q=80",
            role: "MEMBER",
          },
          {
            id: "demo-member-2",
            name: "Hoàng Nam",
            avatar:
              "https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?auto=format&fit=crop&w=200&q=80",
            role: "MEMBER",
          },
        ],
      };

      selectedTrip = demoTrip;
      setTrips((current) => [...current, demoTrip]);
    }

    if (!selectedTrip) {
      return {
        ok: false,
        message: "Không tìm thấy Private Trip với mã mời này.",
      };
    }

    if (selectedTrip.status === "CANCELLED") {
      return {
        ok: false,
        message: "Chuyến đi này đã bị Host hủy.",
      };
    }

    const alreadyJoined = selectedTrip.participants.some(
      (participant) =>
        participant.id === user.id ||
        participant.name.replace(" (Host)", "") === user.name,
    );

    if (alreadyJoined) {
      return {
        ok: true,
        message: "Bạn đã có mặt trong chuyến đi này.",
        trip: selectedTrip,
      };
    }

    if (selectedTrip.enrolledCount >= selectedTrip.capacity) {
      return {
        ok: false,
        message: "Chuyến đi đã đủ số lượng thành viên.",
      };
    }

    const joinedTrip: Trip = {
      ...selectedTrip,
      enrolledCount: selectedTrip.enrolledCount + 1,
      participants: [
        ...selectedTrip.participants,
        {
          id: user.id,
          name: user.name,
          avatar: user.avatar,
          role: "MEMBER",
        },
      ],
    };

    setTrips((current) =>
      current.map((trip) => (trip.id === joinedTrip.id ? joinedTrip : trip)),
    );

    return {
      ok: true,
      message: "Tham gia Private Trip thành công.",
      trip: joinedTrip,
    };
  };

  const leavePrivateTrip = (tripId: string): PrivateTripActionResult => {
    const selectedTrip = trips.find((trip) => trip.id === tripId);

    if (!selectedTrip || selectedTrip.type !== "PRIVATE") {
      return {
        ok: false,
        message: "Không tìm thấy Private Trip.",
      };
    }

    const isHost = selectedTrip.participants.some(
      (participant) =>
        participant.role === "HOST" &&
        (participant.id === user.id ||
          participant.name.replace(" (Host)", "") === user.name),
    );

    if (isHost) {
      return {
        ok: false,
        message: "Host không thể rời chuyến. Hãy hủy chuyến nếu cần.",
      };
    }

    const isMember = selectedTrip.participants.some(
      (participant) => participant.id === user.id,
    );

    if (!isMember) {
      return {
        ok: false,
        message: "Bạn chưa tham gia chuyến đi này.",
      };
    }

    const updatedTrip: Trip = {
      ...selectedTrip,
      enrolledCount: Math.max(1, selectedTrip.enrolledCount - 1),
      participants: selectedTrip.participants.filter(
        (participant) => participant.id !== user.id,
      ),
    };

    setTrips((current) =>
      current.map((trip) => (trip.id === tripId ? updatedTrip : trip)),
    );

    return {
      ok: true,
      message: "Bạn đã rời khỏi chuyến đi.",
      trip: updatedTrip,
    };
  };

  const cancelPrivateTrip = (tripId: string): PrivateTripActionResult => {
    const selectedTrip = trips.find((trip) => trip.id === tripId);

    if (!selectedTrip || selectedTrip.type !== "PRIVATE") {
      return {
        ok: false,
        message: "Không tìm thấy Private Trip.",
      };
    }

    const isHost = selectedTrip.participants.some(
      (participant) =>
        participant.role === "HOST" &&
        (participant.id === user.id ||
          participant.name.replace(" (Host)", "") === user.name),
    );

    if (!isHost) {
      return {
        ok: false,
        message: "Chỉ Host mới có thể hủy chuyến đi này.",
      };
    }

    const cancelledTrip: Trip = {
      ...selectedTrip,
      status: "CANCELLED",
    };

    setTrips((current) =>
      current.map((trip) => (trip.id === tripId ? cancelledTrip : trip)),
    );

    return {
      ok: true,
      message: "Private Trip đã được hủy.",
      trip: cancelledTrip,
    };
  };

  const bookPublicTrip = (tripId: string, participantsCount: number) => {
    setTrips((current) =>
      current.map((trip) => {
        if (trip.id !== tripId) {
          return trip;
        }

        return {
          ...trip,
          enrolledCount: Math.min(
            trip.capacity,
            trip.enrolledCount + participantsCount,
          ),
          bookingCode:
            trip.bookingCode ||
            `#BK-${Math.floor(1000 + Math.random() * 9000)}`,
        };
      }),
    );
  };

  const unlockTrail = (trailId: string) => {
    setTrails((current) =>
      current.map((trail) =>
        trail.id === trailId ? { ...trail, isUnlocked: true } : trail,
      ),
    );
  };

  const createPersonalTrail = async (input: CreatePersonalTrailInput) => {
    const now = new Date().toISOString();

    const effectiveSegments: [number, number, number?][][] =
      input.gpsSegments && input.gpsSegments.length > 0
        ? input.gpsSegments
        : input.gpsRoute && input.gpsRoute.length > 0
          ? [input.gpsRoute]
          : [];

    const flatRoute: [number, number, number?][] =
      input.gpsRoute ||
      effectiveSegments.reduce<[number, number, number?][]>(
        (acc, seg) => acc.concat(seg),
        [],
      );

    const newTrail: PersonalTrail = {
      id: input.clientRecordingId ? `personal-trail-${input.clientRecordingId}` : `personal-trail-${Date.now()}`,
      ownerId: user.id,
      name: input.name.trim(),
      region: input.region.trim(),
      difficulty: input.difficulty,
      distanceKm: input.distanceKm,
      elevationGainM: input.elevationGainM,
      duration: input.duration.trim(),
      terrainType: input.terrainType.trim(),
      description: input.description.trim(),
      visibility: "PRIVATE",
      verificationStatus: input.submitForVerification ? "PENDING" : "DRAFT",
      routePreset: input.routePreset,
      routePoints: input.routePoints || [],
      gpsRoute: flatRoute,
      gpsSegments: effectiveSegments,
      checkpoints: input.checkpoints || [],
      clientRecordingId: input.clientRecordingId,
      createdAt: now,
      updatedAt: now,
    };

    // SQLite là nguồn dữ liệu bền vững: chỉ cập nhật UI sau khi ghi thành công.
    if (input.clientRecordingId && input.endedAt) {
      await recordingDatabase.finishPersonalTrail(newTrail, input.endedAt, input.elapsedSeconds ?? 0);
    } else {
      await recordingDatabase.savePersonalTrail(newTrail, newTrail.clientRecordingId);
    }
    setPersonalTrails((current) => [newTrail, ...current.filter(t => t.id !== newTrail.id)]);

    return newTrail;
  };

  const updatePersonalTrail = async (
    trailId: string,
    input: CreatePersonalTrailInput,
  ): Promise<void> => {
    const trail = personalTrails.find((item) => item.id === trailId);
    if (!trail) throw new Error("Không tìm thấy cung đường cần cập nhật.");

    if (isUUID(trailId)) {
      const ownerId = authenticatedUser?.id;
      if (!ownerId) throw new Error("Vui lòng đăng nhập lại.");
      const network = await Network.getNetworkStateAsync();
      if (network.isConnected === false || network.isInternetReachable === false) {
        throw new ApiError("Bạn đang offline. Vui lòng kết nối mạng để cập nhật cung đường.", 0, "OFFLINE");
      }
      const response = await personalTrailApi.updateTrail(trailId, {
        title: input.name.trim(),
        description: input.description.trim(),
        duration: input.duration.trim(),
        difficulty: mapDifficultyToBackend(input.difficulty),
        visibility: "PRIVATE",
      });
      if (!response.success) throw new Error(response.message || "Không thể cập nhật cung đường.");
      const updated = convertBackendTrailToPersonalTrail({ ...response.data, id: trailId }, trail.ownerId);
      ++trailRefreshRef.current;
      await recordingDatabase.updateCachedServerPersonalTrail(ownerId, updated);
      if (accountIdRef.current !== ownerId) return;
      setPersonalTrails((current) => current.map((item) => item.id === trailId ? updated : item));
      if (input.submitForVerification) {
        const submission = await personalTrailApi.submitVerification(trailId);
        if (!submission.success) throw new Error(submission.message || "Đã lưu thay đổi nhưng chưa gửi được xác minh.");
        ++trailRefreshRef.current;
        await recordingDatabase.updateCachedServerPersonalTrail(ownerId, {
          ...updated, verificationStatus: "PENDING", rejectionReason: undefined,
        });
        if (accountIdRef.current !== ownerId) return;
        setPersonalTrails((current) => current.map((item) => item.id === trailId
          ? { ...item, verificationStatus: "PENDING", rejectionReason: undefined }
          : item));
      }
      return;
    }
    if (input.submitForVerification) {
      throw new Error("Cung đường chưa đồng bộ lên máy chủ. Vui lòng đồng bộ trước khi gửi xác minh.");
    }

    const effectiveSegments =
      input.gpsSegments !== undefined
        ? input.gpsSegments
        : trail.gpsSegments;

    const effectiveFlat =
      input.gpsRoute !== undefined
        ? input.gpsRoute
        : effectiveSegments
          ? effectiveSegments.reduce<[number, number, number?][]>(
              (acc, seg) => acc.concat(seg),
              [],
            )
          : trail.gpsRoute;

    const updated: PersonalTrail = {
      ...trail,
      name: input.name.trim(),
      region: input.region.trim(),
      difficulty: input.difficulty,
      distanceKm: input.distanceKm,
      elevationGainM: input.elevationGainM,
      duration: input.duration.trim(),
      terrainType: input.terrainType.trim(),
      description: input.description.trim(),
      visibility: "PRIVATE" as const,
      verificationStatus: input.submitForVerification
        ? ("PENDING" as const)
        : ("DRAFT" as const),
      rejectionReason: undefined,
      routePreset: input.routePreset ?? trail.routePreset,
      routePoints: input.routePoints ?? trail.routePoints,
      gpsRoute: effectiveFlat,
      gpsSegments: effectiveSegments,
      checkpoints: (input.checkpoints || trail.checkpoints || []).map(
        (checkpoint, index) => ({
          ...checkpoint,
          order: index + 1,
        }),
      ),
      updatedAt: new Date().toISOString(),
    };
    await recordingDatabase.savePersonalTrail(updated, updated.clientRecordingId);
    setPersonalTrails((current) => current.map((item) => item.id === trailId ? updated : item));
  };

  const submitPersonalTrail = async (
    trailId: string,
    noteToAdmin?: string,
  ): Promise<boolean> => {
    if (!isUUID(trailId)) {
      console.warn(
        `[AppContext] Không thể gửi xác minh trail ${trailId} vì chưa có UUID trên máy chủ.`,
      );
      Alert.alert(
        "Chưa thể gửi xác minh",
        "Cung đường này chưa được đồng bộ hoàn tất lên máy chủ (chưa có mã định danh UUID). Vui lòng kết nối mạng và kéo xuống để làm mới (refresh) trước khi gửi xác minh.",
      );
      return false;
    }

    try {
      const res = await personalTrailApi.submitVerification(trailId, {
        noteToAdmin,
      });

      const updatedStatus =
        (res?.data?.verificationStatus as PersonalTrailVerificationStatus) ||
        "PENDING";

      setPersonalTrails((current) => {
        const next: PersonalTrail[] = current.map((trail) =>
          trail.id === trailId
            ? {
                ...trail,
                visibility: "PRIVATE" as const,
                verificationStatus: updatedStatus,
                rejectionReason: undefined,
                updatedAt: new Date().toISOString(),
              }
            : trail,
        );
        return next;
      });

      return true;
    } catch (apiErr: any) {
      console.warn("[AppContext] Lỗi gọi submitVerification API:", apiErr);

      // Nếu lỗi mạng / offline, vẫn cập nhật tạm PENDING local để trekker không bị chặn
      setPersonalTrails((current) => {
        const next: PersonalTrail[] = current.map((trail) =>
          trail.id === trailId
            ? {
                ...trail,
                visibility: "PRIVATE" as const,
                verificationStatus: "PENDING" as const,
                rejectionReason: undefined,
                updatedAt: new Date().toLocaleDateString("vi-VN"),
              }
            : trail,
        );
        return next;
      });

      throw apiErr;
    }
  };

  const deletePersonalTrail = async (trailId: string): Promise<void> => {
    const ownerId = authenticatedUser?.id;
    if (!ownerId) throw new Error("Vui lòng đăng nhập lại.");
    if (!isUUID(trailId)) {
      await recordingDatabase.deletePersonalTrail(trailId);
    } else {
      const response = await personalTrailApi.deleteTrail(trailId);
      if (!response.success) throw new Error(response.message || "Không thể xóa cung đường.");
      ++trailRefreshRef.current;
      await recordingDatabase.removeCachedServerPersonalTrail(ownerId, trailId);
    }
    if (accountIdRef.current !== ownerId) return;
    setPersonalTrails((current) => current.filter((trail) => trail.id !== trailId));
  };

  const refreshPersonalTrails = useCallback(async (): Promise<void> => {
    const ownerId = authenticatedUser?.id;
    const refreshId = ++trailRefreshRef.current;
    const isCurrent = () => accountIdRef.current === ownerId && trailRefreshRef.current === refreshId;
    if (!ownerId) {
      setPersonalTrails([]);
      return;
    }
    let localTrails: PersonalTrail[] = [];
    let cachedTrails: PersonalTrail[] = [];
    try {
      const auth = await readStoredAuth();
      if (!auth || auth.user.id !== ownerId || !isCurrent()) return;
      localTrails = (await recordingDatabase.getAllPersonalTrails()).filter((trail) => trail.ownerId === ownerId);
      cachedTrails = await recordingDatabase.getCachedServerPersonalTrails(ownerId);
      if (!isCurrent()) return;
      const cachedIds = new Set(cachedTrails.map((trail) => trail.id));
      const cachedRecordings = new Set(cachedTrails.map((trail) => trail.clientRecordingId).filter(Boolean));
      setPersonalTrails([
        ...localTrails.filter((trail) => !cachedIds.has(trail.id) && (!trail.clientRecordingId || !cachedRecordings.has(trail.clientRecordingId))),
        ...cachedTrails,
      ]);
      syncService.processSyncOutbox().catch(console.warn);

      // Fetch every page before replacing the cache or deleting any local trail.
      const serverDtos = await personalTrailApi.getAllMyTrails(auth.accessToken);
      if (!isCurrent()) return;
      const serverTrails = serverDtos.map((dto) => convertBackendTrailToPersonalTrail(dto, ownerId));
      await recordingDatabase.cacheServerPersonalTrails(ownerId, serverTrails);
      if (!isCurrent()) return;
      const syncedIds = await recordingDatabase.getSyncedLocalTrailIds(
        serverTrails.map((trail) => trail.id),
        serverTrails.map((trail) => trail.clientRecordingId).filter((id): id is string => !!id),
      );
      if (!isCurrent()) return;
      await recordingDatabase.removeSyncedPersonalTrails(syncedIds);
      const remaining = (await recordingDatabase.getAllPersonalTrails()).filter((trail) => trail.ownerId === ownerId);
      if (isCurrent()) setPersonalTrails([...remaining, ...serverTrails]);
    } catch (error) {
      // Keep the cached routes already displayed; a network failure must not empty the list.
      console.warn("[AppContext] Không thể làm mới personal trails:", error);
    }
  }, [authenticatedUser?.id]);


  // Tự động làm mới và dọn dẹp các cung đường đã đồng bộ ngay khi hoàn tất hydrate bộ nhớ
  useEffect(() => {
    if (isStorageHydrated) {
      const timer = setTimeout(() => {
        refreshPersonalTrails().catch((err) => {
          console.warn("[AppContext] Auto refreshPersonalTrails on hydrate:", err);
        });
      }, 50);
      return () => clearTimeout(timer);
    }
  }, [isStorageHydrated, refreshPersonalTrails]);

  // Tự động làm mới danh sách khi tiến trình sync Outbox đẩy thành công một cung đường lên Server
  useEffect(() => {
    const unsub = syncService.onSyncCompleted(() => {
      console.log("[AppContext] Outbox sync hoàn tất, tự động làm mới danh sách personalTrails...");
      refreshPersonalTrails().catch(console.warn);
    });
    return () => {
      unsub();
    };
  }, [refreshPersonalTrails]);

  const clearAllDatabaseData = async () => {
    await trailStorage.clearAllData();
    setPersonalTrails([]);
  };

  const createCommunityPost = (input: CreateCommunityPostInput) => {
    const newPost: CommunityPost = {
      id: `community-post-${Date.now()}`,
      author: {
        id: user.id,
        name: user.name,
        avatar: user.avatar,
        role: user.role === "LEADER" ? "LEADER" : "TREKKER",
        verified: user.role === "LEADER",
        badge: user.role === "LEADER" ? "Verified Leader" : "Trekker",
      },
      content: input.content.trim(),
      imageUrl: input.imageUrl?.trim() || undefined,
      location: input.location?.trim() || undefined,
      trailName: input.trailName?.trim() || undefined,
      tags: input.tags,
      createdAt: "Vừa xong",
      likesCount: 0,
      commentsCount: 0,
      isLiked: false,
      isSaved: false,
      comments: [],
    };

    setCommunityPosts((current) => [newPost, ...current]);

    return newPost;
  };

  const toggleCommunityPostLike = (postId: string) => {
    setCommunityPosts((current) =>
      current.map((post) =>
        post.id === postId
          ? {
              ...post,
              isLiked: !post.isLiked,
              likesCount: Math.max(
                0,
                post.likesCount + (post.isLiked ? -1 : 1),
              ),
            }
          : post,
      ),
    );
  };

  const toggleCommunityPostSaved = (postId: string) => {
    setCommunityPosts((current) =>
      current.map((post) =>
        post.id === postId ? { ...post, isSaved: !post.isSaved } : post,
      ),
    );
  };

  const addCommunityComment = (postId: string, content: string) => {
    const normalizedContent = content.trim();

    if (!normalizedContent) {
      return;
    }

    setCommunityPosts((current) =>
      current.map((post) => {
        if (post.id !== postId) {
          return post;
        }

        return {
          ...post,
          commentsCount: post.commentsCount + 1,
          comments: [
            ...post.comments,
            {
              id: `community-comment-${Date.now()}`,
              postId,
              author: {
                id: user.id,
                name: user.name,
                avatar: user.avatar,
                role: user.role === "LEADER" ? "LEADER" : "TREKKER",
                verified: user.role === "LEADER",
                badge: user.role === "LEADER" ? "Verified Leader" : "Trekker",
              },
              content: normalizedContent,
              createdAt: "Vừa xong",
            },
          ],
        };
      }),
    );
  };

  const toggleCommunityFollow = (profileId: string) => {
    setCommunityProfiles((current) =>
      current.map((profile) => {
        if (profile.id !== profileId || profile.id === user.id) {
          return profile;
        }

        return {
          ...profile,
          isFollowing: !profile.isFollowing,
          followersCount: Math.max(
            0,
            profile.followersCount + (profile.isFollowing ? -1 : 1),
          ),
        };
      }),
    );
  };

  const markCommunityNotificationRead = (notificationId: string) => {
    setCommunityNotifications((current) =>
      current.map((notification) =>
        notification.id === notificationId
          ? { ...notification, isRead: true }
          : notification,
      ),
    );
  };

  const markAllCommunityNotificationsRead = () => {
    setCommunityNotifications((current) =>
      current.map((notification) => ({ ...notification, isRead: true })),
    );
  };

  const reportCommunityPost = (
    postId: string,
    reason: CommunityReportReason,
    detail?: string,
  ) => {
    const newReport: CommunityReport = {
      id: `community-report-${Date.now()}`,
      postId,
      reporterId: user.id,
      reason,
      detail: detail?.trim() || undefined,
      createdAt: formatNow(),
      status: "SUBMITTED",
    };

    setCommunityReports((current) => [newReport, ...current]);
  };

  const addToCart = (item: EquipmentItem, quantity: number) => {
    setCart((current) => {
      const existing = current.find((entry) => entry.item.id === item.id);

      let next;
      if (existing) {
        next = current.map((entry) =>
          entry.item.id === item.id
            ? { ...entry, quantity: entry.quantity + quantity }
            : entry,
        );
      } else {
        next = [...current, { item, quantity }];
      }
      accountStorage.saveRentalCart(next);
      return next;
    });
  };

  const setCartQuantity = (item: EquipmentItem, quantity: number) => {
    const normalizedQuantity = Math.max(0, Math.floor(quantity));

    setCart((current) => {
      let next;

      if (normalizedQuantity === 0) {
        next = current.filter((entry) => entry.item.id !== item.id);
      } else if (current.some((entry) => entry.item.id === item.id)) {
        next = current.map((entry) =>
          entry.item.id === item.id
            ? { item, quantity: normalizedQuantity }
            : entry,
        );
      } else {
        next = [...current, { item, quantity: normalizedQuantity }];
      }

      accountStorage.saveRentalCart(next);
      return next;
    });
  };
  const removeFromCart = (itemId: string) => {
    setCart((current) => {
      const next = current.filter((entry) => entry.item.id !== itemId);
      accountStorage.saveRentalCart(next);
      return next;
    });
  };

  const checkoutRental = (tripId: string, days: number) => {
    if (cart.length === 0) {
      return;
    }

    const totalRentalFee = cart.reduce(
      (total, entry) => total + entry.item.dailyRate * entry.quantity * days,
      0,
    );

    const totalDeposit = cart.reduce(
      (total, entry) => total + entry.item.deposit * entry.quantity,
      0,
    );

    const newOrder: RentalOrder = {
      id: `ord-rent-${Math.floor(1000 + Math.random() * 9000)}`,
      tripId,
      tripName:
        trips.find((trip) => trip.id === tripId)?.name || "Chuyến trekking",
      items: [...cart],
      days,
      totalRentalFee,
      totalDeposit,
      totalPayment: totalRentalFee + totalDeposit,
      status: "PAYMENT_CONFIRMED",
      createdAt: new Date().toLocaleDateString("vi-VN"),
    };

    setRentalOrders((current) => [newOrder, ...current]);
    setCart([]);
    accountStorage.saveRentalCart([]);
  };

  const downloadOfflineTrail = async (trailId: string) => {
    const trail = trails.find((t) => t.id === trailId);
    if (!trail) return;

    const initialPkg: OfflineMapPackage = {
      trailId,
      trailName: trail.name,
      downloadedAt: new Date().toLocaleDateString("vi-VN"),
      sizeMb: 42.5,
      status: "DOWNLOADING",
      tileCount: 380,
    };

    setOfflinePackages((current) => ({ ...current, [trailId]: initialPkg }));

    setTimeout(() => {
      const completedPkg: OfflineMapPackage = {
        ...initialPkg,
        status: "DOWNLOADED",
      };
      setOfflinePackages((current) => {
        const next = { ...current, [trailId]: completedPkg };
        offlineMapStorage.savePackage(completedPkg);
        return next;
      });
    }, 1200);
  };

  const removeOfflineTrail = async (trailId: string) => {
    setOfflinePackages((current) => {
      const next = { ...current };
      delete next[trailId];
      offlineMapStorage.removePackage(trailId);
      return next;
    });
  };

  const isTrailOfflineReady = (trailId: string): boolean => {
    return offlinePackages[trailId]?.status === "DOWNLOADED";
  };

  const confirmRentalPickup = (orderId: string) => {
    setRentalOrders((current) =>
      current.map((order) =>
        order.id === orderId ? { ...order, status: "IN_USE" } : order,
      ),
    );
  };

  const requestRentalReturn = (orderId: string, returnMethod: string) => {
    const order = rentalOrders.find((current) => current.id === orderId);

    if (!order) {
      return;
    }

    setRentalOrders((current) =>
      current.map((entry) =>
        entry.id === orderId ? { ...entry, status: "RETURN_PENDING" } : entry,
      ),
    );

    setRentalSettlements((current) => ({
      ...current,
      [orderId]: {
        orderId,
        returnMethod,
        requestedAt: formatNow(),
        deductionAmount: 0,
        refundAmount: order.totalDeposit,
      },
    }));
  };

  const completeRentalInspection = (orderId: string) => {
    const order = rentalOrders.find((current) => current.id === orderId);

    if (!order) {
      return;
    }

    const deductionAmount = Math.min(80000, order.totalDeposit);

    setRentalOrders((current) =>
      current.map((entry) =>
        entry.id === orderId ? { ...entry, status: "RETURNED" } : entry,
      ),
    );

    setRentalSettlements((current) => ({
      ...current,
      [orderId]: {
        orderId,
        returnMethod:
          current[orderId]?.returnMethod || "Trả tại điểm tập trung",
        requestedAt: current[orderId]?.requestedAt || formatNow(),
        inspectedAt: formatNow(),
        inspectionResult: "DEDUCTION",
        deductionAmount,
        deductionReason: "Phí vệ sinh bùn đất sau chuyến đi",
        refundAmount: order.totalDeposit - deductionAmount,
      },
    }));
  };

  const confirmRentalDepositRefund = (orderId: string) => {
    setRentalOrders((current) =>
      current.map((entry) =>
        entry.id === orderId ? { ...entry, status: "DEPOSIT_REFUNDED" } : entry,
      ),
    );

    setRentalSettlements((current) => {
      const settlement = current[orderId];

      if (!settlement) {
        return current;
      }

      return {
        ...current,
        [orderId]: {
          ...settlement,
          refundedAt: formatNow(),
        },
      };
    });
  };

  const toggleDeviation = () => {
    setTelemetry((current) => {
      const isOnRoute = !current.isOnRoute;

      return {
        ...current,
        isOnRoute,
        deviationMeters: isOnRoute ? 0 : 120,
        isWarningDismissed: false,
      };
    });
  };

  const dismissDeviationWarning = () => {
    setTelemetry((current) => ({
      ...current,
      isWarningDismissed: true,
    }));
  };

  const reconnectToRoute = () => {
    setTelemetry((current) => ({
      ...current,
      isOnRoute: true,
      deviationMeters: 0,
      isWarningDismissed: false,
    }));
  };

  const completeCheckpointMission = (checkpointId: string) => {
    setTrails((current) =>
      current.map((trail) => {
        if (trail.id !== activeTrail.id) {
          return trail;
        }

        const checkpoints = trail.checkpoints.map((checkpoint) =>
          checkpoint.id === checkpointId
            ? {
                ...checkpoint,
                status: "COMPLETED" as const,
                mission: checkpoint.mission
                  ? { ...checkpoint.mission, isDone: true }
                  : undefined,
              }
            : checkpoint,
        );

        return { ...trail, checkpoints };
      }),
    );

    setTelemetry((current) => ({
      ...current,
      activeCheckpointsCompleted: current.activeCheckpointsCompleted + 1,
      nextCheckpointName: "Đỉnh 986m – Sống Lưng Khủng Long",
      nextCheckpointDistanceM: 2800,
    }));
  };

  const resolveMemberAlert = (memberId: string) => {
    setTrips((current) =>
      current.map((trip) => {
        if (trip.id !== activeTrip.id) {
          return trip;
        }

        return {
          ...trip,
          participants: trip.participants.map((participant) =>
            participant.id === memberId
              ? {
                  ...participant,
                  isOffRoute: false,
                  deviationMeters: 0,
                }
              : participant,
          ),
        };
      }),
    );
  };

  return (
    <AppContext.Provider
      value={{
        user,
        setUser,
        toggleUserRole,
        trekkerAccount,
        updateUserProfile,
        updateTrekkerAccount,
        trips,
        activeTrip,
        createPrivateTrip,
        joinPrivateTrip,
        leavePrivateTrip,
        cancelPrivateTrip,
        bookPublicTrip,
        groupTrips,
        joinGroupTrip,
        cancelGroupTripRequest,
        leaveGroupTrip,
        userNotifications,
        markUserNotificationRead,
        markAllUserNotificationsRead,
        deleteUserNotification,
        savedTrailIds,
        toggleSavedTrail,
        offlinePackages,
        downloadOfflineTrail,
        removeOfflineTrail,
        isTrailOfflineReady,
        isStorageHydrated,
        supportTickets,
        createSupportTicket,
        trails,
        unlockTrail,
        personalTrails: personalTrails.filter((trail) => trail.ownerId === authenticatedUser?.id),
        createPersonalTrail,
        updatePersonalTrail,
        submitPersonalTrail,
        deletePersonalTrail,
        refreshPersonalTrails,
        clearAllDatabaseData,
        communityPosts,
        communityProfiles,
        communityNotifications,
        communityReports,
        createCommunityPost,
        toggleCommunityPostLike,
        toggleCommunityPostSaved,
        addCommunityComment,
        toggleCommunityFollow,
        markCommunityNotificationRead,
        markAllCommunityNotificationsRead,
        reportCommunityPost,
        equipment,
        rentalOrders,
        rentalSettlements,
        cart,
        addToCart,

        setCartQuantity,
        removeFromCart,
        checkoutRental,
        confirmRentalPickup,
        requestRentalReturn,
        completeRentalInspection,
        confirmRentalDepositRefund,
        telemetry,
        activeTrail,
        toggleDeviation,
        dismissDeviationWarning,
        reconnectToRoute,
        completeCheckpointMission,
        resolveMemberAlert,
        fieldWorkflow,
        setLeaderMemberAttendance,
        completeLeaderCheckpoint,
        resolveLeaderSafetyAlert,
        toggleLeaderGpsStatus,
        toggleLeaderOnlineStatus,
        approveLeaderPretrip,
        startLeaderTrip,
        completeLeaderTrip,
        sendLeaderReport,
        receiveDeliveryPackage,
        markArrivedAtPickup,
        setDeliveryVerified,
        setDeliveryItem,
        setDeliveryPhoto,
        setDeliverySigned,
        completeDelivery,
        markReturnArrived,
        setReturnVerified,
        setReturnItem,
        setReturnConditionRecorded,
        setReturnSigned,
        completeReturn,
        enableReturnDemo,
        resetFieldWorkflow,
        authRole,
        signOut,
      }}
    >
      {children}
    </AppContext.Provider>
  );
};

export const useApp = () => {
  const context = useContext(AppContext);

  if (!context) {
    throw new Error("useApp must be used within an AppProvider");
  }

  return context;
};
