'use client'

import { useState, useRef, useEffect } from 'react'
import { useCallStore } from '@/store/call-store'
import { useWebRTC } from '@/hooks/use-webrtc'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { Separator } from '@/components/ui/separator'

export function ChatPanel() {
  const [input, setInput] = useState('')
  const { messages, userId } = useCallStore()
  const { sendMessage } = useWebRTC()
  const scrollRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight
    }
  }, [messages])

  const handleSend = () => {
    if (!input.trim()) return
    sendMessage(input.trim())
    setInput('')
  }

  const formatTime = (timestamp: number) => {
    return new Date(timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
  }

  const formatFileSize = (bytes: number) => {
    if (bytes < 1024) return bytes + ' B'
    if (bytes < 1048576) return (bytes / 1024).toFixed(1) + ' KB'
    return (bytes / 1048576).toFixed(1) + ' MB'
  }

  return (
    <div className="flex flex-col h-full">
      <div className="p-4 border-b">
        <h3 className="font-semibold flex items-center gap-2">
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
          </svg>
          Chat
          <span className="text-xs text-muted-foreground font-normal ml-auto">
            {messages.length} messages
          </span>
        </h3>
      </div>

      <ScrollArea className="flex-1 p-4" ref={scrollRef}>
        <div className="space-y-3">
          {messages.length === 0 ? (
            <div className="text-center text-muted-foreground text-sm py-8">
              <svg className="w-8 h-8 mx-auto mb-2 opacity-50" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
              </svg>
              No messages yet. Say hello!
            </div>
          ) : (
            messages.map(msg => (
              <div key={msg.id} className={`${msg.type === 'system' ? 'text-center' : ''}`}>
                {msg.type === 'system' ? (
                  <p className="text-xs text-muted-foreground italic">{msg.content}</p>
                ) : (
                  <div className={`flex gap-2 ${msg.senderId === userId ? 'flex-row-reverse' : ''}`}>
                    <Avatar className="w-7 h-7 shrink-0">
                      <AvatarFallback className={`text-xs ${msg.senderId === userId ? 'bg-emerald-600 text-white' : 'bg-gray-200'}`}>
                        {msg.senderName?.charAt(0).toUpperCase()}
                      </AvatarFallback>
                    </Avatar>
                    <div className={`max-w-[75%] ${msg.senderId === userId ? 'text-right' : ''}`}>
                      <div className="flex items-center gap-2 mb-0.5">
                        <span className="text-xs font-medium">{msg.senderName}</span>
                        <span className="text-xs text-muted-foreground">{formatTime(msg.timestamp)}</span>
                      </div>
                      <div className={`inline-block px-3 py-1.5 rounded-xl text-sm ${
                        msg.senderId === userId
                          ? 'bg-emerald-600 text-white'
                          : 'bg-muted'
                      }`}>
                        {msg.type === 'file' ? (
                          <span className="flex items-center gap-1">
                            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                              <path strokeLinecap="round" strokeLinejoin="round" d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
                            </svg>
                            {msg.content}
                          </span>
                        ) : (
                          msg.content
                        )}
                      </div>
                    </div>
                  </div>
                )}
              </div>
            ))
          )}
        </div>
      </ScrollArea>

      <div className="p-3 border-t">
        <div className="flex gap-2">
          <Input
            value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && handleSend()}
            placeholder="Type a message..."
            className="flex-1"
          />
          <Button onClick={handleSend} disabled={!input.trim()} size="icon" className="bg-emerald-600 hover:bg-emerald-700">
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
            </svg>
          </Button>
        </div>
      </div>
    </div>
  )
}
