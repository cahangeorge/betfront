/** Radix + Tailwind primitive components used across the app */
import * as React from 'react'
import { Dialog as DialogNS, Select as SelectNS, Tabs as TabsNS, Tooltip as TooltipNS } from 'radix-ui'
import { ChevronDownIcon, CheckIcon, Cross2Icon } from '@radix-ui/react-icons'
import { cn } from '#/lib/cn'

// ─── Badge ─────────────────────────────────────────────────────────────────

const statusColors: Record<string, string> = {
  pending: 'bg-yellow-100 text-yellow-800 border-yellow-200 dark:bg-yellow-900/30 dark:text-yellow-300 dark:border-yellow-700/50',
  running: 'bg-blue-100 text-blue-800 border-blue-200 animate-pulse dark:bg-blue-900/30 dark:text-blue-300 dark:border-blue-700/50',
  success: 'bg-green-100 text-green-800 border-green-200 dark:bg-green-900/30 dark:text-green-300 dark:border-green-700/50',
  failed: 'bg-red-100 text-red-800 border-red-200 dark:bg-red-900/30 dark:text-red-300 dark:border-red-700/50',
}

const dotColors: Record<string, string> = {
  pending: 'bg-yellow-400',
  running: 'bg-blue-400 animate-pulse',
  success: 'bg-green-500',
  failed: 'bg-red-500',
}

export function Badge({
  status,
  label,
  size = 'sm',
  dot = false,
}: {
  status: string
  label?: string
  size?: 'xs' | 'sm'
  dot?: boolean
}) {
  if (dot) {
    return (
      <span className="inline-flex items-center gap-1.5">
        <span
          className={cn(
            'inline-block rounded-full flex-shrink-0',
            size === 'xs' ? 'h-1.5 w-1.5' : 'h-2 w-2',
            dotColors[status] ?? 'bg-gray-400',
          )}
        />
        {(label ?? status) && (
          <span className={cn('font-medium text-[var(--sea-ink-soft)]', size === 'xs' ? 'text-[10px]' : 'text-xs')}>
            {label ?? status}
          </span>
        )}
      </span>
    )
  }

  return (
    <span
      className={cn(
        'inline-flex items-center rounded-full border font-semibold',
        size === 'xs' ? 'px-1.5 py-px text-[10px]' : 'px-2 py-0.5 text-xs',
        statusColors[status] ?? 'bg-gray-100 text-gray-700 border-gray-200',
      )}
    >
      {label ?? status}
    </span>
  )
}

// ─── Button ────────────────────────────────────────────────────────────────

type ButtonVariant = 'primary' | 'secondary' | 'danger' | 'ghost'
type ButtonSize = 'sm' | 'md' | 'lg'

const buttonVariants: Record<ButtonVariant, string> = {
  primary:
    'bg-[var(--lagoon-deep)] text-white hover:bg-[var(--lagoon)] active:scale-95 shadow-[var(--shadow-sm)] hover:shadow-[var(--shadow-glow-lagoon)]',
  secondary:
    'bg-[var(--surface)] border border-[var(--line)] text-[var(--sea-ink)] hover:bg-[var(--surface-strong)] active:scale-95 shadow-[var(--shadow-sm)]',
  danger:
    'bg-red-500 text-white hover:bg-red-600 active:scale-95',
  ghost:
    'text-[var(--sea-ink-soft)] hover:text-[var(--sea-ink)] hover:bg-black/5 active:scale-95',
}

const buttonSizes: Record<ButtonSize, string> = {
  sm: 'px-3 py-1.5 text-xs rounded-lg gap-1',
  md: 'px-4 py-2 text-sm rounded-lg gap-1.5',
  lg: 'px-5 py-2.5 text-base rounded-xl gap-2',
}

export function Button({
  variant = 'primary',
  size = 'md',
  loading = false,
  className,
  disabled,
  children,
  ...props
}: React.ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: ButtonVariant
  size?: ButtonSize
  loading?: boolean
}) {
  return (
    <button
      {...props}
      disabled={disabled || loading}
      className={cn(
        'inline-flex items-center font-semibold transition-[color,background-color,border-color,box-shadow,opacity,transform] min-h-11',
        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--lagoon)]',
        'disabled:pointer-events-none disabled:opacity-50',
        buttonVariants[variant],
        buttonSizes[size],
        className,
      )}
    >
      {loading && <Spinner className={size === 'lg' ? 'h-5 w-5' : 'h-4 w-4'} />}
      {children}
    </button>
  )
}

