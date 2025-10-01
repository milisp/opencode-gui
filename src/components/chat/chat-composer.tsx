import { FormEvent, useState } from "react"
import { Textarea } from "@/components/ui/textarea"
import { Button } from "@/components/ui/button"
import { useOpencodeStore } from "@/stores/opencode-store"
import { Loader2, Send } from "lucide-react"
import { cn } from "@/lib/utils"

export function ChatComposer() {
  const activeSessionID = useOpencodeStore((state) => state.activeSessionID)
  const prompt = useOpencodeStore((state) => state.prompt)
  const busySessionIDs = useOpencodeStore((state) => state.busySessionIDs)
  const [value, setValue] = useState("")
  const [sending, setSending] = useState(false)

  const isBusy = activeSessionID ? busySessionIDs.has(activeSessionID) : false

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (!activeSessionID) return
    const text = value.trim()
    if (!text) return
    setSending(true)
    try {
      await prompt(activeSessionID, { text })
      setValue("")
    } catch (error) {
      console.error("Failed to send message", error)
    } finally {
      setSending(false)
    }
  }

  const disabled = !activeSessionID || !value.trim() || sending || isBusy

  return (
    <form onSubmit={handleSubmit} className="border-t border-border/60 bg-background/80 px-6 py-4">
      <div className="flex items-end gap-4">
        <Textarea
          value={value}
          onChange={(event) => setValue(event.target.value)}
          placeholder={activeSessionID ? "Ask opencode to help with your code..." : "Select a session to get started"}
          className="max-h-48 min-h-16 flex-1 resize-none bg-background"
          disabled={!activeSessionID || sending || isBusy}
        />
        <Button type="submit" size="lg" className={cn("self-center") } disabled={disabled}>
          {sending || isBusy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
        </Button>
      </div>
    </form>
  )
}
