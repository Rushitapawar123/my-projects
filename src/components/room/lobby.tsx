'use client'

import { useState, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog'
import { Badge } from '@/components/ui/badge'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Separator } from '@/components/ui/separator'
import { useCallStore } from '@/store/call-store'
import { useWebRTC } from '@/hooks/use-webrtc'
import { toast } from '@/hooks/use-toast'

interface Room {
  id: string
  name: string
  description: string | null
  isPrivate: boolean
  createdAt: string
  participants: { userId: string; user: { id: string; name: string; avatar: string | null } }[]
  creator: { id: string; name: string }
}

export function RoomLobby() {
  const [rooms, setRooms] = useState<Room[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [joinRoomId, setJoinRoomId] = useState('')

  // Create room state
  const [newRoomName, setNewRoomName] = useState('')
  const [newRoomDesc, setNewRoomDesc] = useState('')
  const [isPrivate, setIsPrivate] = useState(false)
  const [roomPassword, setRoomPassword] = useState('')
  const [isCreating, setIsCreating] = useState(false)
  const [createOpen, setCreateOpen] = useState(false)

  const { userId, userName } = useCallStore()
  const { connect, initLocalStream, joinRoom } = useWebRTC()

  // Fetch rooms
  const fetchRooms = async () => {
    try {
      const res = await fetch('/api/rooms')
      if (res.ok) {
        const data = await res.json()
        setRooms(data)
      }
    } catch (err) {
      console.error('Failed to fetch rooms:', err)
    } finally {
      setIsLoading(false)
    }
  }

  useEffect(() => {
    fetchRooms()
    const interval = setInterval(fetchRooms, 5000)
    return () => clearInterval(interval)
  }, [])

  const handleCreateRoom = async () => {
    if (!newRoomName.trim()) return
    setIsCreating(true)

    try {
      const res = await fetch('/api/rooms', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: newRoomName.trim(),
          description: newRoomDesc.trim() || undefined,
          isPrivate,
          password: isPrivate ? roomPassword : undefined,
          createdBy: userId,
        })
      })

      if (res.ok) {
        const room = await res.json()
        toast({ title: 'Room Created!', description: `${room.name} is ready` })
        setCreateOpen(false)
        setNewRoomName('')
        setNewRoomDesc('')
        setIsPrivate(false)
        setRoomPassword('')
        fetchRooms()

        // Auto-join the created room
        await handleJoinRoom(room.id, room.name)
      } else {
        const data = await res.json()
        toast({ title: 'Failed', description: data.error, variant: 'destructive' })
      }
    } catch (err) {
      toast({ title: 'Error', description: 'Failed to create room', variant: 'destructive' })
    } finally {
      setIsCreating(false)
    }
  }

  const handleJoinRoom = async (roomId: string, roomName: string) => {
    try {
      // Initialize local media first
      const stream = await initLocalStream()
      if (!stream) {
        toast({ title: 'Camera/Mic Access', description: 'Please allow camera and microphone access to join', variant: 'destructive' })
        return
      }

      // Connect to signaling server
      await connect()

      // Join the room
      joinRoom(roomId, roomName)
    } catch (err) {
      toast({ title: 'Error', description: 'Failed to join room', variant: 'destructive' })
    }
  }

  const handleQuickJoin = async () => {
    if (!joinRoomId.trim()) return
    // Check if the room exists
    const room = rooms.find(r => r.id === joinRoomId.trim())
    if (room) {
      await handleJoinRoom(room.id, room.name)
    } else {
      // Create a quick room with the ID as name
      await handleJoinRoom(joinRoomId.trim(), `Room ${joinRoomId.trim()}`)
    }
  }

  return (
    <div className="w-full max-w-4xl mx-auto">
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 mb-8">
        <div>
          <h2 className="text-2xl font-bold">Welcome, {userName}</h2>
          <p className="text-muted-foreground text-sm mt-1">Join a room or create your own to start collaborating</p>
        </div>
        <div className="flex items-center gap-2">
          <Dialog open={createOpen} onOpenChange={setCreateOpen}>
            <DialogTrigger asChild>
              <Button className="bg-emerald-600 hover:bg-emerald-700">
                <svg className="w-4 h-4 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
                </svg>
                New Room
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Create a New Room</DialogTitle>
                <DialogDescription>Set up a room for your video conference</DialogDescription>
              </DialogHeader>
              <div className="space-y-4 py-4">
                <div className="space-y-2">
                  <Label>Room Name *</Label>
                  <Input
                    value={newRoomName}
                    onChange={e => setNewRoomName(e.target.value)}
                    placeholder="e.g., Team Standup, Project Review"
                  />
                </div>
                <div className="space-y-2">
                  <Label>Description</Label>
                  <Input
                    value={newRoomDesc}
                    onChange={e => setNewRoomDesc(e.target.value)}
                    placeholder="Brief description (optional)"
                  />
                </div>
                <div className="flex items-center gap-3">
                  <Label htmlFor="private-toggle">Private Room</Label>
                  <button
                    id="private-toggle"
                    onClick={() => setIsPrivate(!isPrivate)}
                    className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${isPrivate ? 'bg-emerald-600' : 'bg-gray-200'}`}
                  >
                    <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${isPrivate ? 'translate-x-6' : 'translate-x-1'}`} />
                  </button>
                </div>
                {isPrivate && (
                  <div className="space-y-2">
                    <Label>Room Password</Label>
                    <Input
                      type="password"
                      value={roomPassword}
                      onChange={e => setRoomPassword(e.target.value)}
                      placeholder="Password required to join"
                    />
                  </div>
                )}
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setCreateOpen(false)}>Cancel</Button>
                <Button onClick={handleCreateRoom} disabled={!newRoomName.trim() || isCreating} className="bg-emerald-600 hover:bg-emerald-700">
                  {isCreating ? 'Creating...' : 'Create Room'}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      {/* Quick Join */}
      <Card className="mb-6">
        <CardContent className="p-4">
          <div className="flex gap-3">
            <Input
              value={joinRoomId}
              onChange={e => setJoinRoomId(e.target.value)}
              placeholder="Enter room ID to join..."
              onKeyDown={e => e.key === 'Enter' && handleQuickJoin()}
              className="flex-1"
            />
            <Button onClick={handleQuickJoin} disabled={!joinRoomId.trim()} className="bg-emerald-600 hover:bg-emerald-700">
              Quick Join
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Room List */}
      <div>
        <h3 className="text-lg font-semibold mb-4">Available Rooms</h3>
        {isLoading ? (
          <div className="grid gap-4">
            {[1, 2, 3].map(i => (
              <Card key={i} className="animate-pulse">
                <CardContent className="p-6">
                  <div className="h-6 bg-muted rounded w-1/3 mb-3" />
                  <div className="h-4 bg-muted rounded w-2/3" />
                </CardContent>
              </Card>
            ))}
          </div>
        ) : rooms.length === 0 ? (
          <Card>
            <CardContent className="p-8 text-center">
              <svg className="w-12 h-12 mx-auto text-muted-foreground mb-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
              </svg>
              <h3 className="text-lg font-medium mb-2">No rooms yet</h3>
              <p className="text-muted-foreground text-sm mb-4">Create your first room to get started!</p>
              <Button onClick={() => setCreateOpen(true)} className="bg-emerald-600 hover:bg-emerald-700">
                Create Your First Room
              </Button>
            </CardContent>
          </Card>
        ) : (
          <ScrollArea className="max-h-[calc(100vh-400px)]">
            <div className="grid gap-3">
              {rooms.map(room => (
                <Card key={room.id} className="hover:shadow-md transition-shadow cursor-pointer group" onClick={() => handleJoinRoom(room.id, room.name)}>
                  <CardContent className="p-4">
                    <div className="flex items-center justify-between">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          <h4 className="font-semibold truncate">{room.name}</h4>
                          {room.isPrivate && (
                            <Badge variant="secondary" className="text-xs">
                              <svg className="w-3 h-3 mr-1" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                <path strokeLinecap="round" strokeLinejoin="round" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                              </svg>
                              Private
                            </Badge>
                          )}
                        </div>
                        {room.description && (
                          <p className="text-sm text-muted-foreground truncate">{room.description}</p>
                        )}
                        <div className="flex items-center gap-3 mt-2 text-xs text-muted-foreground">
                          <span>Created by {room.creator.name}</span>
                          <span>{room.participants.length} participant{room.participants.length !== 1 ? 's' : ''}</span>
                        </div>
                      </div>
                      <div className="flex items-center gap-2 ml-4">
                        <div className="flex -space-x-2">
                          {room.participants.slice(0, 3).map((p, i) => (
                            <Avatar key={p.userId} className="w-7 h-7 border-2 border-background">
                              <AvatarFallback className="text-xs bg-emerald-100 text-emerald-700">
                                {p.user.name?.charAt(0).toUpperCase()}
                              </AvatarFallback>
                            </Avatar>
                          ))}
                          {room.participants.length > 3 && (
                            <div className="w-7 h-7 rounded-full bg-muted border-2 border-background flex items-center justify-center text-xs">
                              +{room.participants.length - 3}
                            </div>
                          )}
                        </div>
                        <Button size="sm" className="bg-emerald-600 hover:bg-emerald-700 opacity-0 group-hover:opacity-100 transition-opacity">
                          Join
                        </Button>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </ScrollArea>
        )}
      </div>
    </div>
  )
}
