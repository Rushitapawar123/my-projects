/**
 * Encryption utilities using Web Crypto API for E2E encryption
 */

// Generate an AES-GCM key for room encryption
export async function generateRoomKey(): Promise<CryptoKey> {
  return await crypto.subtle.generateKey(
    { name: 'AES-GCM', length: 256 },
    true,
    ['encrypt', 'decrypt']
  )
}

// Export key to base64 string for sharing
export async function exportKey(key: CryptoKey): Promise<string> {
  const exported = await crypto.subtle.exportKey('raw', key)
  return arrayBufferToBase64(exported)
}

// Import key from base64 string
export async function importKey(keyBase64: string): Promise<CryptoKey> {
  const keyData = base64ToArrayBuffer(keyBase64)
  return await crypto.subtle.importKey(
    'raw',
    keyData,
    { name: 'AES-GCM', length: 256 },
    true,
    ['encrypt', 'decrypt']
  )
}

// Encrypt a message
export async function encryptMessage(plaintext: string, key: CryptoKey): Promise<string> {
  const encoder = new TextEncoder()
  const iv = crypto.getRandomValues(new Uint8Array(12))
  const encrypted = await crypto.subtle.encrypt(
    { name: 'AES-GCM', iv },
    key,
    encoder.encode(plaintext)
  )
  const combined = new Uint8Array(iv.length + new Uint8Array(encrypted).length)
  combined.set(iv)
  combined.set(new Uint8Array(encrypted), iv.length)
  return arrayBufferToBase64(combined.buffer)
}

// Decrypt a message
export async function decryptMessage(ciphertext: string, key: CryptoKey): Promise<string> {
  const data = base64ToArrayBuffer(ciphertext)
  const iv = new Uint8Array(data.slice(0, 12))
  const encrypted = data.slice(12)
  const decrypted = await crypto.subtle.decrypt(
    { name: 'AES-GCM', iv },
    key,
    encrypted
  )
  const decoder = new TextDecoder()
  return decoder.decode(decrypted)
}

// Encrypt file data
export async function encryptFile(data: ArrayBuffer, key: CryptoKey): Promise<string> {
  const iv = crypto.getRandomValues(new Uint8Array(12))
  const encrypted = await crypto.subtle.encrypt(
    { name: 'AES-GCM', iv },
    key,
    data
  )
  const combined = new Uint8Array(iv.length + new Uint8Array(encrypted).length)
  combined.set(iv)
  combined.set(new Uint8Array(encrypted), iv.length)
  return arrayBufferToBase64(combined.buffer)
}

// Decrypt file data
export async function decryptFile(encryptedBase64: string, key: CryptoKey): Promise<ArrayBuffer> {
  const data = base64ToArrayBuffer(encryptedBase64)
  const iv = new Uint8Array(data.slice(0, 12))
  const encrypted = data.slice(12)
  return await crypto.subtle.decrypt(
    { name: 'AES-GCM', iv },
    key,
    encrypted
  )
}

// Helper: ArrayBuffer to Base64
function arrayBufferToBase64(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer)
  let binary = ''
  for (let i = 0; i < bytes.byteLength; i++) {
    binary += String.fromCharCode(bytes[i])
  }
  return btoa(binary)
}

// Helper: Base64 to ArrayBuffer
function base64ToArrayBuffer(base64: string): ArrayBuffer {
  const binary = atob(base64)
  const bytes = new Uint8Array(binary.length)
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i)
  }
  return bytes.buffer
}

// Generate a hash for a password (client-side)
export async function hashPassword(password: string): Promise<string> {
  const encoder = new TextEncoder()
  const data = encoder.encode(password)
  const hash = await crypto.subtle.digest('SHA-256', data)
  return arrayBufferToBase64(hash)
}
