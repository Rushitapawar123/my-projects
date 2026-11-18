import { createServer } from 'http'
import { Server, Socket } from 'socket.io'

const httpServer = createServer()
const io = new Server(httpServer, {
  path: '/',
  cors: {
    origin: "*",
    methods: ["GET", "POST"]
  },
  pingTimeout: 60000,
  pingInterval: 25000,
})

// ======== Types ========
interface RoomUser {
  socketId: string
  userId: string
  username: string
  avatar: string | null
  isScreenSharing: boolean
}

interface Room {
  id: string
  name: string
  users: Map<string, RoomUser>
}

interface ChatMessage {
  id: string
  roomId: string
  senderId: string
  senderName: string
  content: string
  type: 'text' | 'system' | 'file'
  timestamp: number
}

interface WhiteboardAction {
  type: 'draw' | 'erase' | 'clear' | 'text'
  data: {
    points?: { x: number; y: number }[]
    color?: string
    size?: number
    text?: string
    position?: { x: number; y: number }
    tool?: string
  }
  userId: string
  timestamp: number
}

// ======== State ========
const rooms = new Map<string, Room>()

const generateId = () => Math.random().toString(36).substring(2, 11)

// ======== Helper Functions ========
function getRoom(roomId: string): Room | undefined {
  return rooms.get(roomId)
}

function createRoom(roomId: string, roomName: string): Room {
  const room: Room = {
    id: roomId,
    name: roomName,
    users: new Map()
  }
  rooms.set(roomId, room)
  return room
}

function addUserToRoom(roomId: string, user: RoomUser): Room | null {
  let room = getRoom(roomId)
  if (!room) {
    room = createRoom(roomId, roomId)
  }
  room.users.set(user.socketId, user)
  return room
}

function removeUserFromRoom(socketId: string): { room: Room; user: RoomUser } | null {
  for (const [roomId, room] of rooms) {
    const user = room.users.get(socketId)
    if (user) {
      room.users.delete(socketId)
      if (room.users.size === 0) {
        rooms.delete(roomId)
      }
      return { room, user }
    }
  }
  return null
}

function getUsersInRoom(roomId: string): RoomUser[] {
  const room = getRoom(roomId)
  if (!room) return []
  return Array.from(room.users.values())
}

