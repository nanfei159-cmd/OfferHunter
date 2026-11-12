'use client'

import { useState, useEffect } from 'react'
import { createSSEWithBackoff } from '@/lib/sse'
import { BiSearch, BiSave, BiTargetLock, BiMap, BiMoney, BiTime, BiBookmark, BiBarChart, BiPlay, BiStop, BiLogOut, BiBriefcase, BiMessageRounded } from 'react-icons/bi'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import CityMultiSelect from '@/app/components/CityMultiSelect'
import AnalysisContent from '@/app/liepin/analysis/AnalysisContent'
import PageHeader from '@/app/components/PageHeader'
import { API_BASE } from '@/lib/api'

interface LiepinConfig {
  id?: number
  debugger?: number
  keywords?: string
  city?: string
  salaryCode?: string
  companyScale?: string
  sayHi?: string
  sendSayHi?: number
  sameHrFilter?: number
  publishWithinDays?: number
  hrActiveWithinDays?: number
  publishAgeBuckets?: string
  hrActiveBuckets?: string
}

// 猎聘搜索接口没有公司规模筛选参数，这几个是实际抓取数据里出现过的固定档位
const COMPANY_SCALE_OPTIONS = ['1-49人', '50-99人', '100-499人', '500-999人', '1000-2000人', '2000-5000人', '5000-10000人', '10000人以上']

const PUBLISH_BUCKETS = [
  { value: '0-30', label: '30 天内' },
  { value: '31-60', label: '31–60 天' },
  { value: '61-90', label: '61–90 天' },
  { value: '91-180', label: '91–180 天' },
  { value: '180+', label: '180 天以上' },
]

const HR_BUCKETS = [
  { value: 'now', label: '当前 / 今日' },
  { value: '3d', label: '3 天内' },
  { value: 'week', label: '本周' },
  { value: '2w', label: '2 周内' },
  { value: 'month', label: '本月' },
  { value: '3m', label: '3 个月内' },
  { value: 'older', label: '更久' },
]

// 筛选胶囊：选中是青绿 + 日出金的柔和渐变，未选中是奶油纸面
const CHIP_BASE = 'group inline-flex cursor-pointer items-center gap-2 rounded-full border px-3 py-1.5 text-sm backdrop-blur-sm transition-all'
const CHIP_ACTIVE = 'border-brand-teal/35 bg-gradient-to-r from-brand-mint to-[#FEF3C7] text-brand-tealdeep shadow-[0_6px_16px_-10px_rgba(15,118,110,0.5)] dark:border-brand-teal/40 dark:from-brand-teal/20 dark:to-amber-500/10 dark:text-[#CCFBF1]'
const CHIP_IDLE = 'border-brand-sand bg-white/70 text-brand-muted hover:border-brand-teal/25 hover:bg-[#FFF7E8] dark:border-[#26403D] dark:bg-[#0E2422]/60 dark:text-[#9FB5B0] dark:hover:bg-white/10'
const CHIP_BOX = "inline-flex h-4 w-4 items-center justify-center rounded-[5px] border border-[#C9BBA6] bg-white shadow-inner transition-all after:block after:h-2 after:w-1 after:rotate-45 after:border-b-2 after:border-r-2 after:border-white after:opacity-0 after:content-[''] peer-checked:border-brand-teal peer-checked:bg-brand-teal peer-checked:after:opacity-100 dark:border-white/25 dark:bg-white/10"
const CARD_ICON = 'h-5 w-5 text-brand-teal dark:text-[#5EEAD4]'

interface LiepinOption {
  id: number
  type: string
  name: string
  code: string
}

interface LiepinOptions {
  city: LiepinOption[]
}

interface ProgressLogEntry {
  type: string
  message: string
  timestamp: number
}

