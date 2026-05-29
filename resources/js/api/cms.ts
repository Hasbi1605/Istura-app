import { api } from "./client";

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
  id: "Accepted" | "Rejected" | "Reschedule" | "Completed";
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
