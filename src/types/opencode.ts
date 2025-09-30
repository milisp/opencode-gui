export interface SessionTime {
  created: number
  updated: number
  compacting?: number
}

export interface SessionInfo {
  id: string
  projectID: string
  directory: string
  parentID?: string
  share?: {
    url: string
  }
  title: string
  version: string
  time: SessionTime
  revert?: {
    messageID: string
    partID?: string
    snapshot?: string
    diff?: string
  }
}

export interface AssistantUsage {
  input: number
  output: number
  reasoning?: number
  cache?: {
    write: number
    read: number
  }
}

export interface AssistantTime {
  created: number
  completed?: number
}

export type MessageRole = "assistant" | "user"

export interface AssistantMessageInfo {
  id: string
  sessionID: string
  role: "assistant"
  time: AssistantTime
  cost?: number
  path?: string
  summary?: string
  tokens?: AssistantUsage
  modelID?: string
  providerID?: string
  system?: string
  mode?: string
  error?: {
    name: string
    message: string
    stack?: string
    data?: Record<string, unknown>
  }
}

export interface UserMessageInfo {
  id: string
  sessionID: string
  role: "user"
  time: {
    created: number
  }
  origin?: string
}

export type MessageInfo = AssistantMessageInfo | UserMessageInfo

export interface PartBase<T extends string> {
  id: string
  messageID: string
  sessionID: string
  type: T
}

export interface TextPart extends PartBase<"text"> {
  text: string
  synthetic?: boolean
  metadata?: Record<string, unknown>
  time?: {
    start: number
    end?: number
  }
}

export interface ReasoningPart extends PartBase<"reasoning"> {
  text: string
  metadata?: Record<string, unknown>
  time: {
    start: number
    end?: number
  }
}

export interface FileSourceText {
  value: string
  start: number
  end: number
}

export interface FileSourceBase<T extends string> {
  type: T
  text: FileSourceText
}

export interface FileSourceFile extends FileSourceBase<"file"> {
  path: string
}

export interface FileSourceSymbol extends FileSourceBase<"symbol"> {
  path: string
  range: {
    start: {
      line: number
      character: number
    }
    end: {
      line: number
      character: number
    }
  }
  name: string
  kind: number
}

export type FilePartSource = FileSourceFile | FileSourceSymbol

export interface FilePart extends PartBase<"file"> {
  mime: string
  filename?: string
  url: string
  source?: FilePartSource
}

export interface PatchPart extends PartBase<"patch"> {
  hash: string
  files: string[]
}

export interface SnapshotPart extends PartBase<"snapshot"> {
  snapshot: string
}

export interface ToolStatePending {
  status: "pending"
}

export interface ToolStateRunning {
  status: "running"
  input: unknown
  title?: string
  metadata?: Record<string, unknown>
  time: {
    start: number
  }
}

export interface ToolStateCompleted {
  status: "completed"
  input: Record<string, unknown>
  output: string
  title: string
  metadata: Record<string, unknown>
  time: {
    start: number
    end: number
    compacted?: number
  }
}

export interface ToolStateError {
  status: "error"
  input: Record<string, unknown>
  error: string
  metadata?: Record<string, unknown>
  time: {
    start: number
    end: number
  }
}

export type ToolState = ToolStatePending | ToolStateRunning | ToolStateCompleted | ToolStateError

export interface ToolPart extends PartBase<"tool"> {
  callID: string
  tool: string
  state: ToolState
  metadata?: Record<string, unknown>
}

export type MessagePart =
  | TextPart
  | FilePart
  | ReasoningPart
  | ToolPart
  | PatchPart
  | SnapshotPart

export interface MessageWithParts {
  info: MessageInfo
  parts: MessagePart[]
}

export interface SessionResponse {
  sessions: SessionInfo[]
}

export interface SessionListResult extends Array<SessionInfo> {}

export interface MessageListResult extends Array<MessageWithParts> {}

export interface MessageCreatedEvent {
  type: "message.created"
  properties: {
    info: MessageInfo
    parts: MessagePart[]
  }
}

export interface MessageUpdatedEvent {
  type: "message.updated"
  properties: {
    info: MessageInfo
  }
}

export interface MessageRemovedEvent {
  type: "message.removed"
  properties: {
    sessionID: string
    messageID: string
  }
}

export interface MessagePartUpdatedEvent {
  type: "message.part.updated"
  properties: {
    part: MessagePart
  }
}

export interface MessagePartRemovedEvent {
  type: "message.part.removed"
  properties: {
    sessionID: string
    messageID: string
    partID: string
  }
}

export interface SessionUpdatedEvent {
  type: "session.updated"
  properties: {
    info: SessionInfo
  }
}

export interface SessionDeletedEvent {
  type: "session.deleted"
  properties: {
    info: SessionInfo
  }
}

export interface SessionErrorEvent {
  type: "session.error"
  properties: {
    sessionID?: string
    error: AssistantMessageInfo["error"]
  }
}

export interface SessionIdleEvent {
  type: "session.idle"
  properties: {
    sessionID: string
  }
}

export type ServerEvent =
  | { type: "server.connected"; properties: Record<string, never> }
  | MessageCreatedEvent
  | MessageUpdatedEvent
  | MessageRemovedEvent
  | MessagePartUpdatedEvent
  | MessagePartRemovedEvent
  | SessionUpdatedEvent
  | SessionDeletedEvent
  | SessionErrorEvent
  | SessionIdleEvent

export interface PromptInputPartText {
  type: "text"
  text: string
}

export interface PromptInput {
  model?: {
    providerID: string
    modelID: string
  }
  agent?: string
  system?: string
  tools?: Record<string, boolean>
  parts: PromptInputPartText[]
}

export interface PromptResponse extends MessageWithParts {}
