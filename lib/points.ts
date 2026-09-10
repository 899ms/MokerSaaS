import { db } from '@/lib/db'
import { SUBSCRIPTION_PRODUCTS, type SubscriptionPlanType } from '@/lib/stripe'
import { users, pointsHistory } from '@/lib/schema'
import { eq, desc, sql } from 'drizzle-orm'
import { nanoid } from 'nanoid'
import { expireSubscriptionIfNeeded } from '@/lib/subscription'

// ============================================================
// 配置 & 枚举
// ============================================================

// 积分配置 - 可以在这里修改各种奖励积分
export const POINTS_CONFIG = {
  REGISTER_BONUS: 100, // 注册赠送积分
  DAILY_LOGIN_BONUS: 10, // 每日登录奖励
  REFERRAL_BONUS: 200, // 推荐用户奖励
} as const

// 积分操作类型
export enum PointsAction {
  REGISTER = 'register',
  DAILY_LOGIN = 'daily_login',
  REFERRAL = 'referral',
  MANUAL = 'manual',
  USE = 'use',
}

// 积分类型
export enum PointsType {
  PURCHASED = 'purchased', // 购买积分（永不过期）
  GIFTED = 'gifted', // 赠送积分（订阅到期清零）
}

// 操作描述映射
const ACTION_DESCRIPTIONS = {
  [PointsAction.REGISTER]: 'Registration bonus',
  [PointsAction.DAILY_LOGIN]: 'Daily login bonus',
  [PointsAction.REFERRAL]: 'Referral bonus',
  [PointsAction.MANUAL]: 'Manual operation',
  [PointsAction.USE]: '积分使用',
} as const

const DEFAULT_SUBSCRIPTION_GIFTED_POINTS = 1000

export function getSubscriptionGiftedPoints(plan: SubscriptionPlanType | null | undefined) {
  if (!plan) {
    return DEFAULT_SUBSCRIPTION_GIFTED_POINTS
  }
  return SUBSCRIPTION_PRODUCTS[plan]?.giftedPoints ?? DEFAULT_SUBSCRIPTION_GIFTED_POINTS
}

// ============================================================
// 内部工具
// ============================================================

// 添加积分历史记录（内部使用）
async function addPointsHistory(
  userId: string,
  points: number,
  action: PointsAction | string,
  pointsType: PointsType | string,
  description?: string
) {
  await db.insert(pointsHistory).values({
    id: nanoid(),
    userId,
    points,
    pointsType,
    action,
    description: description || (ACTION_DESCRIPTIONS as any)[action] || '',
  })
}

// ============================================================
// 基础 CRUD
// ============================================================

// 添加积分
export async function addPoints(
  userId: string,
  points: number,
  action: PointsAction = PointsAction.MANUAL,
  pointsType: PointsType = PointsType.PURCHASED, // 默认为购买积分
  description?: string
) {
  try {
    // 入口拦截:先检查订阅是否过期
    await expireSubscriptionIfNeeded(userId)

    // 根据积分类型更新不同的字段
    if (pointsType === PointsType.PURCHASED) {
      await db
        .update(users)
        .set({
          points: sql`${users.points} + ${points}`,
          purchasedPoints: sql`${users.purchasedPoints} + ${points}`,
          updatedAt: new Date(),
        })
        .where(eq(users.id, userId))
    } else {
      await db
        .update(users)
        .set({
          points: sql`${users.points} + ${points}`,
          giftedPoints: sql`${users.giftedPoints} + ${points}`,
          updatedAt: new Date(),
        })
        .where(eq(users.id, userId))
    }

    // 添加历史记录
    await addPointsHistory(userId, points, action, pointsType, description)

    // 获取更新后的积分总数
    const user = await db
      .select({ points: users.points })
      .from(users)
      .where(eq(users.id, userId))
      .limit(1)

    const newPoints = user.length > 0 ? user[0].points || 0 : 0
    console.log(`用户 ${userId} 获得 ${points} ${pointsType}积分 (${action})，当前总积分: ${newPoints}`)
    return newPoints
  } catch (error) {
    console.error('添加积分失败:', error)
    throw error
  }
}

