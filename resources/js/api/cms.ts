import { api } from "./client";
import type { BookingStatus, OpenEventPublic, SiteContent } from "../domain/types";
import type { ApiVisitDay } from "./schedule";

export type ApiFaq = {
  id: string;
  question: string;
  answer: string;
  category: string | null;
  link?: { label: string; href: string };
};

export type ApiContact = {
  id: string;
  label: string;
  value: string;
  href?: string | null;
  iconKey: "instagram" | "youtube" | "whatsapp" | "email" | "phone";
};

export type ApiWaTemplate = {
  id: BookingStatus;
  label: string;
  description: string;
  template: string;
};

export const fetchPublicFaqs = () => api<{ data: ApiFaq[] }>("/api/public/faqs").then((r) => r.data);
export const fetchPublicContacts = () =>
  api<{ data: ApiContact[] }>("/api/public/contacts").then((r) => r.data);
export const fetchPublicWaTemplates = () =>
  api<{ data: ApiWaTemplate[] }>("/api/public/wa-templates").then((r) => r.data);

export const fetchAdminFaqs = () => api<{ data: ApiFaq[] }>("/api/admin/cms/faqs").then((r) => r.data);
export const updateAdminFaqs = (items: ApiFaq[]) =>
  api<{ data: ApiFaq[] }>("/api/admin/cms/faqs", { method: "PUT", body: { items } }).then((r) => r.data);

export const fetchAdminContacts = () =>
  api<{ data: ApiContact[] }>("/api/admin/cms/contacts").then((r) => r.data);
export const updateAdminContacts = (items: ApiContact[]) =>
  api<{ data: ApiContact[] }>("/api/admin/cms/contacts", { method: "PUT", body: { items } }).then(
    (r) => r.data,
  );

export const fetchAdminWaTemplates = () =>
  api<{ data: ApiWaTemplate[] }>("/api/admin/cms/wa-templates").then((r) => r.data);
export const updateAdminWaTemplates = (items: ApiWaTemplate[]) =>
  api<{ data: ApiWaTemplate[] }>("/api/admin/cms/wa-templates", {
    method: "PUT",
    body: { items },
  }).then((r) => r.data);

export type ApiHero = {
  headline: string;
  subheadline: string;
  primaryCta: string;
  secondaryCta: string;
  story: string;
};

export type ApiLetter = {
  image: string;
  checklist: string[];
  rulesImage?: string;
  rulesDescription?: string;
  rulesList?: string[];
};

export type ApiPublicBootstrap = {
  schedule: ApiVisitDay[];
  faqs: ApiFaq[];
  contacts: ApiContact[];
  waTemplates: ApiWaTemplate[];
  hero: ApiHero;
  letter: ApiLetter;
  siteContent: SiteContent;
  openEvent: OpenEventPublic | null;
};

export const fetchPublicBootstrap = () =>
  api<{ data: ApiPublicBootstrap }>("/api/public/bootstrap", { cache: "no-cache" }).then((r) => r.data);

export const fetchPublicHero = () => api<{ data: ApiHero }>("/api/public/hero").then((r) => r.data);
export const fetchPublicLetter = () =>
  api<{ data: ApiLetter }>("/api/public/letter").then((r) => r.data);
export const fetchPublicSiteContent = () =>
  api<{ data: SiteContent }>("/api/public/site-content").then((r) => r.data);

export const fetchAdminHero = () => api<{ data: ApiHero }>("/api/admin/cms/hero").then((r) => r.data);
export const updateAdminHero = (hero: ApiHero) =>
  api<{ data: ApiHero }>("/api/admin/cms/hero", { method: "PUT", body: hero }).then((r) => r.data);

export const fetchAdminLetter = () =>
  api<{ data: ApiLetter }>("/api/admin/cms/letter").then((r) => r.data);
export const updateAdminLetter = (
  checklist: string[],
  image?: File | null,
  rulesDescription?: string,
  rulesImage?: File | null,
) => {
  const formData = new FormData();
  checklist.forEach((item) => formData.append("checklist[]", item));
  if (image) formData.append("image", image);
  if (rulesDescription) formData.append("rulesDescription", rulesDescription);
  if (rulesImage) formData.append("rulesImage", rulesImage);
  return api<{ data: ApiLetter }>("/api/admin/cms/letter", { method: "POST", formData }).then(
    (r) => r.data,
  );
};

export const fetchAdminSiteContent = () =>
  api<{ data: SiteContent }>("/api/admin/cms/site-content").then((r) => r.data);

export type SiteContentImageUploads = {
  activityImages?: Array<File | null>;
  navLogo?: File | null;
  footerLogo?: File | null;
  ctaBackground?: File | null;
};

export const updateAdminSiteContent = (
  content: SiteContent,
  uploads: SiteContentImageUploads = {},
) => {
  const activityImages = uploads.activityImages ?? [];
  const hasUploads =
    activityImages.some(Boolean) ||
    Boolean(uploads.navLogo || uploads.footerLogo || uploads.ctaBackground);

  if (!hasUploads) {
    return api<{ data: SiteContent }>("/api/admin/cms/site-content", {
      method: "PUT",
      body: content,
    }).then((r) => r.data);
  }

  const formData = new FormData();
  formData.append("content", JSON.stringify(content));
  activityImages.forEach((file, index) => {
    if (file) formData.append(`activityImages[${index}]`, file);
  });
  if (uploads.navLogo) formData.append("navLogo", uploads.navLogo);
  if (uploads.footerLogo) formData.append("footerLogo", uploads.footerLogo);
  if (uploads.ctaBackground) formData.append("ctaBackground", uploads.ctaBackground);

  return api<{ data: SiteContent }>("/api/admin/cms/site-content", {
    method: "POST",
    formData,
  }).then((r) => r.data);
};
