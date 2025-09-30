import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react"
import {
  createSession,
  deleteSession as deleteSessionRequest,
  fetchMessages,
  fetchSessions,
  readConfig,
  sendPrompt,
  subscribeEvents,
  type OpencodeConfig,
  writeConfig,
} from "@/services/opencode-client"
import type {
  MessagePart,
  MessageWithParts,
  PromptInput,
  ServerEvent,
  SessionInfo,
} from "@/types/opencode"

interface OpencodeStateValue {
  config: OpencodeConfig
  updateConfig: (input: Partial<OpencodeConfig>) => void
  sessions: SessionInfo[]
  isLoadingSessions: boolean
  isLoadingMessages: boolean
  activeSessionID?: string
  activeSession?: SessionInfo
  activeMessages: MessageWithParts[]
  busySessionIDs: Set<string>
  selectSession: (sessionID: string) => void
  refreshSessions: () => Promise<void>
  prompt: (sessionID: string, input: { text: string }) => Promise<void>
  createSession: (input?: { parentID?: string; title?: string }) => Promise<SessionInfo>
  deleteSession: (sessionID: string) => Promise<void>
}

const OpencodeContext = createContext<OpencodeStateValue | null>(null)

function mergeOrInsert(list: SessionInfo[], next: SessionInfo): SessionInfo[] {
  const index = list.findIndex((item) => item.id === next.id)
  if (index >= 0) {
    const copy = [...list]
    copy[index] = next
    copy.sort((a, b) => b.time.updated - a.time.updated)
    return copy
  }
  const copy = [...list, next]
  copy.sort((a, b) => b.time.updated - a.time.updated)
  return copy
}

function removeSession(list: SessionInfo[], id: string): SessionInfo[] {
  return list.filter((item) => item.id !== id)
}

function mergeMessage(list: MessageWithParts[], next: MessageWithParts): MessageWithParts[] {
  const index = list.findIndex((item) => item.info.id === next.info.id)
  if (index >= 0) {
    const copy = [...list]
    copy[index] = {
      info: next.info,
      parts: next.parts,
    }
    copy.sort((a, b) => (a.info.time.created ?? 0) - (b.info.time.created ?? 0))
    return copy
  }
  const copy = [...list, next]
  copy.sort((a, b) => (a.info.time.created ?? 0) - (b.info.time.created ?? 0))
  return copy
}

function mergeMessageInfo(list: MessageWithParts[], info: MessageWithParts["info"]): MessageWithParts[] {
  const index = list.findIndex((item) => item.info.id === info.id)
  if (index >= 0) {
    const copy = [...list]
    copy[index] = {
      info,
      parts: copy[index]!.parts,
    }
    return copy
  }
  return list
}

function mergeMessagePart(list: MessageWithParts[], part: MessagePart): MessageWithParts[] {
  const index = list.findIndex((item) => item.info.id === part.messageID)
  if (index < 0) return list
  const target = list[index]!
  const partIndex = target.parts.findIndex((item) => item.id === part.id)
  const nextParts = [...target.parts]
  if (partIndex >= 0) {
    nextParts[partIndex] = part
  } else {
    nextParts.push(part)
    nextParts.sort((a, b) => a.id.localeCompare(b.id))
  }
  const nextList = [...list]
  nextList[index] = {
    info: target.info,
    parts: nextParts,
  }
  return nextList
}

function removeMessagePart(list: MessageWithParts[], messageID: string, partID: string): MessageWithParts[] {
  const index = list.findIndex((item) => item.info.id === messageID)
  if (index < 0) return list
  const target = list[index]!
  const nextParts = target.parts.filter((item) => item.id !== partID)
  const nextList = [...list]
  nextList[index] = {
    info: target.info,
    parts: nextParts,
  }
  return nextList
}

function removeMessage(list: MessageWithParts[], messageID: string): MessageWithParts[] {
  return list.filter((item) => item.info.id !== messageID)
}

