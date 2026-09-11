import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { pointsHistory, users } from '@/lib/schema'
import { eq, desc, and, sql } from 'drizzle-orm'
import { isAdmin } from '@/lib/auth-utils'

// 管理员查看指定用户的积分历史记录（分页 + 可选过滤）
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ userId: string }> }
) {
  try {
    const adminAccess = await isAdmin()
    if (!adminAccess) {
      return NextResponse.json(
        { error: 'admin_required' },
        { status: 403 }
      )
    }

    const { userId } = await params

    // 校验用户存在
    const userList = await db
      .select({ id: users.id, email: users.email, name: users.name })
      .from(users)
      .where(eq(users.id, userId))
      .limit(1)

    if (userList.length === 0) {
      return NextResponse.json(
        { error: 'user_not_found' },
        { status: 404 }
      )
    }

    const { searchParams } = new URL(request.url)
    const page = Math.max(1, parseInt(searchParams.get('page') || '1'))
    const limit = Math.min(200, Math.max(1, parseInt(searchParams.get('limit') || '20')))
    const offset = (page - 1) * limit
    const pointsType = searchParams.get('pointsType') // purchased | gifted | '' (all)
    const action = searchParams.get('action') // 注册/daily_login/manual/use 等

    // 构建查询条件
    const conditions = [eq(pointsHistory.userId, userId)]
    if (pointsType && (pointsType === 'purchased' || pointsType === 'gifted')) {
      conditions.push(eq(pointsHistory.pointsType, pointsType))
    }
    if (action && action.trim()) {
      conditions.push(eq(pointsHistory.action, action.trim()))
    }

    const whereClause = and(...conditions)

    // 查询总数
    const totalRow = await db
      .select({ count: sql<number>`count(*)` })
      .from(pointsHistory)
      .where(whereClause)
    const total = totalRow[0]?.count || 0

    // 查询当前页数据
    const history = await db
      .select({
        id: pointsHistory.id,
        userId: pointsHistory.userId,
        points: pointsHistory.points,
        pointsType: pointsHistory.pointsType,
        action: pointsHistory.action,
        description: pointsHistory.description,
        createdAt: pointsHistory.createdAt,
      })
      .from(pointsHistory)
      .where(whereClause)
      .orderBy(desc(pointsHistory.createdAt))
      .limit(limit)
      .offset(offset)

    // 聚合统计：累计获得 / 累计扣除（仅查询积分历史表）
    const statsRow = await db
      .select({
        totalEarned: sql<number>`coalesce(sum(case when ${pointsHistory.points} > 0 then ${pointsHistory.points} else 0 end), 0)`,
        totalSpent: sql<number>`coalesce(sum(case when ${pointsHistory.points} < 0 then -${pointsHistory.points} else 0 end), 0)`,
      })
      .from(pointsHistory)
      .where(eq(pointsHistory.userId, userId))

    // 当前余额（来自 users 表）
    const userBalance = await db
      .select({
        purchasedPoints: users.purchasedPoints,
        giftedPoints: users.giftedPoints,
        currentPoints: users.points,
      })
      .from(users)
      .where(eq(users.id, userId))
      .limit(1)

    return NextResponse.json({
      success: true,
      user: {
        id: userList[0].id,
        email: userList[0].email,
        name: userList[0].name,
      },
      history,
      stats: {
        totalEarned: Number(statsRow[0]?.totalEarned || 0),
        totalSpent: Number(statsRow[0]?.totalSpent || 0),
        purchasedPoints: userBalance[0]?.purchasedPoints || 0,
        giftedPoints: userBalance[0]?.giftedPoints || 0,
        currentPoints: userBalance[0]?.currentPoints || 0,
      },
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    })
  } catch (error) {
    console.error('Admin get user points history error:', error)
    return NextResponse.json(
      { error: 'server_error' },
      { status: 500 }
    )
  }
}
