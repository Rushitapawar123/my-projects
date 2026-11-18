import { create } from 'zustand'

export interface RoomUser {
  socketId: string
  userId: string
  username: string
  avatar: string | null
  isScreenSharing: boolean
  stream?: MediaStream | null
}

export interface ChatMessage {
  id: string
  roomId: string
  senderId: string
  senderName: string
  content: string
  type: 'text' | 'system' | 'file'
  timestamp: number
}

export interface SharedFileInfo {
  id: string
  name: string
  size: number
  mimeType: string
  data?: string
  senderName: string
}

export type ActivePanel = 'chat' | 'whiteboard' | 'files' | null

interface CallState {
  // Auth
  userId: string | null
  userName: string | null
  userEmail: string | null
  isAuthenticated: boolean

  // Room
  currentRoomId: string | null
  currentRoomName: string | null
  roomUsers: RoomUser[]

  // Media
  localStream: MediaStream | null
  screenStream: MediaStream | null
  isMuted: boolean
  isVideoOff: boolean
  isScreenSharing: boolean

  // Chat
  messages: ChatMessage[]

  // Whiteboard
  whiteboardActions: any[]

  // Files
  sharedFiles: SharedFileInfo[]

  // UI
  activePanel: ActivePanel
  isConnected: boolean

  // Actions
  setUser: (userId: string, userName: string, userEmail: string) => void
  setAuthenticated: (value: boolean) => void
  setRoom: (roomId: string, roomName: string) => void
  leaveRoom: () => void
  setRoomUsers: (users: RoomUser[]) => void
  setLocalStream: (stream: MediaStream | null) => void
  setScreenStream: (stream: MediaStream | null) => void
  toggleMute: () => void
  toggleVideo: () => void
  toggleScreenShare: () => void
  addMessage: (message: ChatMessage) => void
  setActivePanel: (panel: ActivePanel) => void
  setConnected: (value: boolean) => void
  addSharedFile: (file: SharedFileInfo) => void
  addWhiteboardAction: (action: any) => void
  clearWhiteboard: () => void
}

export const useCallStore = create<CallState>((set, get) => ({
  userId: null,
  userName: null,
  userEmail: null,
  isAuthenticated: false,

  currentRoomId: null,
  currentRoomName: null,
  roomUsers: [],

  localStream: null,
  screenStream: null,
  isMuted: false,
  isVideoOff: false,
  isScreenSharing: false,

  messages: [],
  whiteboardActions: [],
  sharedFiles: [],

  activePanel: null,
  isConnected: false,

  setUser: (userId, userName, userEmail) => set({ userId, userName, userEmail }),
  setAuthenticated: (value) => set({ isAuthenticated: value }),

  setRoom: (roomId, roomName) => set({ currentRoomId: roomId, currentRoomName: roomName, messages: [], sharedFiles: [], whiteboardActions: [] }),
  leaveRoom: () => {
    const { localStream, screenStream } = get()
    localStream?.getTracks().forEach(t => t.stop())
    screenStream?.getTracks().forEach(t => t.stop())
    set({
      currentRoomId: null,
      currentRoomName: null,
      roomUsers: [],
      localStream: null,
      screenStream: null,
      isMuted: false,
      isVideoOff: false,
      isScreenSharing: false,
      messages: [],
      sharedFiles: [],
      whiteboardActions: [],
      activePanel: null,
    })
  },

  setRoomUsers: (users) => set({ roomUsers: users }),
  setLocalStream: (stream) => set({ localStream: stream }),
  setScreenStream: (stream) => set({ screenStream: stream }),

  toggleMute: () => {
    const { localStream, isMuted } = get()
    localStream?.getAudioTracks().forEach(t => { t.enabled = isMuted })
    set({ isMuted: !isMuted })
  },

  toggleVideo: () => {
    const { localStream, isVideoOff } = get()
    localStream?.getVideoTracks().forEach(t => { t.enabled = !isVideoOff })
    set({ isVideoOff: !isVideoOff })
  },

  toggleScreenShare: () => set(state => ({ isScreenSharing: !state.isScreenSharing })),

  addMessage: (message) => set(state => ({ messages: [...state.messages, message] })),
  setActivePanel: (panel) => set(state => ({ activePanel: state.activePanel === panel ? null : panel })),
  setConnected: (value) => set({ isConnected: value }),
  addSharedFile: (file) => set(state => ({ sharedFiles: [...state.sharedFiles, file] })),
  addWhiteboardAction: (action) => set(state => ({ whiteboardActions: [...state.whiteboardActions, action] })),
  clearWhiteboard: () => set({ whiteboardActions: [] }),
}))
