import { api } from "./client";

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

export const fetchAdminFeedbacks = (): Promise<ApiFeedback[]> =>
  api<{ data: ApiFeedback[] }>("/api/admin/feedback").then((r) => r.data);

export const fetchPublicFeedback = (code: string) =>
  api<{
    data: ApiFeedback | null;
    booking: { code: string; institution: string; dateLabel: string };
  }>(`/api/public/feedback/${encodeURIComponent(code)}`);

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
