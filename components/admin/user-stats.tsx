"use client"

import { useEffect, useState } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { 
  Users, 
  UserCheck, 
  Shield, 
  CreditCard, 
  Coins, 
  DollarSign, 
  RefreshCw, 
  Search,
  Edit,
  Eye,
  Calendar,
  Mail,
  MoreHorizontal,
  History,
  Wallet,
  ChevronLeft,
  ChevronRight,
  X
} from 'lucide-react'
import { format } from 'date-fns'
import { zhCN, enUS, ja as jaLocale, ko as koLocale } from 'date-fns/locale'
import type { Locale as DateFnsLocale } from 'date-fns/locale'

const APP_DATE_FNS_LOCALE: Record<string, DateFnsLocale> = {
  'zh-CN': zhCN,
  'zh-TW': zhCN,
  ja: jaLocale,
  ko: koLocale,
}
function getDateFnsLocale(locale: string | undefined | null): DateFnsLocale {
  return APP_DATE_FNS_LOCALE[locale || ''] || enUS
}
import { useTranslations, useLocale } from 'next-intl'
import { toast } from 'sonner'

interface User {
  id: string
  name: string | null
  email: string
  emailVerified: string | null
  role: string
  points: number
  purchasedPoints: number
  giftedPoints: number
  subscriptionStatus: string | null
  subscriptionPlan: string | null
  subscriptionCurrentPeriodEnd: string | null
  createdAt: string
  updatedAt: string
}

interface UserStats {
  totalUsers: number
  verifiedUsers: number
  adminUsers: number
  subscribedUsers: number
  totalPoints: number
  totalPayments: number
}

interface UserListResponse {
  users: User[]
  pagination: {
    page: number
    limit: number
    total: number
    totalPages: number
  }
}

