import { api } from "./client";
import type { FeedbackDiscoverySource, FeedbackGender } from "../domain/types";

export type OpenFeedbackAccessStatus = "not_open_yet" | "available" | "closed";

export type OpenFeedbackContext = {
  eventName: string | null;
  dayDate: string | null;
  dayDateLabel: string | null;
  accessStatus: OpenFeedbackAccessStatus;
  closesAt: string | null;
};

export type OpenFeedbackSubmitPayload = {
  nik: string;
  whatsapp: string;
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
};

export const fetchOpenFeedbackContext = (token: string) =>
  api<{ data: OpenFeedbackContext }>(`/api/public/open-feedback/${encodeURIComponent(token)}`).then(
    (r) => r.data,
  );

export const submitOpenFeedback = (token: string, payload: OpenFeedbackSubmitPayload) =>
  api<{ data: { submitted: boolean; rating: number } }>(
    `/api/public/open-feedback/${encodeURIComponent(token)}`,
    { method: "POST", body: payload },
  ).then((r) => r.data);
