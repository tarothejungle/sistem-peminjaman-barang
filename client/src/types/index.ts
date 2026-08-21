export const Role = {
  PEMOHON: "PEMOHON",
  PJ_RUANGAN: "PJ_RUANGAN",
  KABAG_UMUM: "KABAG_UMUM",
} as const;

export type Role = (typeof Role)[keyof typeof Role];

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
  email: string;
  role: Role;
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
  status: BookingStatus;
  alternativeStartTime: string | null;
  alternativeEndTime: string | null;
  approvalNotes: string | null;
  inspectionNotes: string | null;
  rejectionReason: string | null;
  documentOriginalName?: string | null;
  documentSize?: number | null;
  createdAt: string;
  updatedAt: string;
  user?: User;
  room?: Room | null;
  bookingItems?: BookingItem[];
}

export interface ApiResponse<T> {
  data: T;
}
