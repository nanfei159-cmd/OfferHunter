"use client"
import { usePathname } from 'next/navigation'
import { ReactNode } from 'react'
import { motion } from 'framer-motion'

export default function ContentArea({ children }: { children: ReactNode }) {
  const pathname = usePathname()

  return (
    <main className="app-canvas ml-64 min-h-screen min-w-0 flex-1">
      <motion.div
        key={pathname}
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: -20 }}
        transition={{ duration: 0.4, ease: "easeInOut" }}
        className="container py-8"
      >
        {children}
      </motion.div>
    </main>
  )
}
