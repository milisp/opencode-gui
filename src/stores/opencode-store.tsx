import { useEffect, type ReactNode } from "react"
import { create } from "zustand"
import {
  createSession as apiCreateSession,
  deleteSession as apiDeleteSession,
  fetchMessages as apiFetchMessages,
  fetchSessions as apiFetchSessions,
  readConfig,
  sendPrompt as apiSendPrompt,
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

interface MessageMap {
  [sessionID: string]: MessageWithParts[]
}

interface OpencodeStoreState {
  config: OpencodeConfig
  sessions: SessionInfo[]
  messages: MessageMap
  activeSessionID?: string
  activeSession?: SessionInfo
  activeMessages: MessageWithParts[]
  isLoadingSessions: boolean
  isLoadingMessages: boolean
  busySessionIDs: Set<string>
  lastError?: string
  updateConfig: (input: Partial<OpencodeConfig>) => void
  selectSession: (sessionID: string) => void
  refreshSessions: () => Promise<void>
  loadMessages: (sessionID: string) => Promise<void>
  createSession: (input?: { parentID?: string; title?: string }) => Promise<SessionInfo>
  deleteSession: (sessionID: string) => Promise<void>
  prompt: (sessionID: string, input: { text: string }) => Promise<void>
  mergeSession: (session: SessionInfo) => void
  removeSessionState: (sessionID: string) => void
  mergeMessage: (message: MessageWithParts) => void
  updateMessageInfo: (info: MessageWithParts["info"]) => void
  updateMessagePart: (part: MessagePart) => void
  removeMessagePart: (sessionID: string, messageID: string, partID: string) => void
  removeMessage: (sessionID: string, messageID: string) => void
  setBusy: (sessionID: string, busy: boolean) => void
  setLastError: (message?: string) => void
  clearError: () => void
}

function mergeSessions(list: SessionInfo[], next: SessionInfo): SessionInfo[] {
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

function mergeMessageList(list: MessageWithParts[], next: MessageWithParts): MessageWithParts[] {
  const index = list.findIndex((item) => item.info.id === next.info.id)
  if (index >= 0) {
    const copy = [...list]
    copy[index] = next
    copy.sort((a, b) => (a.info.time.created ?? 0) - (b.info.time.created ?? 0))
    return copy
  }
  const copy = [...list, next]
  copy.sort((a, b) => (a.info.time.created ?? 0) - (b.info.time.created ?? 0))
  return copy
}

function mergeMessageInfoList(list: MessageWithParts[], info: MessageWithParts["info"]): MessageWithParts[] {
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

function mergeMessagePartList(list: MessageWithParts[], part: MessagePart): MessageWithParts[] {
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

function removeMessagePartFromList(list: MessageWithParts[], messageID: string, partID: string): MessageWithParts[] {
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

function removeMessageFromList(list: MessageWithParts[], messageID: string): MessageWithParts[] {
  return list.filter((item) => item.info.id !== messageID)
}

export const useOpencodeStore = create<OpencodeStoreState>((set, get) => ({
  config: readConfig(),
  sessions: [],
  messages: {},
  activeSessionID: undefined,
  activeSession: undefined,
  activeMessages: [],
  isLoadingSessions: false,
  isLoadingMessages: false,
  busySessionIDs: new Set<string>(),
  lastError: undefined,

  updateConfig: (input) => {
    set((state) => {
      const nextConfig: OpencodeConfig = {
        ...state.config,
        ...input,
      }
      writeConfig(nextConfig)
      return {
        config: nextConfig,
      }
    })
  },

  selectSession: (sessionID) => {
    set((state) => {
      const session = state.sessions.find((item) => item.id === sessionID)
      const activeMessages = state.messages[sessionID] ?? []
      return {
        activeSessionID: sessionID,
        activeSession: session,
        activeMessages,
      }
    })
  },

  refreshSessions: async () => {
    const { config } = get()
    set({ isLoadingSessions: true })
    try {
      const result = await apiFetchSessions(config)
      const sorted = [...result].sort((a, b) => b.time.updated - a.time.updated)
      set((state) => {
        const nextActiveID = state.activeSessionID && sorted.some((item) => item.id === state.activeSessionID)
          ? state.activeSessionID
          : sorted[0]?.id
        return {
          sessions: sorted,
          activeSessionID: nextActiveID,
          activeSession: nextActiveID ? sorted.find((item) => item.id === nextActiveID) : undefined,
          activeMessages: nextActiveID ? state.messages[nextActiveID] ?? [] : [],
          isLoadingSessions: false,
        }
      })
    } catch (error) {
      set({
        isLoadingSessions: false,
        lastError: error instanceof Error ? error.message : String(error),
      })
    }
  },

  loadMessages: async (sessionID) => {
    const { config } = get()
    set({ isLoadingMessages: true })
    try {
      const result = await apiFetchMessages(sessionID, config)
      set((state) => {
        const messages: MessageMap = {
          ...state.messages,
          [sessionID]: result,
        }
        const activeMessages = state.activeSessionID === sessionID ? result : state.activeMessages
        return {
          messages,
          activeMessages,
          isLoadingMessages: false,
        }
      })
    } catch (error) {
      set({
        isLoadingMessages: false,
        lastError: error instanceof Error ? error.message : String(error),
      })
    }
  },

  createSession: async (input) => {
    const { config } = get()
    const session = await apiCreateSession(input ?? {}, config)
    set((state) => {
      const sessions = mergeSessions(state.sessions, session)
      return {
        sessions,
        activeSessionID: session.id,
        activeSession: session,
        activeMessages: state.messages[session.id] ?? [],
      }
    })
    return session
  },

  deleteSession: async (sessionID) => {
    const { config } = get()
    await apiDeleteSession(sessionID, config)
    set((state) => {
      const sessions = removeSession(state.sessions, sessionID)
      const messages = { ...state.messages }
      delete messages[sessionID]
      const nextActiveID = state.activeSessionID === sessionID ? sessions[0]?.id : state.activeSessionID
      return {
        sessions,
        messages,
        activeSessionID: nextActiveID,
        activeSession: nextActiveID ? sessions.find((item) => item.id === nextActiveID) : undefined,
        activeMessages: nextActiveID ? messages[nextActiveID] ?? [] : [],
        busySessionIDs: (() => {
          const next = new Set(state.busySessionIDs)
          next.delete(sessionID)
          return next
        })(),
      }
    })
  },

  prompt: async (sessionID, input) => {
    const text = input.text.trim()
    if (!text) return
    const payload: PromptInput = {
      parts: [
        {
          type: "text",
          text,
        },
      ],
    }
    get().setBusy(sessionID, true)
    try {
      const { config } = get()
      const response = await apiSendPrompt(sessionID, payload, config)
      set((state) => {
        const messages = {
          ...state.messages,
          [sessionID]: mergeMessageList(state.messages[sessionID] ?? [], response),
        }
        const activeMessages = state.activeSessionID === sessionID ? messages[sessionID]! : state.activeMessages
        return {
          messages,
          activeMessages,
        }
      })
    } catch (error) {
      set({
        lastError:
          error instanceof Error
            ? error.message
            : typeof error === "string"
            ? error
            : "Failed to send prompt",
      })
    } finally {
      get().setBusy(sessionID, false)
    }
  },

  mergeSession: (session) => {
    set((state) => {
      const sessions = mergeSessions(state.sessions, session)
      const isActive = state.activeSessionID === session.id
      return {
        sessions,
        activeSession: isActive ? session : state.activeSession,
      }
    })
  },

  removeSessionState: (sessionID) => {
    set((state) => {
      const sessions = removeSession(state.sessions, sessionID)
      const messages = { ...state.messages }
      delete messages[sessionID]
      const nextActiveID = state.activeSessionID === sessionID ? sessions[0]?.id : state.activeSessionID
      return {
        sessions,
        messages,
        activeSessionID: nextActiveID,
        activeSession: nextActiveID ? sessions.find((item) => item.id === nextActiveID) : undefined,
        activeMessages: nextActiveID ? messages[nextActiveID] ?? [] : [],
        busySessionIDs: (() => {
          const next = new Set(state.busySessionIDs)
          next.delete(sessionID)
          return next
        })(),
      }
    })
  },

  mergeMessage: (message) => {
    set((state) => {
      const sessionID = message.info.sessionID
      const messages = {
        ...state.messages,
        [sessionID]: mergeMessageList(state.messages[sessionID] ?? [], message),
      }
      const activeMessages = state.activeSessionID === sessionID ? messages[sessionID]! : state.activeMessages
      return {
        messages,
        activeMessages,
      }
    })
  },

  updateMessageInfo: (info) => {
    set((state) => {
      const sessionID = info.sessionID
      const existing = state.messages[sessionID]
      if (!existing) return {}
      const messages = {
        ...state.messages,
        [sessionID]: mergeMessageInfoList(existing, info),
      }
      const activeMessages = state.activeSessionID === sessionID ? messages[sessionID]! : state.activeMessages
      return {
        messages,
        activeMessages,
      }
    })
  },

  updateMessagePart: (part) => {
    set((state) => {
      const sessionID = part.sessionID
      const existing = state.messages[sessionID]
      if (!existing) return {}
      const messages = {
        ...state.messages,
        [sessionID]: mergeMessagePartList(existing, part),
      }
      const activeMessages = state.activeSessionID === sessionID ? messages[sessionID]! : state.activeMessages
      return {
        messages,
        activeMessages,
      }
    })
  },

  removeMessagePart: (sessionID, messageID, partID) => {
    set((state) => {
      const existing = state.messages[sessionID]
      if (!existing) return {}
      const messages = {
        ...state.messages,
        [sessionID]: removeMessagePartFromList(existing, messageID, partID),
      }
      const activeMessages = state.activeSessionID === sessionID ? messages[sessionID]! : state.activeMessages
      return {
        messages,
        activeMessages,
      }
    })
  },

  removeMessage: (sessionID, messageID) => {
    set((state) => {
      const existing = state.messages[sessionID]
      if (!existing) return {}
      const messages = {
        ...state.messages,
        [sessionID]: removeMessageFromList(existing, messageID),
      }
      const activeMessages = state.activeSessionID === sessionID ? messages[sessionID]! : state.activeMessages
      return {
        messages,
        activeMessages,
      }
    })
  },

  setBusy: (sessionID, busy) => {
    if (!sessionID) return
    set((state) => {
      const next = new Set(state.busySessionIDs)
      if (busy) {
        next.add(sessionID)
      } else {
        next.delete(sessionID)
      }
      return {
        busySessionIDs: next,
      }
    })
  },

  setLastError: (message) => {
    set({ lastError: message })
  },

  clearError: () => {
    set({ lastError: undefined })
  },
}))

export function OpencodeProvider({ children }: { children: ReactNode }) {
  const config = useOpencodeStore((state) => state.config)
  const refreshSessions = useOpencodeStore((state) => state.refreshSessions)
  const loadMessages = useOpencodeStore((state) => state.loadMessages)
  const activeSessionID = useOpencodeStore((state) => state.activeSessionID)

  useEffect(() => {
    refreshSessions()
  }, [refreshSessions, config.baseUrl, config.directory])

  useEffect(() => {
    if (!activeSessionID) return
    loadMessages(activeSessionID)
  }, [activeSessionID, loadMessages])

  useEffect(() => {
    const subscription = subscribeEvents((event: ServerEvent) => {
      const store = useOpencodeStore.getState()
      switch (event.type) {
        case "server.connected":
          store.refreshSessions()
          break
        case "session.updated":
          store.mergeSession(event.properties.info)
          break
        case "session.deleted":
          store.removeSessionState(event.properties.info.id)
          break
        case "session.idle":
          store.setBusy(event.properties.sessionID, false)
          break
        case "session.error": {
          if (event.properties.sessionID) {
            store.setBusy(event.properties.sessionID, false)
          }
          const rawMessage = event.properties.error?.data?.message ?? event.properties.error?.message
          const message =
            typeof rawMessage === "string"
              ? rawMessage
              : rawMessage != null
              ? JSON.stringify(rawMessage)
              : "Session error"
          store.setLastError(message)
          break
        }
        case "message.created":
          store.mergeMessage({
            info: event.properties.info,
            parts: event.properties.parts,
          })
          break
        case "message.updated":
          store.updateMessageInfo(event.properties.info)
          break
        case "message.removed":
          store.removeMessage(event.properties.sessionID, event.properties.messageID)
          break
        case "message.part.updated":
          store.updateMessagePart(event.properties.part)
          break
        case "message.part.removed":
          store.removeMessagePart(event.properties.sessionID, event.properties.messageID, event.properties.partID)
          break
        default:
          break
      }
    }, config)
    return () => {
      subscription.close()
    }
  }, [config.baseUrl, config.directory])

  return <>{children}</>
}

export type { SessionInfo, MessageWithParts } from "@/types/opencode"
