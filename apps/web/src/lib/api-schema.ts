import type { paths } from "@aqshara/api-client"

type PathKey = keyof paths
type MethodKey<TPath extends PathKey> = keyof paths[TPath]
type Operation<
  TPath extends PathKey,
  TMethod extends MethodKey<TPath>,
> = paths[TPath][TMethod]

export type ApiJsonResponse<
  TPath extends PathKey,
  TMethod extends MethodKey<TPath>,
  TStatus extends keyof Extract<
    Operation<TPath, TMethod>,
    { responses: unknown }
  >["responses"],
> = Extract<Operation<TPath, TMethod>, { responses: unknown }>["responses"][TStatus] extends {
  content: {
    "application/json": infer TContent
  }
}
  ? TContent
  : never

export type ApiRequestBody<
  TPath extends PathKey,
  TMethod extends MethodKey<TPath>,
> = Operation<TPath, TMethod> extends {
  requestBody?: {
    content: {
      "application/json": infer TBody
    }
  }
}
  ? TBody
  : never

export type ApiPathParams<
  TPath extends PathKey,
  TMethod extends MethodKey<TPath>,
> = Operation<TPath, TMethod> extends {
  parameters: {
    path: infer TParams
  }
}
  ? TParams
  : never

export type ApiQueryParams<
  TPath extends PathKey,
  TMethod extends MethodKey<TPath>,
> = Operation<TPath, TMethod> extends {
  parameters: {
    query?: infer TParams
  }
}
  ? TParams
  : never
