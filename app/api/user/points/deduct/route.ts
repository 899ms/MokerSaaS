import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth/next'
import { authOptions } from '@/lib/auth'
import { deductPoints } from '@/lib/points'
import { db } from '@/lib/db'
import { users } from '@/lib/schema'
import { eq } from 'drizzle-orm'

export async function POST(request: NextRequest) {
  try {
    // 验证用户登录状态
    const session = await getServerSession(authOptions)
    if (!session?.user?.email) {
      return NextResponse.json(
        { success: false, error: 'not_logged_in_alt' },
        { status: 401 }
      )
    }

    const { points, description, type } = await request.json()

    // 验证参数
    if (!points || points <= 0) {
      return NextResponse.json(
        { success: false, error: 'points_invalid_amount' },
        { status: 400 }
      )
    }

    if (!description || !type) {
      return NextResponse.json(
        { success: false, error: 'points_missing_params' },
        { status: 400 }
      )
    }

    // 查找用户
    const userList = await db
      .select({
        id: users.id,
        points: users.points,
        purchasedPoints: users.purchasedPoints,
        giftedPoints: users.giftedPoints,
      })
      .from(users)
      .where(eq(users.email, session.user.email))
      .limit(1)

    const user = userList[0]
    if (!user) {
      return NextResponse.json(
        { success: false, error: 'user_not_found' },
        { status: 404 }
      )
    }

    // 校验积分足够（前置校验，保持原有 400 语义）
    if ((user.points || 0) < points) {
      return NextResponse.json(
        { success: false, error: 'points_insufficient' },
        { status: 400 }
      )
    }

    // 调用 lib/points.ts 的 deductPoints：
    // - 优先扣赠送积分，剩余再扣购买积分
    // - 只写一条 history 记录（action 使用传入的 type）
    // - 入口拦截过期订阅（expireSubscriptionIfNeeded）
    const newPoints = await deductPoints(user.id, points, description, type)

    return NextResponse.json({
      success: true,
      message: 'points_deducted_successfully',
      data: {
        deductedPoints: points,
        remainingPoints: newPoints,
        description: description,
      },
    })
  } catch (error) {
    console.error('积分扣除失败:', error)
    return NextResponse.json(
      { success: false, error: 'server_internal_error' },
      { status: 500 }
    )
  }
}
