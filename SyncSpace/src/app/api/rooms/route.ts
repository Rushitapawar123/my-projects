import { NextRequest, NextResponse } from "next/server"
import bcrypt from "bcryptjs"
import { db } from "@/lib/db"

export async function GET() {
  try {
    const rooms = await db.room.findMany({
      include: {
        participants: {
          include: {
            user: {
              select: { id: true, name: true, avatar: true }
            }
          }
        },
        creator: {
          select: { id: true, name: true }
        }
      },
      orderBy: { createdAt: "desc" }
    })

    return NextResponse.json(rooms)
  } catch (error) {
    console.error("Get rooms error:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}

export async function POST(req: NextRequest) {
  try {
    const { name, description, isPrivate, password, createdBy } = await req.json()

    if (!name || !createdBy) {
      return NextResponse.json(
        { error: "Room name and creator are required" },
        { status: 400 }
      )
    }

    let hashedPassword = null
    if (isPrivate && password) {
      hashedPassword = await bcrypt.hash(password, 12)
    }

    const room = await db.room.create({
      data: {
        name,
        description: description || null,
        isPrivate: isPrivate || false,
        password: hashedPassword,
        createdBy,
        participants: {
          create: {
            userId: createdBy,
            role: "host"
          }
        }
      },
      include: {
        participants: {
          include: {
            user: {
              select: { id: true, name: true, avatar: true }
            }
          }
        },
        creator: {
          select: { id: true, name: true }
        }
      }
    })

    return NextResponse.json(room, { status: 201 })
  } catch (error) {
    console.error("Create room error:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