// ─── Input ────────────────────────────────────────────────────────────────

export function Input({ className, ...props }: React.InputHTMLAttributes<HTMLInputElement>) {
  return (
    <input
      {...props}
      className={cn(
        'w-full rounded-lg border border-[var(--line)] bg-[var(--surface)] px-3 py-2 text-base text-[var(--sea-ink)] min-h-11',
        'placeholder:text-[var(--sea-ink-soft)]/50',
        'focus:outline-none focus:ring-2 focus:ring-[var(--lagoon)] focus:border-transparent',
        'disabled:opacity-50',
        className,
      )}
    />
  )
}

// ─── Label ────────────────────────────────────────────────────────────────

export function Label({ className, ...props }: React.LabelHTMLAttributes<HTMLLabelElement>) {
  return (
    <label
      {...props}
      className={cn('text-xs sm:text-sm font-semibold uppercase tracking-wide text-[var(--sea-ink-soft)]', className)}
    />
  )
}

// ─── Card ────────────────────────────────────────────────────────────────

type CardVariant = 'default' | 'interactive' | 'inset'

export function Card({
  className,
  variant = 'default',
  ...props
}: React.HTMLAttributes<HTMLDivElement> & { variant?: CardVariant }) {
  return (
    <div
      {...props}
      className={cn(
        'rounded-2xl border border-[var(--line)] p-3 sm:p-4 backdrop-blur-sm overflow-hidden',
        variant === 'default' && 'bg-[var(--surface)]',
        variant === 'interactive' &&
          'bg-[var(--surface)] cursor-pointer transition-[transform,box-shadow] hover:-translate-y-1 hover:shadow-[var(--shadow-glow-lagoon)]',
        variant === 'inset' &&
          'bg-[color-mix(in_oklab,var(--surface)_70%,var(--sand)_30%)] shadow-[0_1px_3px_rgba(23,58,64,0.08)_inset]',
        className,
      )}
    />
  )
}

// ─── Select ───────────────────────────────────────────────────────────────

