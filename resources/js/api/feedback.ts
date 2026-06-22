import { api, fetchAllPages } from "./client";
import type { BookingStatus, FeedbackAccessStatus, FeedbackDiscoverySource, FeedbackGender } from "../domain/types";

export type ApiFeedback = {
  id: number;
  code: string;
  visitorName?: string;
  gender?: FeedbackGender | null;
  age?: number | null;
  origin?: string;
  rating: number;
  bookingEase: number;
  service: number;
  guideQuality: number | null;
  facilityComfort: number | null;
  recommend: number;
  visitedBefore: boolean | null;
  discoverySource: FeedbackDiscoverySource | null;
  discoverySourceOther: string | null;
  highlights: string[];
  improvements: string[];
  comment: string | null;
  allowPublish: boolean;
  submittedAt: string | null;
};

export type ApiPublicFeedbackBooking = {
  code: string;
  institution: string;
  dateLabel: string;
  status: BookingStatus;
};

export type ApiPublicFeedbackMeta = {
  accessStatus: FeedbackAccessStatus;
  submittedCount: number;
  limit: number;
  expiresAt: string | null;
};

export const fetchAdminFeedbacks = (): Promise<ApiFeedback[]> =>
  fetchAllPages<ApiFeedback>("/api/admin/feedback");

export const fetchPublicFeedback = (code: string, token: string) =>
  api<{
    data: ApiFeedback | null;
    booking: ApiPublicFeedbackBooking;
    feedback: ApiPublicFeedbackMeta;
  }>(`/api/public/feedback/${encodeURIComponent(code)}?token=${encodeURIComponent(token)}`);

export const submitPublicFeedback = (
  code: string,
  payload: {
    token: string;
    visitorName: string;
    gender: FeedbackGender;
    age: number;
    origin: string;
    bookingEase: number;
    service: number;
    guideQuality: number;
    facilityComfort: number;
    recommend: number;
    visitedBefore: boolean;
    discoverySource: FeedbackDiscoverySource;
    discoverySourceOther?: string;
    highlights: string[];
    improvements: string[];
    comment: string;
    allowPublish: boolean;
  },
) =>
  api<{ data: ApiFeedback }>(`/api/public/feedback/${encodeURIComponent(code)}`, {
    method: "POST",
    body: payload,
  }).then((r) => r.data);
