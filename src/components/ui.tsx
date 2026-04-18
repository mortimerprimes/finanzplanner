import React, { useEffect } from 'react';
import { createPortal } from 'react-dom';
import * as LucideIcons from 'lucide-react';

/* ====== DYNAMIC ICON ====== */
interface IconProps {
  name: string;
  size?: number;
  className?: string;
  color?: string;
}

type IconComponentType = React.ComponentType<{
  size?: number;
  className?: string;
  color?: string;
}>;

export function Icon({ name, size = 24, className = '', color }: IconProps) {
  const iconMap = LucideIcons as unknown as Record<string, IconComponentType>;
  const IconComponent = iconMap[name];
  if (!IconComponent) {
    return <LucideIcons.HelpCircle size={size} className={className} />;
  }
  return <IconComponent size={size} className={className} color={color} />;
}

/* ====== CARD ====== */
interface CardProps {
  children: React.ReactNode;
  className?: string;
  onClick?: () => void;
}

export function Card({ children, className = '', onClick }: CardProps) {
  return (
    <div
      onClick={onClick}
      className={`
        bg-white dark:bg-gray-900 rounded-2xl
        border border-slate-200 dark:border-gray-800
        ${onClick ? 'cursor-pointer hover:shadow-md hover:border-slate-300 dark:hover:border-gray-700 transition-all' : ''}
        ${className}
      `}
    >
      {children}
    </div>
  );
}

/* ====== STAT CARD ====== */
interface StatCardProps {
  title: string;
  value: string;
  subtitle?: string;
  icon: string;
  iconColor?: string;
  iconBg?: string;
}

export function StatCard({ title, value, subtitle, icon, iconColor = '#3b82f6', iconBg = 'bg-blue-50 dark:bg-blue-950/40' }: StatCardProps) {
  return (
    <Card className="p-5">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <p className="text-sm text-slate-500 dark:text-gray-500 font-medium truncate">{title}</p>
          <p className="text-2xl font-bold text-gray-900 dark:text-white mt-1 truncate">{value}</p>
          {subtitle && (
            <p className="text-xs text-slate-500 dark:text-gray-500 mt-1 truncate">{subtitle}</p>
          )}
        </div>
        <div className={`p-3 rounded-xl flex-shrink-0 ${iconBg}`}>
          <Icon name={icon} size={22} color={iconColor} />
        </div>
      </div>
    </Card>
  );
}

/* ====== PROGRESS BAR ====== */
interface ProgressBarProps {
  value: number;
  max?: number;
  color?: string;
  showLabel?: boolean;
  size?: 'sm' | 'md' | 'lg';
}

export function ProgressBar({ value, max = 100, color = '#3b82f6', showLabel = false, size = 'md' }: ProgressBarProps) {
  const pct = Math.min((value / max) * 100, 100);
  const h = { sm: 'h-1.5', md: 'h-2.5', lg: 'h-3.5' };

  return (
    <div className="w-full">
      <div className={`w-full bg-slate-100 dark:bg-gray-800 rounded-full ${h[size]} overflow-hidden`}>
        <div
          className="h-full rounded-full transition-all duration-500 ease-out"
          style={{ width: `${pct}%`, backgroundColor: color }}
        />
      </div>
      {showLabel && (
        <p className="text-xs text-slate-500 dark:text-gray-500 mt-1 text-right">{pct.toFixed(0)}%</p>
      )}
    </div>
  );
}

/* ====== BUTTON ====== */
interface ButtonProps {
  children: React.ReactNode;
  onClick?: () => void;
  variant?: 'primary' | 'secondary' | 'danger' | 'ghost';
  size?: 'sm' | 'md' | 'lg';
  icon?: string;
  disabled?: boolean;
  className?: string;
  type?: 'button' | 'submit';
}

