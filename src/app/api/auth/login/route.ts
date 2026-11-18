import { NextRequest, NextResponse } from "next/server"
import bcrypt from "bcryptjs"
import { db } from "@/lib/db"

const SECRET = process.env.NEXTAUTH_SECRET || "syncspace-secret-key-change-in-production"

function createSessionToken(userId: string, email: string, name: string): string {
  const payload = { userId, email, name, exp: Date.now() + 86400000 }
  const encoded = Buffer.from(JSON.stringify(payload)).toString('base64url')
  return encoded
}

export async function POST(req: NextRequest) {
  try {
    const { email, password } = await req.json()

    if (!email || !password) {
      return NextResponse.json({ error: "Email and password are required" }, { status: 400 })
    }

    const user = await db.user.findUnique({ where: { email } })

    if (!user) {
      return NextResponse.json({ error: "Invalid email or password" }, { status: 401 })
    }

    const isValid = await bcrypt.compare(password, user.password)
    if (!isValid) {
      return NextResponse.json({ error: "Invalid email or password" }, { status: 401 })
    }

    const token = createSessionToken(user.id, user.email, user.name)

    const response = NextResponse.json({
      id: user.id,
      email: user.email,
      name: user.name,
      token,
    })

    response.cookies.set('syncspace-session', token, {
      httpOnly: false,
      secure: false,
      sameSite: 'lax',
      maxAge: 86400,
      path: '/',
    })

    return response
  } catch (error) {
    console.error("Login error:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
