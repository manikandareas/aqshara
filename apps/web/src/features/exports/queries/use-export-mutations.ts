import { useMutation, useQueryClient } from "@tanstack/react-query"
import {
  preflightDocxExport,
  createDocxExport,
  retryExport,
  exportDetailQueryKey,
  exportsListQueryKey,
} from "./exports-queries"
import type { CreateDocxExportInput } from "./exports-queries"

export function useCreateDocxExport(documentId: string) {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (input: CreateDocxExportInput) => {
      await preflightDocxExport(documentId)
      return createDocxExport(documentId, input)
    },
    onSuccess: async (data: any) => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: exportsListQueryKey() }),
        queryClient.invalidateQueries({ queryKey: exportDetailQueryKey(data.export.id) }),
      ])
    },
  })
}

export function useRetryExport(exportId: string) {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: () => retryExport(exportId),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: exportDetailQueryKey(exportId) })
    },
  })
}
