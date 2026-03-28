import type { paths } from "@aqshara/api-client"

export type SessionBootstrap =
  paths["/v1/me"]["get"]["responses"][200]["content"]["application/json"]

type BootstrapRequestBody = NonNullable<
  paths["/v1/documents/bootstrap"]["post"]["requestBody"]
>["content"]["application/json"]

export type TemplateCode =
  BootstrapRequestBody["templateCode"]

export type DocumentType =
  BootstrapRequestBody["type"]

export type BootstrapDocumentInput = BootstrapRequestBody

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