export default function LiepinPage() {
  const [config, setConfig] = useState<LiepinConfig>({
    keywords: '',
    city: '',
    salaryCode: '',
    sayHi: '',
    sendSayHi: 1,
    sameHrFilter: 1,
    publishWithinDays: 90,
    hrActiveWithinDays: 30,
  })
  const [selectedCompanyScale, setSelectedCompanyScale] = useState<string[]>([])
  const [selectedCities, setSelectedCities] = useState<string[]>([])
  const [selectedPublishBuckets, setSelectedPublishBuckets] = useState<string[]>(['0-30', '31-60', '61-90'])
  const [selectedHrBuckets, setSelectedHrBuckets] = useState<string[]>(['now', '3d', 'week', '2w', 'month'])
  const [options, setOptions] = useState<LiepinOptions>({
    city: [],
  })
  const [loading, setLoading] = useState(true)
  const [showSaveDialog, setShowSaveDialog] = useState(false)
  const [saveResult, setSaveResult] = useState<{ success: boolean; message: string } | null>(null)
  const [isLoggedIn, setIsLoggedIn] = useState(false)
  const [isDelivering, setIsDelivering] = useState(false)
  const [checkingLogin, setCheckingLogin] = useState(true)
  const [showLogoutDialog, setShowLogoutDialog] = useState(false)
  const [showLogoutResultDialog, setShowLogoutResultDialog] = useState(false)
  const [logoutResult, setLogoutResult] = useState<{ success: boolean; message: string } | null>(null)
  const [progressLogs, setProgressLogs] = useState<ProgressLogEntry[]>([])

  useEffect(() => {
    fetchAllData()

    // 确保在客户端环境且 EventSource 可用
    if (typeof window === 'undefined' || typeof EventSource === 'undefined') {
      console.warn('EventSource 不可用，无法连接SSE')
      setCheckingLogin(false)
      return
    }

    const client = createSSEWithBackoff(`${API_BASE}/api/jobs/login-status/stream`, {
      onOpen: () => {
        console.log('[SSE] 连接已打开')
      },
      onError: (e, attempt, delay) => {
        console.warn(`[SSE] 连接错误，准备第${attempt}次重连，延迟 ${delay}ms`, e)
        setCheckingLogin(false)
      },
      listeners: [
        {
          name: 'connected',
          handler: (event) => {
            try {
              const data = JSON.parse(event.data)
              setIsLoggedIn(data.liepinLoggedIn || false)
              setCheckingLogin(false)
            } catch (error) {
              console.error('[SSE] 解析连接消息失败:', error)
            }
          },
        },
        {
          name: 'login-status',
          handler: (event) => {
            try {
              const data = JSON.parse(event.data)
              if (data.platform === 'liepin') {
                setIsLoggedIn(data.isLoggedIn)
                setCheckingLogin(false)
              }
            } catch (error) {
              console.error('[SSE] 解析登录状态消息失败:', error)
            }
          },
        },
        { name: 'ping', handler: () => {} },
      ],
    })

    return () => {
      client.close()
    }
  }, [])

  // 投递进度实时日志
  useEffect(() => {
    if (typeof window === 'undefined' || typeof EventSource === 'undefined') return

    const client = createSSEWithBackoff(`${API_BASE}/api/liepin/stream`, {
      listeners: [
        {
          name: 'progress',
          handler: (event) => {
            try {
              const data = JSON.parse(event.data)
              setProgressLogs((prev) => [...prev.slice(-199), { type: data.type, message: data.message, timestamp: data.timestamp }])
            } catch (error) {
              console.error('[SSE] 解析猎聘进度消息失败:', error)
            }
          },
        },
        { name: 'connected', handler: () => {} },
        { name: 'ping', handler: () => {} },
      ],
    })

    return () => {
      client.close()
    }
  }, [])

  // 将数据库中的 JSON 数组字符串转换为逗号分隔的可读字符串
  const parseKeywordsFromDb = (raw?: string): string => {
    if (!raw) return ''
    const t = raw.trim()
    if (t.startsWith('[') && t.endsWith(']')) {
      try {
        const arr = JSON.parse(t)
        if (Array.isArray(arr)) return arr.filter(Boolean).join(', ')
      } catch (e) {
        console.warn('解析关键词JSON失败，使用原值:', e)
      }
    }
    // 兼容逗号或中文逗号分隔的原始字符串
    return t.replace(/，/g, ',')
  }

  // 将输入的逗号分隔字符串转换为 JSON 数组字符串保存到数据库
  const serializeKeywordsForDb = (display?: string): string => {
    const raw = (display || '').trim()
    if (!raw) return '[]'
    const norm = raw.replace(/，/g, ',')
    const tokens = norm
      .split(',')
      .map((s) => s.trim())
      .filter((s) => s.length > 0)
    return JSON.stringify(tokens)
  }

  // 括号列表 "[a,b]" 解析为数组，用于公司规模这种多选字段（不能用上面的JSON.stringify格式，
  // 后端解析括号列表时不会去掉每项的引号，会导致比对不上）
  const parseBracketList = (raw?: string): string[] => {
    if (!raw) return []
    let s = raw.trim()
    if (s.startsWith('[') && s.endsWith(']')) s = s.slice(1, -1)
    if (!s) return []
    return s.split(',').map((v) => v.trim().replace(/^"|"$/g, '')).filter((v) => v.length > 0)
  }
  const toBracketList = (list: string[]): string => (list && list.length ? `[${list.join(',')}]` : '')

  // 旧配置只有单阈值（90/30）时，转换成对应默认档位
  const defaultPublishBuckets = (threshold?: number): string[] => {
    if (threshold === 0) return []
    if (threshold == null || threshold >= 180) return ['0-30', '31-60', '61-90', '91-180']
    if (threshold >= 90) return ['0-30', '31-60', '61-90']
    if (threshold >= 60) return ['0-30', '31-60']
    if (threshold >= 30) return ['0-30']
    return []
  }
  const defaultHrBuckets = (threshold?: number): string[] => {
    if (threshold === 0) return []
    if (threshold == null || threshold >= 90) return ['now', '3d', 'week', '2w', 'month', '3m']
    if (threshold >= 30) return ['now', '3d', 'week', '2w', 'month']
    if (threshold >= 14) return ['now', '3d', 'week', '2w']
    if (threshold >= 7) return ['now', '3d', 'week']
    return []
  }

  const fetchAllData = async () => {
    try {
      const response = await fetch(`${API_BASE}/api/liepin/config`)
      const data = await response.json()

      console.log('Fetched liepin data:', data)

      if (data.config) {
        const normalized = { ...data.config }
        normalized.keywords = parseKeywordsFromDb(data.config.keywords)
        // 旧库没有这两个字段时按默认开启处理
        if (normalized.sendSayHi == null) normalized.sendSayHi = 1
        if (normalized.sameHrFilter == null) normalized.sameHrFilter = 1
        if (normalized.publishWithinDays == null) normalized.publishWithinDays = 90
        if (normalized.hrActiveWithinDays == null) normalized.hrActiveWithinDays = 30
        setConfig(normalized)
        setSelectedCompanyScale(parseBracketList(data.config.companyScale))
        const cityOptions = data.options?.city || []
        setSelectedCities(
          parseBracketList(data.config.city)
            .map((v: string) => cityOptions.find((c: LiepinOption) => c.name === v || c.code === v)?.name || v)
            .filter((v: string) => v && v !== '全国')
        )
        setSelectedPublishBuckets(
          data.config.publishAgeBuckets
            ? parseBracketList(data.config.publishAgeBuckets)
            : defaultPublishBuckets(data.config.publishWithinDays)
        )
        setSelectedHrBuckets(
          data.config.hrActiveBuckets
            ? parseBracketList(data.config.hrActiveBuckets)
            : defaultHrBuckets(data.config.hrActiveWithinDays)
        )
      }
      if (data.options) {
        setOptions(data.options)
      }
    } catch (error) {
      console.error('Failed to fetch liepin data:', error)
    } finally {
      setLoading(false)
    }
  }

  const handleSave = async () => {
    try {
      const payload = {
        ...config,
        keywords: serializeKeywordsForDb(config.keywords),
        city: toBracketList(selectedCities),
        companyScale: toBracketList(selectedCompanyScale),
        publishAgeBuckets: toBracketList(selectedPublishBuckets),
        hrActiveBuckets: toBracketList(selectedHrBuckets),
      }
      const response = await fetch(`${API_BASE}/api/liepin/config`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
      })

      if (response.ok) {
        // 统一保存 Cookie（Liepin）
        try {
          await fetch(`${API_BASE}/api/cookie/save?platform=liepin`, { method: 'POST' })
        } catch (e) {
          console.warn('保存 Cookie 失败（Liepin）:', e)
        }

        fetchAllData()
        setSaveResult({ success: true, message: '保存成功，配置与Cookie已更新。' })
        setShowSaveDialog(true)
      } else {
        console.warn('保存失败：后端返回非 2xx 状态')
        setSaveResult({ success: false, message: '保存失败：后端返回异常状态。' })
        setShowSaveDialog(true)
      }
    } catch (error) {
      console.error('Failed to save config:', error)
      setSaveResult({ success: false, message: '保存失败：网络或服务异常。' })
      setShowSaveDialog(true)
    }
  }

  const handleStartDelivery = async () => {
    try {
      setIsDelivering(true)
      const response = await fetch(`${API_BASE}/api/liepin/start`, {
        method: 'POST',
      })
      const data = await response.json()

      if (data.success) {
        // 启动成功：不弹框
      } else {
        // 启动失败：不弹框
        console.warn('启动失败：', data.message)
        setIsDelivering(false)
      }
    } catch (error) {
      console.error('Failed to start delivery:', error)
      // 启动失败：不弹框
      setIsDelivering(false)
    }
  }

  const handleStopDelivery = async () => {
    try {
      const response = await fetch(`${API_BASE}/api/liepin/stop`, {
        method: 'POST',
      })
      const data = await response.json()

      if (data.success) {
        // 停止成功：不弹框
        setIsDelivering(false)
      } else {
        // 停止失败：不弹框
        console.warn('停止失败：', data.message)
      }
    } catch (error) {
      console.error('Failed to stop delivery:', error)
      // 停止失败：不弹框
    }
  }

  const triggerLogout = async () => {
    try {
      const response = await fetch(`${API_BASE}/api/liepin/logout`, { method: 'POST' })
      const data = await response.json()
      if (data.success) {
        setIsLoggedIn(false)
        setIsDelivering(false)
        console.info('已退出登录，数据库Cookie已置空')
        setLogoutResult({ success: true, message: '已退出登录，Cookie已清空。' })
        setShowLogoutResultDialog(true)
      } else {
        console.warn('退出登录失败：', data.message)
        setLogoutResult({ success: false, message: `退出登录失败：${data.message || '服务返回异常。'}` })
        setShowLogoutResultDialog(true)
      }
    } catch (error) {
      console.error('Failed to logout:', error)
      setLogoutResult({ success: false, message: '退出登录失败：网络或服务异常。' })
      setShowLogoutResultDialog(true)
    }
  }

  if (loading) {
    return <div className="flex items-center justify-center h-screen">加载中...</div>
  }

  return (
    <div className="space-y-6">
      <PageHeader
        icon={<BiSearch className="text-2xl" />}
        title="猎聘配置"
        subtitle="配置猎聘平台的求职参数"
        iconClass="text-brand-teal dark:text-[#5EEAD4]"
        accentBgClass="bg-gradient-to-br from-brand-tealsoft to-[#FEF3C7] dark:from-brand-teal/20 dark:to-amber-500/10"
        actions={
          <div className="flex items-center gap-2">
            {checkingLogin ? (
              <Button size="sm" disabled className="cursor-not-allowed rounded-full border border-brand-sand bg-[#F1EADF] px-4 text-[#8A97A6] shadow-sm">
                <BiPlay className="mr-1" /> 检查登录中...
              </Button>
            ) : !isLoggedIn ? (
              <Button size="sm" disabled className="cursor-not-allowed rounded-full border border-brand-sand bg-[#F1EADF] px-4 text-[#8A97A6] shadow-sm">
                <BiPlay className="mr-1" /> 请先登录猎聘
              </Button>
            ) : isDelivering ? (
              <Button onClick={handleStopDelivery} size="sm" className="rounded-full bg-gradient-to-r from-brand-coral to-brand-rose px-4 text-[#FFFDF8] shadow-[0_10px_22px_-10px_rgba(225,29,72,0.65)] transition-all duration-300 hover:brightness-105 hover:shadow-[0_14px_26px_-10px_rgba(225,29,72,0.7)]">
                <BiStop className="mr-1" /> 停止投递
              </Button>
            ) : (
              <Button onClick={handleStartDelivery} size="sm" className="rounded-full bg-gradient-to-r from-[#0F766E] to-[#14B8A6] px-4 text-[#FFFDF8] shadow-[0_10px_22px_-10px_rgba(15,118,110,0.7)] transition-all duration-300 hover:from-[#115E59] hover:to-brand-teal hover:shadow-[0_14px_26px_-10px_rgba(15,118,110,0.75)]">
                <BiPlay className="mr-1" /> 开始投递
              </Button>
            )}
            <Button onClick={() => setShowLogoutDialog(true)} size="sm" className="rounded-full border border-brand-rose/30 bg-white/70 px-4 text-[#BE123C] shadow-sm transition-all duration-300 hover:bg-[#FFF1F2] hover:shadow-md dark:border-brand-rose/40 dark:bg-transparent dark:text-[#FDA4AF] dark:hover:bg-brand-rose/10">
              <BiLogOut className="mr-1" /> 退出登录
            </Button>
            <Button onClick={handleSave} size="sm" className="rounded-full border border-brand-teal/25 bg-brand-mint px-4 text-brand-tealdeep shadow-sm transition-all duration-300 hover:bg-brand-tealsoft hover:shadow-md dark:border-brand-teal/40 dark:bg-brand-teal/15 dark:text-[#CCFBF1] dark:hover:bg-brand-teal/25">
              <BiSave className="mr-1" /> 保存配置
            </Button>
          </div>
        }
      />

      <Tabs defaultValue="config" className="w-full">
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="config">平台配置</TabsTrigger>
          <TabsTrigger value="analytics">投递分析</TabsTrigger>
        </TabsList>

        <TabsContent value="config" className="mt-6">
        <div className="grid grid-cols-1 xl:grid-cols-[minmax(0,1fr)_380px] gap-6 items-start">
        <div className="space-y-6 min-w-0 order-2 xl:order-1">
        {/* 平台说明 */}
        <Card className="animate-in fade-in slide-in-from-bottom-5 border-brand-teal/20 bg-gradient-to-br from-brand-mint/80 via-brand-paper to-[#FFF7E8] duration-700 dark:border-brand-teal/30 dark:bg-none dark:bg-[#0E2422]">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <BiBriefcase className={CARD_ICON} />
              猎聘平台说明
            </CardTitle>
            <CardDescription>登录与投递操作提示</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <p className="text-sm text-muted-foreground">请在浏览器标签页中登录 猎聘 平台，登录成功后系统会自动检测登录状态。</p>
              <p className="text-sm text-muted-foreground">登录成功后，点击“开始投递”按钮启动自动投递任务。</p>
              <p className="text-sm text-muted-foreground">点击“保存配置”按钮可手动保存当前登录相关信息到数据库。</p>
              <p className="text-sm text-muted-foreground">
                投递时会自动点「发简历 → 立即投递」，使用的是你猎聘账号里的默认附件简历。请先在猎聘上传简历并设为默认；本工具不会上传本地文件。
              </p>
            </div>
          </CardContent>
        </Card>

        {/* 搜索配置 */}
        <Card className="animate-in fade-in slide-in-from-bottom-5 focus-within:z-30 duration-700">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <BiSearch className={CARD_ICON} />
              搜索配置
            </CardTitle>
            <CardDescription>设置职位搜索关键词和筛选条件</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="space-y-2">
                <Label htmlFor="keywords">搜索关键词</Label>
                <Input
                  id="keywords"
                  value={config.keywords || ''}
                  onChange={(e) => setConfig({ ...config, keywords: e.target.value })}
                  placeholder="例如：大模型, Python, Golang"
                />
                <p className="text-xs text-muted-foreground">关键词可多选，使用英文逗号分隔，例如：大模型, Python, Golang</p>
              </div>

              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label htmlFor="city">工作城市</Label>
                  <span className="text-xs text-muted-foreground">可多选</span>
                </div>
                <CityMultiSelect
                  id="city"
                  options={options.city}
                  value={selectedCities}
                  onChange={setSelectedCities}
                />
                <p className="text-xs text-muted-foreground">
                  不选表示全国；可搜索并勾选多个城市，投递时按城市依次搜索。
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* 自定义招呼语 */}
        <Card className="animate-in fade-in slide-in-from-bottom-5 duration-700">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <BiMessageRounded className={CARD_ICON} />
              自定义招呼语
            </CardTitle>
            <CardDescription>猎聘点「聊一聊」会先发账号里的默认招呼语；补发会让聊天里出现两条</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              <Label htmlFor="sayHi">招呼语</Label>
              <Textarea
                id="sayHi"
                value={config.sayHi || ''}
                onChange={(e) => setConfig({ ...config, sayHi: e.target.value })}
                placeholder="您好，我有相关行业经验，看到这个岗位比较匹配，方便聊聊吗？"
                rows={4}
              />
              <p className="text-xs text-muted-foreground">
                建议写具体经历和岗位匹配点，不要用群发模板。
              </p>
              <label className="flex items-start gap-2 pt-1 text-sm cursor-pointer">
                <input
                  type="checkbox"
                  className="mt-1 h-4 w-4 rounded border-[#C9BBA6] accent-brand-teal"
                  checked={config.sendSayHi !== 0}
                  onChange={(e) => setConfig({ ...config, sendSayHi: e.target.checked ? 1 : 0 })}
                />
                <span>
                  补发自定义招呼语
                  <span className="mt-0.5 block text-xs text-muted-foreground">
                    只想要一条消息：取消勾选，只用猎聘账号里的默认招呼语；或者在猎聘设置里清空默认招呼语，再勾选这里。
                  </span>
                </span>
              </label>
            </div>
          </CardContent>
        </Card>

        {/* 薪资配置 */}
        <Card className="animate-in fade-in slide-in-from-bottom-6 duration-700">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <BiMoney className={CARD_ICON} />
              薪资筛选
            </CardTitle>
            <CardDescription>设置期望薪资范围</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 gap-6">
              <div className="space-y-2">
                <Label htmlFor="salaryCode">薪资范围</Label>
                <Input
                  id="salaryCode"
                  value={config.salaryCode || ''}
                  onChange={(e) => setConfig({ ...config, salaryCode: e.target.value })}
                  placeholder="例如：15$30"
                />
                <p className="text-xs text-muted-foreground">薪资范围码（例如：15$30表示15k-30k）</p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* 公司要求 */}
        <Card className="animate-in fade-in slide-in-from-bottom-7 duration-700">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <BiBriefcase className={CARD_ICON} />
              公司要求
            </CardTitle>
            <CardDescription>按公司规模筛选，目标太多时可以缩小范围</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              <Label>公司规模</Label>
              <div className="flex flex-wrap gap-2">
                {COMPANY_SCALE_OPTIONS.map((s) => (
                  <label
                    key={s}
                    className={`${CHIP_BASE} ${
                      selectedCompanyScale.includes(s) ? CHIP_ACTIVE : CHIP_IDLE
                    }`}
                  >
                    <input
                      type="checkbox"
                      checked={selectedCompanyScale.includes(s)}
                      onChange={(e) => {
                        setSelectedCompanyScale((prev) =>
                          e.target.checked ? [...prev, s] : prev.filter((x) => x !== s)
                        )
                      }}
                      className="sr-only peer"
                    />
                    <span className={CHIP_BOX}></span>
                    {s}
                  </label>
                ))}
              </div>
              <p className="text-xs text-muted-foreground">不勾选表示不限；猎聘搜索接口不支持按规模硬过滤，命中的是投递前用已抓取数据做的二次校验</p>

              <label className="flex items-start gap-2 pt-2 text-sm cursor-pointer">
                <input
                  type="checkbox"
                  className="mt-1 h-4 w-4 rounded border-[#C9BBA6] accent-brand-teal"
                  checked={config.sameHrFilter !== 0}
                  onChange={(e) => setConfig({ ...config, sameHrFilter: e.target.checked ? 1 : 0 })}
                />
                <span>
                  同一 HR 只打一次招呼
                  <span className="mt-0.5 block text-xs text-muted-foreground">
                    同一个 HR 发布多个岗位时，只处理第一个，避免在同一个聊天里重复发招呼语。
                  </span>
                </span>
              </label>
            </div>
          </CardContent>
        </Card>

        {/* 活跃度过滤 */}
        <Card className="animate-in fade-in slide-in-from-bottom-7 duration-700">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <BiTime className={CARD_ICON} />
              活跃度过滤
            </CardTitle>
            <CardDescription>勾选允许的档位，可多选；一个都不选表示不限</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <div className="space-y-3">
                <div className="flex items-baseline justify-between gap-3">
                  <Label>发布时间</Label>
                  <span className="text-xs text-muted-foreground">只投勾选的时间段</span>
                </div>
                <div className="flex flex-wrap gap-2">
                  {PUBLISH_BUCKETS.map((b) => {
                    const active = selectedPublishBuckets.includes(b.value)
                    return (
                      <label
                        key={b.value}
                        className={`${CHIP_BASE} ${active ? CHIP_ACTIVE : CHIP_IDLE}`}
                      >
                        <input
                          type="checkbox"
                          checked={active}
                          onChange={(e) => {
                            setSelectedPublishBuckets((prev) =>
                              e.target.checked ? [...prev, b.value] : prev.filter((v) => v !== b.value)
                            )
                          }}
                          className="sr-only peer"
                        />
                        <span className={CHIP_BOX}></span>
                        {b.label}
                      </label>
                    )
                  })}
                </div>
                <p className="text-xs text-muted-foreground">默认只投 90 天内：30 天内 / 31–60 天 / 61–90 天。</p>
              </div>

              <div className="space-y-3">
                <div className="flex items-baseline justify-between gap-3">
                  <Label>HR 最近活跃</Label>
                  <span className="text-xs text-muted-foreground">只投勾选的活跃档</span>
                </div>
                <div className="flex flex-wrap gap-2">
                  {HR_BUCKETS.map((b) => {
                    const active = selectedHrBuckets.includes(b.value)
                    return (
                      <label
                        key={b.value}
                        className={`${CHIP_BASE} ${active ? CHIP_ACTIVE : CHIP_IDLE}`}
                      >
                        <input
                          type="checkbox"
                          checked={active}
                          onChange={(e) => {
                            setSelectedHrBuckets((prev) =>
                              e.target.checked ? [...prev, b.value] : prev.filter((v) => v !== b.value)
                            )
                          }}
                          className="sr-only peer"
                        />
                        <span className={CHIP_BOX}></span>
                        {b.label}
                      </label>
                    )
                  })}
                </div>
                <p className="text-xs text-muted-foreground">默认只投 30 天内活跃的 HR；拿不到活跃信息时保守放行。</p>
              </div>
            </div>
          </CardContent>
        </Card>
        </div>

        <aside className="space-y-6 order-1 xl:order-2 xl:sticky xl:top-6">
          <Card className="animate-in fade-in slide-in-from-bottom-5 duration-700">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <BiPlay className={CARD_ICON} />
                运行状态
              </CardTitle>
              <CardDescription>登录与任务状态</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-3 text-sm">
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground">猎聘登录</span>
                  <span className={`inline-flex items-center gap-1.5 font-medium ${isLoggedIn ? 'text-brand-teal dark:text-[#5EEAD4]' : 'text-amber-600 dark:text-amber-300'}`}>
                    <span className={`h-1.5 w-1.5 rounded-full ${isLoggedIn ? 'bg-brand-teal' : 'bg-amber-500'}`} />
                    {isLoggedIn ? '已登录' : '未登录'}
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground">投递任务</span>
                  <span className={`inline-flex items-center gap-1.5 font-medium ${isDelivering ? 'text-brand-teal dark:text-[#5EEAD4]' : 'text-muted-foreground'}`}>
                    <span className={`h-1.5 w-1.5 rounded-full ${isDelivering ? 'animate-pulse bg-brand-teal' : 'bg-[#C9BBA6]'}`} />
                    {isDelivering ? '运行中' : '空闲'}
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground">本次日志</span>
                  <span className="font-medium text-brand-ink dark:text-brand-cream">{progressLogs.length} 条</span>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="animate-in fade-in slide-in-from-bottom-5 duration-700">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <BiTime className={CARD_ICON} />
                投递进度
              </CardTitle>
              <CardDescription>实时日志（最近 200 条）</CardDescription>
            </CardHeader>
            <CardContent>
              <div className={`${progressLogs.length === 0
                ? 'flex h-[180px] items-center justify-center rounded-xl border border-dashed border-brand-sand bg-brand-cream/60 text-brand-muted dark:border-[#26403D] dark:bg-white/[0.03] dark:text-[#7FA9A3]'
                : 'log-scroll h-[360px] space-y-1 overflow-y-auto rounded-xl border border-[#D3E8E1] bg-[#F7FCFA] p-3 font-mono text-xs text-[#0F4C4A] shadow-[inset_0_1px_0_rgba(255,255,255,0.9)] xl:h-[520px] dark:border-[#23403D] dark:bg-[#0A2422] dark:text-[#CFE8E3] dark:shadow-[inset_0_1px_0_rgba(255,255,255,0.04)]'
              }`}>
                {progressLogs.length === 0 ? (
                  <div className="flex flex-col items-center gap-1.5 text-center">
                    <span className="mb-1 flex h-9 w-9 items-center justify-center rounded-full bg-brand-teal/10 text-brand-teal dark:bg-brand-teal/15 dark:text-[#5EEAD4]">
                      <BiTime className="text-lg" />
                    </span>
                    <p className="text-xs font-medium">暂无日志</p>
                    <p className="text-[11px] opacity-75">点击「开始投递」后显示</p>
                  </div>
                ) : (
                  progressLogs.map((log, i) => (
                    <div key={i} className={log.type === 'error' ? 'text-[#BE123C] dark:text-[#FDA4AF]' : log.type === 'warning' ? 'text-[#B45309] dark:text-[#FCD34D]' : log.type === 'success' ? 'text-[#0F766E] dark:text-[#6EE7B7]' : 'text-[#5B6B7E] dark:text-[#A7D8D0]'}>
                      [{new Date(log.timestamp).toLocaleTimeString()}] {log.message}
                    </div>
                  ))
                )}
              </div>
            </CardContent>
          </Card>
        </aside>
        </div>
        </TabsContent>

        <TabsContent value="analytics" className="space-y-6 mt-6">
          <AnalysisContent />
        </TabsContent>
      </Tabs>

      {/* 退出确认弹框 */}
      {showLogoutDialog && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-[#0B3B3A]/40 backdrop-blur-[2px]">
          <div className="w-[92%] max-w-sm animate-in fade-in zoom-in-95 rounded-2xl border border-brand-sand bg-brand-paper shadow-2xl dark:border-[#23403D] dark:bg-[#0E2422]">
            <Card className="border-0 bg-transparent shadow-none ring-0 hover:translate-y-0 hover:shadow-none">
              <CardHeader className="pb-2">
                <CardTitle className="flex items-center gap-2 text-lg">
                  <BiLogOut className="text-brand-rose" />
                  确认退出登录
                </CardTitle>
              </CardHeader>
              <CardContent className="pt-0">
                <p className="mb-4 text-sm text-muted-foreground">退出后将清除Cookie并切换为未登录状态。</p>
                <div className="flex justify-end gap-2">
                  <Button
                    variant="ghost"
                    onClick={() => setShowLogoutDialog(false)}
                    className="rounded-full px-4 text-brand-muted hover:bg-brand-mint hover:text-brand-tealdeep dark:text-[#9FB5B0] dark:hover:bg-white/10 dark:hover:text-brand-cream"
                  >
                    取消
                  </Button>
                  <Button
                    onClick={async () => {
                      await triggerLogout()
                      setShowLogoutDialog(false)
                    }}
                    className="rounded-full bg-gradient-to-r from-brand-coral to-brand-rose px-4 text-[#FFFDF8] shadow-[0_8px_18px_-10px_rgba(225,29,72,0.65)] hover:brightness-105"
                  >
                    确认退出
                  </Button>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      )}

      {/* 退出登录结果弹框 */}
      {showLogoutResultDialog && logoutResult && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-[#0B3B3A]/35 backdrop-blur-[2px]" role="dialog" aria-modal="true">
          <div className="w-[92%] max-w-sm animate-in fade-in zoom-in-95 rounded-2xl border border-brand-sand bg-brand-paper shadow-2xl dark:border-[#23403D] dark:bg-[#0E2422]">
            <Card className="border-0 bg-transparent shadow-none ring-0 hover:translate-y-0 hover:shadow-none">
              <CardHeader className="pb-2">
                <CardTitle className="flex items-center gap-2 text-lg">
                  <BiLogOut className={logoutResult.success ? 'text-brand-teal' : 'text-brand-rose'} />
                  {logoutResult.success ? '退出登录成功' : '退出登录失败'}
                </CardTitle>
              </CardHeader>
              <CardContent className="pt-0">
                <p className="mb-4 text-sm text-muted-foreground">{logoutResult.message}</p>
                <div className="flex justify-end gap-2">
                  <Button
                    onClick={() => setShowLogoutResultDialog(false)}
                    className={`rounded-full px-4 text-[#FFFDF8] ${logoutResult.success ? 'bg-gradient-to-r from-brand-teal to-[#0D9488]' : 'bg-gradient-to-r from-brand-coral to-brand-rose'}`}
                  >
                    知道了
                  </Button>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      )}

      {/* 保存结果弹框 */}
      {showSaveDialog && saveResult && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-[#0B3B3A]/35 backdrop-blur-[2px]" role="dialog" aria-modal="true">
          <div className="w-[92%] max-w-sm animate-in fade-in zoom-in-95 rounded-2xl border border-brand-sand bg-brand-paper shadow-2xl dark:border-[#23403D] dark:bg-[#0E2422]">
            <Card className="border-0 bg-transparent shadow-none ring-0 hover:translate-y-0 hover:shadow-none">
              <CardHeader className="pb-2">
                <CardTitle className="flex items-center gap-2 text-lg">
                  <BiSave className={saveResult.success ? 'text-brand-teal' : 'text-brand-rose'} />
                  {saveResult.success ? '保存成功' : '保存失败'}
                </CardTitle>
              </CardHeader>
              <CardContent className="pt-0">
                <p className="mb-4 text-sm text-muted-foreground">{saveResult.message}</p>
                <div className="flex justify-end gap-2">
                  <Button
                    onClick={() => setShowSaveDialog(false)}
                    className={`rounded-full px-4 text-[#FFFDF8] ${saveResult.success ? 'bg-gradient-to-r from-brand-teal to-[#0D9488]' : 'bg-gradient-to-r from-brand-coral to-brand-rose'}`}
                  >
                    知道了
                  </Button>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      )}
    </div>
  )
}
