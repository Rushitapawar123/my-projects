'use client'

import { useRef, useEffect, useState, useCallback } from 'react'
import { useCallStore } from '@/store/call-store'
import { useWebRTC } from '@/hooks/use-webrtc'
import { Button } from '@/components/ui/button'
import { Separator } from '@/components/ui/separator'

type Tool = 'pen' | 'eraser' | 'text'

export function Whiteboard() {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const [tool, setTool] = useState<Tool>('pen')
  const [color, setColor] = useState('#000000')
  const [size, setSize] = useState(3)
  const isDrawingRef = useRef(false)
  const lastPointRef = useRef<{ x: number; y: number } | null>(null)

  const { sendWhiteboardAction, sendWhiteboardClear } = useWebRTC()

  // Setup canvas
  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return

    const resize = () => {
      const parent = canvas.parentElement
      if (!parent) return
      canvas.width = parent.clientWidth
      canvas.height = parent.clientHeight
    }

    resize()
    window.addEventListener('resize', resize)
    return () => window.removeEventListener('resize', resize)
  }, [])

  // Handle incoming whiteboard actions
  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    const { whiteboardActions } = useCallStore.getState()
    // Redraw all actions
    // This is a simplified approach - in production you'd want a more sophisticated replay system
  }, [])

  const getCanvasPoint = useCallback((e: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current
    if (!canvas) return { x: 0, y: 0 }
    const rect = canvas.getBoundingClientRect()
    return {
      x: e.clientX - rect.left,
      y: e.clientY - rect.top,
    }
  }, [])

  const startDrawing = useCallback((e: React.MouseEvent<HTMLCanvasElement>) => {
    isDrawingRef.current = true
    lastPointRef.current = getCanvasPoint(e)
  }, [getCanvasPoint])

  const draw = useCallback((e: React.MouseEvent<HTMLCanvasElement>) => {
    if (!isDrawingRef.current || !lastPointRef.current) return

    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    const currentPoint = getCanvasPoint(e)

    ctx.beginPath()
    ctx.moveTo(lastPointRef.current.x, lastPointRef.current.y)
    ctx.lineTo(currentPoint.x, currentPoint.y)

    if (tool === 'eraser') {
      ctx.strokeStyle = '#ffffff'
      ctx.lineWidth = size * 5
    } else {
      ctx.strokeStyle = color
      ctx.lineWidth = size
    }

    ctx.lineCap = 'round'
    ctx.lineJoin = 'round'
    ctx.stroke()

    // Send action to other users
    sendWhiteboardAction({
      type: tool === 'eraser' ? 'erase' : 'draw',
      data: {
        points: [lastPointRef.current, currentPoint],
        color: tool === 'eraser' ? '#ffffff' : color,
        size: tool === 'eraser' ? size * 5 : size,
        tool,
      },
      userId: useCallStore.getState().userId,
      timestamp: Date.now(),
    })

    lastPointRef.current = currentPoint
  }, [tool, color, size, getCanvasPoint, sendWhiteboardAction])

  const stopDrawing = useCallback(() => {
    isDrawingRef.current = false
    lastPointRef.current = null
  }, [])

  const clearCanvas = useCallback(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return
    ctx.fillStyle = '#ffffff'
    ctx.fillRect(0, 0, canvas.width, canvas.height)
    sendWhiteboardClear()
  }, [sendWhiteboardClear])

  const colors = ['#000000', '#ef4444', '#f97316', '#eab308', '#22c55e', '#3b82f6', '#8b5cf6', '#ec4899']

  return (
    <div className="flex flex-col h-full">
      <div className="p-3 border-b flex items-center gap-3 flex-wrap">
        {/* Tools */}
        <div className="flex gap-1">
          <Button
            variant={tool === 'pen' ? 'default' : 'secondary'}
            size="sm"
            className={`h-8 ${tool === 'pen' ? 'bg-emerald-600 hover:bg-emerald-700' : ''}`}
            onClick={() => setTool('pen')}
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
            </svg>
          </Button>
          <Button
            variant={tool === 'eraser' ? 'default' : 'secondary'}
            size="sm"
            className={`h-8 ${tool === 'eraser' ? 'bg-emerald-600 hover:bg-emerald-700' : ''}`}
            onClick={() => setTool('eraser')}
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
            </svg>
          </Button>
        </div>

        <Separator orientation="vertical" className="h-6" />

        {/* Colors */}
        <div className="flex gap-1">
          {colors.map(c => (
            <button
              key={c}
              onClick={() => { setColor(c); setTool('pen') }}
              className={`w-6 h-6 rounded-full border-2 transition-transform ${color === c && tool === 'pen' ? 'border-emerald-600 scale-110' : 'border-transparent'}`}
              style={{ backgroundColor: c }}
            />
          ))}
        </div>

        <Separator orientation="vertical" className="h-6" />

        {/* Size */}
        <div className="flex items-center gap-2">
          <span className="text-xs text-muted-foreground">Size</span>
          <input
            type="range"
            min={1}
            max={20}
            value={size}
            onChange={e => setSize(Number(e.target.value))}
            className="w-20"
          />
        </div>

        <div className="ml-auto">
          <Button variant="secondary" size="sm" className="h-8" onClick={clearCanvas}>
            <svg className="w-4 h-4 mr-1" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
            </svg>
            Clear
          </Button>
        </div>
      </div>

      <div className="flex-1 relative bg-white">
        <canvas
          ref={canvasRef}
          className="absolute inset-0 cursor-crosshair"
          onMouseDown={startDrawing}
          onMouseMove={draw}
          onMouseUp={stopDrawing}
          onMouseLeave={stopDrawing}
        />
      </div>
    </div>
  )
}
