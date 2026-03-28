import * as React from "react"

import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import {
  Empty,
  EmptyContent,
  EmptyDescription,
  EmptyHeader,
  EmptyTitle,
} from "@/components/ui/empty"
import {
  Field,
  FieldContent,
  FieldDescription,
  FieldGroup,
  FieldLabel,
} from "@/components/ui/field"
import { Input } from "@/components/ui/input"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Separator } from "@/components/ui/separator"
import { Spinner } from "@/components/ui/spinner"
import {
  type BootstrapDocumentInput,
  type DocumentType,
  getDocumentTypeLabel,
  getTemplateLabel,
  type SessionBootstrap,
  type TemplateCode,
} from "@/lib/onboarding"

type OnboardingFormProps = {
  session: SessionBootstrap
  templates: TemplateCode[]
  isPending: boolean
  errorMessage?: string
  onSubmit: (input: BootstrapDocumentInput) => Promise<unknown> | void
}

const documentTypes: DocumentType[] = ["general_paper", "proposal", "skripsi"]

export function OnboardingForm({
  session,
  templates,
  isPending,
  errorMessage,
  onSubmit,
}: OnboardingFormProps) {
  const [title, setTitle] = React.useState("")
  const [type, setType] = React.useState<DocumentType | "">("")
  const [templateCode, setTemplateCode] = React.useState<TemplateCode | "">("")

  const initials = React.useMemo(() => {
    const source = session.user.name?.trim() || session.user.email
    return source.slice(0, 2).toUpperCase()
  }, [session.user.email, session.user.name])

  const hasTemplates = templates.length > 0
  const isDisabled = !title.trim() || !type || !templateCode || isPending

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault()

    if (!title.trim() || !type || !templateCode) {
      return
    }

    await onSubmit({
      title: title.trim(),
      type,
      templateCode,
    })
  }

  return (
    <Card className="border-border/70 bg-card/95 shadow-2xl shadow-black/10">
      <CardHeader className="space-y-4">
        <div className="flex items-start justify-between gap-4">
          <div className="space-y-1">
            <CardTitle className="text-2xl tracking-tight">
              Create your first document
            </CardTitle>
            <CardDescription className="max-w-xl text-sm leading-6 text-muted-foreground">
              Start inside the existing Aqshara workspace flow. We&apos;ll create one
              document and route you into the main app shell immediately after.
            </CardDescription>
          </div>
          <Badge variant="secondary" className="rounded-full px-3 py-1 text-xs">
            {session.plan.label}
          </Badge>
        </div>

        <div className="flex items-center gap-3 rounded-xl border border-border/70 bg-background/70 p-3">
          <Avatar className="size-10 border border-border/70">
            <AvatarImage src={session.user.avatarUrl ?? undefined} alt={session.user.name ?? session.user.email} />
            <AvatarFallback>{initials}</AvatarFallback>
          </Avatar>
          <div className="min-w-0 flex-1">
            <div className="truncate text-sm font-medium">
              {session.user.name ?? session.user.email}
            </div>
            <div className="truncate text-sm text-muted-foreground">
              {session.workspace.name}
            </div>
          </div>
        </div>
      </CardHeader>

      <Separator />

      <form onSubmit={handleSubmit}>
        <CardContent className="pt-6">
          {hasTemplates ? (
            <FieldGroup>
              <Field>
                <FieldLabel htmlFor="document-title">Document title</FieldLabel>
                <FieldContent>
                  <Input
                    id="document-title"
                    name="document-title"
                    value={title}
                    onChange={(event) => setTitle(event.target.value)}
                    placeholder="My First Draft"
                  />
                  <FieldDescription>
                    Use a working title. You can rename the document later.
                  </FieldDescription>
                </FieldContent>
              </Field>

              <div className="grid gap-4 md:grid-cols-2">
                <Field>
                  <FieldLabel htmlFor="document-type-trigger">Document type</FieldLabel>
                  <FieldContent>
                    <Select value={type} onValueChange={(value) => setType(value as DocumentType)}>
                      <SelectTrigger
                        id="document-type-trigger"
                        aria-label="Document type"
                        className="w-full"
                      >
                        <SelectValue placeholder="Choose a document type" />
                      </SelectTrigger>
                      <SelectContent>
                        {documentTypes.map((documentType) => (
                          <SelectItem key={documentType} value={documentType}>
                            {getDocumentTypeLabel(documentType)}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </FieldContent>
                </Field>

                <Field>
                  <FieldLabel htmlFor="template-trigger">Template</FieldLabel>
                  <FieldContent>
                    <Select
                      value={templateCode}
                      onValueChange={(value) => setTemplateCode(value as TemplateCode)}
                    >
                      <SelectTrigger
                        id="template-trigger"
                        aria-label="Template"
                        className="w-full"
                      >
                        <SelectValue placeholder="Choose a template" />
                      </SelectTrigger>
                      <SelectContent>
                        {templates.map((template) => (
                          <SelectItem key={template} value={template}>
                            {getTemplateLabel(template)}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </FieldContent>
                </Field>
              </div>
            </FieldGroup>
          ) : (
            <Empty className="min-h-[240px] rounded-2xl border border-dashed border-border/70 bg-background/40">
              <EmptyHeader>
                <EmptyTitle>No templates available</EmptyTitle>
                <EmptyDescription>
                  Onboarding needs at least one starter template before the first
                  document can be created.
                </EmptyDescription>
              </EmptyHeader>
              <EmptyContent className="text-muted-foreground">
                Try again in a moment or check the template configuration.
              </EmptyContent>
            </Empty>
          )}

          {errorMessage ? (
            <Alert variant="destructive" className="mt-6">
              <AlertTitle>We couldn&apos;t create your document</AlertTitle>
              <AlertDescription>{errorMessage}</AlertDescription>
            </Alert>
          ) : null}
        </CardContent>

        <CardFooter className="justify-end">
          <Button type="submit" disabled={isDisabled} className="min-w-48">
            {isPending ? (
              <span className="inline-flex items-center gap-2">
                <Spinner className="size-4" />
                Creating...
              </span>
            ) : (
              "Create first document"
            )}
          </Button>
        </CardFooter>
      </form>
    </Card>
  )
}
