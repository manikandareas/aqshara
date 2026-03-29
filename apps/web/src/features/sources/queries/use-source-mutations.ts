import { useMutation, useQueryClient } from "@tanstack/react-query"
import {
  createSourceUploadUrl,
  registerSource,
  retrySource,
  deleteSource,
  documentSourcesQueryKey,
  sourceStatusQueryKey,
} from "./sources-queries"
import type { RetrySourceInput } from "./sources-queries"

export function useRegisterSource(documentId: string) {
  const queryClient = useQueryClient()

  // Full flow: upload URL + (in component) file upload + register
  return useMutation({
    mutationFn: async (input: {
      file: File
      type: any
    }) => {
      // 1. Get upload URL
      const { uploadUrl, fileId: uploadFileId } = (await createSourceUploadUrl()) as any

      // 2. Upload file to URL
      const formData = new FormData()
      formData.append("file", input.file)
      
      const uploadResponse = await fetch(uploadUrl, {
        method: "PUT",
        body: input.file, // S3/R2 direct upload usually requires raw body or formData depending on the presigned URL type. We emit raw file here.
        headers: {
          "Content-Type": input.file.type || "application/octet-stream",
        },
      })
      
      if (!uploadResponse.ok) {
        throw new Error("Failed to upload the file to storage")
      }

      // 3. Register
      return registerSource({
        documentId,
        sourceId: uploadFileId as any,
        storageKey: uploadFileId as any,
        originalFileName: input.file.name,
        fileSizeBytes: input.file.size,
        checksum: "TODO",
        mimeType: input.file.type || "application/octet-stream"
      })
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({
        queryKey: documentSourcesQueryKey(documentId),
      })
    },
  })
}

export function useRetrySource(sourceId: string) {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (input: RetrySourceInput) => retrySource(sourceId, input),
    onSuccess: async () => {
      await queryClient.invalidateQueries({
        queryKey: sourceStatusQueryKey(sourceId),
      })
    },
  })
}

export function useDeleteSource(documentId: string, sourceId: string) {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: () => deleteSource(sourceId),
    onSuccess: async () => {
      await queryClient.invalidateQueries({
        queryKey: documentSourcesQueryKey(documentId),
      })
    },
  })
}