export function UserStats() {
  const t = useTranslations('admin.users')
  const locale = useLocale()
  const [stats, setStats] = useState<UserStats | null>(null)
  const [users, setUsers] = useState<User[]>([])
  const [page, setPage] = useState(1)
  const [limit, setLimit] = useState(10)
  const [pagination, setPagination] = useState({
    page: 1,
    limit: 10,
    total: 0,
    totalPages: 0
  })
  const formatShort = (date: Date) =>
    format(
      date,
      (locale === 'zh-CN' || locale === 'zh-TW' || locale === 'ja' || locale === 'ko') ? 'yyyy年MM月dd日' : 'MMM dd, yyyy',
      { locale: getDateFnsLocale(locale) }
    )
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [search, setSearch] = useState('')
  const [roleFilter, setRoleFilter] = useState('all')
  const [emailVerifiedFilter, setEmailVerifiedFilter] = useState('all')
  const [subscriptionStatusFilter, setSubscriptionStatusFilter] = useState('all')
  const [selectedUser, setSelectedUser] = useState<User | null>(null)
  const [dialogOpen, setDialogOpen] = useState(false)
  const [actionType, setActionType] = useState<'role' | 'points' | 'subscription' | null>(null)
  const [pointsHistoryDialogOpen, setPointsHistoryDialogOpen] = useState(false)
  const [paymentsDialogOpen, setPaymentsDialogOpen] = useState(false)

  const fetchStats = async () => {
    try {
      const response = await fetch('/api/admin/users?action=stats')
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}))
        throw new Error(errorData.error || `HTTP ${response.status}: ${response.statusText}`)
      }
      const data = await response.json()
      setStats(data)
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : t('messages.fetch_stats_failed')
      setError(`${t('messages.fetch_stats_failed')}: ${errorMessage}`)
      console.error('Error fetching stats:', err)
    }
  }

  const fetchUsers = async (targetPage?: number) => {
    const pageToFetch = targetPage ?? page
    try {
      const params = new URLSearchParams({
        action: 'list',
        page: pageToFetch.toString(),
        limit: limit.toString(),
      })
      
      if (search) params.append('search', search)
      if (roleFilter && roleFilter !== 'all') params.append('role', roleFilter)
      if (emailVerifiedFilter && emailVerifiedFilter !== 'all') params.append('emailVerified', emailVerifiedFilter)
      if (subscriptionStatusFilter && subscriptionStatusFilter !== 'all') params.append('subscriptionStatus', subscriptionStatusFilter)

      const response = await fetch(`/api/admin/users?${params}`)
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}))
        throw new Error(errorData.error || `HTTP ${response.status}: ${response.statusText}`)
      }
      const data: UserListResponse = await response.json()
      setUsers(data.users)
      setPagination(data.pagination)
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : t('messages.fetch_users_failed')
      setError(`${t('messages.fetch_users_failed')}: ${errorMessage}`)
      console.error('Error fetching users:', err)
    }
  }

  const fetchData = async () => {
    setLoading(true)
    setError(null)
    await Promise.all([fetchStats(), fetchUsers()])
    setLoading(false)
  }

  useEffect(() => {
    fetchData()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => {
    setPage(1)
    fetchUsers(1)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [limit, search, roleFilter, emailVerifiedFilter, subscriptionStatusFilter])

  useEffect(() => {
    fetchUsers(page)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [page])

  const handleUpdateUser = async (userId: string, action: string, data: any) => {
    try {
      const response = await fetch(`/api/admin/users/${userId}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ action, ...data }),
      })

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error || '更新失败')
      }

      const result = await response.json()
      toast.success(result.message)
      fetchUsers(page)
      setDialogOpen(false)
    } catch (error) {
      toast.error(error instanceof Error ? error.message : '更新失败')
    }
  }

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
    }).format(amount / 100)
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="text-center py-8">
        <p className="text-destructive mb-4">{error}</p>
        <Button onClick={fetchData} variant="outline">
          <RefreshCw className="h-4 w-4 mr-2" />
          {t('actions.retry')}
        </Button>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* 统计卡片 */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">{t('stats.total_users')}</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats?.totalUsers || 0}</div>
            <p className="text-xs text-muted-foreground">
              {t('stats.total_users_desc')}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">{t('stats.verified_users')}</CardTitle>
            <UserCheck className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats?.verifiedUsers || 0}</div>
            <p className="text-xs text-muted-foreground">
              {t('stats.verified_users_desc')}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">{t('stats.admin_users')}</CardTitle>
            <Shield className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats?.adminUsers || 0}</div>
            <p className="text-xs text-muted-foreground">
              {t('stats.admin_users_desc')}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">{t('stats.subscribed_users')}</CardTitle>
            <CreditCard className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats?.subscribedUsers || 0}</div>
            <p className="text-xs text-muted-foreground">
              {t('stats.subscribed_users_desc')}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">{t('stats.total_points')}</CardTitle>
            <Coins className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats?.totalPoints || 0}</div>
            <p className="text-xs text-muted-foreground">
              {t('stats.total_points_desc')}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">{t('stats.total_payments')}</CardTitle>
            <DollarSign className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{formatCurrency(stats?.totalPayments || 0)}</div>
            <p className="text-xs text-muted-foreground">
              {t('stats.total_payments_desc')}
            </p>
          </CardContent>
        </Card>
      </div>

      {/* 用户列表 */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <div>
            <CardTitle>{t('user_list.title')}</CardTitle>
            <CardDescription>{t('user_list.description')}</CardDescription>
          </div>
          <Button onClick={fetchData} variant="outline" size="sm">
            <RefreshCw className="h-4 w-4 mr-2" />
            {t('actions.refresh')}
          </Button>
        </CardHeader>
        <CardContent>
          {/* 筛选器 */}
          <div className="flex flex-col lg:flex-row gap-4 mb-6">
            <div className="flex-1 min-w-0">
              <div className="relative">
                <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder={t('user_list.search_placeholder')}
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="pl-8"
                />
              </div>
            </div>
            <div className="flex flex-col sm:flex-row gap-4">
              <Select value={roleFilter} onValueChange={setRoleFilter}>
                <SelectTrigger className="w-full sm:w-[180px]">
                  <SelectValue placeholder={t('user_list.filter_role')} />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">{t('user_list.all_roles')}</SelectItem>
                  <SelectItem value="user">{t('user_list.role_user')}</SelectItem>
                  <SelectItem value="admin">{t('user_list.role_admin')}</SelectItem>
                </SelectContent>
              </Select>
              <Select value={emailVerifiedFilter} onValueChange={setEmailVerifiedFilter}>
                <SelectTrigger className="w-full sm:w-[180px]">
                  <SelectValue placeholder={t('user_list.filter_email_status')} />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">{t('user_list.all_statuses')}</SelectItem>
                  <SelectItem value="true">{t('user_list.email_verified')}</SelectItem>
                  <SelectItem value="false">{t('user_list.email_unverified')}</SelectItem>
                </SelectContent>
              </Select>
              <Select value={subscriptionStatusFilter} onValueChange={setSubscriptionStatusFilter}>
                <SelectTrigger className="w-full sm:w-[180px]">
                  <SelectValue placeholder={t('user_list.filter_subscription_status')} />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">{t('user_list.all_subscription_statuses')}</SelectItem>
                  <SelectItem value="active">{t('user_list.subscription_active')}</SelectItem>
                  <SelectItem value="cancelled">{t('user_list.subscription_cancelled')}</SelectItem>
                  <SelectItem value="past_due">{t('user_list.subscription_past_due')}</SelectItem>
                  <SelectItem value="paused">{t('user_list.subscription_paused')}</SelectItem>
                  <SelectItem value="none">{t('user_list.subscription_none')}</SelectItem>
                </SelectContent>
              </Select>
              <Select
                value={String(limit)}
                onValueChange={(v) => setLimit(parseInt(v, 10))}
              >
                <SelectTrigger className="w-full sm:w-[110px]">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="10">{t('user_list.page_size_10')}</SelectItem>
                  <SelectItem value="20">{t('user_list.page_size_20')}</SelectItem>
                  <SelectItem value="50">{t('user_list.page_size_50')}</SelectItem>
                  <SelectItem value="100">{t('user_list.page_size_100')}</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* 用户表格 */}
          <div className="rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="min-w-[250px]">{t('user_list.table.user_info')}</TableHead>
                  <TableHead className="min-w-[100px]">{t('user_list.table.role')}</TableHead>
                  <TableHead className="min-w-[120px]">{t('user_list.table.email_status')}</TableHead>
                  <TableHead className="min-w-[160px]">{t('user_list.table.points')}</TableHead>
                  <TableHead className="min-w-[140px]">{t('user_list.table.subscription')}</TableHead>
                  <TableHead className="min-w-[150px]">{t('user_list.table.subscription_expiry')}</TableHead>
                  <TableHead className="min-w-[120px]">{t('user_list.table.created_at')}</TableHead>
                  <TableHead className="min-w-[150px]">{t('user_list.table.actions')}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {users.map((user) => (
                  <TableRow key={user.id}>
                    <TableCell>
                      <div>
                        <div className="font-medium">{user.name || t('user_list.table.no_name')}</div>
                        <div className="text-sm text-muted-foreground">{user.email}</div>
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge variant={user.role === 'admin' ? 'destructive' : 'default'}>
                        {user.role === 'admin' ? t('user_list.table.role_admin') : t('user_list.table.role_user')}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center">
                        <Mail className="h-4 w-4 mr-2 text-muted-foreground" />
                        <Badge variant={user.emailVerified ? 'default' : 'secondary'}>
                          {user.emailVerified ? t('user_list.table.email_verified') : t('user_list.table.email_unverified')}
                        </Badge>
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="text-sm">
                        <div className="font-medium">{t('user_list.table.points_total')}: {user.points}</div>
                        <div className="text-muted-foreground text-xs">
                          {t('user_list.table.points_purchased')}: {user.purchasedPoints} | {t('user_list.table.points_gifted')}: {user.giftedPoints}
                        </div>
                      </div>
                    </TableCell>
                    <TableCell>
                      {user.subscriptionStatus ? (
                        <Badge variant={user.subscriptionStatus === 'active' ? 'default' : 'secondary'}>
                          {t(`user_list.table.plan_${user.subscriptionPlan || 'pro'}`)} - {t(`user_list.table.status_${user.subscriptionStatus}`)}
                        </Badge>
                      ) : (
                        <span className="text-muted-foreground">{t('user_list.table.no_subscription')}</span>
                      )}
                    </TableCell>
                    <TableCell>
                      {user.subscriptionCurrentPeriodEnd ? (
                        <div className="text-sm">
                          <div className="flex items-center whitespace-nowrap">
                            <Calendar className="h-4 w-4 mr-2 text-muted-foreground flex-shrink-0" />
                            <span>
                              {format(
                                new Date(user.subscriptionCurrentPeriodEnd),
                                (locale === 'zh-CN' || locale === 'zh-TW' || locale === 'ja' || locale === 'ko') ? 'yyyy年MM月dd日' : 'MMM dd, yyyy',
                                { locale: getDateFnsLocale(locale) }
                              )}
                            </span>
                          </div>
                          {new Date(user.subscriptionCurrentPeriodEnd) < new Date() ? (
                            <Badge variant="destructive" className="mt-1 text-xs">{t('user_list.table.expired')}</Badge>
                          ) : new Date(user.subscriptionCurrentPeriodEnd) < new Date(Date.now() + 7 * 24 * 60 * 60 * 1000) ? (
                            <Badge variant="secondary" className="mt-1 text-xs">{t('user_list.table.expiring_soon')}</Badge>
                          ) : null}
                        </div>
                      ) : (
                        <span className="text-muted-foreground">-</span>
                      )}
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center whitespace-nowrap">
                        <Calendar className="h-4 w-4 mr-2 text-muted-foreground flex-shrink-0" />
                        <span className="text-sm">
                          {format(
                            new Date(user.createdAt),
                            (locale === 'zh-CN' || locale === 'zh-TW' || locale === 'ja' || locale === 'ko') ? 'yyyy年MM月dd日' : 'MMM dd, yyyy',
                            { locale: getDateFnsLocale(locale) }
                          )}
                        </span>
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => {
                            setSelectedUser(user)
                            setActionType('role')
                            setDialogOpen(true)
                          }}
                          title={t('user_list.table.edit_role')}
                        >
                          <Edit className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => {
                            setSelectedUser(user)
                            setActionType('points')
                            setDialogOpen(true)
                          }}
                          title={t('user_list.table.adjust_points')}
                        >
                          <Coins className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => {
                            setSelectedUser(user)
                            setActionType('subscription')
                            setDialogOpen(true)
                          }}
                          title={t('user_list.table.manage_subscription')}
                        >
                          <CreditCard className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => {
                            setSelectedUser(user)
                            setPointsHistoryDialogOpen(true)
                          }}
                          title={t('user_list.table.view_points_history')}
                        >
                          <History className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => {
                            setSelectedUser(user)
                            setPaymentsDialogOpen(true)
                          }}
                          title={t('user_list.table.view_payments')}
                        >
                          <Wallet className="h-4 w-4" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>

          {/* 分页 */}
          {pagination.totalPages > 1 && (
            <div className="flex items-center justify-between mt-4">
              <div className="text-sm text-muted-foreground">
                {t('pagination.page_info', { page: pagination.page, totalPages: pagination.totalPages })} | {t('pagination.total_records', { total: pagination.total })}
              </div>
              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setPage(pagination.page - 1)}
                  disabled={pagination.page <= 1}
                >
                  {t('pagination.previous')}
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setPage(pagination.page + 1)}
                  disabled={pagination.page >= pagination.totalPages}
                >
                  {t('pagination.next')}
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* 操作对话框 */}
      <UserActionDialog
        user={selectedUser}
        actionType={actionType}
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        onUpdate={handleUpdateUser}
      />

      {/* 积分历史对话框 */}
      <PointsHistoryDialog
        user={selectedUser}
        open={pointsHistoryDialogOpen}
        onOpenChange={setPointsHistoryDialogOpen}
      />

      {/* 支付记录对话框 */}
      <PaymentsDialog
        user={selectedUser}
        open={paymentsDialogOpen}
        onOpenChange={setPaymentsDialogOpen}
      />
    </div>
  )
}

function UserActionDialog({
  user,
  actionType,
  open,
  onOpenChange,
  onUpdate
}: {
  user: User | null
  actionType: 'role' | 'points' | 'subscription' | null
  open: boolean
  onOpenChange: (open: boolean) => void
  onUpdate: (userId: string, action: string, data: any) => void
}) {
  const t = useTranslations('admin.users')
  const locale = useLocale()
  const [role, setRole] = useState('')
  const [points, setPoints] = useState('')
  const [pointsType, setPointsType] = useState('purchased')
  const [description, setDescription] = useState('')
  const formatShort = (date: Date) =>
    format(
      date,
      (locale === 'zh-CN' || locale === 'zh-TW' || locale === 'ja' || locale === 'ko') ? 'yyyy年MM月dd日' : 'MMM dd, yyyy',
      { locale: getDateFnsLocale(locale) }
    )
  const [subscriptionStatus, setSubscriptionStatus] = useState('')
  const [subscriptionPlan, setSubscriptionPlan] = useState('')
  const [subscriptionEndDate, setSubscriptionEndDate] = useState('')

  useEffect(() => {
    if (user && actionType === 'role') {
      setRole(user.role)
    } else if (user && actionType === 'subscription') {
      setSubscriptionStatus(user.subscriptionStatus || '')
      setSubscriptionPlan(user.subscriptionPlan || '')
      setSubscriptionEndDate(
        user.subscriptionCurrentPeriodEnd 
          ? format(new Date(user.subscriptionCurrentPeriodEnd), 'yyyy-MM-dd')
          : ''
      )
      
      // 如果用户已经有active订阅和计划，立即计算续费时间
      if (user.subscriptionStatus === 'active' && user.subscriptionPlan) {
        // 延迟执行以确保状态已设置
        setTimeout(() => {
          calculateEndDate(user.subscriptionPlan!)
        }, 100)
      }
    }
  }, [user, actionType])

  const calculateEndDate = (plan: string) => {
    // 获取当前用户的订阅到期时间，如果没有则使用当前时间
    const currentEndDate = user?.subscriptionCurrentPeriodEnd 
      ? new Date(user.subscriptionCurrentPeriodEnd)
      : new Date()
    
    // 如果当前订阅已过期，则从当前时间开始计算
    const now = new Date()
    const startDate = currentEndDate > now ? currentEndDate : now
    
    // 创建新的结束日期
    const endDate = new Date(startDate)
    
    // 根据计划设置固定时长
    if (plan === 'trial') {
      endDate.setDate(endDate.getDate() + 7) // Trial 7天
    } else if (plan === 'pro') {
      endDate.setMonth(endDate.getMonth() + 1) // Pro 1个月
    } else if (plan === 'annual') {
      endDate.setFullYear(endDate.getFullYear() + 1) // Annual 1年
    }
    
    // 确保设置正确的日期格式
    const formattedDate = endDate.toISOString().split('T')[0]
    setSubscriptionEndDate(formattedDate)
  }

  const handleSubmit = () => {
    if (!user) return

    if (actionType === 'role') {
      onUpdate(user.id, 'updateRole', { role })
    } else if (actionType === 'points') {
      const pointsValue = parseInt(points)
      
      // 验证赠送积分需要订阅到期时间
      if (pointsType === 'gifted' && pointsValue > 0) {
        if (!user.subscriptionCurrentPeriodEnd) {
          toast.error(t('dialogs.adjust_points.gifted_points_requires_subscription'))
          return
        }
        // 检查订阅是否已过期
        const now = new Date()
        if (new Date(user.subscriptionCurrentPeriodEnd) < now) {
          toast.error(t('dialogs.adjust_points.subscription_expired_error') || '用户订阅已过期，无法添加赠送积分')
          return
        }
      }
      
      onUpdate(user.id, 'adjustPoints', { 
        points: pointsValue, 
        pointsType, 
        description 
      })
    } else if (actionType === 'subscription') {
      onUpdate(user.id, 'updateSubscription', { 
        subscriptionStatus, 
        subscriptionPlan, 
        subscriptionEndDate 
      })
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>
            {actionType === 'role' ? t('dialogs.edit_role.title') : 
             actionType === 'points' ? t('dialogs.adjust_points.title') : 
             t('dialogs.manage_subscription.title')}
          </DialogTitle>
          <DialogDescription>
            {t('dialogs.user_info', { name: user?.name || t('dialogs.no_name'), email: user?.email || '' })}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {actionType === 'role' && (
            <div>
              <Label htmlFor="role">{t('dialogs.edit_role.role_label')}</Label>
              <Select value={role} onValueChange={setRole}>
                <SelectTrigger>
                  <SelectValue placeholder={t('dialogs.edit_role.role_placeholder')} />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="user">{t('dialogs.edit_role.role_user')}</SelectItem>
                  <SelectItem value="admin">{t('dialogs.edit_role.role_admin')}</SelectItem>
                </SelectContent>
              </Select>
            </div>
          )}

          {actionType === 'points' && (
            <>
              <div>
                <Label htmlFor="points">{t('dialogs.adjust_points.points_label')}</Label>
                <Input
                  id="points"
                  type="number"
                  placeholder={t('dialogs.adjust_points.points_placeholder')}
                  value={points}
                  onChange={(e) => setPoints(e.target.value)}
                />
              </div>
              <div>
                <Label htmlFor="pointsType">{t('dialogs.adjust_points.points_type_label')}</Label>
                <Select value={pointsType} onValueChange={setPointsType}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="purchased">{t('dialogs.adjust_points.points_type_purchased')}</SelectItem>
                    <SelectItem value="gifted">{t('dialogs.adjust_points.points_type_gifted')}</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              {pointsType === 'purchased' && (
                <div className="p-3 bg-muted rounded-md text-sm text-muted-foreground">
                  {t('dialogs.adjust_points.purchased_points_info')}
                </div>
              )}
              {pointsType === 'gifted' && (
                <div className="space-y-2">
                  {user?.subscriptionCurrentPeriodEnd ? (
                    <div className="p-3 bg-blue-50 dark:bg-blue-950 rounded-md">
                      <div className="flex items-center text-sm">
                        <Calendar className="h-4 w-4 mr-2 text-blue-600 dark:text-blue-400" />
                        <span className="text-blue-900 dark:text-blue-100 font-medium">
                          {t('dialogs.adjust_points.gifted_points_expiry_label')}:
                        </span>
                        <span className="ml-2 text-blue-700 dark:text-blue-300">
                          {format(
                            new Date(user.subscriptionCurrentPeriodEnd),
                            (locale === 'zh-CN' || locale === 'zh-TW' || locale === 'ja' || locale === 'ko') ? 'yyyy年MM月dd日' : 'MMM dd, yyyy',
                            { locale: getDateFnsLocale(locale) }
                          )}
                        </span>
                      </div>
                      <p className="text-xs text-blue-700 dark:text-blue-400 mt-2">
                        {t('dialogs.adjust_points.gifted_points_expiry_info')}
                      </p>
                    </div>
                  ) : (
                    <div className="p-3 bg-yellow-50 dark:bg-yellow-950 rounded-md border border-yellow-200 dark:border-yellow-800">
                      <p className="text-sm text-yellow-900 dark:text-yellow-100 font-medium">
                        {t('dialogs.adjust_points.gifted_points_requires_subscription')}
                      </p>
                      <p className="text-xs text-yellow-700 dark:text-yellow-300 mt-1">
                        {t('dialogs.adjust_points.gifted_points_no_subscription')}
                      </p>
                    </div>
                  )}
                </div>
              )}
              <div>
                <Label htmlFor="description">{t('dialogs.adjust_points.description_label')}</Label>
                <Textarea
                  id="description"
                  placeholder={t('dialogs.adjust_points.description_placeholder')}
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                />
              </div>
            </>
          )}

          {actionType === 'subscription' && (
            <>
              <div>
                <Label htmlFor="subscriptionStatus">{t('dialogs.manage_subscription.status_label')}</Label>
                <Select value={subscriptionStatus} onValueChange={(value) => {
                  setSubscriptionStatus(value)
                  // 当状态设为active且已选择计划时，自动计算到期时间
                  if (value === 'active' && subscriptionPlan) {
                    calculateEndDate(subscriptionPlan)
                  }
                }}>
                  <SelectTrigger>
                    <SelectValue placeholder={t('dialogs.manage_subscription.status_placeholder')} />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="active">{t('dialogs.manage_subscription.status_active')}</SelectItem>
                    <SelectItem value="cancelled">{t('dialogs.manage_subscription.status_cancelled')}</SelectItem>
                    <SelectItem value="past_due">{t('dialogs.manage_subscription.status_past_due')}</SelectItem>
                    <SelectItem value="paused">{t('dialogs.manage_subscription.status_paused')}</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label htmlFor="subscriptionPlan">{t('dialogs.manage_subscription.plan_label')}</Label>
                <Select value={subscriptionPlan} onValueChange={(value) => {
                  setSubscriptionPlan(value)
                  // 自动计算到期时间 - 无论是否已经选择过，都重新计算
                  if (value && subscriptionStatus === 'active') {
                    calculateEndDate(value)
                  }
                }}>
                  <SelectTrigger>
                    <SelectValue placeholder={t('dialogs.manage_subscription.plan_placeholder')} />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="trial">{t('dialogs.manage_subscription.plan_trial')}</SelectItem>
                    <SelectItem value="pro">{t('dialogs.manage_subscription.plan_pro')}</SelectItem>
                    <SelectItem value="annual">{t('dialogs.manage_subscription.plan_annual')}</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              {subscriptionStatus === 'active' && subscriptionPlan && (
                <div>
                  <Label>{t('dialogs.manage_subscription.end_date_label')}</Label>
                  <div className="p-2 bg-muted rounded-md text-sm">
                    {subscriptionEndDate ? 
                      format(new Date(subscriptionEndDate), (locale === 'zh-CN' || locale === 'zh-TW' || locale === 'ja' || locale === 'ko') ? 'yyyy年MM月dd日' : 'MMM dd, yyyy', { locale: getDateFnsLocale(locale) }) : 
                      t('dialogs.manage_subscription.select_plan_first')
                    }
                  </div>
                  <p className="text-xs text-muted-foreground mt-1">
                    {user?.subscriptionCurrentPeriodEnd && new Date(user.subscriptionCurrentPeriodEnd) > new Date() 
                      ? t('dialogs.manage_subscription.cumulative_calculated')
                      : t('dialogs.manage_subscription.auto_calculated')
                    }
                  </p>
                </div>
              )}
            </>
          )}
        </div>

        <div className="flex justify-end gap-2">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            {t('dialogs.cancel')}
          </Button>
          <Button onClick={handleSubmit}>
            {t('dialogs.confirm')}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}

// ============================================================
// 积分历史对话框（管理员查看用户的积分明细）
// ============================================================

interface PointsHistoryItem {
  id: string
  points: number
  pointsType: string
  action: string
  description: string | null
  createdAt: string | Date
}

interface PointsHistoryResponse {
  success: boolean
  user?: { id: string; email: string; name: string | null }
  history: PointsHistoryItem[]
  stats: {
    totalEarned: number
    totalSpent: number
    purchasedPoints: number
    giftedPoints: number
    currentPoints: number
  }
  pagination: {
    page: number
    limit: number
    total: number
    totalPages: number
  }
}

function PointsHistoryDialog({
  user,
  open,
  onOpenChange,
}: {
  user: User | null
  open: boolean
  onOpenChange: (open: boolean) => void
}) {
  const t = useTranslations('admin.users')
  const tPoints = useTranslations('profile')
  const locale = useLocale()
  const [data, setData] = useState<PointsHistoryResponse | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [page, setPage] = useState(1)
  const [limit, setLimit] = useState(20)
  const [pointsTypeFilter, setPointsTypeFilter] = useState('all')

  const fetchHistory = async () => {
    if (!user) return
    setLoading(true)
    setError(null)
    try {
      const params = new URLSearchParams({
        page: page.toString(),
        limit: limit.toString(),
      })
      if (pointsTypeFilter && pointsTypeFilter !== 'all') {
        params.append('pointsType', pointsTypeFilter)
      }
      const res = await fetch(`/api/admin/users/${user.id}/points-history?${params}`)
      if (!res.ok) {
        const errData = await res.json().catch(() => ({}))
        throw new Error(errData.error || `HTTP ${res.status}`)
      }
      const json: PointsHistoryResponse = await res.json()
      setData(json)
    } catch (err) {
      setError(err instanceof Error ? err.message : t('messages.fetch_history_failed'))
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    if (open) {
      setPage(1)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, pointsTypeFilter])

  useEffect(() => {
    if (open) fetchHistory()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, page, limit, pointsTypeFilter])

  // 积分历史 action 字段 -> 当前 locale 下的可读描述。
  // 数据库里的 description 是写入时的硬编码字符串（多数为中文），直接渲染会出现英文界面显示中文。
  // 这里按 action 走翻译 key（profile.points_actions.*），保证 UI 语言切换时描述也跟着切换。
  const getPointsActionDisplay = (action: string, description: string | null | undefined): string => {
    // 从中文硬编码描述里提取订阅计划名（数据库里没有结构化 plan 字段，只能反向解析）
    const planName = description ? description.match(/(?:订阅|续订|升级)([A-Za-z]+)\s*赠送积分/)?.[1]
      ?? description.match(/(?:订阅|续订|升级)([A-Za-z]+)赠送积分/)?.[1]
      : null
    const planDisplay = planName
      ? (() => {
          try {
            const v = tPoints(`plan_${planName.toLowerCase()}`)
            return v || planName.charAt(0).toUpperCase() + planName.slice(1)
          } catch {
            return planName.charAt(0).toUpperCase() + planName.slice(1)
          }
        })()
      : ''

    switch (action) {
      case 'register':
        return tPoints('points_actions.register')
      case 'email_verify':
        return tPoints('points_actions.email_verify')
      case 'daily_login':
        return tPoints('points_actions.daily_login')
      case 'referral':
        return tPoints('points_actions.referral')
      case 'manual':
        return tPoints('points_actions.manual')
      case 'purchase':
        return tPoints('points_actions.purchase')
      case 'subscription_gift':
        return tPoints('points_actions.subscription_gift', { plan: planDisplay })
      case 'subscription_renewal_gift':
        return tPoints('points_actions.subscription_renewal_gift', { plan: planDisplay })
      case 'subscription_upgrade_gift':
        return tPoints('points_actions.subscription_upgrade_gift', { plan: planDisplay })
      case 'subscription_reward':
        return tPoints('points_actions.subscription_reward')
      case 'subscription_expired':
        return tPoints('points_actions.subscription_expired')
      default:
        // 未知 action：回退到原始 description，最后回退到 unknown 翻译
        return description || tPoints('points_actions.unknown')
    }
  }

  const formatDateTime = (d: string | Date) =>
    format(
      new Date(d),
      (locale === 'zh-CN' || locale === 'zh-TW' || locale === 'ja' || locale === 'ko')
        ? 'yyyy年MM月dd日 HH:mm'
        : 'MMM dd, yyyy HH:mm',
      { locale: getDateFnsLocale(locale) }
    )

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <History className="h-5 w-5" />
            {t('points_history.title')}
          </DialogTitle>
          <DialogDescription>
            {t('dialogs.user_info', { name: user?.name || t('dialogs.no_name'), email: user?.email || '' })}
          </DialogDescription>
        </DialogHeader>

        <div className="flex flex-col sm:flex-row gap-2 mb-3">
          <div className="flex items-center gap-2">
            <span className="text-sm text-muted-foreground">{t('points_history.filter_type')}:</span>
            <Select value={pointsTypeFilter} onValueChange={setPointsTypeFilter}>
              <SelectTrigger className="w-[140px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">{t('points_history.all_types')}</SelectItem>
                <SelectItem value="purchased">{t('points_history.type_purchased')}</SelectItem>
                <SelectItem value="gifted">{t('points_history.type_gifted')}</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="flex items-center gap-2 ml-auto">
            <span className="text-sm text-muted-foreground">{t('user_list.page_size_10').split(' ')[0]}:</span>
            <Select value={String(limit)} onValueChange={(v) => { setLimit(parseInt(v, 10)); setPage(1) }}>
              <SelectTrigger className="w-[90px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="10">10</SelectItem>
                <SelectItem value="20">20</SelectItem>
                <SelectItem value="50">50</SelectItem>
                <SelectItem value="100">100</SelectItem>
              </SelectContent>
            </Select>
            <Button variant="outline" size="sm" onClick={fetchHistory} disabled={loading}>
              <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
            </Button>
          </div>
        </div>

        {/* 统计概览 */}
        {data?.stats && (
          <div className="grid grid-cols-2 md:grid-cols-5 gap-2 mb-3">
            <StatBox label={t('points_history.current_points')} value={data.stats.currentPoints} />
            <StatBox label={t('points_history.purchased_points')} value={data.stats.purchasedPoints} />
            <StatBox label={t('points_history.gifted_points')} value={data.stats.giftedPoints} />
            <StatBox label={t('points_history.total_earned')} value={`+${data.stats.totalEarned}`} positive />
            <StatBox label={t('points_history.total_spent')} value={`-${data.stats.totalSpent}`} negative />
          </div>
        )}

        {error && (
          <div className="text-sm text-destructive py-2">{error}</div>
        )}

        <div className="flex-1 overflow-auto border rounded-md">
          <Table>
            <TableHeader className="sticky top-0 bg-background">
              <TableRow>
                <TableHead>{t('points_history.col_time')}</TableHead>
                <TableHead>{t('points_history.col_action')}</TableHead>
                <TableHead>{t('points_history.col_type')}</TableHead>
                <TableHead className="text-right">{t('points_history.col_change')}</TableHead>
                <TableHead>{t('points_history.col_desc')}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading && !data && (
                <TableRow>
                  <TableCell colSpan={5} className="text-center py-8 text-muted-foreground">
                    {t('points_history.loading')}
                  </TableCell>
                </TableRow>
              )}
              {data?.history?.length === 0 && (
                <TableRow>
                  <TableCell colSpan={5} className="text-center py-8 text-muted-foreground">
                    {t('points_history.empty')}
                  </TableCell>
                </TableRow>
              )}
              {data?.history?.map((item) => (
                <TableRow key={item.id}>
                  <TableCell className="text-xs whitespace-nowrap">
                    {formatDateTime(item.createdAt)}
                  </TableCell>
                  <TableCell>
                    <Badge variant="outline">{item.action}</Badge>
                  </TableCell>
                  <TableCell className="text-xs">
                    {item.pointsType === 'purchased' ? t('points_history.type_purchased') : t('points_history.type_gifted')}
                  </TableCell>
                  <TableCell className={`text-right font-mono ${item.points > 0 ? 'text-green-600' : item.points < 0 ? 'text-red-600' : ''}`}>
                    {item.points > 0 ? `+${item.points}` : item.points}
                  </TableCell>
                  <TableCell className="text-xs text-muted-foreground max-w-[260px] truncate" title={getPointsActionDisplay(item.action, item.description)}>
                    {getPointsActionDisplay(item.action, item.description)}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>

        {/* 分页 */}
        {data && data.pagination.totalPages > 1 && (
          <div className="flex items-center justify-between pt-3">
            <div className="text-sm text-muted-foreground">
              {t('pagination.page_info', { page: data.pagination.page, totalPages: data.pagination.totalPages })} |{' '}
              {t('pagination.total_records', { total: data.pagination.total })}
            </div>
            <div className="flex items-center gap-2">
              <Button variant="outline" size="sm" onClick={() => setPage(Math.max(1, page - 1))} disabled={page <= 1}>
                <ChevronLeft className="h-4 w-4" />
                {t('pagination.previous')}
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setPage(Math.min(data.pagination.totalPages, page + 1))}
                disabled={page >= data.pagination.totalPages}
              >
                {t('pagination.next')}
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  )
}

function StatBox({ label, value, positive, negative }: { label: string; value: number | string; positive?: boolean; negative?: boolean }) {
  const color = positive ? 'text-green-600' : negative ? 'text-red-600' : ''
  return (
    <div className="rounded-md border bg-card px-3 py-2">
      <div className="text-xs text-muted-foreground">{label}</div>
      <div className={`text-lg font-semibold ${color}`}>{value}</div>
    </div>
  )
}

// ============================================================
// 支付记录对话框（管理员查看用户的 Stripe 支付明细）
// ============================================================

interface PaymentRecord {
  id: string
  paymentType: string
  paymentStatus: string
  amount: number
  currency: string
  productName: string | null
  pointsAmount: number | null
  pointsType: string | null
  subscriptionPlan: string | null
  refundAmount: number | null
  refundReason: string | null
  refundedAt: string | Date | null
  paymentIntentId: string | null
  checkoutSessionId: string | null
  invoiceId: string | null
  subscriptionId: string | null
  createdAt: string | Date
}

interface PaymentsResponse {
  success: boolean
  user?: { id: string; email: string; name: string | null }
  payments: PaymentRecord[]
  stats: {
    totalPayments: number
    succeededAmount: number
    refundedAmount: number
    succeededCount: number
    failedCount: number
    refundedCount: number
    subscriptionCount: number
    pointsPurchaseCount: number
    totalPointsPurchased: number
    totalPointsGifted: number
  }
  pagination: {
    page: number
    limit: number
    total: number
    totalPages: number
  }
}

function PaymentsDialog({
  user,
  open,
  onOpenChange,
}: {
  user: User | null
  open: boolean
  onOpenChange: (open: boolean) => void
}) {
  const t = useTranslations('admin.users')
  const tPoints = useTranslations('profile')
  const locale = useLocale()
  const [data, setData] = useState<PaymentsResponse | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [page, setPage] = useState(1)
  const [limit, setLimit] = useState(20)
  const [typeFilter, setTypeFilter] = useState('all')
  const [statusFilter, setStatusFilter] = useState('all')

  const fetchPayments = async () => {
    if (!user) return
    setLoading(true)
    setError(null)
    try {
      const params = new URLSearchParams({
        page: page.toString(),
        limit: limit.toString(),
      })
      if (typeFilter && typeFilter !== 'all') params.append('paymentType', typeFilter)
      if (statusFilter && statusFilter !== 'all') params.append('paymentStatus', statusFilter)
      const res = await fetch(`/api/admin/users/${user.id}/payments?${params}`)
      if (!res.ok) {
        const errData = await res.json().catch(() => ({}))
        throw new Error(errData.error || `HTTP ${res.status}`)
      }
      const json: PaymentsResponse = await res.json()
      setData(json)
    } catch (err) {
      setError(err instanceof Error ? err.message : t('messages.fetch_payments_failed'))
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    if (open) setPage(1)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, typeFilter, statusFilter])

  useEffect(() => {
    if (open) fetchPayments()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, page, limit, typeFilter, statusFilter])

  const formatDateTime = (d: string | Date) =>
    format(
      new Date(d),
      (locale === 'zh-CN' || locale === 'zh-TW' || locale === 'ja' || locale === 'ko')
        ? 'yyyy年MM月dd日 HH:mm'
        : 'MMM dd, yyyy HH:mm',
      { locale: getDateFnsLocale(locale) }
    )

  const formatCurrency = (cents: number, currency = 'USD') =>
    new Intl.NumberFormat('en-US', { style: 'currency', currency: currency.toUpperCase() }).format(cents / 100)

  const paymentTypeLabel = (pt: string) => {
    if (pt === 'subscription') return t('payments.type_subscription')
    if (pt === 'points_purchase') return t('payments.type_points_purchase')
    if (pt === 'one_time') return t('payments.type_one_time')
    return pt
  }

  const paymentStatusBadge = (ps: string) => {
    const variant: 'default' | 'secondary' | 'destructive' | 'outline' =
      ps === 'succeeded' ? 'default' :
      ps === 'failed' ? 'destructive' :
      ps === 'refunded' ? 'secondary' : 'outline'
    const label =
      ps === 'succeeded' ? t('payments.status_succeeded') :
      ps === 'failed' ? t('payments.status_failed') :
      ps === 'pending' ? t('payments.status_pending') :
      ps === 'refunded' ? t('payments.status_refunded') :
      ps === 'cancelled' ? t('payments.status_cancelled') : ps
    return <Badge variant={variant}>{label}</Badge>
  }

  // 订阅计划名 / Stripe 产品名 -> 当前 locale 翻译（profile.plan_*）
  // 仅保留英文 / 数字部分作为翻译 key，避免 "Pro订阅" 之类的中文后缀导致找不到键
  const getPlanDisplayName = (v: string | null | undefined): string => {
    if (!v) return ''
    const asciiPart = v.toLowerCase().replace(/\s+/g, '').replace(/[^a-z0-9]/g, '')
    const tryKeys = asciiPart ? [asciiPart] : []
    try {
      for (const k of tryKeys) {
        const translated = tPoints(`plan_${k}`)
        if (translated && translated !== `plan_${k}`) return translated
      }
    } catch {
      // fall through
    }
    return v
  }

  // Points 列：同时翻译 points type（purchased / gifted）
  const pointsColumn = (pointsAmount: number | null, pointsType: string | null | undefined) => {
    if (!pointsAmount) return '-'
    const typeLabel =
      pointsType === 'purchased' ? t('points_history.type_purchased') :
      pointsType === 'gifted' ? t('points_history.type_gifted') :
      pointsType || '-'
    return `+${pointsAmount} (${typeLabel})`
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-5xl max-h-[90vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Wallet className="h-5 w-5" />
            {t('payments.title')}
          </DialogTitle>
          <DialogDescription>
            {t('dialogs.user_info', { name: user?.name || t('dialogs.no_name'), email: user?.email || '' })}
          </DialogDescription>
        </DialogHeader>

        {/* 筛选 */}
        <div className="flex flex-col sm:flex-row gap-2 mb-3">
          <div className="flex items-center gap-2">
            <span className="text-sm text-muted-foreground">{t('payments.filter_type')}:</span>
            <Select value={typeFilter} onValueChange={setTypeFilter}>
              <SelectTrigger className="w-[150px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">{t('payments.all_types')}</SelectItem>
                <SelectItem value="subscription">{t('payments.type_subscription')}</SelectItem>
                <SelectItem value="points_purchase">{t('payments.type_points_purchase')}</SelectItem>
                <SelectItem value="one_time">{t('payments.type_one_time')}</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-sm text-muted-foreground">{t('payments.filter_status')}:</span>
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-[140px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">{t('payments.all_statuses')}</SelectItem>
                <SelectItem value="succeeded">{t('payments.status_succeeded')}</SelectItem>
                <SelectItem value="failed">{t('payments.status_failed')}</SelectItem>
                <SelectItem value="pending">{t('payments.status_pending')}</SelectItem>
                <SelectItem value="refunded">{t('payments.status_refunded')}</SelectItem>
                <SelectItem value="cancelled">{t('payments.status_cancelled')}</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="flex items-center gap-2 ml-auto">
            <span className="text-sm text-muted-foreground">Page:</span>
            <Select value={String(limit)} onValueChange={(v) => { setLimit(parseInt(v, 10)); setPage(1) }}>
              <SelectTrigger className="w-[90px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="10">10</SelectItem>
                <SelectItem value="20">20</SelectItem>
                <SelectItem value="50">50</SelectItem>
                <SelectItem value="100">100</SelectItem>
              </SelectContent>
            </Select>
            <Button variant="outline" size="sm" onClick={fetchPayments} disabled={loading}>
              <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
            </Button>
          </div>
        </div>

        {/* 统计 */}
        {data?.stats && (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-2 mb-3">
            <StatBox label={t('payments.total_count')} value={data.stats.totalPayments} />
            <StatBox label={t('payments.succeeded_amount')} value={formatCurrency(data.stats.succeededAmount)} positive />
            <StatBox label={t('payments.refunded_amount')} value={formatCurrency(data.stats.refundedAmount || 0)} negative />
            <StatBox
              label={t('payments.total_points')}
              value={`+${(data.stats.totalPointsPurchased || 0) + (data.stats.totalPointsGifted || 0)}`}
              positive
            />
          </div>
        )}

        {error && (
          <div className="text-sm text-destructive py-2">{error}</div>
        )}

        <div className="flex-1 overflow-auto border rounded-md">
          <Table>
            <TableHeader className="sticky top-0 bg-background">
              <TableRow>
                <TableHead>{t('payments.col_time')}</TableHead>
                <TableHead>{t('payments.col_type')}</TableHead>
                <TableHead>{t('payments.col_status')}</TableHead>
                <TableHead className="text-right">{t('payments.col_amount')}</TableHead>
                <TableHead className="text-right">{t('payments.col_points')}</TableHead>
                <TableHead>{t('payments.col_product')}</TableHead>
                <TableHead>{t('payments.col_refund')}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading && !data && (
                <TableRow>
                  <TableCell colSpan={7} className="text-center py-8 text-muted-foreground">
                    {t('payments.loading')}
                  </TableCell>
                </TableRow>
              )}
              {data?.payments?.length === 0 && (
                <TableRow>
                  <TableCell colSpan={7} className="text-center py-8 text-muted-foreground">
                    {t('payments.empty')}
                  </TableCell>
                </TableRow>
              )}
              {data?.payments?.map((p) => (
                <TableRow key={p.id}>
                  <TableCell className="text-xs whitespace-nowrap">{formatDateTime(p.createdAt)}</TableCell>
                  <TableCell>
                    <Badge variant="outline">{paymentTypeLabel(p.paymentType)}</Badge>
                  </TableCell>
                  <TableCell>{paymentStatusBadge(p.paymentStatus)}</TableCell>
                  <TableCell className="text-right font-mono">
                    {formatCurrency(p.amount, p.currency)}
                  </TableCell>
                  <TableCell className="text-right text-xs">
                    {pointsColumn(p.pointsAmount, p.pointsType)}
                  </TableCell>
                  <TableCell className="text-xs max-w-[200px] truncate" title={p.productName || ''}>
                    {p.productName
                      ? getPlanDisplayName(p.productName)
                      : (p.subscriptionPlan
                        ? `${t('payments.col_plan')}: ${getPlanDisplayName(p.subscriptionPlan)}`
                        : '-')}
                  </TableCell>
                  <TableCell className="text-xs">
                    {p.refundAmount ? (
                      <span className="text-orange-600">
                        {formatCurrency(p.refundAmount, p.currency)}
                        {p.refundedAt ? ` · ${format(new Date(p.refundedAt), 'MM-dd')}` : ''}
                      </span>
                    ) : '-'}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>

        {data && data.pagination.totalPages > 1 && (
          <div className="flex items-center justify-between pt-3">
            <div className="text-sm text-muted-foreground">
              {t('pagination.page_info', { page: data.pagination.page, totalPages: data.pagination.totalPages })} |{' '}
              {t('pagination.total_records', { total: data.pagination.total })}
            </div>
            <div className="flex items-center gap-2">
              <Button variant="outline" size="sm" onClick={() => setPage(Math.max(1, page - 1))} disabled={page <= 1}>
                <ChevronLeft className="h-4 w-4" />
                {t('pagination.previous')}
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setPage(Math.min(data.pagination.totalPages, page + 1))}
                disabled={page >= data.pagination.totalPages}
              >
                {t('pagination.next')}
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  )
}