// 管理员手动添加积分（兼容原 addPointsManually）
export async function addPointsManually(
  userId: string,
  points: number,
  type: 'purchased' | 'gifted',
  description: string
) {
  try {
    await expireSubscriptionIfNeeded(userId)

    await addPoints(
      userId,
      points,
      PointsAction.MANUAL,
      type as PointsType,
      description
    )

    return {
      success: true,
      pointsAdded: points,
      type,
    }
  } catch (error) {
    console.error('手动添加积分失败:', error)
    throw error
  }
}

// 获取用户积分总数
export async function getUserPoints(userId: string) {
  try {
    const result = await db
      .select({ points: users.points })
      .from(users)
      .where(eq(users.id, userId))
      .limit(1)

    return result[0]?.points || 0
  } catch (error) {
    console.error('获取用户积分失败:', error)
    return 0
  }
}

// 扣除积分（优先扣赠送积分）
export async function deductPoints(
  userId: string,
  points: number,
  description?: string,
  action: string = PointsAction.MANUAL
) {
  try {
    // 入口拦截:先检查订阅是否过期
    await expireSubscriptionIfNeeded(userId)

    const currentPoints = await getUserPoints(userId)

    if (currentPoints < points) {
      throw new Error('Insufficient points')
    }

    // 获取用户当前积分明细
    const user = await db
      .select({
        points: users.points,
        purchasedPoints: users.purchasedPoints,
        giftedPoints: users.giftedPoints,
      })
      .from(users)
      .where(eq(users.id, userId))
      .limit(1)

    if (user.length === 0) {
      throw new Error('User not found')
    }

    const currentUser = user[0]
    const giftedPointsVal = currentUser.giftedPoints || 0
    const purchasedPointsVal = currentUser.purchasedPoints || 0

    // 计算需要从各类型积分中扣除的数量（优先扣除赠送积分）
    let remainingPointsToDeduct = points
    let giftedPointsDeducted = 0
    let purchasedPointsDeducted = 0

    if (giftedPointsVal > 0 && remainingPointsToDeduct > 0) {
      giftedPointsDeducted = Math.min(giftedPointsVal, remainingPointsToDeduct)
      remainingPointsToDeduct -= giftedPointsDeducted
    }

    if (remainingPointsToDeduct > 0) {
      purchasedPointsDeducted = remainingPointsToDeduct
    }

    const newPoints = currentPoints - points

    // 更新用户积分 - 分别扣除 purchasedPoints 和 giftedPoints（余额仍按类型分账）
    await db
      .update(users)
      .set({
        points: newPoints,
        giftedPoints: sql`${users.giftedPoints} - ${giftedPointsDeducted}`,
        purchasedPoints: sql`${users.purchasedPoints} - ${purchasedPointsDeducted}`,
        updatedAt: new Date(),
      })
      .where(eq(users.id, userId))

    // 只写一条 history 记录：总扣除数量 + description
    // pointsType 固定为 PURCHASED 兼容旧字段（前端只关心 -points 和 description）
    await addPointsHistory(
      userId,
      -points,
      action,
      PointsType.PURCHASED,
      description || '积分扣除'
    )

    console.log(`用户 ${userId} 扣除 ${points} 积分（赠送:${giftedPointsDeducted}, 购买:${purchasedPointsDeducted}），当前总积分: ${newPoints}`)
    return newPoints
  } catch (error) {
    console.error('扣除积分失败:', error)
    throw error
  }
}

// ============================================================
// 业务编排
// ============================================================

