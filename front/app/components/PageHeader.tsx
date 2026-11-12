"use client"
import { ReactNode } from 'react'
import { motion } from 'framer-motion'

export default function PageHeader({
  icon,
  title,
  subtitle,
  iconClass = 'text-brand-teal dark:text-[#5EEAD4]',
  accentBgClass = 'bg-gradient-to-br from-brand-tealsoft to-[#FEF3C7] dark:from-brand-teal/20 dark:to-amber-500/10',
  actions,
}: {
  icon: ReactNode
  title: string
  subtitle?: string
  iconClass?: string
  accentBgClass?: string
  actions?: ReactNode
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: -20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, ease: "easeOut" }}
      className="mb-8"
    >
      <div className="relative flex flex-wrap items-center gap-4 overflow-hidden rounded-[24px] border border-brand-sand/80 bg-white/70 p-6 shadow-brand backdrop-blur-xl dark:border-[#23403D] dark:bg-[#0E2422]/80">
        {/* 晨光与轨道：把图标的视觉语言带进页头 */}
        <div className="pointer-events-none absolute -right-20 -top-24 h-64 w-64 rounded-full bg-[radial-gradient(circle,rgba(251,191,36,0.32),rgba(249,115,22,0.10)_45%,transparent_70%)] blur-2xl" />
        <svg
          className="pointer-events-none absolute -right-8 top-1/2 h-52 w-52 -translate-y-1/2 text-brand-teal opacity-[0.06] dark:text-brand-tealsoft dark:opacity-[0.10]"
          viewBox="0 0 200 200"
          fill="none"
          aria-hidden="true"
        >
          <ellipse cx="100" cy="100" rx="88" ry="34" stroke="currentColor" strokeWidth="1.2" />
          <ellipse cx="100" cy="100" rx="88" ry="34" stroke="currentColor" strokeWidth="1.2" transform="rotate(60 100 100)" />
          <ellipse cx="100" cy="100" rx="88" ry="34" stroke="currentColor" strokeWidth="1.2" transform="rotate(120 100 100)" />
          <circle cx="100" cy="100" r="14" stroke="currentColor" strokeWidth="1.2" />
        </svg>

        <motion.div
          initial={{ scale: 0, rotate: -180 }}
          animate={{ scale: 1, rotate: 0 }}
          transition={{ delay: 0.2, type: "spring", stiffness: 200 }}
          className={`relative z-10 rounded-2xl p-4 shadow-[0_10px_24px_-18px_rgba(15,118,110,0.45)] ring-1 ring-[#A7E3D8] dark:ring-[#2C4A45] ${accentBgClass}`}
        >
          <span className={`${iconClass} text-2xl`}>{icon}</span>
        </motion.div>
        <motion.div
          initial={{ opacity: 0, x: -20 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ delay: 0.3, duration: 0.5 }}
          className="relative z-10 flex-1"
        >
          <h1 className="text-2xl font-bold tracking-tight text-brand-ink dark:text-brand-cream md:text-3xl">
            {title}
          </h1>
          {subtitle && (
            <p className="mt-1.5 text-base text-brand-muted dark:text-[#9FB5B0]">
              {subtitle}
            </p>
          )}
        </motion.div>
        {actions && (
          <motion.div
            initial={{ opacity: 0, scale: 0.8 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: 0.4, duration: 0.3 }}
            className="relative z-10 ml-auto flex flex-wrap items-center gap-2"
          >
            {actions}
          </motion.div>
        )}
      </div>
    </motion.div>
  )
}