export function Select({
  value,
  onValueChange,
  placeholder,
  options,
  optionGroups,
  disabled,
}: {
  value?: string
  onValueChange: (v: string) => void
  placeholder?: string
  options: { label: string; value: string }[]
  optionGroups?: Array<{ label: string; options: { label: string; value: string }[] }>
  disabled?: boolean
}) {
  const allOptions = optionGroups?.flatMap((group) => group.options) ?? options

  if (allOptions.some((option) => option.value === '')) {
    throw new Error('Select options must not use an empty string value. Use a sentinel value such as __all__ and map it in the caller.')
  }

  return (
    <SelectNS.Root value={value} onValueChange={onValueChange} disabled={disabled}>
      <SelectNS.Trigger
        className={cn(
          'flex w-full items-center justify-between rounded-lg border border-[var(--line)]',
          'bg-[var(--surface)] px-3 py-2 text-sm text-[var(--sea-ink)] min-h-11',
          'focus:outline-none focus:ring-2 focus:ring-[var(--lagoon)]',
          'data-[placeholder]:text-[var(--sea-ink-soft)]/50',
          'disabled:opacity-50',
        )}
      >
        <SelectNS.Value placeholder={placeholder} />
        <SelectNS.Icon>
          <ChevronDownIcon className="h-4 w-4 opacity-50" />
        </SelectNS.Icon>
      </SelectNS.Trigger>

      <SelectNS.Portal>
        <SelectNS.Content
          className={cn(
            'z-50 min-w-[8rem] overflow-hidden rounded-xl border border-[var(--line)]',
            'bg-[var(--surface-strong)] shadow-lg shadow-black/20',
          )}
          position="popper"
          sideOffset={4}
        >
          <SelectNS.Viewport className="p-1">
            {(optionGroups ?? [{ label: null, options }]).map((group, groupIndex) => (
              <React.Fragment key={group.label ?? `ungrouped-${groupIndex}`}>
                {group.label ? (
                  <SelectNS.Group>
                    <SelectNS.Label className="px-3 pb-1 pt-2 text-[10px] font-semibold uppercase tracking-wide text-[var(--sea-ink-soft)]/70">
                      {group.label}
                    </SelectNS.Label>
                    {group.options.map((opt) => (
                      <SelectNS.Item
                        key={opt.value}
                        value={opt.value}
                        className={cn(
                          'relative flex cursor-default select-none items-center rounded-lg px-3 py-2 text-sm',
                          'text-[var(--sea-ink)] outline-none',
                          'data-[highlighted]:bg-[var(--lagoon)]/10 data-[highlighted]:text-[var(--lagoon-deep)]',
                          'data-[state=checked]:font-semibold',
                        )}
                      >
                        <SelectNS.ItemIndicator className="absolute left-1.5">
                          <CheckIcon className="h-3.5 w-3.5" />
                        </SelectNS.ItemIndicator>
                        <SelectNS.ItemText className="pl-4">{opt.label}</SelectNS.ItemText>
                      </SelectNS.Item>
                    ))}
                  </SelectNS.Group>
                ) : (
                  group.options.map((opt) => (
                    <SelectNS.Item
                      key={opt.value}
                      value={opt.value}
                      className={cn(
                        'relative flex cursor-default select-none items-center rounded-lg px-3 py-2 text-sm',
                        'text-[var(--sea-ink)] outline-none',
                        'data-[highlighted]:bg-[var(--lagoon)]/10 data-[highlighted]:text-[var(--lagoon-deep)]',
                        'data-[state=checked]:font-semibold',
                      )}
                    >
                      <SelectNS.ItemIndicator className="absolute left-1.5">
                        <CheckIcon className="h-3.5 w-3.5" />
                      </SelectNS.ItemIndicator>
                      <SelectNS.ItemText className="pl-4">{opt.label}</SelectNS.ItemText>
                    </SelectNS.Item>
                  ))
                )}
              </React.Fragment>
            ))}
          </SelectNS.Viewport>
        </SelectNS.Content>
      </SelectNS.Portal>
    </SelectNS.Root>
  )
}