export function Button({
  children, onClick, variant = 'primary', size = 'md', icon,
  disabled = false, className = '', type = 'button'
}: ButtonProps) {
  const variants = {
    primary: 'bg-blue-600 hover:bg-blue-700 text-white shadow-sm',
    secondary: 'bg-slate-100 dark:bg-gray-800 hover:bg-slate-200 dark:hover:bg-gray-600 text-gray-900 dark:text-white',
    danger: 'bg-red-600 hover:bg-red-700 text-white shadow-sm',
    ghost: 'hover:bg-slate-100 dark:hover:bg-gray-800 text-slate-600 dark:text-gray-400',
  };
  const sizes = {
    sm: 'px-3 py-1.5 text-xs',
    md: 'px-4 py-2 text-sm',
    lg: 'px-5 py-2.5 text-base',
  };

  return (
    <button
      type={type}
      onClick={onClick}
      disabled={disabled}
      className={`
        inline-flex items-center justify-center gap-2 font-medium rounded-xl whitespace-nowrap shrink-0
        transition-all duration-150 disabled:opacity-50 disabled:cursor-not-allowed
        ${variants[variant]} ${sizes[size]} ${className}
      `}
    >
      {icon && <Icon name={icon} size={size === 'sm' ? 14 : size === 'lg' ? 20 : 16} />}
      {children}
    </button>
  );
}

/* ====== TOGGLE ====== */
interface ToggleProps {
  checked: boolean;
  onChange: (value: boolean) => void;
  disabled?: boolean;
  ariaLabel?: string;
  className?: string;
}

export function Toggle({ checked, onChange, disabled = false, ariaLabel, className = '' }: ToggleProps) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={ariaLabel}
      disabled={disabled}
      onClick={() => onChange(!checked)}
      className={`
        relative inline-flex h-8 w-14 items-center rounded-full border transition-all duration-200
        focus:outline-none focus:ring-2 focus:ring-blue-500/40 focus:ring-offset-2 dark:focus:ring-offset-gray-900
        disabled:cursor-not-allowed disabled:opacity-50
        ${checked
          ? 'border-blue-600 bg-blue-600 shadow-[0_8px_24px_-12px_rgba(37,99,235,0.9)]'
          : 'border-slate-200 bg-slate-200 dark:border-gray-700 dark:bg-gray-700'}
        ${className}
      `}
    >
      <span
        className={`
          pointer-events-none inline-block h-6 w-6 rounded-full bg-white shadow-sm ring-1 ring-black/5
          transition-transform duration-200 ${checked ? 'translate-x-7' : 'translate-x-1'}
        `}
      />
    </button>
  );
}

/* ====== INPUT ====== */
interface InputProps {
  label?: string;
  type?: string;
  value: string | number;
  onChange: (value: string) => void;
  placeholder?: string;
  icon?: string;
  error?: string;
  disabled?: boolean;
  className?: string;
}

export function Input({
  label, type = 'text', value, onChange, placeholder,
  icon, error, disabled = false, className = ''
}: InputProps) {
  return (
    <div className={`min-w-0 ${className}`}>
      {label && (
        <label className="mb-2 block text-sm font-medium text-gray-700 dark:text-gray-300">
          {label}
        </label>
      )}
      <div className="relative">
        {icon && (
          <div className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 dark:text-gray-500 pointer-events-none">
            <Icon name={icon} size={16} />
          </div>
        )}
        <input
          type={type}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          disabled={disabled}
          className={`
            block min-h-11 w-full rounded-xl border bg-white dark:bg-gray-800
            text-gray-900 dark:text-white placeholder-slate-400 dark:placeholder-gray-600
            focus:outline-none focus:ring-2 focus:ring-blue-500/40 focus:border-blue-500
            disabled:opacity-50 disabled:cursor-not-allowed
            transition-all text-sm leading-6
            ${icon ? 'pl-10 pr-4 py-2.5' : 'px-4 py-2.5'}
            ${error
              ? 'border-red-400 dark:border-red-500'
              : 'border-slate-200 dark:border-gray-700'}
          `}
        />
      </div>
      {error && <p className="text-xs text-red-500 mt-1">{error}</p>}
    </div>
  );
}

