import { createFileRoute } from "@tanstack/react-router"
import { useSuspenseQuery } from "@tanstack/react-query"
import { documentDetailQueryOptions } from "@/features/documents/queries/documents-queries"
import { DocumentEditor } from "@/features/documents/components/document-editor"

export const Route = createFileRoute("/app/$documentId")({
  loader: async ({ context, params }) => {
    await context.queryClient.ensureQueryData(
      documentDetailQueryOptions(params.documentId)
    )
  },
  component: DocumentEditorPage,
})

function DocumentEditorPage() {
  const { documentId } = Route.useParams()
  const { data } = useSuspenseQuery(documentDetailQueryOptions(documentId)) as any

  return (
    <div className="flex-1 flex flex-col h-full overflow-hidden absolute inset-0">
      <DocumentEditor document={data?.document} />
    </div>
  )
}
