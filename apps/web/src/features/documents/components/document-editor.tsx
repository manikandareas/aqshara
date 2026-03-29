import * as React from "react"
import { Plate, usePlateEditor } from "platejs/react"

import { BasicNodesKit } from "@/components/editor/plugins/basic-nodes-kit"
import { Editor, EditorContainer } from "@/components/ui/editor"
import { Toolbar, ToolbarGroup } from "@/components/ui/toolbar"
import { MarkToolbarButton } from "@/components/ui/mark-toolbar-button"
import { useSaveDocumentContent } from "../queries/use-document-mutations"

function useDebounceCallback<Args extends any[]>(
  callback: (...args: Args) => void,
  delay: number
) {
  const timeoutRef = React.useRef<ReturnType<typeof setTimeout> | null>(null)

  return React.useCallback(
    (...args: Args) => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current)
      }
      timeoutRef.current = setTimeout(() => {
        callback(...args)
      }, delay)
    },
    [callback, delay]
  )
}

export function DocumentEditor({ document }: { document: any }) {
  const saveContent = useSaveDocumentContent(document.id)

  const debouncedSave = useDebounceCallback((value) => {
    saveContent.mutate({
      contentJson: value,
      baseUpdatedAt: document.updatedAt,
    })
  }, 2000)

  // Memoize initial value so it doesn't reset Plate if document rerenders
  const initialValue = React.useMemo(() => {
    if (document?.contentJson && Array.isArray(document.contentJson) && document.contentJson.length > 0) {
      return document.contentJson;
    }
    return [
      {
        type: 'h1',
        children: [{ text: document?.title || 'Untitled' }],
      },
      {
        type: 'p',
        children: [{ text: '' }],
      },
    ];
  }, [document?.id]);

  const editor = usePlateEditor({
    plugins: [
      ...BasicNodesKit,
      // If table/list plugins were successfully installed, we'd add them here later
    ],
    value: initialValue,
  })

  return (
    <Plate
      editor={editor}
      onChange={({ value }) => {
        debouncedSave(value)
      }}
    >
      <div className="absolute top-4 left-1/2 -translate-x-1/2 w-full max-w-[400px] z-10 flex justify-center">
        <Toolbar className="rounded-xl p-1 shadow-sm border bg-background/95 backdrop-blur items-center justify-center flex gap-1">
          <ToolbarGroup>
            <MarkToolbarButton nodeType="bold" tooltip="Bold (⌘+B)">
              <span className="font-bold">B</span>
            </MarkToolbarButton>
            <MarkToolbarButton nodeType="italic" tooltip="Italic (⌘+I)">
              <span className="italic">I</span>
            </MarkToolbarButton>
            <MarkToolbarButton nodeType="underline" tooltip="Underline (⌘+U)">
              <span className="underline">U</span>
            </MarkToolbarButton>
          </ToolbarGroup>
        </Toolbar>
      </div>

      <div className="flex-1 w-full h-full flex flex-col items-center overflow-auto pt-24 pb-40 px-10 md:px-20 lg:px-40">
        <div className="w-full max-w-3xl">
          <EditorContainer>
            <Editor placeholder="Start writing your document..." variant="default" className="text-lg leading-relaxed text-foreground min-h-[400px] bg-transparent border-transparent min-w-full" />
          </EditorContainer>
        </div>
      </div>
    </Plate>
  )
}
