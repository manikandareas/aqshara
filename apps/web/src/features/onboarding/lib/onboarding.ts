export type { SessionBootstrap } from "@/features/app-session/lib/app-session"
export type {
  BootstrapDocumentInput,
  DocumentType,
  TemplateCode,
} from "@/features/documents/lib/documents"

import type { SessionBootstrap } from "@/features/app-session/lib/app-session"
import type { DocumentType, TemplateCode } from "@/features/documents/lib/documents"

export function resolveOnboardingRedirect(
  pathname: string,
  session: SessionBootstrap
) {
  if (session.onboarding.shouldShow && pathname === "/app") {
    return "/onboarding"
  }

  if (!session.onboarding.shouldShow && pathname === "/onboarding") {
    return "/app"
  }

  return null
}

export function getTemplateLabel(template: TemplateCode) {
  switch (template) {
    case "blank":
      return "Blank template"
    case "general_paper":
      return "General paper"
    case "proposal":
      return "Proposal template"
    case "skripsi":
      return "Skripsi template"
  }
}

export function getDocumentTypeLabel(type: DocumentType) {
  switch (type) {
    case "general_paper":
      return "General paper"
    case "proposal":
      return "Proposal"
    case "skripsi":
      return "Skripsi"
  }
}