export function MultiSelect({
  values,
  onValuesChange,
  placeholder,
  options,
  optionGroups,
  disabled,
  exclusiveValues = [],
  searchable = false,
  searchPlaceholder = 'Search...',
  maxVisibleLabels = 1,
  dropdownMode = 'overlay',
  triggerAriaLabel,
  testId,
}: {
  values: string[]
  onValuesChange: (values: string[]) => void
  placeholder?: string
  options: { label: string; value: string }[]
  optionGroups?: Array<{ label: string; options: { label: string; value: string }[] }>
  disabled?: boolean
  exclusiveValues?: string[]
  searchable?: boolean
  searchPlaceholder?: string
  maxVisibleLabels?: number
  dropdownMode?: 'overlay' | 'inline'
  triggerAriaLabel?: string
  testId?: string
}) {
  const [open, setOpen] = React.useState(false)
  const [query, setQuery] = React.useState('')
  const containerRef = React.useRef<HTMLDivElement | null>(null)
  const searchInputRef = React.useRef<HTMLInputElement | null>(null)

  React.useEffect(() => {
    if (!open) {
      return
    }

    if (searchable) {
      window.requestAnimationFrame(() => searchInputRef.current?.focus())
    }

    const handlePointerDown = (event: MouseEvent) => {
      if (!containerRef.current?.contains(event.target as Node)) {
        setOpen(false)
      }
    }

    window.addEventListener('mousedown', handlePointerDown)
    return () => window.removeEventListener('mousedown', handlePointerDown)
  }, [open, searchable])

  React.useEffect(() => {
    if (!open && query) {
      setQuery('')
    }
  }, [open, query])

  const allOptions = React.useMemo(
    () => optionGroups?.flatMap((group) => group.options) ?? options,
    [optionGroups, options],
  )

  const selectedLabels = allOptions
    .filter((option) => values.includes(option.value))
    .map((option) => option.label)

  const triggerLabel = React.useMemo(() => {
    if (selectedLabels.length === 0) {
      return placeholder ?? 'Select options...'
    }

    if (selectedLabels.length <= maxVisibleLabels) {
      return selectedLabels.join(', ')
    }

    const visible = selectedLabels.slice(0, maxVisibleLabels).join(', ')
    const remaining = selectedLabels.length - maxVisibleLabels
    return `${visible} +${remaining} more`
  }, [maxVisibleLabels, placeholder, selectedLabels])

  const filteredOptions = React.useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase()
    if (!normalizedQuery) {
      return allOptions
    }

    return allOptions.filter((option) =>
      option.label.toLowerCase().includes(normalizedQuery) || option.value.toLowerCase().includes(normalizedQuery),
    )
  }, [allOptions, query])

  const filteredGroups = React.useMemo(() => {
    if (!optionGroups) {
      return []
    }

    const allowedValues = new Set(filteredOptions.map((option) => option.value))
    return optionGroups
      .map((group) => ({
        label: group.label,
        options: group.options.filter((option) => allowedValues.has(option.value)),
      }))
      .filter((group) => group.options.length > 0)
  }, [filteredOptions, optionGroups])

  const toggleValue = (value: string) => {
    if (values.includes(value)) {
      onValuesChange(values.filter((item) => item !== value))
      return
    }

    if (exclusiveValues.includes(value)) {
      onValuesChange([value])
      return
    }

    onValuesChange([...values.filter((item) => !exclusiveValues.includes(item)), value])
  }

  return (
    <div ref={containerRef} className="relative">
      <button
        type="button"
        disabled={disabled}
        onClick={() => setOpen((current) => !current)}
        aria-label={triggerAriaLabel}
        data-testid={testId ? `${testId}-trigger` : undefined}
        className={cn(
          'flex w-full items-center justify-between rounded-lg border border-[var(--line)]',
          'bg-[var(--surface)] px-3 py-2 text-left text-sm text-[var(--sea-ink)]',
          'focus:outline-none focus:ring-2 focus:ring-[var(--lagoon)]',
          'disabled:opacity-50',
        )}
      >
        <span className={cn(values.length === 0 && 'text-[var(--sea-ink-soft)]/50')}>
          {triggerLabel}
        </span>
        <ChevronDownIcon className={cn('h-4 w-4 opacity-50 transition-transform', open && 'rotate-180')} />
      </button>

      {open && !disabled && (
        <div
          className={cn(
            'w-full rounded-xl border border-[var(--line)] bg-[var(--surface-strong)] p-1 shadow-lg shadow-black/20',
            dropdownMode === 'inline' ? 'relative mt-1' : 'absolute z-50 mt-1',
          )}
        >
          {searchable && (
            <div className="p-1">
              <input
                ref={searchInputRef}
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder={searchPlaceholder}
                className={cn(
                  'w-full rounded-lg border border-[var(--line)] bg-[var(--surface)] px-3 py-2 text-sm text-[var(--sea-ink)]',
                  'placeholder:text-[var(--sea-ink-soft)]/50 focus:outline-none focus:ring-2 focus:ring-[var(--lagoon)]',
                )}
              />
            </div>
          )}
          {filteredOptions.length > 0 && (
            <div className="flex items-center gap-1 border-b border-[var(--line)] px-2 py-1.5">
              <button
                type="button"
                onClick={() => {
                  const newValues = new Set(values)
                  for (const option of filteredOptions) newValues.add(option.value)
                  onValuesChange([...newValues])
                }}
                className="rounded border border-[var(--line)] px-2 py-0.5 text-[10px] font-semibold text-[var(--sea-ink-soft)] hover:bg-[var(--surface-strong)]"
              >
                Select all
              </button>
              <button
                type="button"
                onClick={() => {
                  const filteredSet = new Set(filteredOptions.map((option) => option.value))
                  onValuesChange(values.filter((value) => !filteredSet.has(value)))
                }}
                className="rounded border border-[var(--line)] px-2 py-0.5 text-[10px] font-semibold text-[var(--sea-ink-soft)] hover:bg-[var(--surface-strong)]"
              >
                Clear
              </button>
            </div>
          )}
          <div className="max-h-80 overflow-y-auto">
            {(filteredGroups.length > 0 ? filteredGroups : [{ label: null, options: filteredOptions }]).map((group, groupIndex) => (
              <div key={group.label ?? `ungrouped-${groupIndex}`}>
                {group.label ? (
                  <div className="flex items-center gap-1 px-3 pb-1 pt-2">
                    <span className="flex-1 text-[10px] font-semibold uppercase tracking-wide text-[var(--sea-ink-soft)]/70">
                      {group.label}
                    </span>
                    <button
                      type="button"
                      onClick={() => {
                        const newValues = new Set(values)
                        for (const option of group.options) newValues.add(option.value)
                        onValuesChange([...newValues])
                      }}
                      className="rounded border border-[var(--line)] px-1.5 py-0.5 text-[9px] font-semibold text-[var(--sea-ink-soft)] hover:bg-[var(--surface-strong)]"
                    >
                      All
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        const groupSet = new Set(group.options.map((option) => option.value))
                        onValuesChange(values.filter((value) => !groupSet.has(value)))
                      }}
                      className="rounded border border-[var(--line)] px-1.5 py-0.5 text-[9px] font-semibold text-[var(--sea-ink-soft)] hover:bg-[var(--surface-strong)]"
                    >
                      Clear
                    </button>
                  </div>
                ) : null}
                {group.options.map((option) => {
                  const checked = values.includes(option.value)

                  return (
                    <button
                      key={option.value}
                      type="button"
                      onClick={() => toggleValue(option.value)}
                      data-testid={testId ? `${testId}-option-${option.value}` : undefined}
                      className={cn(
                        'flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-sm text-[var(--sea-ink)]',
                        'hover:bg-[var(--lagoon)]/10 hover:text-[var(--lagoon-deep)]',
                        checked && 'bg-[var(--lagoon)]/10 font-semibold text-[var(--lagoon-deep)]',
                      )}
                    >
                      <span
                        className={cn(
                          'flex h-4 w-4 items-center justify-center rounded border border-[var(--line)] bg-[var(--surface-strong)]',
                          checked && 'border-[var(--lagoon-deep)] bg-[var(--lagoon-deep)] text-white',
                        )}
                      >
                        {checked ? <CheckIcon className="h-3.5 w-3.5" /> : null}
                      </span>
                      <span>{option.label}</span>
                    </button>
                  )
                })}
              </div>
            ))}
            {filteredOptions.length === 0 && (
              <div className="px-3 py-2 text-sm text-[var(--sea-ink-soft)]/70">No results found.</div>
            )}
          </div>
        </div>
      )}

      {selectedLabels.length > 0 && (
        <div className="mt-2 flex flex-wrap gap-1">
          {selectedLabels.map((label) => (
            <span
              key={label}
              className="rounded-full bg-[var(--lagoon)]/10 px-2 py-0.5 text-[10px] font-medium text-[var(--lagoon-deep)]"
            >
              {label}
            </span>
          ))}
        </div>
      )}
    </div>
  )
}

