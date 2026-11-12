'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import { BiCheck, BiChevronDown, BiMap, BiSearch } from 'react-icons/bi'

export interface CityOption {
  name: string
  code: string
}

const HOT_CITIES = new Set([
  '北京', '上海', '广州', '深圳', '杭州', '成都', '南京', '苏州', '武汉', '西安',
  '天津', '重庆', '长沙', '郑州', '青岛', '东莞', '佛山', '宁波', '合肥', '厦门',
  '济南', '无锡', '大连', '沈阳',
])

// 城市列表页同时会给出省级链接，这些不是具体城市，避免混进选项
const PROVINCES = new Set([
  '河北', '山西', '辽宁', '吉林', '黑龙江', '江苏', '浙江', '安徽', '福建', '江西',
  '山东', '河南', '湖北', '湖南', '广东', '海南', '四川', '贵州', '云南', '陕西',
  '甘肃', '青海', '台湾', '内蒙古', '广西', '西藏', '宁夏', '新疆',
])

export default function CityMultiSelect({
  options,
  value,
  onChange,
  id,
}: {
  options: CityOption[]
  value: string[]
  onChange: (cities: string[]) => void
  id?: string
}) {
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState('')
  const [dropUp, setDropUp] = useState(false)
  const wrapperRef = useRef<HTMLDivElement>(null)
  const buttonRef = useRef<HTMLButtonElement>(null)

  useEffect(() => {
    if (!open) return
    const updateDirection = () => {
      const rect = buttonRef.current?.getBoundingClientRect()
      if (!rect) return
      const panelHeight = Math.min(window.innerHeight * 0.62, 540)
      setDropUp(window.innerHeight - rect.bottom < panelHeight && rect.top > panelHeight)
    }
    updateDirection()
    const handleClickOutside = (event: MouseEvent) => {
      if (wrapperRef.current && !wrapperRef.current.contains(event.target as Node)) {
        setOpen(false)
      }
    }
    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setOpen(false)
    }
    document.addEventListener('mousedown', handleClickOutside)
    document.addEventListener('keydown', handleEscape)
    window.addEventListener('resize', updateDirection)
    window.addEventListener('scroll', updateDirection, true)
    return () => {
      document.removeEventListener('mousedown', handleClickOutside)
      document.removeEventListener('keydown', handleEscape)
      window.removeEventListener('resize', updateDirection)
      window.removeEventListener('scroll', updateDirection, true)
    }
  }, [open])

  const allCities = useMemo(
    () => (options || []).filter((o) => o.name && o.name !== '全国' && !PROVINCES.has(o.name) && !o.name.includes('省直辖')),
    [options]
  )
  const hotCities = useMemo(() => allCities.filter((o) => HOT_CITIES.has(o.name)), [allCities])
  const otherCities = useMemo(() => allCities.filter((o) => !HOT_CITIES.has(o.name)), [allCities])

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    if (!q) return []
    return allCities.filter((o) => o.name.toLowerCase().includes(q) || o.code.includes(q))
  }, [allCities, query])

  const selectedCount = value.length
  const summary = selectedCount === 0
    ? '全国 / 不限'
    : selectedCount <= 2
    ? value.join('、')
    : `${value.slice(0, 2).join('、')} 等 ${selectedCount} 个城市`

  const toggle = (name: string) => {
    if (value.includes(name)) {
      onChange(value.filter((x) => x !== name))
    } else {
      onChange([...value, name])
    }
  }

  const chipClass = (active: boolean) =>
    `inline-flex items-center gap-1 rounded-full border px-2.5 py-1 text-xs transition-colors ${
      active
        ? 'border-brand-teal/40 bg-brand-tealsoft text-brand-tealdeep dark:border-brand-teal/50 dark:bg-brand-teal/20 dark:text-[#CCFBF1]'
        : 'border-brand-sand bg-white/70 text-brand-muted hover:border-brand-teal/25 hover:bg-brand-mint dark:border-[#26403D] dark:bg-[#0E2422]/60 dark:text-[#9FB5B0] dark:hover:bg-white/10'
    }`

  return (
    <div ref={wrapperRef} className="relative">
      <button
        ref={buttonRef}
        id={id}
        type="button"
        aria-haspopup="listbox"
        aria-expanded={open}
        onClick={() => {
          setOpen((v) => !v)
          setQuery('')
        }}
        className="flex h-10 w-full items-center justify-between gap-2 rounded-full border border-brand-sand bg-white/80 px-4 text-sm text-brand-ink shadow-[inset_0_1px_0_rgba(255,255,255,.9)] transition-all hover:border-[#D6C7B2] hover:bg-white focus:outline-none focus:ring-2 focus:ring-brand-teal/25 focus:border-brand-teal/60 dark:border-[#26403D] dark:bg-[#0E2422]/70 dark:text-brand-cream dark:hover:bg-[#0E2422]"
      >
        <span className="flex min-w-0 items-center gap-2">
          <BiMap className="shrink-0 text-brand-teal dark:text-[#5EEAD4]" />
          <span className={`truncate ${selectedCount === 0 ? 'text-[#9AA7B3] dark:text-[#7F9994]' : ''}`}>
            {summary}
          </span>
        </span>
        <BiChevronDown className={`shrink-0 text-brand-teal transition-transform dark:text-[#5EEAD4] ${open ? 'rotate-180' : ''}`} />
      </button>

      {open && (
        <div
          role="listbox"
          aria-multiselectable="true"
          className={`absolute left-0 z-40 w-[420px] max-w-[calc(100vw-2rem)] rounded-2xl border border-brand-sand bg-brand-paper p-3 shadow-brand-lg dark:border-[#23403D] dark:bg-[#0E2422] ${dropUp ? 'bottom-full mb-2' : 'top-full mt-2'}`}
        >
          <div className="relative">
            <BiSearch className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-brand-teal dark:text-[#5EEAD4]" />
            <input
              autoFocus
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="搜索城市，如：佛山、东莞"
              aria-label="搜索城市"
              className="h-9 w-full rounded-full border border-brand-sand bg-white/80 pl-9 pr-3 text-sm text-brand-ink placeholder:text-[#9AA7B3] focus:outline-none focus:ring-2 focus:ring-brand-teal/25 dark:border-[#26403D] dark:bg-[#0A1F1E] dark:text-brand-cream dark:placeholder:text-[#7F9994]"
            />
          </div>

          <div className="mt-2 flex items-center justify-between px-1 text-xs">
            <span className="text-brand-muted dark:text-[#9FB5B0]">
              {selectedCount ? `已选 ${selectedCount} 个城市` : '不选表示全国 / 不限'}
            </span>
            <div className="flex items-center gap-3">
              {selectedCount > 0 && (
                <button
                  type="button"
                  onClick={() => onChange([])}
                  className="text-brand-teal hover:underline dark:text-[#5EEAD4]"
                >
                  清空
                </button>
              )}
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="text-brand-muted hover:text-brand-teal dark:text-[#9FB5B0] dark:hover:text-[#5EEAD4]"
              >
                收起
              </button>
            </div>
          </div>

          <div className="mt-2 max-h-[min(60vh,420px)] overflow-y-auto pr-1">
            {query ? (
              <div className="p-1">
                <p className="mb-1.5 text-[11px] font-medium uppercase tracking-wide text-brand-muted dark:text-[#9FB5B0]">搜索结果</p>
                {filtered.length ? (
                  <div className="flex flex-wrap gap-1.5">
                    {filtered.map((city) => {
                      const active = value.includes(city.name)
                      return (
                        <button key={city.name} type="button" aria-pressed={active} onClick={() => toggle(city.name)} className={chipClass(active)}>
                          {active && <BiCheck className="text-sm" />}
                          {city.name}
                        </button>
                      )
                    })}
                  </div>
                ) : (
                  <p className="px-1 py-3 text-xs text-brand-muted dark:text-[#9FB5B0]">没有找到匹配城市</p>
                )}
              </div>
            ) : (
              <>
                <div className="p-1">
                  <button type="button" aria-pressed={selectedCount === 0} onClick={() => onChange([])} className={chipClass(selectedCount === 0)}>
                    {selectedCount === 0 && <BiCheck className="text-sm" />}
                    全国 / 不限
                  </button>
                </div>

                <section className="mt-2 border-t border-brand-sand/60 p-1 pt-3 dark:border-white/10">
                  <p className="mb-1.5 text-[11px] font-medium uppercase tracking-wide text-brand-muted dark:text-[#9FB5B0]">热门城市</p>
                  <div className="flex flex-wrap gap-1.5">
                    {hotCities.map((city) => {
                      const active = value.includes(city.name)
                      return (
                        <button key={city.name} type="button" aria-pressed={active} onClick={() => toggle(city.name)} className={chipClass(active)}>
                          {active && <BiCheck className="text-sm" />}
                          {city.name}
                        </button>
                      )
                    })}
                  </div>
                </section>

                <section className="mt-2 border-t border-brand-sand/60 p-1 pt-3 dark:border-white/10">
                  <p className="mb-1.5 text-[11px] font-medium uppercase tracking-wide text-brand-muted dark:text-[#9FB5B0]">其它城市</p>
                  <div className="flex flex-wrap gap-1.5">
                    {otherCities.map((city) => {
                      const active = value.includes(city.name)
                      return (
                        <button key={city.name} type="button" aria-pressed={active} onClick={() => toggle(city.name)} className={chipClass(active)}>
                          {active && <BiCheck className="text-sm" />}
                          {city.name}
                        </button>
                      )
                    })}
                  </div>
                </section>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
