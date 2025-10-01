/* @refresh reload */
import { Router, Route } from "@solidjs/router"
import type { Component } from "solid-js"
import "@/index.css"
import Layout from "@/pages/layout"
import Home from "@/pages"
import {
  EventProvider,
  SDKProvider,
  SyncProvider,
  LocalProvider,
  ThemeProvider,
  ShikiProvider,
  MarkedProvider,
} from "@/context"

const App: Component = () => (
  <div class="h-full bg-background text-text-muted">
    <ThemeProvider defaultTheme="opencode" defaultDarkMode={true}>
      <ShikiProvider>
        <MarkedProvider>
          <SDKProvider>
            <EventProvider>
              <SyncProvider>
                <LocalProvider>
                  <Router root={Layout}>
                    <Route path="/" component={Home} />
                  </Router>
                </LocalProvider>
              </SyncProvider>
            </EventProvider>
          </SDKProvider>
        </MarkedProvider>
      </ShikiProvider>
    </ThemeProvider>
  </div>
)

export default App