// ─── Tabs ─────────────────────────────────────────────────────────────────

export const Tabs = TabsNS.Root

export function TabsList({
  className,
  scrollable = false,
  ...props
}: React.ComponentPropsWithoutRef<typeof TabsNS.List> & { scrollable?: boolean }) {
  const list = (
    <TabsNS.List
      {...props}
      className={cn(
        'inline-flex items-center gap-1 rounded-xl bg-[var(--sand)] p-1',
        scrollable && 'w-full',
        className,
      )}
    />
  )
  if (scrollable) {
    return (
      <div className="overflow-x-auto scrollbar-none -mx-1 px-1">
        {list}
      </div>
    )
  }
  return list
}

export function TabsTrigger({
  className,
  ...props
}: React.ComponentPropsWithoutRef<typeof TabsNS.Trigger>) {
  return (
    <TabsNS.Trigger
      {...props}
      className={cn(
        'rounded-lg px-4 py-1.5 text-sm font-medium text-[var(--sea-ink-soft)] transition-[color,background-color,box-shadow]',
        'data-[state=active]:bg-[var(--surface-strong)] data-[state=active]:text-[var(--sea-ink)] data-[state=active]:shadow-sm',
        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--lagoon)]',
        className,
      )}
    />
  )
}

export const TabsContent = TabsNS.Content

// ─── Dialog ───────────────────────────────────────────────────────────────

export const Dialog = DialogNS.Root
export const DialogTrigger = DialogNS.Trigger

