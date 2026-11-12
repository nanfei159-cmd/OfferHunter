'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useEffect, useState } from 'react'
import { BiSearch, BiMoon, BiSun } from 'react-icons/bi'
import { motion } from 'framer-motion'
import { useTheme } from 'next-themes'
import { API_BASE } from '@/lib/api'

export default function Sidebar() {
  const pathname = usePathname()
  const { theme, setTheme } = useTheme()
  const [mounted, setMounted] = useState(false)

  // 健康检查状态：up / degraded / down / unknown
  const [health, setHealth] = useState<'up' | 'degraded' | 'down' | 'unknown'>('unknown')
  const [checking, setChecking] = useState(false)

  useEffect(() => {
    setMounted(true)
  }, [])

  useEffect(() => {
    let interval: NodeJS.Timeout | null = null

    const check = async () => {
      if (checking) return
      setChecking(true)
      const baseUrl = process.env.API_BASE_URL || `${API_BASE}`

      const controller = new AbortController()
      const timeout = setTimeout(() => controller.abort(), 3000)
      try {
        // 先尝试自定义健康接口
        let res = await fetch(`${baseUrl}/api/health`, { signal: controller.signal })
        if (res.status === 404) {
          // 回退到 Spring Boot Actuator
          res = await fetch(`${baseUrl}/actuator/health`, { signal: controller.signal })
        }
        if (!res.ok) throw new Error(`status ${res.status}`)
        const data = await res.json()
        const statusRaw = (data.status || data.state || '').toString().toUpperCase()
        if (statusRaw === 'UP' || statusRaw === 'HEALTHY') {
          setHealth('up')
        } else if (statusRaw === 'DEGRADED' || statusRaw === 'WARN') {
          setHealth('degraded')
        } else {
          setHealth('down')
        }
      } catch (e) {
        setHealth('unknown')
      } finally {
        clearTimeout(timeout)
        setChecking(false)
      }
    }

    // 首次检查 + 轮询
    check()
    interval = setInterval(check, 30000)
    return () => {
      if (interval) clearInterval(interval)
    }
  }, [])

  const platformGroup = [
    { href: '/liepin', icon: BiSearch, label: '猎聘' },
  ]

  return (
    <motion.div
      initial={{ x: -100, opacity: 0 }}
      animate={{ x: 0, opacity: 1 }}
      transition={{ duration: 0.5, ease: 'easeOut' }}
      className="fixed left-0 top-0 z-50 h-full w-64 overflow-hidden border-r border-[#E7DCCB] bg-[linear-gradient(168deg,#F1FBFF_0%,#FFF9EF_48%,#FFE7D0_100%)] shadow-[10px_0_40px_-32px_rgba(91,70,46,0.28)] dark:border-[#23403D] dark:bg-[linear-gradient(168deg,#0E2E2B_0%,#123C38_55%,#1A4A42_100%)]"
    >
      {/* 日出暖光：呼应图标的中心太阳 */}
      <div className="pointer-events-none absolute -bottom-28 -left-28 h-80 w-80 rounded-full bg-[radial-gradient(circle,rgba(251,191,36,0.22),rgba(249,115,22,0.07)_45%,transparent_70%)] blur-2xl" />

      {/* 轨道水印：呼应图标的原子线条 */}
      <svg
        className="pointer-events-none absolute -right-24 -top-12 h-[340px] w-[340px] text-[#0F766E] opacity-[0.08] dark:text-[#FFF7E8] dark:opacity-[0.08]"
        viewBox="0 0 200 200"
        fill="none"
        aria-hidden="true"
      >
        <ellipse cx="100" cy="100" rx="88" ry="34" stroke="currentColor" strokeWidth="1.1" />
        <ellipse cx="100" cy="100" rx="88" ry="34" stroke="currentColor" strokeWidth="1.1" transform="rotate(60 100 100)" />
        <ellipse cx="100" cy="100" rx="88" ry="34" stroke="currentColor" strokeWidth="1.1" transform="rotate(120 100 100)" />
        <circle cx="100" cy="100" r="17" stroke="currentColor" strokeWidth="1.1" />
      </svg>

      {/* 侧边栏头部 */}
      <motion.div
        initial={{ y: -20, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ delay: 0.2, duration: 0.5 }}
        className="relative border-b border-[#E7DCCB] p-6 dark:border-[#23403D]"
      >
        <div className="mb-2 flex items-center gap-3">
          <img
            src="/offer-hunter.png"
            alt="Offer猎手"
            className="h-12 w-12 rounded-full shadow-[0_10px_24px_rgba(120,90,50,0.18)] ring-1 ring-white/80 dark:ring-[#3A5853]"
          />
          <div>
            <h1 className="text-xl font-bold tracking-tight text-[#0B3B3A] dark:text-[#FFF7E8]">Offer猎手</h1>
            <p className="text-sm text-[#5F7C79] dark:text-[#A7D8D0]">猎聘投递助手</p>
          </div>
        </div>

        {/* 状态指示器（动态健康检查） */}
        <div className="mt-4 flex items-center gap-2 text-sm text-[#4F6B68] dark:text-[#CFE8E3]">
          <div
            className={`h-2 w-2 animate-pulse rounded-full ${
              health === 'up'
                ? 'bg-emerald-400 shadow-[0_0_10px_rgba(52,211,153,0.55)]'
                : health === 'degraded'
                ? 'bg-amber-400'
                : health === 'down'
                ? 'bg-rose-400'
                : 'bg-slate-300'
            }`}
          ></div>
          <span>
            {health === 'up'
              ? '系统运行正常'
              : health === 'degraded'
              ? '服务降级'
              : health === 'down'
              ? '服务异常'
              : '未连接'}
          </span>
        </div>

        {/* 主题切换器 */}
        {mounted && (
          <motion.button
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            transition={{ delay: 0.4, type: 'spring', stiffness: 200 }}
            onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
            className="mt-4 flex w-full items-center justify-center gap-2 rounded-xl border border-[#D9E8E2] bg-[#FFFDF8] px-4 py-2.5 text-[#0F4C4A] transition-all duration-300 hover:bg-[#F0FDFA] dark:border-[#2C4A45] dark:bg-[#143432] dark:text-[#FFF7E8] dark:hover:bg-[#1B423D]"
          >
            {theme === 'dark' ? (
              <>
                <BiSun className="text-lg text-amber-500" />
                <span className="text-sm">切换到浅色</span>
              </>
            ) : (
              <>
                <BiMoon className="text-lg text-[#5F8F89]" />
                <span className="text-sm">切换到深色</span>
              </>
            )}
          </motion.button>
        )}
      </motion.div>

      {/* 导航菜单 */}
      <nav className="relative h-[calc(100vh-280px)] space-y-4 overflow-y-auto p-4">
        {/* 平台配置分组 */}
        <div>
          <div className="px-4 py-2 text-xs uppercase tracking-[0.16em] text-[#5F7C79] dark:text-[#8FC9C1]">猎聘</div>
          <div className="space-y-2">
            {platformGroup.map((item, index) => {
              const Icon = item.icon
              const isActive = pathname === item.href
              return (
                <motion.div
                  key={item.href}
                  initial={{ x: -20, opacity: 0 }}
                  animate={{ x: 0, opacity: 1 }}
                  transition={{ delay: 0.1 * index + 0.5, duration: 0.3 }}
                >
                  <Link
                    href={item.href}
                    className={`
                      group flex items-center gap-3 rounded-xl px-4 py-3 transition-all duration-300
                      ${isActive
                        ? 'border border-[#B9E3D9] bg-white/80 text-[#0B3B3A] shadow-[0_10px_24px_-18px_rgba(15,118,110,0.45)] dark:border-[#FFF7E8] dark:bg-[#FFF7E8]'
                        : 'text-[#5B6B7E] hover:bg-white/60 hover:text-[#0F4C4A] dark:text-[#CFE8E3] dark:hover:bg-[#183C37] dark:hover:text-white'
                      }
                    `}
                  >
                    <Icon className={`text-xl transition-transform group-hover:scale-110 ${isActive ? 'text-[#0F766E]' : 'text-[#7FA9A3] dark:text-[#9FD8D0]'}`} />
                    <span className="font-medium">{item.label}</span>
                    {isActive && (
                      <div className="ml-auto">
                        <div className="h-2 w-2 rounded-full bg-[#F59E0B] shadow-[0_0_10px_rgba(245,158,11,0.55)]"></div>
                      </div>
                    )}
                  </Link>
                </motion.div>
              )
            })}
          </div>
        </div>
      </nav>

      {/* 底部信息 */}
      <motion.div
        initial={{ y: 20, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ delay: 0.8, duration: 0.5 }}
        className="absolute bottom-0 left-0 right-0 border-t border-[#E7DCCB] p-4 dark:border-[#23403D]"
      >
        <div className="text-center">
          <p className="text-xs text-[#5F7C79]/90 dark:text-[#8FC9C1]/80">v2.0.1 · Offer猎手</p>
        </div>
      </motion.div>
    </motion.div>
  )
}
