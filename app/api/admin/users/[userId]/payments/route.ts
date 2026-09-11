import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { stripePayments, users } from '@/lib/schema'
import { eq, desc, and, sql } from 'drizzle-orm'
import { isAdmin } from '@/lib/auth-utils'

// 管理员查看指定用户的支付记录（分页 + 过滤 + 统计）
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
    const paymentType = searchParams.get('paymentType') // subscription | points_purchase | one_time | ''
    const paymentStatus = searchParams.get('paymentStatus') // succeeded | failed | pending | refunded | cancelled | ''

    const conditions = [eq(stripePayments.userId, userId)]
    if (paymentType && ['subscription', 'points_purchase', 'one_time'].includes(paymentType)) {
      conditions.push(eq(stripePayments.paymentType, paymentType))
    }
    if (paymentStatus && ['succeeded', 'failed', 'pending', 'refunded', 'cancelled'].includes(paymentStatus)) {
      conditions.push(eq(stripePayments.paymentStatus, paymentStatus))
    }
    const whereClause = and(...conditions)

    // 计数
    const totalRow = await db
      .select({ count: sql<number>`count(*)` })
      .from(stripePayments)
      .where(whereClause)
    const total = totalRow[0]?.count || 0

    // 当前页
    const paymentsRaw = await db
      .select()
      .from(stripePayments)
      .where(whereClause)
      .orderBy(desc(stripePayments.createdAt))
      .limit(limit)
      .offset(offset)

    const payments = paymentsRaw.map((p) => ({
      ...p,
      metadata: p.metadata ? safeParseJson(p.metadata) : null,
    }))

    // 聚合统计（基于该用户所有记录，不受过滤影响；如需跟随过滤，可去掉这里 userId 外的 where）
    const statsRow = await db
      .select({
        totalPayments: sql<number>`count(*)`,
        succeededAmount: sql<number>`coalesce(sum(case when ${stripePayments.paymentStatus} = 'succeeded' then ${stripePayments.amount} else 0 end), 0)`,
        refundedAmount: sql<number>`coalesce(sum(case when ${stripePayments.paymentStatus} = 'refunded' then ${stripePayments.refundAmount} else 0 end), 0)`,
        succeededCount: sql<number>`count(case when ${stripePayments.paymentStatus} = 'succeeded' then 1 end)`,
        failedCount: sql<number>`count(case when ${stripePayments.paymentStatus} = 'failed' then 1 end)`,
        refundedCount: sql<number>`count(case when ${stripePayments.paymentStatus} = 'refunded' then 1 end)`,
        subscriptionCount: sql<number>`count(case when ${stripePayments.paymentType} = 'subscription' then 1 end)`,
        pointsPurchaseCount: sql<number>`count(case when ${stripePayments.paymentType} = 'points_purchase' then 1 end)`,
        totalPointsPurchased: sql<number>`coalesce(sum(case when ${stripePayments.pointsType} = 'purchased' then ${stripePayments.pointsAmount} else 0 end), 0)`,
        totalPointsGifted: sql<number>`coalesce(sum(case when ${stripePayments.pointsType} = 'gifted' then ${stripePayments.pointsAmount} else 0 end), 0)`,
      })
      .from(stripePayments)
      .where(eq(stripePayments.userId, userId))

    return NextResponse.json({
      success: true,
      user: {
        id: userList[0].id,
        email: userList[0].email,
        name: userList[0].name,
      },
      payments,
      stats: {
        totalPayments: Number(statsRow[0]?.totalPayments || 0),
        succeededAmount: Number(statsRow[0]?.succeededAmount || 0),
        refundedAmount: Number(statsRow[0]?.refundedAmount || 0),
        succeededCount: Number(statsRow[0]?.succeededCount || 0),
        failedCount: Number(statsRow[0]?.failedCount || 0),
        refundedCount: Number(statsRow[0]?.refundedCount || 0),
        subscriptionCount: Number(statsRow[0]?.subscriptionCount || 0),
        pointsPurchaseCount: Number(statsRow[0]?.pointsPurchaseCount || 0),
        totalPointsPurchased: Number(statsRow[0]?.totalPointsPurchased || 0),
        totalPointsGifted: Number(statsRow[0]?.totalPointsGifted || 0),
      },
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    })
  } catch (error) {
    console.error('Admin get user payments error:', error)
    return NextResponse.json(
      { error: 'server_error' },
      { status: 500 }
    )
  }
}

function safeParseJson(raw: string): any {
  try {
    return JSON.parse(raw)
  } catch {
    return raw
  }
}
