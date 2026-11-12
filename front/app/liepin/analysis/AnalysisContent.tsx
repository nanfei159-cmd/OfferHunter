"use client"

import { useEffect, useMemo, useRef, useState } from "react"
import { useTheme } from "next-themes"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Select } from "@/components/ui/select"
import { Label } from "@/components/ui/label"
import PageHeader from "@/app/components/PageHeader"
import { BiRefresh, BiDownload, BiBarChart, BiLineChart, BiPieChart, BiBriefcase } from "react-icons/bi"
import { parseSalary } from "@/lib/salary"

type NameValue = { name: string; value: number }
type BucketValue = { bucket: string; value: number }

type StatsResponse = {
  kpi: {
    total: number
    delivered: number
    pending: number
    filtered: number
    failed: number
    avgMonthlyK?: number | null
  }
  charts: {
    byStatus: NameValue[]
    byCity: NameValue[]
    byIndustry: NameValue[]
    byCompany: NameValue[]
    byExperience: NameValue[]
    byDegree: NameValue[]
    salaryBuckets: BucketValue[]
    dailyTrend: NameValue[]
    hrActivity: NameValue[]
  }
}

type LiepinJob = {
  jobId: number
  compName?: string
  compIndustry?: string
  compScale?: string
  jobTitle?: string
  jobSalaryText?: string
  jobArea?: string
  jobEduReq?: string
  jobExpReq?: string
  jobPublishTime?: string
  jobLink?: string
  hrName?: string
  hrTitle?: string
  hrActiveStatus?: string
  jobDescription?: string
  recruitmentStatus?: string
  delivered?: number
  createTime?: string
}

type PagedResult = {
  items: LiepinJob[]
  total: number
  page: number
  size: number
}

import { API_BASE } from "@/lib/api"
const CATEGORY_COLORS = [
  "#0F766E",
  "#14B8A6",
  "#F59E0B",
  "#FB923C",
  "#E11D48",
  "#0EA5E9",
  "#2DD4BF",
  "#FBBF24",
  "#F43F5E",
  "#A16207",
  "#0B3B3A",
  "#94A3B8",
  "#FB7185",
  "#84CC16",
]

function ChartCanvas({
  type,
  labels,
  data,
  title,
  color = "#0F766E",
  colors,
}: {
  type: "pie" | "bar" | "line"
  labels: string[]
  data: number[]
  title?: string
  color?: string
  colors?: string[]
}) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null)
  const chartRef = useRef<any | null>(null)
  const { resolvedTheme } = useTheme()
  const toSolid = (hex: string) => hex

  async function ensureChart(): Promise<any> {
    if (typeof window !== "undefined" && (window as any).Chart) return (window as any).Chart
    return new Promise((resolve, reject) => {
      const existing = document.querySelector("script[data-chartjs-cdn='true']") as HTMLScriptElement | null
      if (existing) {
        existing.addEventListener("load", () => resolve((window as any).Chart))
        existing.addEventListener("error", () => reject(new Error("Chart.js CDN load error")))
        return
      }
      const script = document.createElement("script")
      script.src = "https://cdn.jsdelivr.net/npm/chart.js@4.4.4/dist/chart.umd.min.js"
      script.async = true
      script.setAttribute("data-chartjs-cdn", "true")
      script.addEventListener("load", () => resolve((window as any).Chart))
      script.addEventListener("error", () => reject(new Error("Chart.js CDN load error")))
      document.head.appendChild(script)
    })
  }

  useEffect(() => {
    const ctx = canvasRef.current?.getContext("2d")
    if (!ctx) return

    if (chartRef.current) {
      chartRef.current.destroy()
      chartRef.current = null
    }

    let cancelled = false

    const pieColorsBase = [
      "#0F766E",
      "#14B8A6",
      "#F59E0B",
      "#FB923C",
      "#E11D48",
      "#0EA5E9",
      "#2DD4BF",
      "#FBBF24",
      "#F43F5E",
      "#0B3B3A",
    ]

    const backgroundColor = (() => {
      if (type === "pie") {
        const arr = (colors && colors.length ? colors : pieColorsBase).slice(0, labels.length)
        return arr
      }
      if (type === "bar" && colors && colors.length) {
        return colors.slice(0, data.length).map((c) => toSolid(c))
      }
      return toSolid(color ?? "#0F766E")
    })()

    const borderColor = (() => {
      if (type === "pie") return undefined
      if (type === "bar" && colors && colors.length) return colors.slice(0, data.length)
      return color
    })()

    const dataset: any = {
      label: title || "",
      data,
      backgroundColor,
      borderColor,
    }

    if (type === "line") {
      dataset.fill = false
      dataset.pointBackgroundColor = toSolid(color)
      dataset.pointBorderColor = toSolid(color)
    }

    ;(async () => {
      try {
        const Chart = await ensureChart()
        if (cancelled) return
        const dark = resolvedTheme === "dark"
        const textColor = dark ? "#9FB5B0" : "#6B7A88"
        const titleColor = dark ? "#F0F7F5" : "#102033"
        const gridColor = dark ? "rgba(255,255,255,0.08)" : "rgba(234,223,207,0.55)"
        chartRef.current = new Chart(ctx, {
          type,
          data: { labels, datasets: [dataset] },
          options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
              legend: {
                display: type === "pie",
                position: "bottom",
                labels: { color: textColor, usePointStyle: true, boxWidth: 9, padding: 14, font: { size: 11 } },
              },
              title: { display: !!title, text: title, color: titleColor, font: { size: 13, weight: "600" } },
            },
            scales: type !== "pie" ? {
              x: { ticks: { autoSkip: true, color: textColor }, grid: { display: false } },
              y: { beginAtZero: true, ticks: { color: textColor }, grid: { color: gridColor } },
            } : undefined,
          },
        })
      } catch (error) {
        console.error("Failed to create chart:", error)
      }
    })()

    return () => {
      cancelled = true
      if (chartRef.current) {
        chartRef.current.destroy()
        chartRef.current = null
      }
    }
  }, [type, labels, data, title, color, colors, resolvedTheme])

  return <canvas ref={canvasRef} className="w-full h-64" />
}

