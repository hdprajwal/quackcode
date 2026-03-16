import * as React from 'react'
import { cva, type VariantProps } from 'class-variance-authority'
import { cn } from '@renderer/lib/utils'

const sidebarMenuButtonVariants = cva(
  'flex w-full items-center gap-2 overflow-hidden rounded-lg px-2 py-1.5 text-left text-sm transition-colors outline-none focus-visible:ring-2 focus-visible:ring-ring/50 disabled:pointer-events-none disabled:opacity-50',
  {
    variants: {
      variant: {
        default: 'text-sidebar-foreground/80 hover:bg-white/[0.04] hover:text-white',
        ghost: 'text-white/72 hover:bg-white/[0.03] hover:text-white'
      },
      size: {
        default: 'min-h-8',
        sm: 'min-h-7 text-[13px]'
      },
      isActive: {
        true: 'bg-white/[0.06] text-white shadow-[inset_0_0_0_1px_rgba(255,255,255,0.05)]',
        false: ''
      }
    },
    defaultVariants: {
      variant: 'default',
      size: 'default',
      isActive: false
    }
  }
)

const sidebarMenuActionVariants = cva(
  'flex size-7 shrink-0 items-center justify-center rounded-md text-white/35 transition-colors hover:bg-white/6 hover:text-white disabled:pointer-events-none disabled:opacity-50'
)

function Sidebar({ className, ...props }: React.ComponentProps<'aside'>) {
  return (
    <aside
      data-slot="sidebar"
      className={cn(
        'flex h-full flex-col border-r border-white/6 bg-transparent text-white',
        className
      )}
      {...props}
    />
  )
}

function SidebarHeader({ className, ...props }: React.ComponentProps<'div'>) {
  return <div data-slot="sidebar-header" className={cn('flex flex-col', className)} {...props} />
}

function SidebarContent({ className, ...props }: React.ComponentProps<'div'>) {
  return (
    <div
      data-slot="sidebar-content"
      className={cn('flex min-h-0 flex-1 flex-col', className)}
      {...props}
    />
  )
}

function SidebarFooter({ className, ...props }: React.ComponentProps<'div'>) {
  return <div data-slot="sidebar-footer" className={cn('flex flex-col', className)} {...props} />
}

function SidebarGroup({ className, ...props }: React.ComponentProps<'section'>) {
  return (
    <section
      data-slot="sidebar-group"
      className={cn('flex flex-col gap-1', className)}
      {...props}
    />
  )
}

function SidebarGroupLabel({ className, ...props }: React.ComponentProps<'div'>) {
  return (
    <div
      data-slot="sidebar-group-label"
      className={cn(
        'px-2 text-xs font-medium uppercase tracking-[0.18em] text-white/35',
        className
      )}
      {...props}
    />
  )
}

function SidebarGroupContent({ className, ...props }: React.ComponentProps<'div'>) {
  return (
    <div
      data-slot="sidebar-group-content"
      className={cn('flex flex-col gap-1', className)}
      {...props}
    />
  )
}

function SidebarMenu({ className, ...props }: React.ComponentProps<'ul'>) {
  return <ul data-slot="sidebar-menu" className={cn('flex flex-col gap-1', className)} {...props} />
}

function SidebarMenuItem({ className, ...props }: React.ComponentProps<'li'>) {
  return (
    <li
      data-slot="sidebar-menu-item"
      className={cn('group/menu-item relative', className)}
      {...props}
    />
  )
}

type SidebarMenuButtonProps = React.ComponentProps<'button'> &
  VariantProps<typeof sidebarMenuButtonVariants> & {
    tooltip?: string
  }

function SidebarMenuButton({
  className,
  variant,
  size,
  isActive,
  tooltip,
  ...props
}: SidebarMenuButtonProps) {
  return (
    <button
      type="button"
      data-slot="sidebar-menu-button"
      data-active={isActive ? 'true' : 'false'}
      title={tooltip}
      className={cn(sidebarMenuButtonVariants({ variant, size, isActive }), className)}
      {...props}
    />
  )
}

function SidebarMenuAction({ className, ...props }: React.ComponentProps<'button'>) {
  return (
    <button
      type="button"
      data-slot="sidebar-menu-action"
      className={cn(sidebarMenuActionVariants(), className)}
      {...props}
    />
  )
}

function SidebarMenuSub({ className, ...props }: React.ComponentProps<'ul'>) {
  return (
    <ul
      data-slot="sidebar-menu-sub"
      className={cn('ml-3 flex flex-col gap-1 border-l border-white/7 pl-3', className)}
      {...props}
    />
  )
}

function SidebarSeparator({ className, ...props }: React.ComponentProps<'div'>) {
  return (
    <div
      data-slot="sidebar-separator"
      className={cn('mx-2 h-px bg-white/6', className)}
      {...props}
    />
  )
}

export {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuAction,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarMenuSub,
  SidebarSeparator
}
