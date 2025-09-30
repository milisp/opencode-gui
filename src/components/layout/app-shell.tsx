import type { ReactNode } from "react"
import { cn } from "@/lib/utils"

interface AppShellProps {
  sidebar: ReactNode
  header?: ReactNode
  children: ReactNode
  footer?: ReactNode
}

export function AppShell({ sidebar, header, children, footer }: AppShellProps) {
  return (
    <div className="flex h-screen w-screen bg-background text-foreground">
      <aside className="hidden w-72 shrink-0 border-r border-border/60 bg-sidebar text-sidebar-foreground md:flex">
        <div className="flex h-full w-full flex-col overflow-hidden">{sidebar}</div>
      </aside>
      <main className="flex flex-1 flex-col overflow-hidden">
        {header ? <header className="border-b border-border/60 bg-background/80 backdrop-blur supports-[backdrop-filter]:bg-background/60">{header}</header> : null}
        <section className="flex flex-1 flex-col overflow-hidden">{children}</section>
        {footer ? <footer className={cn("border-t border-border/60 bg-background/80")}>{footer}</footer> : null}
      </main>
    </div>
  )
}
