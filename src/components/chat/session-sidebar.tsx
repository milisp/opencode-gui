import { useMemo, useState } from "react"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Separator } from "@/components/ui/separator"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"
import { useOpencodeStore } from "@/stores/opencode-store"
import { FilePlus2, Loader2, RefreshCw, Search, Trash2 } from "lucide-react"
import { useShallow } from "zustand/react/shallow"

export function SessionSidebar() {
  const { sessions, activeSessionID, isLoadingSessions } = useOpencodeStore(
    useShallow((state) => ({
      sessions: state.sessions,
      activeSessionID: state.activeSessionID,
      isLoadingSessions: state.isLoadingSessions,
    })),
  )
  const selectSession = useOpencodeStore((state) => state.selectSession)
  const refreshSessions = useOpencodeStore((state) => state.refreshSessions)
  const createSession = useOpencodeStore((state) => state.createSession)
  const deleteSession = useOpencodeStore((state) => state.deleteSession)
  const [query, setQuery] = useState("")
  const [deletingID, setDeletingID] = useState<string | null>(null)

  const filtered = useMemo(() => {
    if (!query.trim()) return sessions
    const q = query.trim().toLowerCase()
    return sessions.filter((session) => session.title.toLowerCase().includes(q))
  }, [sessions, query])

  const handleCreate = async () => {
    try {
      await createSession()
    } catch (error) {
      console.error("Failed to create session", error)
    }
  }

  const handleDelete = async (sessionID: string) => {
    setDeletingID(sessionID)
    try {
      await deleteSession(sessionID)
    } catch (error) {
      console.error("Failed to delete session", error)
    } finally {
      setDeletingID(null)
    }
  }

  return (
    <div className="flex h-full flex-col">
      <div className="flex items-center gap-2 px-4 py-3">
        <div className="relative flex-1">
          <Search className="pointer-events-none absolute left-2 top-1/2 h-4 w-4 -translate-y-1/2 text-foreground/60" />
          <input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search sessions"
            className="block w-full rounded-lg border border-border/60 bg-background/70 py-1.5 pl-8 pr-3 text-sm text-foreground placeholder:text-foreground/50 focus:outline-none focus:ring-2 focus:ring-ring"
          />
        </div>
        <Button variant="ghost" size="icon" onClick={() => refreshSessions()} disabled={isLoadingSessions} title="Reload sessions">
          {isLoadingSessions ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
        </Button>
        <Button variant="default" size="icon" onClick={handleCreate} title="New session">
          <FilePlus2 className="h-4 w-4" />
        </Button>
      </div>
      <Separator className="bg-border/50" />
      <ScrollArea className="flex-1">
        <div className="space-y-1 px-2 py-3 w-72">
          {filtered.map((session) => {
            const isActive = session.id === activeSessionID
            const isDeleting = deletingID === session.id
            return (
              <div
                key={session.id}
                role="button"
                tabIndex={0}
                onClick={() => selectSession(session.id)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" || e.key === " ") {
                    e.preventDefault()
                    selectSession(session.id)
                  }
                }}
                className={cn(
                  "group flex w-full items-center gap-2 rounded-lg border border-transparent px-3 py-2 text-left text-sm transition",
                  isActive
                    ? "bg-sidebar-accent/20 text-sidebar-foreground ring-1 ring-sidebar-ring"
                    : "text-sidebar-foreground/80 hover:bg-sidebar-accent/10",
                )}
              >
                <div className="flex-1 truncate">
                  <p className="truncate font-medium">{session.title}</p>
                  <p className="truncate text-xs text-sidebar-foreground/60">
                    {new Date(session.time.updated).toLocaleString()}
                  </p>
                </div>
                <Button
                  variant="ghost"
                  size="icon"
                  className="hidden h-7 w-7 flex-none text-sidebar-foreground/60 hover:text-destructive group-hover:flex"
                  onClick={(event) => {
                    event.stopPropagation()
                    handleDelete(session.id)
                  }}
                  disabled={isDeleting}
                >
                  {isDeleting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
                </Button>
              </div>
            )
          })}
          {filtered.length === 0 && !isLoadingSessions ? (
            <div className="rounded-lg border border-dashed border-border/60 px-4 py-8 text-center text-sm text-sidebar-foreground/60">
              No sessions match your search.
            </div>
          ) : null}
        </div>
      </ScrollArea>
    </div>
  )
}