export default function AnalysisContent({ showHeader = false }: { showHeader?: boolean }) {
  const [stats, setStats] = useState<StatsResponse | null>(null)
  const [loadingStats, setLoadingStats] = useState(true)

  const [items, setItems] = useState<LiepinJob[]>([])
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(1)
  const [size, setSize] = useState(20)
  const [inputPage, setInputPage] = useState<number | string>(1)
  const [inputSize, setInputSize] = useState<number | string>(20)

  const [statuses, setStatuses] = useState<string[]>([])
  const [location, setLocation] = useState<string>("")
  const [experience, setExperience] = useState<string>("")
  const [degree, setDegree] = useState<string>("")
  const [minK, setMinK] = useState<string>("")
  const [maxK, setMaxK] = useState<string>("")
  const [keyword, setKeyword] = useState<string>("")
  const [loadingList, setLoadingList] = useState(false)
  const [exporting, setExporting] = useState(false)
  const [computedSalaryBuckets, setComputedSalaryBuckets] = useState<BucketValue[]>([])

  // 查看全文弹窗（点单元格弹出完整内容）
  const [showTextDialog, setShowTextDialog] = useState(false)
  const [textDialogTitle, setTextDialogTitle] = useState<string>("")
  const [textDialogContent, setTextDialogContent] = useState<string>("")
  const textAreaRef = useRef<HTMLTextAreaElement | null>(null)

  const openTextDialog = (title: string, content?: string) => {
    setTextDialogTitle(title)
    setTextDialogContent(content || "")
    setShowTextDialog(true)
  }

  const selectDialogText = () => {
    const el = textAreaRef.current
    if (el) el.select()
  }

  const copyDialogText = async () => {
    try {
      await navigator.clipboard.writeText(textDialogContent || "")
      alert("已复制到剪贴板")
    } catch (e) {
      try {
        const ta = document.createElement("textarea")
        ta.value = textDialogContent || ""
        document.body.appendChild(ta)
        ta.select()
        document.execCommand("copy")
        document.body.removeChild(ta)
        alert("已复制到剪贴板")
      } catch (e2) {
        alert("复制失败，请手动选中复制")
      }
    }
  }

  const statusOptions = ["未投递", "已投递"]

  useEffect(() => {
    loadStats()
  }, [])

  useEffect(() => { setInputPage(page) }, [page])
  useEffect(() => { setInputSize(size) }, [size])

  const formatDateOnly = (s?: string) => {
    if (!s) return ""
    const d = new Date(s)
    if (!isNaN(d.getTime())) {
      const y = d.getFullYear()
      const m = String(d.getMonth() + 1).padStart(2, "0")
      const day = String(d.getDate()).padStart(2, "0")
      return `${y}-${m}-${day}`
    }
    return s.slice(0, 10)
  }

  const loadList = async (toPage = page, toSize = size) => {
    const params = new URLSearchParams()
    if (statuses.length) params.set("statuses", statuses.join(","))
    if (location) params.set("location", location)
    if (experience) params.set("experience", experience)
    if (degree) params.set("degree", degree)
    if (minK) params.set("minK", String(Number(minK)))
    if (maxK) params.set("maxK", String(Number(maxK)))
    if (keyword) params.set("keyword", keyword)
    params.set("page", String(toPage))
    params.set("size", String(toSize))

    try {
      setLoadingList(true)
      const res = await fetch(`${API_BASE}/api/liepin/list?${params.toString()}`)
      const data: PagedResult = await res.json()
      setItems(data.items || [])
      setTotal(data.total || 0)
      setPage(data.page || toPage)
      setSize(data.size || toSize)
    } catch (e) {
      console.error("fetch liepin list failed", e)
    } finally {
      setLoadingList(false)
    }
  }

  const loadStats = async () => {
    const params = new URLSearchParams()
    if (statuses.length) params.set("statuses", statuses.join(","))
    if (location) params.set("location", location)
    if (experience) params.set("experience", experience)
    if (degree) params.set("degree", degree)
    if (minK) params.set("minK", String(Number(minK)))
    if (maxK) params.set("maxK", String(Number(maxK)))
    if (keyword) params.set("keyword", keyword)

    try {
      setLoadingStats(true)
      const res = await fetch(`${API_BASE}/api/liepin/stats?${params.toString()}`)
      const data: StatsResponse = await res.json()
      setStats(data)
    } catch (e) {
      console.error("fetch liepin stats failed", e)
    } finally {
      setLoadingStats(false)
    }
  }

  useEffect(() => { loadList(1, size) }, [])

  const exportCSV = async (ignoreFilters: boolean = false) => {
    try {
      setExporting(true)
      // “全部导出”忽略筛选，直接导出整表
      const baseParams = new URLSearchParams()
      if (!ignoreFilters) {
        if (statuses.length) baseParams.set("statuses", statuses.join(","))
        if (location) baseParams.set("location", location)
        if (experience) baseParams.set("experience", experience)
        if (degree) baseParams.set("degree", degree)
        if (minK) baseParams.set("minK", String(Number(minK)))
        if (maxK) baseParams.set("maxK", String(Number(maxK)))
        if (keyword) baseParams.set("keyword", keyword)
      }

      const pageSize = 1000
      let currentPage = 1
      let all: LiepinJob[] = []
      let totalCount = 0

      while (true) {
        const params = new URLSearchParams(baseParams)
        params.set("page", String(currentPage))
        params.set("size", String(pageSize))
        const res = await fetch(`${API_BASE}/api/liepin/list?${params.toString()}`)
        const data: PagedResult = await res.json()
        const chunk = data.items || []
        if (currentPage === 1) totalCount = data.total || chunk.length
        all = all.concat(chunk)
        if (all.length >= totalCount || chunk.length === 0) break
        currentPage += 1
      }

      // 导出列与表格完全一致（19列；公司地址/融资阶段/公司介绍猎聘平台没有，固定留空）
      const header = [
        "公司名称",
        "岗位名称",
        "薪资",
        "地点",
        "经验",
        "学历",
        "HR",
        "HR职位",
        "HR活跃",
        "投递状态",
        "招聘状态",
        "链接",
        "公司地址",
        "行业",
        "公司规模",
        "融资阶段",
        "公司介绍",
        "岗位描述",
        "创建时间",
      ]
      const rows = all.map((it) => [
        it.compName || "",
        it.jobTitle || "",
        it.jobSalaryText || "",
        it.jobArea || "",
        it.jobExpReq || "",
        it.jobEduReq || "",
        it.hrName || "",
        it.hrTitle || "",
        it.hrActiveStatus || "",
        (it.delivered === 1 ? "已投递" : "未投递"),
        it.recruitmentStatus || "",
        it.jobLink || "",
        "",
        it.compIndustry || "",
        it.compScale || "",
        "",
        "",
        it.jobDescription || "",
        formatDateOnly(it.createTime) || "",
      ])
      const csv = [header, ...rows]
        .map((r) => r.map((v) => {
          const s = String(v)
          // 岗位描述等字段可能带逗号、引号或换行，都要加引号转义，否则会把CSV行结构撑坏
          return /[,"\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s
        }).join(","))
        .join("\n")
      // 加 UTF-8 BOM：Excel 不认没有 BOM 的 UTF-8 CSV，会按系统 GBK 码页打开，中文全乱码
      const BOM = String.fromCharCode(0xFEFF)
      const blob = new Blob([BOM + csv], { type: "text/csv;charset=utf-8;" })
      const url = URL.createObjectURL(blob)
      const a = document.createElement("a")
      a.href = url
      a.download = `liepin_jobs_${ignoreFilters ? 'all_' : ''}${new Date().toISOString().slice(0, 10)}.csv`
      a.click()
      URL.revokeObjectURL(url)
    } catch (e) {
      console.error("export CSV failed", e)
      alert("导出失败，请稍后重试")
    } finally {
      setExporting(false)
    }
  }

  // 当后端的薪资分布为空或全零时，使用全量分页数据计算分布
  const refreshComputedSalaryBuckets = async () => {
    try {
      const baseParams = new URLSearchParams()
      if (statuses.length) baseParams.set("statuses", statuses.join(","))
      if (location) baseParams.set("location", location)
      if (experience) baseParams.set("experience", experience)
      if (degree) baseParams.set("degree", degree)
      if (minK) baseParams.set("minK", String(Number(minK)))
      if (maxK) baseParams.set("maxK", String(Number(maxK)))
      if (keyword) baseParams.set("keyword", keyword)

      const pageSize = 1000
      let currentPage = 1
      let totalCount = 0
      const ks: number[] = []

      while (true) {
        const params = new URLSearchParams(baseParams)
        params.set("page", String(currentPage))
        params.set("size", String(pageSize))
        const res = await fetch(`${API_BASE}/api/liepin/list?${params.toString()}`)
        const data: PagedResult = await res.json()
        const chunk = data.items || []
        if (currentPage === 1) totalCount = data.total || chunk.length
        for (const it of chunk) {
          const info = parseSalary(it.jobSalaryText)
          if (info && !isNaN(info.medianK)) ks.push(info.medianK)
        }
        if (currentPage * pageSize >= totalCount || chunk.length === 0) break
        currentPage += 1
      }

      if (!ks.length) { setComputedSalaryBuckets([]); return }
      const buckets: { key: string; min: number; max: number | null }[] = [
        { key: "0-10K", min: 0, max: 10 },
        { key: "10-15K", min: 10, max: 15 },
        { key: "15-20K", min: 15, max: 20 },
        { key: "20-25K", min: 20, max: 25 },
        { key: ">=25K", min: 25, max: null },
      ]
      const counts = new Map<string, number>()
      for (const b of buckets) counts.set(b.key, 0)
      for (const k of ks) {
        const b = buckets.find((x) => (k >= x.min) && (x.max == null ? true : k < x.max))
        if (b) counts.set(b.key, (counts.get(b.key) || 0) + 1)
      }
      setComputedSalaryBuckets(buckets.map((b) => ({ bucket: b.key, value: counts.get(b.key) || 0 })))
    } catch (e) {
      console.error("compute salary buckets failed", e)
      setComputedSalaryBuckets([])
    }
  }

  // 监听筛选变化与统计加载完毕后刷新分布
  useEffect(() => {
    const apiBuckets = stats?.charts?.salaryBuckets || []
    const sum = apiBuckets.reduce((a, b) => a + (b?.value || 0), 0)
    if (apiBuckets.length === 0 || sum === 0) {
      refreshComputedSalaryBuckets()
    } else {
      setComputedSalaryBuckets([])
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [stats, statuses.join(","), location, experience, degree, minK, maxK, keyword])

  // 移除原“累计趋势”计算逻辑；改为以现有维度（经验）展示折线图

  const badgeClass = (kind: "delivery" | "hr" | "recruitment", value?: string) => {
    const base = "px-2 py-1 rounded-full text-xs font-medium whitespace-nowrap"
    const v = (value || "").trim()
    if (kind === "delivery") {
      if (v.includes("已投递")) return `${base} bg-brand-mint text-brand-tealdeep dark:bg-brand-teal/20 dark:text-[#5EEAD4]`
      return `${base} bg-[#F1EADF] text-brand-muted dark:bg-white/10 dark:text-[#9FB5B0]`
    }
    if (kind === "hr") {
      if (/刚|在线|今日/.test(v)) return `${base} bg-brand-mint text-brand-tealdeep dark:bg-brand-teal/20 dark:text-[#5EEAD4]`
      if (/小时|近/.test(v)) return `${base} bg-[#FEF3C7] text-[#92400E] dark:bg-amber-500/15 dark:text-amber-300`
      if (/天|周|月|很久/.test(v)) return `${base} bg-[#F1EADF] text-brand-muted dark:bg-white/10 dark:text-[#9FB5B0]`
      return `${base} bg-[#F1EADF] text-brand-muted dark:bg-white/10 dark:text-[#9FB5B0]`
    }
    return `${base} bg-[#F1EADF] text-brand-muted dark:bg-white/10 dark:text-[#9FB5B0]`
  }

  const kpiCards = useMemo(() => {
    const k = stats?.kpi
    // 前端容错：当后端未提供均值时，基于当前列表估算月薪均值(K)
    const avgMonthlyKFromItems = (() => {
      if (!items?.length) return undefined
      const ks: number[] = []
      for (const it of items) {
        const info = parseSalary(it.jobSalaryText)
        if (info && !isNaN(info.medianK)) ks.push(info.medianK)
      }
      if (!ks.length) return undefined
      const sum = ks.reduce((a, b) => a + b, 0)
      return Math.round((sum / ks.length) * 10) / 10
    })()
    return [
      { title: "总岗位数", value: k?.total ?? 0 },
      { title: "已投递", value: k?.delivered ?? 0 },
      { title: "未投递", value: k?.pending ?? 0 },
      { title: "平均月薪(K)", value: (k?.avgMonthlyK ?? avgMonthlyKFromItems ?? 0) },
    ]
  }, [stats, items])

  // 前端容错：当图表数据缺失时，基于列表计算分布
  const fallbackSalaryBuckets = useMemo(() => {
    const ks: number[] = []
    for (const it of items) {
      const info = parseSalary(it.jobSalaryText)
      if (info && !isNaN(info.medianK)) ks.push(info.medianK)
    }
    if (!ks.length) return [] as BucketValue[]
    const buckets: { key: string; min: number; max: number | null }[] = [
      { key: "0-10K", min: 0, max: 10 },
      { key: "10-15K", min: 10, max: 15 },
      { key: "15-20K", min: 15, max: 20 },
      { key: "20-25K", min: 20, max: 25 },
      { key: ">=25K", min: 25, max: null },
    ]
    const counts = new Map<string, number>()
    for (const b of buckets) counts.set(b.key, 0)
    for (const k of ks) {
      const b = buckets.find((x) => (k >= x.min) && (x.max == null ? true : k < x.max))
      if (b) counts.set(b.key, (counts.get(b.key) || 0) + 1)
    }
    return buckets.map((b) => ({ bucket: b.key, value: counts.get(b.key) || 0 }))
  }, [items])

  const fallbackByExperience = useMemo(() => {
    if (!items?.length) return [] as NameValue[]
    const dict = new Map<string, number>()
    const norm = (s?: string) => (s || "").trim() || "未知"
    for (const it of items) {
      const k = norm(it.jobExpReq)
      dict.set(k, (dict.get(k) || 0) + 1)
    }
    return Array.from(dict.entries()).map(([name, value]) => ({ name, value }))
  }, [items])

  const fallbackByDegree = useMemo(() => {
    if (!items?.length) return [] as NameValue[]
    const dict = new Map<string, number>()
    const norm = (s?: string) => (s || "").trim() || "不限"
    for (const it of items) {
      const k = norm(it.jobEduReq)
      dict.set(k, (dict.get(k) || 0) + 1)
    }
    return Array.from(dict.entries()).map(([name, value]) => ({ name, value }))
  }, [items])

  // 需求变更：删去 HR 活跃度卡片（保留相关类型定义无需使用）

  return (
    <div className="space-y-8">
      {showHeader && (
        <PageHeader
          icon={<BiBriefcase className="text-2xl" />}
          title="猎聘投递分析"
          subtitle="统计分析猎聘平台的岗位投递数据"
          iconClass="text-brand-teal dark:text-[#5EEAD4]"
          accentBgClass="bg-gradient-to-br from-brand-tealsoft to-[#FEF3C7] dark:from-brand-teal/20 dark:to-amber-500/10"
          actions={
            <div className="flex items-center gap-2">
              <Button onClick={() => { loadList(1, size); loadStats(); }} size="sm" className="rounded-full bg-gradient-to-r from-brand-teal to-[#0D9488] px-4 text-[#FFFDF8] shadow-[0_8px_18px_-10px_rgba(15,118,110,0.65)] hover:from-[#115E59] hover:to-brand-teal">
                <BiRefresh className="mr-1" /> 刷新
              </Button>
              <Button onClick={() => exportCSV(false)} disabled={exporting} size="sm" className="rounded-full border border-brand-teal/25 bg-brand-mint px-4 text-brand-tealdeep hover:bg-brand-tealsoft dark:border-brand-teal/40 dark:bg-brand-teal/15 dark:text-[#CCFBF1] dark:hover:bg-brand-teal/25">
                <BiDownload className="mr-1" /> 导出CSV（按筛选）
              </Button>
              <Button onClick={() => exportCSV(true)} disabled={exporting} size="sm" className="rounded-full border border-brand-teal/25 bg-brand-mint px-4 text-brand-tealdeep hover:bg-brand-tealsoft dark:border-brand-teal/40 dark:bg-brand-teal/15 dark:text-[#CCFBF1] dark:hover:bg-brand-teal/25">
                <BiDownload className="mr-1" /> 全部导出
              </Button>
            </div>
          }
        />
      )}

      {/* KPI */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        {kpiCards.map((k) => (
          <Card key={k.title} className="border-brand-teal/15 bg-gradient-to-br from-brand-paper to-brand-mint/60 dark:border-brand-teal/25 dark:from-[#0E2422] dark:to-brand-teal/10">
            <CardContent className="pt-6">
              <p className="mb-1 text-sm font-medium text-muted-foreground">{k.title}</p>
              <p className="text-3xl font-bold text-brand-teal dark:text-[#5EEAD4]">{k.value}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* 筛选区域 */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">筛选条件</CardTitle>
          <CardDescription>根据状态、地区、经验、学历、薪资区间与关键词筛选</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <Label className="block mb-1">状态</Label>
              <div className="flex flex-wrap gap-2">
                {statusOptions.map((s) => (
                  <label key={s} className="inline-flex items-center gap-1 text-sm">
                    <input
                      type="checkbox"
                      checked={statuses.includes(s)}
                      className="h-4 w-4 rounded border-[#C9BBA6] accent-brand-teal"
                      onChange={(e) => {
                        setStatuses((prev) => e.target.checked ? [...prev, s] : prev.filter((x) => x !== s))
                      }}
                    />
                    {s}
                  </label>
                ))}
              </div>
            </div>
            <div>
              <Label htmlFor="location">城市</Label>
              <Input id="location" value={location} onChange={(e) => setLocation(e.target.value)} placeholder="例如：北京" />
            </div>
            <div>
              <Label htmlFor="keyword">关键词</Label>
              <Input id="keyword" value={keyword} onChange={(e) => setKeyword(e.target.value)} placeholder="公司/岗位/HR" />
            </div>
            <div>
              <Label htmlFor="experience">经验</Label>
              <Select id="experience" value={experience} onChange={(e) => setExperience(e.target.value)}>
                <option value="">不限</option>
                <option value="应届">应届</option>
                <option value="1-3年">1-3年</option>
                <option value="3-5年">3-5年</option>
                <option value="5-10年">5-10年</option>
                <option value="10年以上">10年以上</option>
              </Select>
            </div>
            <div>
              <Label htmlFor="degree">学历</Label>
              <Select id="degree" value={degree} onChange={(e) => setDegree(e.target.value)}>
                <option value="">不限</option>
                <option value="大专">大专</option>
                <option value="本科">本科</option>
                <option value="硕士">硕士</option>
                <option value="博士">博士</option>
              </Select>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <Label htmlFor="minK">最低K</Label>
                <Input id="minK" value={minK} onChange={(e) => setMinK(e.target.value)} placeholder="如：15" />
              </div>
              <div>
                <Label htmlFor="maxK">最高K</Label>
                <Input id="maxK" value={maxK} onChange={(e) => setMaxK(e.target.value)} placeholder="如：30" />
              </div>
            </div>
          </div>
          <div className="mt-4 flex items-center gap-2">
            <Button onClick={() => { loadList(1, size); loadStats(); }} className="rounded-full bg-gradient-to-r from-brand-teal to-[#0D9488] px-4 text-[#FFFDF8] shadow-[0_8px_18px_-10px_rgba(15,118,110,0.65)] hover:from-[#115E59] hover:to-brand-teal">
              <BiRefresh className="mr-1" /> 应用筛选
            </Button>
            <Button onClick={() => exportCSV(false)} disabled={exporting} className="rounded-full border border-brand-teal/25 bg-brand-mint px-4 text-brand-tealdeep hover:bg-brand-tealsoft dark:border-brand-teal/40 dark:bg-brand-teal/15 dark:text-[#CCFBF1] dark:hover:bg-brand-teal/25">
              <BiDownload className="mr-1" /> 导出CSV（按筛选）
            </Button>
            <Button onClick={() => exportCSV(true)} disabled={exporting} className="rounded-full border border-brand-teal/25 bg-brand-mint px-4 text-brand-tealdeep hover:bg-brand-tealsoft dark:border-brand-teal/40 dark:bg-brand-teal/15 dark:text-[#CCFBF1] dark:hover:bg-brand-teal/25">
              <BiDownload className="mr-1" /> 全部导出
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* 图表 */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2"><BiBarChart className="text-primary" />按城市</CardTitle>
            <CardDescription>热门城市岗位数排行</CardDescription>
          </CardHeader>
          <CardContent>
            <ChartCanvas type="bar" title="按城市" labels={(stats?.charts?.byCity || []).map(x => x.name)} data={(stats?.charts?.byCity || []).map(x => x.value)} colors={CATEGORY_COLORS} />
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2"><BiPieChart className="text-primary" />按公司</CardTitle>
            <CardDescription>公司维度分布</CardDescription>
          </CardHeader>
          <CardContent>
            <ChartCanvas type="pie" title="按公司" labels={(stats?.charts?.byCompany || []).map(x => x.name)} data={(stats?.charts?.byCompany || []).map(x => x.value)} colors={CATEGORY_COLORS} />
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2"><BiBarChart className="text-primary" />按行业</CardTitle>
            <CardDescription>行业维度分布</CardDescription>
          </CardHeader>
          <CardContent>
            <ChartCanvas type="bar" title="按行业" labels={(stats?.charts?.byIndustry || []).map(x => x.name)} data={(stats?.charts?.byIndustry || []).map(x => x.value)} colors={CATEGORY_COLORS} />
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2"><BiLineChart className="text-primary" />经验趋势</CardTitle>
            <CardDescription>不同经验要求的岗位量（折线）</CardDescription>
          </CardHeader>
          <CardContent>
            {(() => {
              const arr = (stats?.charts?.byExperience && stats.charts.byExperience.length > 0)
                ? stats.charts.byExperience
                : fallbackByExperience
              return <ChartCanvas type="line" title="经验趋势" labels={arr.map(x => x.name)} data={arr.map(x => x.value)} color="#0F766E" />
            })()}
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2"><BiBarChart className="text-primary" />薪资分布</CardTitle>
            <CardDescription>中位数K的分布桶</CardDescription>
          </CardHeader>
          <CardContent>
            {(() => {
              const apiBuckets = stats?.charts?.salaryBuckets || []
              const apiSum = apiBuckets.reduce((a, b) => a + (b?.value || 0), 0)
              const buckets = (apiBuckets.length > 0 && apiSum > 0)
                ? apiBuckets
                : (computedSalaryBuckets.length ? computedSalaryBuckets : fallbackSalaryBuckets)
              const labels = buckets.map(x => x.bucket)
              const data = buckets.map(x => x.value)
              return <ChartCanvas type="bar" title="薪资分布" labels={labels} data={data} colors={CATEGORY_COLORS} />
            })()}
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2"><BiPieChart className="text-primary" />按状态</CardTitle>
            <CardDescription>已投递与未投递占比</CardDescription>
          </CardHeader>
          <CardContent>
            <ChartCanvas type="pie" title="按状态" labels={(stats?.charts?.byStatus || []).map(x => x.name)} data={(stats?.charts?.byStatus || []).map(x => x.value)} colors={["#0F766E", "#D6CDC0"]} />
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2"><BiBarChart className="text-primary" />按经验</CardTitle>
            <CardDescription>经验要求的分布</CardDescription>
          </CardHeader>
          <CardContent>
            {(() => {
              const arr = (stats?.charts?.byExperience && stats.charts.byExperience.length > 0)
                ? stats.charts.byExperience
                : fallbackByExperience
              return <ChartCanvas type="bar" title="按经验" labels={arr.map(x => x.name)} data={arr.map(x => x.value)} colors={CATEGORY_COLORS} />
            })()}
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2"><BiBarChart className="text-primary" />按学历</CardTitle>
            <CardDescription>学历要求的分布</CardDescription>
          </CardHeader>
          <CardContent>
            {(() => {
              const arr = (stats?.charts?.byDegree && stats.charts.byDegree.length > 0)
                ? stats.charts.byDegree
                : fallbackByDegree
              return <ChartCanvas type="bar" title="按学历" labels={arr.map(x => x.name)} data={arr.map(x => x.value)} colors={CATEGORY_COLORS} />
            })()}
          </CardContent>
        </Card>
        {/* 已按需求移除 HR 活跃度图表卡片 */}
      </div>

      {/* 列表 */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2"><BiBriefcase /> 岗位数据</CardTitle>
          <CardDescription>支持筛选、导出与刷新（公司地址/融资阶段/公司介绍猎聘平台不展示，固定留空）</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto rounded-xl border border-stroke/30 dark:border-strokedark/30 shadow-lg">
            <table className="w-full table-fixed min-w-[1200px] bg-brand-paper dark:bg-[#0E2422]">
              <thead>
                <tr className="bg-gradient-to-r from-brand-mint to-[#FFF7E8] dark:from-brand-teal/15 dark:to-amber-500/10 border-b-2 border-brand-sand dark:border-[#23403D]">
                  <th className="w-40 px-4 py-3.5 text-left text-sm font-semibold text-brand-tealdeep dark:text-[#CCFBF1] border-r border-brand-sand dark:border-[#23403D]">公司名称</th>
                  <th className="w-48 px-4 py-3.5 text-left text-sm font-semibold text-brand-tealdeep dark:text-[#CCFBF1] border-r border-brand-sand dark:border-[#23403D]">岗位名称</th>
                  <th className="w-24 px-4 py-3.5 text-left text-sm font-semibold text-brand-tealdeep dark:text-[#CCFBF1] border-r border-brand-sand dark:border-[#23403D]">薪资</th>
                  <th className="w-24 px-4 py-3.5 text-left text-sm font-semibold text-brand-tealdeep dark:text-[#CCFBF1] border-r border-brand-sand dark:border-[#23403D]">地点</th>
                  <th className="w-24 px-4 py-3.5 text-left text-sm font-semibold text-brand-tealdeep dark:text-[#CCFBF1] border-r border-brand-sand dark:border-[#23403D]">经验</th>
                  <th className="w-20 px-4 py-3.5 text-left text-sm font-semibold text-brand-tealdeep dark:text-[#CCFBF1] border-r border-brand-sand dark:border-[#23403D]">学历</th>
                  <th className="w-28 px-4 py-3.5 text-left text-sm font-semibold text-brand-tealdeep dark:text-[#CCFBF1] border-r border-brand-sand dark:border-[#23403D]">HR</th>
                  <th className="w-32 px-4 py-3.5 text-left text-sm font-semibold text-brand-tealdeep dark:text-[#CCFBF1] border-r border-brand-sand dark:border-[#23403D]">HR职位</th>
                  <th className="w-32 px-4 py-3.5 text-left text-sm font-semibold text-brand-tealdeep dark:text-[#CCFBF1] border-r border-brand-sand dark:border-[#23403D]">HR活跃</th>
                  <th className="w-24 px-4 py-3.5 text-left text-sm font-semibold text-brand-tealdeep dark:text-[#CCFBF1] border-r border-brand-sand dark:border-[#23403D]">投递状态</th>
                  <th className="w-24 px-4 py-3.5 text-left text-sm font-semibold text-brand-tealdeep dark:text-[#CCFBF1] border-r border-brand-sand dark:border-[#23403D]">招聘状态</th>
                  <th className="w-16 px-4 py-3.5 text-left text-sm font-semibold text-brand-tealdeep dark:text-[#CCFBF1] border-r border-brand-sand dark:border-[#23403D]">链接</th>
                  <th className="w-48 px-4 py-3.5 text-left text-sm font-semibold text-brand-tealdeep dark:text-[#CCFBF1] border-r border-brand-sand dark:border-[#23403D]">公司地址</th>
                  <th className="w-28 px-4 py-3.5 text-left text-sm font-semibold text-brand-tealdeep dark:text-[#CCFBF1] border-r border-brand-sand dark:border-[#23403D]">行业</th>
                  <th className="w-28 px-4 py-3.5 text-left text-sm font-semibold text-brand-tealdeep dark:text-[#CCFBF1] border-r border-brand-sand dark:border-[#23403D]">公司规模</th>
                  <th className="w-28 px-4 py-3.5 text-left text-sm font-semibold text-brand-tealdeep dark:text-[#CCFBF1] border-r border-brand-sand dark:border-[#23403D]">融资阶段</th>
                  <th className="w-48 px-4 py-3.5 text-left text-sm font-semibold text-brand-tealdeep dark:text-[#CCFBF1] border-r border-brand-sand dark:border-[#23403D]">公司介绍</th>
                  <th className="w-48 px-4 py-3.5 text-left text-sm font-semibold text-brand-tealdeep dark:text-[#CCFBF1] border-r border-brand-sand dark:border-[#23403D]">岗位描述</th>
                  <th className="w-28 px-4 py-3.5 text-left text-sm font-semibold text-brand-tealdeep dark:text-[#CCFBF1]">创建时间</th>
                </tr>
              </thead>
              <tbody>
                {items.length === 0 ? (
                  <tr>
                    <td colSpan={19} className="bg-brand-cream px-4 py-12 text-center text-muted-foreground dark:bg-white/[0.03]">
                      <div className="flex flex-col items-center gap-3">
                        <BiBriefcase className="text-4xl text-[#C9BBA6] dark:text-[#4A615D]" />
                        <p className="text-sm">暂无数据</p>
                      </div>
                    </td>
                  </tr>
                ) : (
                  items.map((it, idx) => {
                    const deliveryText = it.delivered === 1 ? "已投递" : "未投递"
                    return (
                      <tr
                        key={it.jobId}
                        className={`group transition-colors border-b border-brand-sand dark:border-[#23403D] last:border-b-0 ${
                          idx % 2 === 0
                            ? 'bg-brand-paper dark:bg-[#0E2422] hover:bg-brand-mint dark:hover:bg-white/5'
                            : 'bg-[#FCF8F0] dark:bg-white/[0.03] hover:bg-brand-mint dark:hover:bg-white/5'
                        }`}
                      >
                        <td className="px-4 py-3 text-sm leading-6 align-top border-r border-brand-sand dark:border-[#23403D]">
                          <div className="truncate cursor-pointer hover:text-primary transition-colors" title={it.compName || '-'} onClick={() => openTextDialog("公司名称", it.compName)}>{it.compName || '-'}</div>
                        </td>
                        <td className="px-4 py-3 text-sm leading-6 align-top border-r border-brand-sand dark:border-[#23403D]">
                          <div className="truncate cursor-pointer hover:text-primary transition-colors" title={it.jobTitle || '-'} onClick={() => openTextDialog("岗位名称", it.jobTitle)}>{it.jobTitle || '-'}</div>
                        </td>
                        <td className="px-4 py-3 text-sm leading-6 whitespace-nowrap align-top border-r border-brand-sand dark:border-[#23403D]">
                          <div className="truncate cursor-pointer hover:text-primary transition-colors" title={it.jobSalaryText || '-'} onClick={() => openTextDialog("薪资", it.jobSalaryText)}>{it.jobSalaryText || '-'}</div>
                        </td>
                        <td className="px-4 py-3 text-sm leading-6 whitespace-nowrap align-top border-r border-brand-sand dark:border-[#23403D]">
                          <div className="truncate cursor-pointer hover:text-primary transition-colors" title={it.jobArea || '-'} onClick={() => openTextDialog("地点", it.jobArea)}>{it.jobArea || '-'}</div>
                        </td>
                        <td className="px-4 py-3 text-sm leading-6 whitespace-nowrap align-top border-r border-brand-sand dark:border-[#23403D]">
                          <div className="truncate cursor-pointer hover:text-primary transition-colors" title={it.jobExpReq || '-'} onClick={() => openTextDialog("经验", it.jobExpReq)}>{it.jobExpReq || '-'}</div>
                        </td>
                        <td className="px-4 py-3 text-sm leading-6 whitespace-nowrap align-top border-r border-brand-sand dark:border-[#23403D]">
                          <div className="truncate cursor-pointer hover:text-primary transition-colors" title={it.jobEduReq || '-'} onClick={() => openTextDialog("学历", it.jobEduReq)}>{it.jobEduReq || '-'}</div>
                        </td>
                        <td className="px-4 py-3 text-sm leading-6 align-top border-r border-brand-sand dark:border-[#23403D]">
                          <div className="truncate cursor-pointer hover:text-primary transition-colors" title={it.hrName || '-'} onClick={() => openTextDialog("HR", it.hrName)}>{it.hrName || '-'}</div>
                        </td>
                        <td className="px-4 py-3 text-sm leading-6 align-top border-r border-brand-sand dark:border-[#23403D]">
                          <div className="truncate cursor-pointer hover:text-primary transition-colors" title={it.hrTitle || '-'} onClick={() => openTextDialog("HR职位", it.hrTitle)}>{it.hrTitle || '-'}</div>
                        </td>
                        <td className="px-4 py-3 text-sm leading-6 whitespace-nowrap align-top border-r border-brand-sand dark:border-[#23403D]">
                          <button className={badgeClass("hr", it.hrActiveStatus)} title={it.hrActiveStatus} onClick={() => openTextDialog("HR活跃", it.hrActiveStatus)}>{it.hrActiveStatus || "-"}</button>
                        </td>
                        <td className="px-4 py-3 text-sm leading-6 whitespace-nowrap align-top border-r border-brand-sand dark:border-[#23403D]">
                          <button className={badgeClass("delivery", deliveryText)} title={deliveryText} onClick={() => openTextDialog("投递状态", deliveryText)}>{deliveryText}</button>
                        </td>
                        <td className="px-4 py-3 text-sm leading-6 whitespace-nowrap align-top border-r border-brand-sand dark:border-[#23403D]">
                          <button className={badgeClass("recruitment", it.recruitmentStatus)} title={it.recruitmentStatus} onClick={() => openTextDialog("招聘状态", it.recruitmentStatus)}>{it.recruitmentStatus || "-"}</button>
                        </td>
                        <td className="px-4 py-3 text-sm leading-6 whitespace-nowrap align-top border-r border-brand-sand dark:border-[#23403D]">
                          {it.jobLink ? (
                            <a href={it.jobLink} className="text-primary underline hover:text-primary/80 transition-colors" target="_blank" rel="noreferrer">链接</a>
                          ) : (
                            "-"
                          )}
                        </td>
                        {/* 公司地址：猎聘详情页不展示该信息，固定留空 */}
                        <td className="px-4 py-3 text-sm leading-6 align-top border-r border-brand-sand dark:border-[#23403D] text-muted-foreground">-</td>
                        <td className="px-4 py-3 text-sm leading-6 align-top border-r border-brand-sand dark:border-[#23403D]">
                          <div className="truncate cursor-pointer hover:text-primary transition-colors" title={it.compIndustry || '-'} onClick={() => openTextDialog("行业", it.compIndustry)}>{it.compIndustry || '-'}</div>
                        </td>
                        <td className="px-4 py-3 text-sm leading-6 align-top border-r border-brand-sand dark:border-[#23403D]">
                          <div className="truncate cursor-pointer hover:text-primary transition-colors" title={it.compScale || '-'} onClick={() => openTextDialog("公司规模", it.compScale)}>{it.compScale || '-'}</div>
                        </td>
                        {/* 融资阶段、公司介绍：猎聘详情页不展示该信息，固定留空 */}
                        <td className="px-4 py-3 text-sm leading-6 align-top border-r border-brand-sand dark:border-[#23403D] text-muted-foreground">-</td>
                        <td className="px-4 py-3 text-sm leading-6 align-top border-r border-brand-sand dark:border-[#23403D] text-muted-foreground">-</td>
                        <td className="px-4 py-3 text-sm leading-6 align-top border-r border-brand-sand dark:border-[#23403D]">
                          <div className="truncate cursor-pointer hover:text-primary transition-colors" title={it.jobDescription || '-'} onClick={() => openTextDialog("岗位描述", it.jobDescription)}>{it.jobDescription || '-'}</div>
                        </td>
                        <td className="px-4 py-3 text-sm leading-6 whitespace-nowrap align-top">
                          <div className="truncate cursor-pointer hover:text-primary transition-colors" title={formatDateOnly(it.createTime) || '-'} onClick={() => openTextDialog("创建时间", formatDateOnly(it.createTime))}>{formatDateOnly(it.createTime) || '-'}</div>
                        </td>
                      </tr>
                    )
                  })
                )}
              </tbody>
            </table>
          </div>

          {/* 查看全文弹框 */}
          {showTextDialog && (
            <div className="fixed inset-0 z-50 flex items-center justify-center bg-[#0B3B3A]/35 backdrop-blur-[2px]" role="dialog" aria-modal="true">
              <div className="w-[92%] max-w-3xl animate-in fade-in zoom-in-95 rounded-2xl border border-brand-sand bg-brand-paper shadow-2xl dark:border-[#23403D] dark:bg-[#0E2422]">
                <Card className="border-0 bg-transparent shadow-none ring-0 hover:translate-y-0 hover:shadow-none">
                  <CardHeader className="pb-2">
                    <CardTitle className="flex items-center gap-2 text-lg">{textDialogTitle}</CardTitle>
                  </CardHeader>
                  <CardContent className="pt-0">
                    <textarea
                      ref={textAreaRef}
                      readOnly
                      value={textDialogContent || ''}
                      className="h-[50vh] w-full rounded-xl border border-brand-sand bg-brand-cream p-3 text-sm leading-6 text-brand-ink dark:border-[#23403D] dark:bg-[#0A1F1E] dark:text-brand-cream"
                    />
                    <div className="mt-4 flex justify-end gap-2">
                      <Button variant="outline" onClick={selectDialogText} className="rounded-full px-4">全选</Button>
                      <Button onClick={copyDialogText} className="rounded-full bg-gradient-to-r from-brand-teal to-[#0D9488] px-4 text-[#FFFDF8]">复制</Button>
                      <Button onClick={() => setShowTextDialog(false)} className="rounded-full px-4">关闭</Button>
                    </div>
                  </CardContent>
                </Card>
              </div>
            </div>
          )}

          {/* 分页 */}
          <div className="mt-4 flex items-center gap-2">
            <Label className="text-sm">页码</Label>
            <Input
              value={inputPage}
              onChange={(e) => setInputPage(e.target.value)}
              onBlur={() => {
                const v = Number(inputPage)
                if (!isNaN(v) && v > 0) { setPage(v); loadList(v, size) }
                else setInputPage(page)
              }}
              className="w-20"
            />
            <Label className="text-sm">每页</Label>
            <Input
              value={inputSize}
              onChange={(e) => setInputSize(e.target.value)}
              onBlur={() => {
                const v = Number(inputSize)
                if (!isNaN(v) && v > 0) { setSize(v); loadList(page, v) }
                else setInputSize(size)
              }}
              className="w-20"
            />
            <span className="text-sm text-muted-foreground">共 {total} 条</span>
            <div className="ml-auto flex items-center gap-2">
              <Button onClick={() => loadList(page - 1 > 0 ? page - 1 : 1, size)} disabled={loadingList || page <= 1} className="rounded-full border border-brand-sand bg-white/70 text-brand-tealdeep hover:bg-brand-mint dark:border-[#26403D] dark:bg-transparent dark:text-[#CCFBF1] dark:hover:bg-white/10">
                上一页
              </Button>
              <Button onClick={() => loadList(page + 1, size)} disabled={loadingList || items.length < size} className="rounded-full border border-brand-sand bg-white/70 text-brand-tealdeep hover:bg-brand-mint dark:border-[#26403D] dark:bg-transparent dark:text-[#CCFBF1] dark:hover:bg-white/10">
                下一页
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}