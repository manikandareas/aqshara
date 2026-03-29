import { createFileRoute, redirect } from "@tanstack/react-router"
import { recentDocumentsQueryOptions } from "@/features/documents/queries/documents-queries"

export const Route = createFileRoute("/app/")({
  loader: async ({ context }) => {
    const recentDocs = await context.queryClient.ensureQueryData(
      recentDocumentsQueryOptions({ limit: 1 })
    ) as any

    if (recentDocs?.documents?.length > 0) {
      throw redirect({
        to: "/app/$documentId",
        params: { documentId: recentDocs.documents[0].id },
      })
    }
    
    return null
  },
  component: AppIndexPage,
})

function AppIndexPage() {
  return (
    <div className="flex-1 flex flex-col items-center justify-center h-full text-center">
      <div className="max-w-md space-y-4">
        <h2 className="text-2xl font-semibold tracking-tight">No Documents Yet</h2>
        <p className="text-muted-foreground text-sm">
          You don't have any recent documents. Create a new one from the sidebar to get started.
        </p>
      </div>
    </div>
  )
}
