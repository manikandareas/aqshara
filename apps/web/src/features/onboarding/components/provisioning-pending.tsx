import { Empty, EmptyContent, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from "@/components/ui/empty"
import { Spinner } from "@/components/ui/spinner"

type ProvisioningPendingProps = {
  title?: string
  description?: string
}

export function ProvisioningPending({
  title = "Setting up your workspace",
  description = "Your account is still provisioning. We’ll keep checking and continue as soon as it’s ready.",
}: ProvisioningPendingProps) {
  return (
    <Empty className="min-h-[320px] rounded-2xl border border-border/70 bg-card/80">
      <EmptyHeader>
        <EmptyMedia variant="icon">
          <Spinner className="size-4" />
        </EmptyMedia>
        <EmptyTitle>{title}</EmptyTitle>
        <EmptyDescription>{description}</EmptyDescription>
      </EmptyHeader>
      <EmptyContent className="text-muted-foreground">
        This usually takes a few seconds.
      </EmptyContent>
    </Empty>
  )
}
