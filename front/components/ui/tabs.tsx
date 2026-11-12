"use client"

import * as React from "react"
import * as TabsPrimitive from "@radix-ui/react-tabs"

import { cn } from "@/lib/utils"

const Tabs = TabsPrimitive.Root

const TabsList = React.forwardRef<
  React.ElementRef<typeof TabsPrimitive.List>,
  React.ComponentPropsWithoutRef<typeof TabsPrimitive.List>
>(({ className, ...props }, ref) => (
  <TabsPrimitive.List
    ref={ref}
    className={cn(
      "inline-flex h-10 items-center justify-center rounded-full border border-brand-sand/80 bg-white/70 p-1.5 text-brand-muted shadow-brand backdrop-blur-md dark:border-[#23403D] dark:bg-[#0E2422]/70 dark:text-[#9FB5B0]",
      className
    )}
    {...props}
  />
))
TabsList.displayName = TabsPrimitive.List.displayName

const TabsTrigger = React.forwardRef<
  React.ElementRef<typeof TabsPrimitive.Trigger>,
  React.ComponentPropsWithoutRef<typeof TabsPrimitive.Trigger>
>(({ className, ...props }, ref) => (
  <TabsPrimitive.Trigger
    ref={ref}
    className={cn(
      "relative inline-flex items-center justify-center whitespace-nowrap rounded-full px-5 py-2 text-sm font-medium select-none transition-all ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 "+
        "data-[state=inactive]:hover:bg-white/70 data-[state=inactive]:hover:text-brand-tealdeep dark:data-[state=inactive]:hover:bg-white/10 dark:data-[state=inactive]:hover:text-brand-cream "+
        "data-[state=active]:text-brand-tealdeep data-[state=active]:bg-gradient-to-r data-[state=active]:from-brand-tealsoft data-[state=active]:to-[#FEF3C7] data-[state=active]:shadow-[0_6px_16px_-12px_rgba(15,118,110,0.5)] data-[state=active]:ring-1 data-[state=active]:ring-inset data-[state=active]:ring-[#A7E3D8] "+
        "dark:data-[state=active]:text-[#FFFDF8] dark:data-[state=active]:from-brand-teal dark:data-[state=active]:to-[#0D9488] dark:data-[state=active]:ring-brand-teal/40",
      className
    )}
    {...props}
  />
))
TabsTrigger.displayName = TabsPrimitive.Trigger.displayName

const TabsContent = React.forwardRef<
  React.ElementRef<typeof TabsPrimitive.Content>,
  React.ComponentPropsWithoutRef<typeof TabsPrimitive.Content>
>(({ className, ...props }, ref) => (
  <TabsPrimitive.Content
    ref={ref}
    className={cn(
      "mt-2 ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
      className
    )}
    {...props}
  />
))
TabsContent.displayName = TabsPrimitive.Content.displayName

export { Tabs, TabsList, TabsTrigger, TabsContent }
