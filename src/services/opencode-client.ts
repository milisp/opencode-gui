import type {
  MessageListResult,
  MessageWithParts,
  PromptInput,
  PromptResponse,
  ServerEvent,
  SessionInfo,
  SessionListResult,
} from "@/types/opencode"

export interface OpencodeConfig {
  baseUrl: string
  directory?: string
}

const CONFIG_STORAGE_KEY = "opencode.config"
const DEFAULT_BASE_URL = import.meta.env.VITE_OPENCODE_URL ?? "http://127.0.0.1:4096"

function resolveUrl(path: string, config: OpencodeConfig): string {
  const url = new URL(path, config.baseUrl)
  if (config.directory) {
    url.searchParams.set("directory", config.directory)
  }
  return url.toString()
}

export function readConfig(): OpencodeConfig {
  if (typeof window === "undefined") {
    return { baseUrl: DEFAULT_BASE_URL }
  }
  try {
    const raw = window.localStorage.getItem(CONFIG_STORAGE_KEY)
    if (!raw) return { baseUrl: DEFAULT_BASE_URL }
    const parsed = JSON.parse(raw)
    if (typeof parsed !== "object" || parsed === null) {
      throw new Error("invalid config")
    }
    return {
      baseUrl: typeof parsed.baseUrl === "string" ? parsed.baseUrl : DEFAULT_BASE_URL,
      directory: typeof parsed.directory === "string" ? parsed.directory : undefined,
    }
  } catch (error) {
    console.warn("failed to read opencode config", error)
    return { baseUrl: DEFAULT_BASE_URL }
  }
}

export function writeConfig(next: OpencodeConfig) {
  if (typeof window === "undefined") return
  window.localStorage.setItem(CONFIG_STORAGE_KEY, JSON.stringify(next))
}

async function request<T>(path: string, init?: RequestInit, config = readConfig()): Promise<T> {
  const url = resolveUrl(path, config)
  const response = await fetch(url, {
    ...init,
    headers: {
      "content-type": "application/json",
      ...(init?.headers ?? {}),
    },
  })
  if (!response.ok) {
    const message = await response.text()
    throw new Error(`Request failed (${response.status}): ${message}`)
  }
  return response.json() as Promise<T>
}

export async function fetchSessions(config?: OpencodeConfig): Promise<SessionListResult> {
  return request<SessionListResult>("/session", { method: "GET" }, config)
}

export async function fetchSession(sessionID: string, config?: OpencodeConfig): Promise<SessionInfo> {
  return request<SessionInfo>(`/session/${encodeURIComponent(sessionID)}`, { method: "GET" }, config)
}

export async function fetchMessages(sessionID: string, config?: OpencodeConfig): Promise<MessageListResult> {
  return request<MessageListResult>(`/session/${encodeURIComponent(sessionID)}/message`, { method: "GET" }, config)
}

export async function createSession(input: { parentID?: string; title?: string }, config?: OpencodeConfig): Promise<SessionInfo> {
  return request<SessionInfo>("/session", {
    method: "POST",
    body: JSON.stringify(input),
  }, config)
}

export async function deleteSession(sessionID: string, config?: OpencodeConfig): Promise<void> {
  await request(`/session/${encodeURIComponent(sessionID)}`, { method: "DELETE" }, config)
}

export async function sendPrompt(sessionID: string, input: PromptInput, config?: OpencodeConfig): Promise<PromptResponse> {
  return request<MessageWithParts>(`/session/${encodeURIComponent(sessionID)}/message`, {
    method: "POST",
    body: JSON.stringify(input),
  }, config)
}

export type EventSubscription = {
  close: () => void
}

export function subscribeEvents(onEvent: (event: ServerEvent) => void, config = readConfig()): EventSubscription {
  const url = resolveUrl("/event", config)
  const source = new EventSource(url)
  source.onmessage = (message) => {
    try {
      const parsed = JSON.parse(message.data) as ServerEvent
      if (!parsed?.type) return
      onEvent(parsed)
    } catch (error) {
      console.warn("Failed to parse SSE message", error)
    }
  }
  source.onerror = (error) => {
    console.warn("SSE error", error)
  }
  return {
    close: () => source.close(),
  }
}

export function updateBaseUrl(baseUrl: string) {
  const current = readConfig()
  const next: OpencodeConfig = {
    ...current,
    baseUrl,
  }
  writeConfig(next)
}

export function updateDirectory(directory?: string) {
  const current = readConfig()
  const next: OpencodeConfig = {
    ...current,
    directory,
  }
  writeConfig(next)
}
