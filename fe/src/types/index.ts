export const Role = {
  PEMOHON: "PEMOHON",
  PJ_RUANGAN: "PJ_RUANGAN",
  KABAG_UMUM: "KABAG_UMUM",
  KASUBAG_UMUM: "KASUBAG_UMUM",
} as const;

export type Role = (typeof Role)[keyof typeof Role];

/** Roles with full system administration rights. */
export const ADMINISTRATOR_ROLES: readonly Role[] = [Role.KABAG_UMUM, Role.KASUBAG_UMUM];

/** Roles allowed to manage the room and item inventory (Kelola Ruangan / Kelola Kendaraan). */
export const RESOURCE_MANAGER_ROLES: readonly Role[] = [...ADMINISTRATOR_ROLES, Role.PJ_RUANGAN];

export function isAdministratorRole(role?: Role): boolean {
  return role !== undefined && ADMINISTRATOR_ROLES.includes(role);
}

export function canManageResources(role?: Role): boolean {
  return role !== undefined && RESOURCE_MANAGER_ROLES.includes(role);
}

/**
 * Roles allowed to act on the booking approval queue. KABAG_UMUM is a
 * monitoring (read-only) role: it can open the queue but not change it.
 */
export const BOOKING_APPROVER_ROLES: readonly Role[] = [Role.KASUBAG_UMUM];

export function canApproveBookings(role?: Role): boolean {
  return role !== undefined && BOOKING_APPROVER_ROLES.includes(role);
}

export const BookingStatus = {
  PENDING_PJ_REVIEW: "PENDING_PJ_REVIEW",
  PENDING_KABAG_APPROVAL: "PENDING_KABAG_APPROVAL",
  APPROVED: "APPROVED",
  ALTERNATIVE_OFFERED: "ALTERNATIVE_OFFERED",
  CONFIRMED: "CONFIRMED",
  PREPARING: "PREPARING",
  IN_USE: "IN_USE",
  FINISHED_PENDING_INSPECTION: "FINISHED_PENDING_INSPECTION",
  COMPLETED: "COMPLETED",
  REJECTED: "REJECTED",
  CANCELLED: "CANCELLED",
} as const;

export type BookingStatus = (typeof BookingStatus)[keyof typeof BookingStatus];

export const ResourceType = {
  ROOM: "ROOM",
  ITEM: "ITEM",
} as const;

export type ResourceType = (typeof ResourceType)[keyof typeof ResourceType];

export interface User {
  id: string;
  fullName: string;
  username: string;
  email: string;
  role: Role;
  phoneNumber: string | null;
  /** Borrower-only credibility points; the API omits it for every other role. */
  creditScore: number | null;
  profileImageUrl: string | null;
  createdAt?: string;
  updatedAt?: string;
}

export interface Room {
  id: string;
  name: string;
  capacity: number;
  location: string;
  facilities: string[];
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
  imageUrl?: string | null;
}

export interface Item {
  id: string;
  name: string;
  totalStock: number;
  category: string;
  plateNumber?: string | null;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
  imageUrl?: string | null;
}

export interface BookingItem {
  id: string;
  bookingId: string;
  itemId: string;
  quantity: number;
  item?: Item;
}

export interface Booking {
  id: string;
  userId: string;
  resourceType: ResourceType;
  roomId: string | null;
  startTime: string;
  endTime: string;
  purpose: string;
  responsibleName: string;
  phoneNumber: string;
  workUnit: string | null;
  status: BookingStatus;
  alternativeRoomId: string | null;
  alternativeStartTime: string | null;
  alternativeEndTime: string | null;
  approvalNotes: string | null;
  inspectionNotes: string | null;
  rejectionReason: string | null;
  pjReviewedBy?: string | null;
  pjReviewerName?: string | null;
  kasubagReviewedBy?: string | null;
  kasubagReviewerName?: string | null;
  rejectedBy?: string | null;
  rejectedByName?: string | null;
  documentOriginalName?: string | null;
  documentSize?: number | null;
  suratTugasOriginalName?: string | null;
  suratTugasSize?: number | null;
  returnedAt: string | null;
  /** Diisi hanya ketika sistem yang menutup peminjaman ruang, bukan pemohon. */
  autoConfirmedAt?: string | null;
  createdAt: string;
  updatedAt: string;
  user?: User;
  room?: Room | null;
  alternativeRoom?: Room | null;
  bookingItems?: BookingItem[];
}

export interface RoomBookingCancellation {
  id: string;
  bookingId: string;
  roomId: string | null;
  requestedBy: string;
  requestedByName: string;
  roomName: string;
  workUnit: string;
  responsibleName: string;
  purpose: string | null;
  bookingStartTime: string;
  bookingEndTime: string;
  reason: string;
  createdAt: string;
  updatedAt: string;
}

export interface ApiResponse<T> {
  data: T;
}

export interface LoginActivityDashboard {
  summary: {
    loginCount: number;
    uniqueUserCount: number;
    activeSessionCount: number;
  };
  activities: Array<{
    id: string;
    user: Pick<User, "id" | "fullName" | "username" | "role">;
    loggedInAt: string;
    lastActivityAt: string | null;
    status: "ACTIVE" | "ENDED";
  }>;
  pagination: {
    currentPage: number;
    lastPage: number;
    perPage: number;
    total: number;
  };
}

export interface UserNotification {
  id: string;
  userId: string;
  bookingId: string | null;
  type:
    | "BOOKING_SUBMITTED"
    | "BOOKING_REVIEW_REQUIRED"
    | "BOOKING_IN_REVIEW"
    | "BOOKING_FORWARDED"
    | "BOOKING_APPROVAL_REQUIRED"
    | "BOOKING_APPROVED"
    | "BOOKING_REJECTED"
    | "BOOKING_RELOCATED"
    | "BOOKING_AUTO_CONFIRMED"
    | "ROOM_BOOKING_CANCELLED";
  title: string;
  message: string;
  readAt: string | null;
  createdAt: string;
  updatedAt: string;
}