/* ====== SELECT ====== */
interface SelectProps {
  label?: string;
  value: string;
  onChange: (value: string) => void;
  options: { value: string; label: string }[];
  placeholder?: string;
  className?: string;
}

export function Select({ label, value, onChange, options, placeholder, className = '' }: SelectProps) {
  return (
    <div className={`min-w-0 ${className}`}>
      {label && (
        <label className="mb-2 block text-sm font-medium text-gray-700 dark:text-gray-300">
          {label}
        </label>
      )}
      <div className="relative">
        <select
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className="
            block min-h-11 w-full rounded-xl border border-slate-200 bg-white px-4 py-2.5 pr-10
            text-gray-900 dark:border-gray-700 dark:bg-gray-800 dark:text-white
            focus:outline-none focus:ring-2 focus:ring-blue-500/40 focus:border-blue-500
            transition-all cursor-pointer text-sm leading-6 appearance-none
          "
        >
          {placeholder && <option value="">{placeholder}</option>}
          {options.map((opt) => (
            <option key={opt.value} value={opt.value}>{opt.label}</option>
          ))}
        </select>
        <LucideIcons.ChevronDown
          size={18}
          className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 dark:text-gray-300"
        />
      </div>
    </div>
  );
}

/* ====== MODAL ====== */
interface ModalProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  children: React.ReactNode;
}

export function Modal({ isOpen, onClose, title, children }: ModalProps) {
  useEffect(() => {
    if (!isOpen) return;

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = previousOverflow;
    };
  }, [isOpen]);

  if (!isOpen) return null;

  return createPortal(
    <div className="fixed inset-0 z-[120] isolate">
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm animate-overlay dark:bg-slate-950/70" onClick={onClose} />
      <div className="relative flex min-h-full items-start justify-center overflow-y-auto p-3 sm:items-center sm:p-6">
        <div className="relative my-6 flex w-full max-w-lg flex-col overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-2xl dark:border-gray-800 dark:bg-gray-900 animate-modal max-h-[calc(100dvh-3rem)]">
          <div className="flex items-center justify-between gap-4 border-b border-slate-200 px-5 py-4 dark:border-gray-800 sm:px-6">
            <h3 className="truncate text-lg font-semibold text-gray-900 dark:text-white">{title}</h3>
            <button
              onClick={onClose}
              className="rounded-lg p-1.5 text-slate-400 transition-colors hover:bg-slate-100 dark:text-gray-500 dark:hover:bg-gray-800"
            >
              <LucideIcons.X size={18} />
            </button>
          </div>
          <div className="overflow-y-auto px-5 py-5 sm:px-6">
            {children}
          </div>
        </div>
      </div>
    </div>,
    document.body
  );
}

/* ====== EMPTY STATE ====== */
interface EmptyStateProps {
  icon: string;
  title: string;
  description: string;
  action?: { label: string; onClick: () => void };
}

export function EmptyState({ icon, title, description, action }: EmptyStateProps) {
  return (
    <div className="flex flex-col items-center justify-center py-16 text-center px-4">
      <div className="p-4 bg-slate-100 dark:bg-gray-800 rounded-2xl mb-4">
        <Icon name={icon} size={28} className="text-slate-400 dark:text-gray-500" />
      </div>
      <h3 className="text-base font-semibold text-gray-900 dark:text-white mb-1">{title}</h3>
      <p className="text-sm text-slate-500 dark:text-gray-500 max-w-xs mb-5">{description}</p>
      {action && (
        <Button onClick={action.onClick} icon="Plus">{action.label}</Button>
      )}
    </div>
  );
}

/* ====== BADGE ====== */
interface BadgeProps {
  children: React.ReactNode;
  color?: string;
  className?: string;
}

export function Badge({ children, color = '#3b82f6', className = '' }: BadgeProps) {
  return (
    <span
      className={`inline-flex items-center px-2 py-0.5 rounded-md text-[11px] font-semibold ${className}`}
      style={{ backgroundColor: `${color}18`, color }}
    >
      {children}
    </span>
  );
}