export function OpencodeProvider({ children }: { children: ReactNode }) {
  const [config, setConfig] = useState<OpencodeConfig>(() => readConfig())
  const [sessions, setSessions] = useState<SessionInfo[]>([])
  const [activeSessionID, setActiveSessionID] = useState<string | undefined>(undefined)
  const [messages, setMessages] = useState<Record<string, MessageWithParts[]>>({})
  const [isLoadingSessions, setIsLoadingSessions] = useState(false)
  const [isLoadingMessages, setIsLoadingMessages] = useState(false)
  const [busySessionIDs, setBusySessionIDs] = useState<Set<string>>(new Set())
  const eventSubscription = useRef<ReturnType<typeof subscribeEvents> | null>(null)

  const refreshSessions = useCallback(async () => {
    setIsLoadingSessions(true)
    try {
      const result = await fetchSessions(config)
      const sorted = [...result].sort((a, b) => b.time.updated - a.time.updated)
      setSessions(sorted)
      if (!activeSessionID && sorted.length > 0) {
        setActiveSessionID(sorted[0]!.id)
      }
    } catch (error) {
      console.error("Failed to load sessions", error)
    } finally {
      setIsLoadingSessions(false)
    }
  }, [config, activeSessionID])

  useEffect(() => {
    refreshSessions()
  }, [refreshSessions])

  useEffect(() => {
    if (!activeSessionID) return
    setIsLoadingMessages(true)
    fetchMessages(activeSessionID, config)
      .then((result) => {
        setMessages((prev) => ({
          ...prev,
          [activeSessionID]: result,
        }))
      })
      .catch((error) => {
        console.error("Failed to load messages", error)
      })
      .finally(() => {
        setIsLoadingMessages(false)
      })
  }, [activeSessionID, config])

  const handleEvent = useCallback(
    (event: ServerEvent) => {
      if (event.type === "server.connected") {
        refreshSessions()
        return
      }
      if (event.type === "session.updated") {
        setSessions((prev) => mergeOrInsert(prev, event.properties.info))
        return
      }
      if (event.type === "session.deleted") {
        setSessions((prev) => removeSession(prev, event.properties.info.id))
        setMessages((prev) => {
          const next = { ...prev }
          delete next[event.properties.info.id]
          return next
        })
        if (activeSessionID === event.properties.info.id) {
          setActiveSessionID((prev) => {
            if (prev !== event.properties.info.id) return prev
            const remaining = sessions.filter((session) => session.id !== event.properties.info.id)
            return remaining.length ? remaining[0]!.id : undefined
          })
        }
        return
      }
      if (event.type === "session.idle") {
        setBusySessionIDs((prev) => {
          const next = new Set(prev)
          next.delete(event.properties.sessionID)
          return next
        })
        return
      }
      if (event.type === "session.error") {
        console.error("Session error", event.properties)
        setBusySessionIDs((prev) => {
          if (!event.properties.sessionID) return prev
          const next = new Set(prev)
          next.delete(event.properties.sessionID)
          return next
        })
        return
      }
      if (event.type === "message.updated") {
        setMessages((prev) => ({
          ...prev,
          [event.properties.info.sessionID]: mergeMessageInfo(prev[event.properties.info.sessionID] ?? [], event.properties.info),
        }))
        return
      }
      if (event.type === "message.removed") {
        setMessages((prev) => ({
          ...prev,
          [event.properties.sessionID]: removeMessage(prev[event.properties.sessionID] ?? [], event.properties.messageID),
        }))
        return
      }
      if (event.type === "message.part.updated") {
        setMessages((prev) => ({
          ...prev,
          [event.properties.part.sessionID]: mergeMessagePart(prev[event.properties.part.sessionID] ?? [], event.properties.part),
        }))
        return
      }
      if (event.type === "message.part.removed") {
        setMessages((prev) => ({
          ...prev,
          [event.properties.sessionID]: removeMessagePart(
            prev[event.properties.sessionID] ?? [],
            event.properties.messageID,
            event.properties.partID,
          ),
        }))
        return
      }
    },
    [activeSessionID, sessions, refreshSessions],
  )

  useEffect(() => {
    eventSubscription.current?.close()
    eventSubscription.current = subscribeEvents(handleEvent, config)
    return () => {
      eventSubscription.current?.close()
    }
  }, [config, handleEvent])

  const selectSession = useCallback((sessionID: string) => {
    setActiveSessionID(sessionID)
  }, [])

  const createSessionAction = useCallback(
    async (input?: { parentID?: string; title?: string }) => {
      const result = await createSession(input ?? {}, config)
      setSessions((prev) => mergeOrInsert(prev, result))
      setActiveSessionID(result.id)
      return result
    },
    [config],
  )

  const deleteSessionAction = useCallback(
    async (sessionID: string) => {
      await deleteSessionRequest(sessionID, config)
      setSessions((prev) => removeSession(prev, sessionID))
      setMessages((prev) => {
        const next = { ...prev }
        delete next[sessionID]
        return next
      })
      setActiveSessionID((current) => {
        if (current !== sessionID) return current
        const remaining = sessions.filter((session) => session.id !== sessionID)
        return remaining.length ? remaining[0]!.id : undefined
      })
    },
    [config, sessions],
  )

  const prompt = useCallback(
    async (sessionID: string, input: { text: string }) => {
      if (!input.text.trim()) return
      setBusySessionIDs((prev) => new Set(prev).add(sessionID))
      const payload: PromptInput = {
        parts: [
          {
            type: "text",
            text: input.text,
          },
        ],
      }
      try {
        const response = await sendPrompt(sessionID, payload, config)
        setMessages((prev) => ({
          ...prev,
          [sessionID]: mergeMessage(prev[sessionID] ?? [], response),
        }))
      } catch (error) {
        console.error("Failed to send prompt", error)
      } finally {
        setBusySessionIDs((prev) => {
          const next = new Set(prev)
          next.delete(sessionID)
          return next
        })
      }
    },
    [config],
  )

  const updateConfig = useCallback((input: Partial<OpencodeConfig>) => {
    setConfig((prev) => {
      const next = { ...prev, ...input }
      writeConfig(next)
      return next
    })
  }, [])

  const activeSession = useMemo(
    () => sessions.find((session) => session.id === activeSessionID),
    [sessions, activeSessionID],
  )

  const activeMessages = useMemo(() => {
    if (!activeSessionID) return []
    return messages[activeSessionID] ?? []
  }, [messages, activeSessionID])

  const value: OpencodeStateValue = {
    config,
    updateConfig,
    sessions,
    isLoadingSessions,
    isLoadingMessages,
    activeSessionID,
    activeSession,
    activeMessages,
    busySessionIDs,
    selectSession,
    refreshSessions,
    prompt,
    createSession: createSessionAction,
    deleteSession: deleteSessionAction,
  }

  return <OpencodeContext.Provider value={value}>{children}</OpencodeContext.Provider>
}

export function useOpencode() {
  const context = useContext(OpencodeContext)
  if (!context) throw new Error("useOpencode must be used within OpencodeProvider")
  return context
}

export type { SessionInfo, MessageWithParts } from "@/types/opencode"