export function DialogContent({
  className,
  children,
  title,
  ...props
}: React.ComponentPropsWithoutRef<typeof DialogNS.Content> & { title?: string }) {
  return (
    <DialogNS.Portal>
      <DialogNS.Overlay className="fixed inset-0 z-50 bg-black/30 backdrop-blur-sm data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0" />
      <DialogNS.Content
        {...props}
        className={cn(
          'fixed left-1/2 top-1/2 z-50 w-full max-w-lg -translate-x-1/2 -translate-y-1/2',
          'rounded-2xl border border-[var(--line)] bg-[var(--surface-strong)] p-6 shadow-xl overflow-hidden',
          'data-[state=open]:animate-in data-[state=closed]:animate-out',
          'data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0',
          'data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95',
          className,
        )}
      >
        {title && (
          <DialogNS.Title className="mb-4 text-lg font-bold text-[var(--sea-ink)]">
            {title}
          </DialogNS.Title>
        )}
        {children}
        <DialogNS.Close
          className="absolute right-4 top-4 rounded-lg p-1 opacity-50 hover:opacity-100 focus:outline-none focus:ring-2 focus:ring-[var(--lagoon)]"
          aria-label="Close"
        >
          <Cross2Icon className="h-4 w-4" />
        </DialogNS.Close>
      </DialogNS.Content>
    </DialogNS.Portal>
  )
}

// ─── Tooltip ──────────────────────────────────────────────────────────────

export function Tooltip({ content, children }: { content: string; children: React.ReactNode }) {
  return (
    <TooltipNS.Provider delayDuration={300}>
      <TooltipNS.Root>
        <TooltipNS.Trigger asChild>{children}</TooltipNS.Trigger>
        <TooltipNS.Portal>
          <TooltipNS.Content
            className="z-50 rounded-lg bg-[var(--sea-ink)] px-2.5 py-1 text-xs text-white shadow-md"
            sideOffset={4}
          >
            {content}
            <TooltipNS.Arrow className="fill-[var(--sea-ink)]" />
          </TooltipNS.Content>
        </TooltipNS.Portal>
      </TooltipNS.Root>
    </TooltipNS.Provider>
  )
}

// ─── Spinner ──────────────────────────────────────────────────────────────

export function Spinner({ className }: { className?: string }) {
  return (
    <svg
      className={cn('animate-spin', className ?? 'h-4 w-4')}
      xmlns="http://www.w3.org/2000/svg"
      fill="none"
      viewBox="0 0 24 24"
      aria-hidden="true"
    >
      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z" />
    </svg>
  )
}

// ─── PageHeader ───────────────────────────────────────────────────────────

export function PageHeader({
  kicker,
  title,
  description,
  className,
}: {
  kicker?: string
  title: string
  description?: string
  className?: string
}) {
  return (
    <header className={cn('page-header', className)}>
      {kicker && <p className="island-kicker mb-2">{kicker}</p>}
      <h1 className="display-title text-3xl font-bold text-[var(--sea-ink)]">{title}</h1>
      {description && (
        <p className="mt-2 max-w-3xl text-[var(--sea-ink-soft)] leading-relaxed">{description}</p>
      )}
    </header>
  )
}

// ─── EmptyState ───────────────────────────────────────────────────────────

export function EmptyState({
  icon,
  title,
  description,
  actionLabel,
  onAction,
}: {
  icon?: React.ReactNode
  title: string
  description?: string
  actionLabel?: string
  onAction?: () => void
}) {
  return (
    <div className="flex flex-col items-center justify-center gap-3 rounded-2xl border border-dashed border-[var(--line)] px-6 py-14 text-center">
      {icon && (
        <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-[color-mix(in_oklab,var(--lagoon)_12%,transparent)] text-[var(--lagoon-deep)]">
          {icon}
        </div>
      )}
      <p className="text-base font-semibold text-[var(--sea-ink)]">{title}</p>
      {description && <p className="max-w-xs text-sm text-[var(--sea-ink-soft)]">{description}</p>}
      {actionLabel && onAction && (
        <Button variant="secondary" size="sm" onClick={onAction} className="mt-2">
          {actionLabel}
        </Button>
      )}
    </div>
  )
}
