import * as React from "react"

import { cn } from "@/lib/utils"

export interface TextareaProps
  extends React.TextareaHTMLAttributes<HTMLTextAreaElement> {}

const Textarea = React.forwardRef<HTMLTextAreaElement, TextareaProps>(
  ({ className, ...props }, ref) => {
    return (
      <textarea
        className={cn(
          "flex min-h-[60px] w-full rounded-xl border border-brand-sand bg-white/80 px-4 py-3 text-base text-brand-ink shadow-[inset_0_1px_0_rgba(255,255,255,.9)] placeholder:text-[#9AA7B3] transition-all duration-200 hover:border-[#D6C7B2] hover:bg-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-teal/25 focus-visible:border-brand-teal/60 disabled:cursor-not-allowed disabled:opacity-50 dark:border-[#26403D] dark:bg-[#0E2422]/70 dark:text-brand-cream dark:placeholder:text-[#7F9994] dark:hover:bg-[#0E2422] md:text-sm",
          className
        )}
        ref={ref}
        {...props}
      />
    )
  }
)
Textarea.displayName = "Textarea"

export { Textarea }
