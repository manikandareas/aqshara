import { useMutation, useQueryClient } from "@tanstack/react-query"
import { useNavigate } from "@tanstack/react-router"
import {
  createDocument,
  updateDocument,
  saveDocumentContent,
  archiveDocument,
  deleteDocument,
  documentDetailQueryKey,
  documentsListQueryKey,
  recentDocumentsQueryKey,
  documentVersionsQueryKey,
} from "./documents-queries"
import type {
  CreateDocumentInput,
  UpdateDocumentInput,
  SaveDocumentContentInput,
} from "./documents-queries"

export function useCreateDocument() {
  const queryClient = useQueryClient()
  const navigate = useNavigate()

  return useMutation({
    mutationFn: (input: CreateDocumentInput) => createDocument(input),
    onSuccess: async (data: any) => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: documentsListQueryKey() }),
        queryClient.invalidateQueries({ queryKey: recentDocumentsQueryKey() }),
      ])
      navigate({ to: "/app/$documentId", params: { documentId: data.document.id } })
    },
  })
}

export function useUpdateDocument(documentId: string) {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (input: UpdateDocumentInput) => updateDocument(documentId, input),
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: documentDetailQueryKey(documentId) }),
        queryClient.invalidateQueries({ queryKey: documentsListQueryKey() }),
        queryClient.invalidateQueries({ queryKey: recentDocumentsQueryKey() }),
      ])
    },
  })
}

export function useSaveDocumentContent(documentId: string) {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (input: SaveDocumentContentInput) =>
      saveDocumentContent(documentId, input),
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: documentDetailQueryKey(documentId) }),
        queryClient.invalidateQueries({ queryKey: documentVersionsQueryKey(documentId) }),
      ])
    },
  })
}

export function useArchiveDocument(documentId: string) {
  const queryClient = useQueryClient()
  const navigate = useNavigate()

  return useMutation({
    mutationFn: () => archiveDocument(documentId),
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: documentDetailQueryKey(documentId) }),
        queryClient.invalidateQueries({ queryKey: documentsListQueryKey() }),
        queryClient.invalidateQueries({ queryKey: recentDocumentsQueryKey() }),
      ])
      navigate({ to: "/app" })
    },
  })
}

export function useDeleteDocument(documentId: string) {
  const queryClient = useQueryClient()
  const navigate = useNavigate()

  return useMutation({
    mutationFn: () => deleteDocument(documentId),
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: documentsListQueryKey() }),
        queryClient.invalidateQueries({ queryKey: recentDocumentsQueryKey() }),
      ])
      navigate({ to: "/app" })
    },
  })
}
