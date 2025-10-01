import { AppShell } from "@/components/layout/app-shell"
import { SessionSidebar } from "@/components/chat/session-sidebar"
import { ChatHeader } from "@/components/chat/chat-header"
import { ChatTimeline } from "@/components/chat/chat-timeline"
import { ChatComposer } from "@/components/chat/chat-composer"
import { OpencodeProvider } from "@/stores/opencode-store"
import "./App.css"

function App() {
  return (
    <OpencodeProvider>
      <AppShell sidebar={<SessionSidebar />} header={<ChatHeader />} footer={<ChatComposer />}>
        <ChatTimeline />
      </AppShell>
    </OpencodeProvider>
  )
}

export default App