// 积分使用策略：优先使用赠送积分，再使用购买积分
export async function usePoints(
  userId: string,
  pointsToUse: number,
  description: string,
  action: string = 'use'
) {
  try {
    // 入口拦截
    await expireSubscriptionIfNeeded(userId)

    const user = await db
      .select({
        points: users.points,
        purchasedPoints: users.purchasedPoints,
        giftedPoints: users.giftedPoints,
      })
      .from(users)
      .where(eq(users.id, userId))
      .limit(1)

    if (user.length === 0) {
      throw new Error('用户不存在')
    }

    const currentUser = user[0]
    const totalPoints = currentUser.points || 0
    const giftedPoints = currentUser.giftedPoints || 0
    const purchasedPoints = currentUser.purchasedPoints || 0

    if (totalPoints < pointsToUse) {
      throw new Error('积分不足')
    }

    let remainingPointsToUse = pointsToUse
    let giftedPointsUsed = 0
    let purchasedPointsUsed = 0

    // 优先使用赠送积分
    if (giftedPoints > 0 && remainingPointsToUse > 0) {
      giftedPointsUsed = Math.min(giftedPoints, remainingPointsToUse)
      remainingPointsToUse -= giftedPointsUsed
    }

    // 如果还有剩余需要扣除的积分，使用购买积分
    if (remainingPointsToUse > 0) {
      purchasedPointsUsed = remainingPointsToUse
    }

    // 更新用户积分
    await db
      .update(users)
      .set({
        points: sql`${users.points} - ${pointsToUse}`,
        giftedPoints: sql`${users.giftedPoints} - ${giftedPointsUsed}`,
        purchasedPoints: sql`${users.purchasedPoints} - ${purchasedPointsUsed}`,
        updatedAt: new Date(),
      })
      .where(eq(users.id, userId))

    // 记录积分使用历史
    if (giftedPointsUsed > 0) {
      await db.insert(pointsHistory).values({
        id: nanoid(),
        userId,
        points: -giftedPointsUsed,
        pointsType: 'gifted',
        action,
        description: description,
        createdAt: new Date(),
      })
    }

    if (purchasedPointsUsed > 0) {
      await db.insert(pointsHistory).values({
        id: nanoid(),
        userId,
        points: -purchasedPointsUsed,
        pointsType: 'purchased',
        action,
        description: description,
        createdAt: new Date(),
      })
    }

    return {
      success: true,
      pointsUsed: pointsToUse,
      giftedPointsUsed,
      purchasedPointsUsed,
      remainingPoints: totalPoints - pointsToUse,
    }
  } catch (error) {
    console.error('积分使用失败:', error)
    throw error
  }
}

// ============================================================
// 积分详情（带订阅过期清零）
// ============================================================

// 获取用户积分详情
export async function getUserPointsDetail(userId: string) {
  try {
    // 通过统一的 helper 处理订阅过期清零（带乐观并发、缓存）
    await expireSubscriptionIfNeeded(userId)

    const user = await db.select().from(users).where(eq(users.id, userId)).limit(1)

    if (user.length === 0) {
      throw new Error('用户不存在')
    }

    const currentUser = user[0]

    return {
      totalPoints: currentUser.points || 0,
      purchasedPoints: currentUser.purchasedPoints || 0,
      giftedPoints: currentUser.giftedPoints || 0,
      subscriptionStatus: currentUser.subscriptionStatus,
      subscriptionPlan: currentUser.subscriptionPlan,
      subscriptionCurrentPeriodEnd: currentUser.subscriptionCurrentPeriodEnd,
    }
  } catch (error) {
    console.error('获取用户积分详情失败:', error)
    throw error
  }
}

// ============================================================
// 积分历史
// ============================================================

// 获取用户积分历史
export async function getUserPointsHistory(userId: string, limit: number = 20, offset: number = 0) {
  try {
    const history = await db
      .select({
        id: pointsHistory.id,
        points: pointsHistory.points,
        action: pointsHistory.action,
        description: pointsHistory.description,
        createdAt: pointsHistory.createdAt,
      })
      .from(pointsHistory)
      .where(eq(pointsHistory.userId, userId))
      .orderBy(desc(pointsHistory.createdAt))
      .limit(limit)
      .offset(offset)

    return history
  } catch (error) {
    console.error('获取积分历史失败:', error)
    return []
  }
}

// 获取用户积分历史总数
export async function getUserPointsHistoryCount(userId: string) {
  try {
    const result = await db
      .select({ count: sql<number>`count(*)` })
      .from(pointsHistory)
      .where(eq(pointsHistory.userId, userId))

    return result[0]?.count || 0
  } catch (error) {
    console.error('获取积分历史总数失败:', error)
    return 0
  }
}

// ============================================================
// 业务封装
// ============================================================

// 给新注册用户赠送积分（归类为购买积分，永不过期）
export async function giveRegisterBonus(userId: string) {
  return addPoints(
    userId,
    POINTS_CONFIG.REGISTER_BONUS,
    PointsAction.REGISTER,
    PointsType.PURCHASED // 注册积分归类为购买积分，永不过期
  )
}
