'use client'

import { useState, useRef } from 'react'
import { useCallStore } from '@/store/call-store'
import { useWebRTC } from '@/hooks/use-webrtc'
import { Button } from '@/components/ui/button'
import { ScrollArea } from '@/components/ui/scroll-area'
import { toast } from '@/hooks/use-toast'

export function FileSharing() {
  const [isUploading, setIsUploading] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const { sharedFiles } = useCallStore()
  const { notifyFileShared, sendMessage } = useWebRTC()

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    // Max 5MB for browser-based sharing
    if (file.size > 5 * 1024 * 1024) {
      toast({ title: 'File Too Large', description: 'Maximum file size is 5MB', variant: 'destructive' })
      return
    }

    setIsUploading(true)
    try {
      const reader = new FileReader()
      reader.onload = () => {
        const base64 = reader.result as string

        // Add to local shared files
        useCallStore.getState().addSharedFile({
          id: Math.random().toString(36).substring(2),
          name: file.name,
          size: file.size,
          mimeType: file.type,
          data: base64,
          senderName: useCallStore.getState().userName || 'You',
        })

        // Notify other users
        notifyFileShared({
          fileId: Math.random().toString(36).substring(2),
          fileName: file.name,
          fileSize: file.size,
          mimeType: file.type,
        })

        // Send chat message about the file
        sendMessage(`Shared a file: ${file.name}`)
        toast({ title: 'File Shared', description: `${file.name} has been shared` })
      }
      reader.readAsDataURL(file)
    } catch (err) {
      toast({ title: 'Upload Failed', description: 'Could not share the file', variant: 'destructive' })
    } finally {
      setIsUploading(false)
      if (fileInputRef.current) fileInputRef.current.value = ''
    }
  }

  const formatFileSize = (bytes: number) => {
    if (bytes < 1024) return bytes + ' B'
    if (bytes < 1048576) return (bytes / 1024).toFixed(1) + ' KB'
    return (bytes / 1048576).toFixed(1) + ' MB'
  }

  const downloadFile = (file: typeof sharedFiles[0]) => {
    if (file.data) {
      const link = document.createElement('a')
      link.href = file.data
      link.download = file.name
      link.click()
    }
  }

  const getFileIcon = (mimeType: string) => {
    if (mimeType.startsWith('image/')) return '🖼️'
    if (mimeType.startsWith('video/')) return '🎬'
    if (mimeType.startsWith('audio/')) return '🎵'
    if (mimeType.includes('pdf')) return '📄'
    if (mimeType.includes('zip') || mimeType.includes('rar')) return '📦'
    return '📎'
  }

  return (
    <div className="flex flex-col h-full">
      <div className="p-4 border-b">
        <h3 className="font-semibold flex items-center gap-2">
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
          </svg>
          Shared Files
          <span className="text-xs text-muted-foreground font-normal ml-auto">
            {sharedFiles.length} files
          </span>
        </h3>
      </div>

      <ScrollArea className="flex-1 p-4">
        {sharedFiles.length === 0 ? (
          <div className="text-center text-muted-foreground text-sm py-8">
            <svg className="w-8 h-8 mx-auto mb-2 opacity-50" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
            </svg>
            No files shared yet
          </div>
        ) : (
          <div className="space-y-2">
            {sharedFiles.map(file => (
              <div
                key={file.id}
                className="flex items-center gap-3 p-3 rounded-lg border hover:bg-muted/50 cursor-pointer transition-colors"
                onClick={() => downloadFile(file)}
              >
                <span className="text-2xl">{getFileIcon(file.mimeType)}</span>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium truncate">{file.name}</p>
                  <p className="text-xs text-muted-foreground">
                    {formatFileSize(file.size)} · {file.senderName}
                  </p>
                </div>
                <Button variant="ghost" size="sm" className="shrink-0">
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                  </svg>
                </Button>
              </div>
            ))}
          </div>
        )}
      </ScrollArea>

      <div className="p-3 border-t">
        <input
          ref={fileInputRef}
          type="file"
          className="hidden"
          onChange={handleFileSelect}
        />
        <Button
          onClick={() => fileInputRef.current?.click()}
          disabled={isUploading}
          className="w-full bg-emerald-600 hover:bg-emerald-700"
        >
          {isUploading ? (
            <>
              <svg className="w-4 h-4 mr-2 animate-spin" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
              </svg>
              Uploading...
            </>
          ) : (
            <>
              <svg className="w-4 h-4 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
              </svg>
              Share a File
            </>
          )}
        </Button>
        <p className="text-xs text-muted-foreground text-center mt-2">Max file size: 5MB</p>
      </div>
    </div>
  )
}
