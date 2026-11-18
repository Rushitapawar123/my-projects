'use client'

import { useCallStore, ActivePanel } from '@/store/call-store'
import { useWebRTC } from '@/hooks/use-webrtc'
import { Button } from '@/components/ui/button'
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip'
import { toast } from '@/hooks/use-toast'

export function CallControls() {
  const {
    isMuted, isVideoOff, isScreenSharing,
    activePanel, setActivePanel, currentRoomId,
  } = useCallStore()

  const {
    toggleMute, toggleVideo, startScreenShare,
    stopScreenShare, leaveRoom, sendMessage,
    sendWhiteboardAction, sendWhiteboardClear,
  } = useWebRTC()

  const handleToggleMic = () => {
    useCallStore.getState().toggleMute()
  }

  const handleToggleVideo = () => {
    useCallStore.getState().toggleVideo()
  }

  const handleScreenShare = async () => {
    if (isScreenSharing) {
      stopScreenShare()
    } else {
      const stream = await startScreenShare()
      if (!stream) {
        toast({ title: 'Screen Share Failed', description: 'Could not start screen sharing', variant: 'destructive' })
      }
    }
  }

  const handleLeave = () => {
    leaveRoom()
  }

  const copyRoomId = () => {
    if (currentRoomId) {
      navigator.clipboard.writeText(currentRoomId)
      toast({ title: 'Copied!', description: 'Room ID copied to clipboard' })
    }
  }

  return (
    <TooltipProvider>
      <div className="flex items-center justify-center gap-2 sm:gap-3 p-3 bg-background/80 backdrop-blur border-t">
        {/* Mic */}
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant={isMuted ? 'destructive' : 'secondary'}
              size="icon"
              className="rounded-full h-11 w-11"
              onClick={handleToggleMic}
            >
              {isMuted ? (
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M5.586 15H4a1 1 0 01-1-1v-4a1 1 0 011-1h1.586l4.707-4.707C10.923 3.663 12 4.109 12 5v14c0 .891-1.077 1.337-1.707.707L5.586 15z" />
                  <path strokeLinecap="round" strokeLinejoin="round" d="M17 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2" />
                </svg>
              ) : (
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M15.536 8.464a5 5 0 010 7.072m2.828-9.9a9 9 0 010 12.728M5.586 15H4a1 1 0 01-1-1v-4a1 1 0 011-1h1.586l4.707-4.707C10.923 3.663 12 4.109 12 5v14c0 .891-1.077 1.337-1.707.707L5.586 15z" />
                </svg>
              )}
            </Button>
          </TooltipTrigger>
          <TooltipContent>{isMuted ? 'Unmute' : 'Mute'}</TooltipContent>
        </Tooltip>

        {/* Video */}
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant={isVideoOff ? 'destructive' : 'secondary'}
              size="icon"
              className="rounded-full h-11 w-11"
              onClick={handleToggleVideo}
            >
              {isVideoOff ? (
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
                  <path strokeLinecap="round" strokeLinejoin="round" d="M3 3l18 18" />
                </svg>
              ) : (
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
                </svg>
              )}
            </Button>
          </TooltipTrigger>
          <TooltipContent>{isVideoOff ? 'Turn on camera' : 'Turn off camera'}</TooltipContent>
        </Tooltip>

        {/* Screen share */}
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant={isScreenSharing ? 'default' : 'secondary'}
              size="icon"
              className={`rounded-full h-11 w-11 ${isScreenSharing ? 'bg-emerald-600 hover:bg-emerald-700' : ''}`}
              onClick={handleScreenShare}
            >
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
              </svg>
            </Button>
          </TooltipTrigger>
          <TooltipContent>{isScreenSharing ? 'Stop sharing' : 'Share screen'}</TooltipContent>
        </Tooltip>

        <div className="w-px h-8 bg-border mx-1" />

        {/* Chat */}
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant={activePanel === 'chat' ? 'default' : 'secondary'}
              size="icon"
              className={`rounded-full h-11 w-11 ${activePanel === 'chat' ? 'bg-emerald-600 hover:bg-emerald-700' : ''}`}
              onClick={() => setActivePanel('chat')}
            >
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
              </svg>
            </Button>
          </TooltipTrigger>
          <TooltipContent>Chat</TooltipContent>
        </Tooltip>

        {/* Whiteboard */}
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant={activePanel === 'whiteboard' ? 'default' : 'secondary'}
              size="icon"
              className={`rounded-full h-11 w-11 ${activePanel === 'whiteboard' ? 'bg-emerald-600 hover:bg-emerald-700' : ''}`}
              onClick={() => setActivePanel('whiteboard')}
            >
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
              </svg>
            </Button>
          </TooltipTrigger>
          <TooltipContent>Whiteboard</TooltipContent>
        </Tooltip>

        {/* Files */}
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant={activePanel === 'files' ? 'default' : 'secondary'}
              size="icon"
              className={`rounded-full h-11 w-11 ${activePanel === 'files' ? 'bg-emerald-600 hover:bg-emerald-700' : ''}`}
              onClick={() => setActivePanel('files')}
            >
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
              </svg>
            </Button>
          </TooltipTrigger>
          <TooltipContent>Files</TooltipContent>
        </Tooltip>

        <div className="w-px h-8 bg-border mx-1" />

        {/* Copy Room ID */}
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant="secondary"
              size="icon"
              className="rounded-full h-11 w-11"
              onClick={copyRoomId}
            >
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
              </svg>
            </Button>
          </TooltipTrigger>
          <TooltipContent>Copy Room ID</TooltipContent>
        </Tooltip>

        {/* Leave */}
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant="destructive"
              size="icon"
              className="rounded-full h-11 w-11"
              onClick={handleLeave}
            >
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
              </svg>
            </Button>
          </TooltipTrigger>
          <TooltipContent>Leave Call</TooltipContent>
        </Tooltip>
      </div>
    </TooltipProvider>
  )
}