// ======== Socket Handlers ========
io.on('connection', (socket: Socket) => {
  console.log(`[Connect] ${socket.id}`)
  let currentRoomId: string | null = null
  let currentUser: RoomUser | null = null

  // ---- Room Management ----
  socket.on('join-room', (data: { roomId: string; userId: string; username: string; avatar: string | null }) => {
    const { roomId, userId, username, avatar } = data

    // Leave previous room if any
    if (currentRoomId) {
      const result = removeUserFromRoom(socket.id)
      if (result) {
        socket.leave(result.room.id)
        socket.to(result.room.id).emit('user-left', {
          user: result.user,
          message: { id: generateId(), type: 'system', content: `${result.user.username} left the room`, timestamp: Date.now() }
        })
        socket.to(result.room.id).emit('room-users', { users: getUsersInRoom(result.room.id) })
      }
    }

    // Join new room
    const user: RoomUser = {
      socketId: socket.id,
      userId,
      username,
      avatar,
      isScreenSharing: false
    }

    const room = addUserToRoom(roomId, user)
    socket.join(roomId)
    currentRoomId = roomId
    currentUser = user

    // Send current users list to the joining user
    const usersInRoom = getUsersInRoom(roomId)
    socket.emit('room-users', { users: usersInRoom })

    // Notify others in the room
    socket.to(roomId).emit('user-joined', {
      user,
      message: { id: generateId(), roomId, type: 'system', content: `${username} joined the room`, timestamp: Date.now() }
    })

    console.log(`[Join] ${username} joined room ${roomId} (${usersInRoom.length} users)`)
  })

  socket.on('leave-room', () => {
    if (!currentRoomId || !currentUser) return

    const result = removeUserFromRoom(socket.id)
    if (result) {
      socket.leave(result.room.id)
      socket.to(result.room.id).emit('user-left', {
        user: result.user,
        message: { id: generateId(), type: 'system', content: `${result.user.username} left the room`, timestamp: Date.now() }
      })
      socket.to(result.room.id).emit('room-users', { users: getUsersInRoom(result.room.id) })
      console.log(`[Leave] ${currentUser.username} left room ${currentRoomId}`)
    }
    currentRoomId = null
    currentUser = null
  })

  // ---- WebRTC Signaling ----
  socket.on('webrtc-offer', (data: { targetSocketId: string; offer: RTCSessionDescriptionInit }) => {
    socket.to(data.targetSocketId).emit('webrtc-offer', {
      senderSocketId: socket.id,
      offer: data.offer
    })
  })

  socket.on('webrtc-answer', (data: { targetSocketId: string; answer: RTCSessionDescriptionInit }) => {
    socket.to(data.targetSocketId).emit('webrtc-answer', {
      senderSocketId: socket.id,
      answer: data.answer
    })
  })

  socket.on('webrtc-ice-candidate', (data: { targetSocketId: string; candidate: RTCIceCandidateInit }) => {
    socket.to(data.targetSocketId).emit('webrtc-ice-candidate', {
      senderSocketId: socket.id,
      candidate: data.candidate
    })
  })

  // ---- Screen Sharing Signaling ----
  socket.on('screen-share-start', () => {
    if (!currentRoomId || !currentUser) return
    currentUser.isScreenSharing = true
    socket.to(currentRoomId).emit('screen-share-started', { user: currentUser })
  })

  socket.on('screen-share-stop', () => {
    if (!currentRoomId || !currentUser) return
    currentUser.isScreenSharing = false
    socket.to(currentRoomId).emit('screen-share-stopped', { user: currentUser })
  })

  // ---- Chat ----
  socket.on('chat-message', (data: { content: string; type?: string }) => {
    if (!currentRoomId || !currentUser) return

    const message: ChatMessage = {
      id: generateId(),
      roomId: currentRoomId,
      senderId: currentUser.userId,
      senderName: currentUser.username,
      content: data.content,
      type: (data.type as any) || 'text',
      timestamp: Date.now()
    }

    io.to(currentRoomId).emit('chat-message', message)
  })

  // ---- Whiteboard ----
  socket.on('whiteboard-action', (data: WhiteboardAction) => {
    if (!currentRoomId) return
    socket.to(currentRoomId).emit('whiteboard-action', {
      ...data,
      userId: currentUser?.userId || socket.id
    })
  })

  socket.on('whiteboard-clear', () => {
    if (!currentRoomId) return
    socket.to(currentRoomId).emit('whiteboard-clear', { userId: currentUser?.userId })
  })

  // ---- File Sharing ----
  socket.on('file-shared', (data: { fileId: string; fileName: string; fileSize: number; mimeType: string; senderName: string }) => {
    if (!currentRoomId) return
    socket.to(currentRoomId).emit('file-shared', data)
  })

  // ---- Disconnect ----
  socket.on('disconnect', () => {
    if (currentRoomId && currentUser) {
      const result = removeUserFromRoom(socket.id)
      if (result) {
        socket.to(result.room.id).emit('user-left', {
          user: result.user,
          message: { id: generateId(), type: 'system', content: `${result.user.username} disconnected`, timestamp: Date.now() }
        })
        socket.to(result.room.id).emit('room-users', { users: getUsersInRoom(result.room.id) })
        console.log(`[Disconnect] ${currentUser.username} from room ${currentRoomId}`)
      }
    }
    console.log(`[Disconnect] ${socket.id}`)
  })

  socket.on('error', (error) => {
    console.error(`[Error] Socket ${socket.id}:`, error.message)
  })
})

// ======== Start Server ========
const PORT = 3003
httpServer.listen(PORT, () => {
  console.log(`🚀 Signaling server running on port ${PORT}`)
})

// Graceful shutdown
process.on('SIGTERM', () => {
  console.log('Received SIGTERM, shutting down...')
  httpServer.close(() => process.exit(0))
})

process.on('SIGINT', () => {
  console.log('Received SIGINT, shutting down...')
  httpServer.close(() => process.exit(0))
})
