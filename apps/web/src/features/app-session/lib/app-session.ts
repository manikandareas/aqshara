import type { ApiJsonResponse } from "@/lib/api-schema"

export type SessionBootstrap = ApiJsonResponse<"/v1/me", "get", 200>
