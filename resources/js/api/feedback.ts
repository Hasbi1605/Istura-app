import { api } from "./client";
import type { BookingStatus } from "../domain/types";

export type ApiFeedback = {
  code: string;
  rating: number;
  bookingEase: number;
  service: number;
  recommend: number;
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

export const fetchAdminFeedbacks = (): Promise<ApiFeedback[]> =>
  api<{ data: ApiFeedback[] }>("/api/admin/feedback").then((r) => r.data);

export const fetchPublicFeedback = (code: string, token: string) =>
  api<{
    data: ApiFeedback | null;
    booking: ApiPublicFeedbackBooking;
  }>(`/api/public/feedback/${encodeURIComponent(code)}?token=${encodeURIComponent(token)}`);

export const submitPublicFeedback = (
  code: string,
  payload: {
    token: string;
    rating: number;
    bookingEase: number;
    service: number;
    recommend: number;
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
