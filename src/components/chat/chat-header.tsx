import { useState } from "react"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { useOpencodeStore } from "@/stores/opencode-store"
import { cn } from "@/lib/utils"
import { AlertTriangle, FileText, Loader2, Settings } from "lucide-react"
import { useShallow } from "zustand/react/shallow"
import { open as openDir } from '@tauri-apps/plugin-dialog';
import useProjectStore from "@/stores/project-store"

export function ChatHeader() {
  const { activeSession, isLoadingMessages, busySessionIDs, activeSessionID, lastError } = useOpencodeStore(
    useShallow((state) => ({
      activeSession: state.activeSession,
      isLoadingMessages: state.isLoadingMessages,
      busySessionIDs: state.busySessionIDs,
      activeSessionID: state.activeSessionID,
      lastError: state.lastError,
    })),
  )
  const clearError = useOpencodeStore((state) => state.clearError)
  const isBusy = activeSessionID ? busySessionIDs.has(activeSessionID) : false

  return (
    <div className="flex flex-col gap-2 px-6 py-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-lg font-semibold leading-tight text-foreground">
            {activeSession ? activeSession.title : "Select a session"}
          </h1>
          <p className="text-sm text-foreground/60">
            {activeSession ? new Date(activeSession.time.updated).toLocaleString() : "No session selected"}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <span
            className={cn(
              "inline-flex items-center gap-2 rounded-full border border-border/60 px-3 py-1 text-xs font-medium",
              isBusy ? "bg-primary/10 text-primary" : "bg-secondary/40 text-foreground/70",
            )}
          >
            {isLoadingMessages ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : null}
            {isBusy ? "Assistant working" : "Idle"}
          </span>
          <SettingsDialogTrigger />
        </div>
      </div>
      {lastError ? (
        <div className="flex items-center gap-2 rounded-md border border-destructive/40 bg-destructive/10 px-3 py-2 text-xs text-destructive">
          <AlertTriangle className="h-4 w-4" />
          <span className="flex-1 truncate" title={lastError}>
            {lastError}
          </span>
          <Button
            variant="ghost"
            size="sm"
            className="h-7 text-destructive hover:bg-destructive/10"
            onClick={clearError}
          >
            Dismiss
          </Button>
        </div>
      ) : null}
    </div>
  )
}

function SettingsDialogTrigger() {
  const config = useOpencodeStore((state) => state.config)
  const updateConfig = useOpencodeStore((state) => state.updateConfig)
  const refreshSessions = useOpencodeStore((state) => state.refreshSessions)
  const [open, setOpen] = useState(false)
  const [baseUrl, setBaseUrl] = useState(config.baseUrl)
  const projectDirectory = useProjectStore((s) => s.directory)
  const setProjectDirectory = useProjectStore((s) => s.setDirectory)
  const [directory, setDirectory] = useState(projectDirectory ?? config.directory ?? "")
  const [saving, setSaving] = useState(false)

  const handleSave = async () => {
    setSaving(true)
    try {
      updateConfig({ baseUrl: baseUrl.trim() || config.baseUrl, directory: directory.trim() || undefined })
      await refreshSessions()
      setOpen(false)
    } catch (error) {
      console.error("Failed to save settings", error)
    } finally {
      setSaving(false)
    }
  }

  const handleOpenChange = (next: boolean) => {
    if (next) {
      setBaseUrl(config.baseUrl)
      // prefer project store value if present
      setDirectory(useProjectStore.getState().directory ?? config.directory ?? "")
    }
    setOpen(next)
  }


  const handleSelectProjectDir = async () => {
    try {
      const result = await openDir({
        multiple: false,
        directory: true
      });
      if (result) {
        // tauri plugin-dialog returns either a string or array of strings depending on options
        const picked = Array.isArray(result) ? result[0] : result
        setDirectory(picked as string)
        setProjectDirectory(picked as string)
      }
    } catch (error) {
      console.error('Failed to select codex executable:', error);
    }
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogTrigger asChild>
        <Button variant="ghost" size="icon" title="Settings">
          <Settings className="h-5 w-5" />
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Connection settings</DialogTitle>
          <DialogDescription>Configure the opencode backend endpoint.</DialogDescription>
        </DialogHeader>
        <div className="space-y-4 py-2">
          <div className="space-y-1">
            <label htmlFor="base-url" className="text-sm font-medium text-foreground">
              Base URL
            </label>
            <Input
              id="base-url"
              value={baseUrl}
              placeholder="http://127.0.0.1:4096"
              onChange={(event) => setBaseUrl(event.target.value)}
            />
          </div>
          <div className="space-y-1">
            <label htmlFor="directory" className="text-sm font-medium text-foreground">
              Project directory
            </label>
            <div className="flex">
              <Input
                id="directory"
                value={directory}
                placeholder="/path/to/workspace"
                onChange={(event) => setDirectory(event.target.value)}
              />
              <Button
                variant="outline"
                onClick={handleSelectProjectDir}
                className="flex items-center gap-2"
              >
                <FileText className="w-4 h-4" />
                Browse
              </Button>
            </div>
            <p className="text-xs text-foreground/60">
              When set, the app sends a <code className="rounded bg-foreground/10 px-1">directory</code> query parameter for all
              requests so the opencode server scopes to a specific workspace.
            </p>
          </div>
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={() => setOpen(false)} disabled={saving}>
            Cancel
          </Button>
          <Button onClick={handleSave} disabled={saving}>
            {saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
            Save changes
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
