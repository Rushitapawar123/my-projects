'use client'

import { useEffect, useRef } from 'react'
import { useCallStore } from '@/store/call-store'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { Badge } from '@/components/ui/badge'

export function VideoGrid() {
  const { localStream, roomUsers, isMuted, isVideoOff, isScreenSharing, screenStream } = useCallStore()
  const localVideoRef = useRef<HTMLVideoElement>(null)
  const remoteVideoRefs = useRef<Map<string, HTMLVideoElement>>(new Map())

  // Attach local stream
  useEffect(() => {
    if (localVideoRef.current && localStream) {
      localVideoRef.current.srcObject = localStream
    }
  }, [localStream])

  // Attach remote streams
  useEffect(() => {
    roomUsers.forEach(user => {
      if (user.stream) {
        const videoEl = remoteVideoRefs.current.get(user.socketId)
        if (videoEl) {
          videoEl.srcObject = user.stream
        }
      }
    })
  }, [roomUsers])

  const totalUsers = roomUsers.length + 1 // +1 for local user

  const getGridClass = () => {
    if (totalUsers === 1) return 'grid-cols-1'
    if (totalUsers === 2) return 'grid-cols-1 sm:grid-cols-2'
    if (totalUsers <= 4) return 'grid-cols-2'
    if (totalUsers <= 6) return 'grid-cols-2 sm:grid-cols-3'
    return 'grid-cols-2 sm:grid-cols-3 lg:grid-cols-4'
  }

  return (
    <div className={`grid ${getGridClass()} gap-3 h-full p-3 auto-rows-fr`}>
      {/* Local video */}
      <div className="relative rounded-xl overflow-hidden bg-gray-900 group">
        <video
          ref={localVideoRef}
          autoPlay
          playsInline
          muted
          className={`w-full h-full object-cover ${isVideoOff ? 'hidden' : ''}`}
          style={{ transform: 'scaleX(-1)' }}
        />
        {isVideoOff && (
          <div className="absolute inset-0 flex items-center justify-center bg-gray-800">
            <Avatar className="w-20 h-20">
              <AvatarFallback className="text-2xl bg-emerald-600 text-white">
                {useCallStore.getState().userName?.charAt(0).toUpperCase() || 'U'}
              </AvatarFallback>
            </Avatar>
          </div>
        )}
        <div className="absolute bottom-0 left-0 right-0 p-3 bg-gradient-to-t from-black/60 to-transparent">
          <div className="flex items-center justify-between">
            <span className="text-white text-sm font-medium">
              You {isMuted && '(Muted)'}
            </span>
            <div className="flex gap-1">
              {isMuted && (
                <Badge variant="destructive" className="text-xs px-1.5 py-0">
                  <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M5.586 15H4a1 1 0 01-1-1v-4a1 1 0 011-1h1.586l4.707-4.707C10.923 3.663 12 4.109 12 5v14c0 .891-1.077 1.337-1.707.707L5.586 15z" />
                    <path strokeLinecap="round" strokeLinejoin="round" d="M17 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2" />
                  </svg>
                </Badge>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Remote videos */}
      {roomUsers.map(user => (
        <div key={user.socketId} className="relative rounded-xl overflow-hidden bg-gray-900">
          <video
            ref={el => {
              if (el) {
                remoteVideoRefs.current.set(user.socketId, el)
                if (user.stream) {
                  el.srcObject = user.stream
                }
              }
            }}
            autoPlay
            playsInline
            className="w-full h-full object-cover"
          />
          <div className="absolute bottom-0 left-0 right-0 p-3 bg-gradient-to-t from-black/60 to-transparent">
            <div className="flex items-center justify-between">
              <span className="text-white text-sm font-medium">{user.username}</span>
              {user.isScreenSharing && (
                <Badge className="text-xs bg-emerald-600">Sharing</Badge>
              )}
            </div>
          </div>
        </div>
      ))}

      {/* Screen share view */}
      {isScreenSharing && screenStream && (
        <div className="relative rounded-xl overflow-hidden bg-gray-900 col-span-2 row-span-2">
          <video
            ref={el => {
              if (el) el.srcObject = screenStream
            }}
            autoPlay
            playsInline
            className="w-full h-full object-contain"
          />
          <div className="absolute bottom-0 left-0 right-0 p-3 bg-gradient-to-t from-black/60 to-transparent">
            <span className="text-white text-sm font-medium">Your Screen</span>
          </div>
        </div>
      )}
    </div>
  )
}
