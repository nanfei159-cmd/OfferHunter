import * as React from "react"

import { cn } from "@/lib/utils"

const Input = React.forwardRef<HTMLInputElement, React.ComponentProps<"input">>(
  ({ className, type, ...props }, ref) => {
    return (
      <input
        type={type}
        className={cn(
          // 尺寸与排版
          "flex h-10 w-full rounded-full px-4 py-2 text-sm",
          // 奶油纸面 + 细沙描边
          "border border-brand-sand bg-white/80 text-brand-ink shadow-[inset_0_1px_0_rgba(255,255,255,.9)]",
          "placeholder:text-[#9AA7B3]",
          // 交互态
          "transition-all duration-200 hover:border-[#D6C7B2] hover:bg-white",
          "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-teal/25 focus-visible:border-brand-teal/60",
          // 深色模式：深青夜面
          "dark:border-[#26403D] dark:bg-[#0E2422]/70 dark:text-brand-cream dark:placeholder:text-[#7F9994] dark:hover:bg-[#0E2422]",
          // 文件输入
          "file:border-0 file:bg-transparent file:text-sm file:font-medium file:text-foreground",
          // 禁用态
          "disabled:cursor-not-allowed disabled:opacity-50",
          className
        )}
        ref={ref}
        {...props}
      />
    )
  }
)
Input.displayName = "Input"

export { Input }
