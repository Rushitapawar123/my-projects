'use client'

import { useEffect, useState } from 'react'
import { useCallStore } from '@/store/call-store'
import { AuthForm } from '@/components/auth/auth-form'
import { RoomLobby } from '@/components/room/lobby'
import { VideoGrid } from '@/components/video/video-call'
import { CallControls } from '@/components/call/call-controls'
import { ChatPanel } from '@/components/chat/chat-panel'
import { Whiteboard } from '@/components/whiteboard/whiteboard'
import { FileSharing } from '@/components/files/file-sharing'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Separator } from '@/components/ui/separator'

export default function Home() {
  const {
    isAuthenticated, currentRoomId, currentRoomName,
    roomUsers, activePanel, isConnected, userName,
  } = useCallStore()

  const setUser = useCallStore(s => s.setUser)
  const setAuthenticated = useCallStore(s => s.setAuthenticated)
  const [mounted, setMounted] = useState(false)

  // Check for existing session on mount
  useEffect(() => {
    const checkSession = async () => {
      try {
        const res = await fetch('/api/auth/me')
        const data = await res.json()
        if (data?.user) {
          setUser(data.user.id, data.user.name, data.user.email)
          setAuthenticated(true)
        }
      } catch (err) {
        // Not authenticated, show login
      }
    }
    checkSession()
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setMounted(true)
  }, [setUser, setAuthenticated])

  if (!mounted) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="flex flex-col items-center gap-4">
          <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-emerald-500 to-teal-600 flex items-center justify-center animate-pulse">
            <svg className="w-7 h-7 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
            </svg>
          </div>
          <p className="text-muted-foreground text-sm">Loading SyncSpace...</p>
        </div>
      </div>
    )
  }

  // Not authenticated - show auth form
  if (!isAuthenticated) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-b from-background to-emerald-50/30 p-4">
        <AuthForm />
      </div>
    )
  }

  // In a call - show video conference room
  if (currentRoomId) {
    return (
      <div className="h-screen flex flex-col bg-gray-950">
        {/* Room header */}
        <div className="flex items-center justify-between px-4 py-2 bg-gray-900 border-b border-gray-800">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-emerald-500 to-teal-600 flex items-center justify-center">
              <svg className="w-4 h-4 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
              </svg>
            </div>
            <div>
              <h2 className="text-white font-semibold text-sm">{currentRoomName}</h2>
              <div className="flex items-center gap-2">
                <span className="text-gray-400 text-xs">{roomUsers.length + 1} participant{roomUsers.length !== 0 ? 's' : ''}</span>
                <Badge variant="outline" className={`text-xs px-1.5 py-0 ${isConnected ? 'border-emerald-500 text-emerald-400' : 'border-red-500 text-red-400'}`}>
                  <span className={`w-1.5 h-1.5 rounded-full mr-1 inline-block ${isConnected ? 'bg-emerald-400' : 'bg-red-400'}`} />
                  {isConnected ? 'Connected' : 'Reconnecting'}
                </Badge>
              </div>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Badge variant="outline" className="text-xs border-emerald-500/50 text-emerald-400">
              <svg className="w-3 h-3 mr-1" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
              </svg>
              E2E Encrypted
            </Badge>
          </div>
        </div>

        {/* Main content area */}
        <div className="flex-1 flex min-h-0">
          {/* Video area */}
          <div className="flex-1 min-w-0">
            <VideoGrid />
          </div>

          {/* Side panel */}
          {activePanel && (
            <div className="w-80 border-l border-gray-800 bg-gray-900 flex-shrink-0 hidden sm:flex flex-col">
              {activePanel === 'chat' && <ChatPanel />}
              {activePanel === 'whiteboard' && <Whiteboard />}
              {activePanel === 'files' && <FileSharing />}
            </div>
          )}
        </div>

        {/* Mobile panel overlay */}
          {activePanel && (
            <div className="sm:hidden fixed inset-0 z-50 bg-gray-900">
              <div className="h-full flex flex-col">
                <div className="flex items-center justify-between p-3 border-b border-gray-800">
                  <h3 className="text-white font-semibold capitalize">{activePanel}</h3>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="text-gray-400"
                    onClick={() => useCallStore.getState().setActivePanel(null)}
                  >
                    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </Button>
                </div>
                <div className="flex-1 min-h-0">
                  {activePanel === 'chat' && <ChatPanel />}
                  {activePanel === 'whiteboard' && <Whiteboard />}
                  {activePanel === 'files' && <FileSharing />}
                </div>
              </div>
            </div>
          )}

        {/* Call controls */}
        <CallControls />
      </div>
    )
  }

  // Authenticated but not in a call - show lobby
  return (
    <div className="min-h-screen bg-background">
      {/* Nav bar */}
      <header className="border-b">
        <div className="max-w-6xl mx-auto px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-lg bg-gradient-to-br from-emerald-500 to-teal-600 flex items-center justify-center">
              <svg className="w-5 h-5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
              </svg>
            </div>
            <h1 className="text-xl font-bold">SyncSpace</h1>
          </div>
          <div className="flex items-center gap-3">
            <span className="text-sm text-muted-foreground">{userName}</span>
            <Button
              variant="ghost"
              size="sm"
              onClick={async () => {
                document.cookie = 'syncspace-session=; path=/; max-age=0'
                useCallStore.getState().setAuthenticated(false)
                useCallStore.getState().leaveRoom()
              }}
            >
              Sign Out
            </Button>
          </div>
        </div>
      </header>

      {/* Feature highlights */}
      <div className="border-b bg-gradient-to-b from-emerald-50/30 to-transparent">
        <div className="max-w-6xl mx-auto px-4 py-8">
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            {[
              { icon: 'M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z', label: 'Video Calls', desc: 'Multi-user WebRTC' },
              { icon: 'M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z', label: 'Screen Share', desc: 'Share your screen' },
              { icon: 'M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z', label: 'Whiteboard', desc: 'Collaborate visually' },
              { icon: 'M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z', label: 'Encrypted', desc: 'E2E security' },
            ].map((feature, i) => (
              <div key={i} className="flex flex-col items-center text-center p-3">
                <div className="w-10 h-10 rounded-lg bg-emerald-100 flex items-center justify-center mb-2">
                  <svg className="w-5 h-5 text-emerald-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d={feature.icon} />
                  </svg>
                </div>
                <span className="text-sm font-medium">{feature.label}</span>
                <span className="text-xs text-muted-foreground">{feature.desc}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Room lobby */}
      <div className="max-w-6xl mx-auto px-4 py-6">
        <RoomLobby />
      </div>
    </div>
  )
}

