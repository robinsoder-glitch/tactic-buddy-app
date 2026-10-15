import type { ComponentType } from "react";
import { template as matchInvitationTemplate } from "./match-invitation";
import { template as contactMessageTemplate } from "./contact-message";

export interface TemplateEntry {
  component: ComponentType<Record<string, string | undefined>>;
  subject: string | ((data: Record<string, string | undefined>) => string);
  displayName?: string;
  previewData?: Record<string, string | undefined>;
  /** Fixed recipient — overrides caller-provided recipientEmail when set. */
  to?: string;
}

/**
 * Template registry — maps template names to their React Email components.
 * Import and register new templates here after creating them in this directory.
 */
export const TEMPLATES: Record<string, TemplateEntry> = {
  "match-invitation": matchInvitationTemplate,
  "contact-message": contactMessageTemplate,
};
