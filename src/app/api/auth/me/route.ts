import { NextRequest, NextResponse } from "next/server"

export async function GET(req: NextRequest) {
  try {
    const token = req.cookies.get('syncspace-session')?.value

    if (!token) {
      return NextResponse.json({ user: null })
    }

    const payload = JSON.parse(Buffer.from(token, 'base64url').toString())

    if (payload.exp < Date.now()) {
      return NextResponse.json({ user: null })
    }

    return NextResponse.json({
      user: {
        id: payload.userId,
        email: payload.email,
        name: payload.name,
      }
    })
  } catch {
    return NextResponse.json({ user: null })
  }
}
