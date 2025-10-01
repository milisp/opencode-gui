import { useEffect, useRef } from "react"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Card } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Separator } from "@/components/ui/separator"
import { cn } from "@/lib/utils"
import { useOpencodeStore } from "@/stores/opencode-store"
import type {
  MessagePart,
  MessageWithParts,
  TextPart,
  ToolPart,
  FilePart,
  ReasoningPart,
  SnapshotPart,
  PatchPart,
} from "@/types/opencode"
import { Bot, FileText, PenTool, Terminal, User } from "lucide-react"

export function ChatTimeline() {
  const activeMessages = useOpencodeStore((state) => state.activeMessages)
  const viewportRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const viewport = viewportRef.current
    if (!viewport) return
    viewport.scrollTop = viewport.scrollHeight
  }, [activeMessages])

  return (
    <ScrollArea className="flex-1">
      <div ref={viewportRef} className="space-y-6 px-6 py-6">
        {activeMessages.map((message) => (
          <ChatMessage key={message.info.id} message={message} />
        ))}
        {activeMessages.length === 0 ? (
          <Card className="border-dashed border-border/60 bg-background/40 px-6 py-10 text-center text-sm text-foreground/60">
            No messages yet. Send a prompt to get started.
          </Card>
        ) : null}
      </div>
    </ScrollArea>
  )
}

function ChatMessage({ message }: { message: MessageWithParts }) {
  const isAssistant = message.info.role === "assistant"
  const icon = isAssistant ? <Bot className="h-4 w-4" /> : <User className="h-4 w-4" />
  const time = new Date(message.info.time.created ?? Date.now()).toLocaleTimeString()

  return (
    <div className={cn("flex gap-3", isAssistant ? "flex-row" : "flex-row-reverse text-right")}
    >
      <div className="mt-1 flex h-7 w-7 items-center justify-center rounded-full bg-primary/10 text-primary">
        {icon}
      </div>
      <div className={cn("max-w-3xl space-y-3", isAssistant ? "items-start" : "items-end")}
      >
        <div className={cn("text-xs font-medium uppercase tracking-wide text-foreground/60", isAssistant ? "text-left" : "text-right")}
        >
          {isAssistant ? "Assistant" : "You"}
          <span className="ml-2 text-foreground/40">{time}</span>
        </div>
        <div
          className={cn(
            "space-y-3 rounded-2xl border border-border/60 bg-card px-5 py-4 text-sm leading-relaxed",
            isAssistant ? "rounded-tl-none" : "rounded-tr-none",
          )}
        >
          {message.parts.length === 0 ? (
            <p className="text-foreground/60">(empty message)</p>
          ) : (
            message.parts.map((part) => <MessagePartView key={part.id} part={part} />)
          )}
        </div>
      </div>
    </div>
  )
}

function MessagePartView({ part }: { part: MessagePart }) {
  switch (part.type) {
    case "text":
      return <TextPartView part={part} />
    case "reasoning":
      return <ReasoningPartView part={part} />
    case "tool":
      return <ToolPartView part={part} />
    case "file":
      return <FilePartView part={part} />
    case "snapshot":
      return <SnapshotPartView part={part} />
    case "patch":
      return <PatchPartView part={part} />
    default:
      return null
  }
}

function TextPartView({ part }: { part: TextPart }) {
  return <p className="whitespace-pre-wrap text-foreground">{part.text}</p>
}

function ReasoningPartView({ part }: { part: ReasoningPart }) {
  return (
    <div className="rounded-lg border border-border/60 bg-muted/30 p-3 text-xs text-muted-foreground">
      <p className="flex items-center gap-2 font-medium text-muted-foreground/80">
        <PenTool className="h-3.5 w-3.5" />
        Reasoning
      </p>
      <Separator className="my-2 bg-border/60" />
      <p className="whitespace-pre-wrap">{part.text}</p>
    </div>
  )
}

function ToolPartView({ part }: { part: ToolPart }) {
  return (
    <div className="rounded-lg border border-border/60 bg-background/60 p-3 text-xs">
      <p className="flex items-center justify-between font-medium text-foreground/80">
        <span className="flex items-center gap-2">
          <Terminal className="h-3.5 w-3.5" />
          {part.tool}
        </span>
        <ToolStatusBadge status={part.state.status} />
      </p>
      <Separator className="my-2 bg-border/40" />
      <pre className="max-h-40 overflow-y-auto whitespace-pre-wrap rounded bg-muted/30 p-2 text-[11px] text-muted-foreground">
        {JSON.stringify(part.state, null, 2)}
      </pre>
    </div>
  )
}

function ToolStatusBadge({ status }: { status: string }) {
  const label = status.charAt(0).toUpperCase() + status.slice(1)
  switch (status) {
    case "pending":
      return <Badge variant="outline">Pending</Badge>
    case "running":
      return <Badge className="bg-primary/10 text-primary">Running</Badge>
    case "completed":
      return <Badge className="bg-emerald-500/10 text-emerald-400">Completed</Badge>
    case "error":
      return <Badge className="bg-destructive/20 text-destructive">Error</Badge>
    default:
      return <Badge variant="outline">{label}</Badge>
  }
}

function FilePartView({ part }: { part: FilePart }) {
  return (
    <div className="rounded-lg border border-border/60 bg-muted/20 p-3 text-xs">
      <div className="flex items-center gap-2 font-medium text-foreground/80">
        <FileText className="h-3.5 w-3.5" />
        {part.filename ?? part.url}
      </div>
      {part.source?.text?.value ? (
        <pre className="mt-2 max-h-48 overflow-y-auto whitespace-pre text-[11px] text-muted-foreground">
          {part.source.text.value}
        </pre>
      ) : null}
    </div>
  )
}

function SnapshotPartView({ part }: { part: SnapshotPart }) {
  return (
    <div className="rounded-lg border border-border/60 bg-muted/10 p-3 text-xs">
      <p className="font-medium text-foreground/80">Snapshot</p>
      <p className="mt-1 break-all text-muted-foreground">{part.snapshot}</p>
    </div>
  )
}

function PatchPartView({ part }: { part: PatchPart }) {
  return (
    <div className="rounded-lg border border-border/60 bg-muted/10 p-3 text-xs text-foreground/80">
      <p className="font-medium">Workspace changes</p>
      <ul className="mt-1 list-disc space-y-1 pl-4 text-muted-foreground">
        {part.files.map((file) => (
          <li key={file}>{file}</li>
        ))}
      </ul>
      <p className="mt-2 text-[11px] text-muted-foreground/80">Patch hash: {part.hash}</p>
    </div>
  )
}
