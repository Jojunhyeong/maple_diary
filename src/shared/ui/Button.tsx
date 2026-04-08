'use client';

import { ButtonHTMLAttributes } from 'react';
import { clsx } from 'clsx';

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'ghost' | 'danger';
  size?: 'sm' | 'md' | 'lg';
  fullWidth?: boolean;
}

export function Button({
  variant = 'primary',
  size = 'md',
  fullWidth = false,
  className,
  children,
  disabled,
  ...props
}: ButtonProps) {
  return (
    <button
      className={clsx(
        'inline-flex items-center justify-center rounded-xl font-semibold tracking-[-0.01em] transition-all duration-200 cursor-pointer',
        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-400/60 focus-visible:ring-offset-2 focus-visible:ring-offset-app',
        {
          'maple-btn-primary bg-[linear-gradient(135deg,#f59e0b,#dc6a0b)] text-white shadow-[0_12px_24px_rgba(217,119,6,0.32)] hover:-translate-y-0.5 hover:brightness-105 active:translate-y-0': variant === 'primary',
          'bg-surface/90 text-t1 border border-line hover:bg-surface hover:-translate-y-0.5 active:translate-y-0': variant === 'secondary',
          'bg-transparent text-t2 hover:bg-surface/70 hover:text-t1': variant === 'ghost',
          'bg-red-500 text-white shadow-[0_10px_20px_rgba(239,68,68,0.25)] hover:-translate-y-0.5 hover:bg-red-600 active:translate-y-0': variant === 'danger',
        },
        {
          'h-9 px-4 text-sm': size === 'sm',
          'h-12 px-6 text-[15px]': size === 'md',
          'h-14 px-8 text-[17px]': size === 'lg',
        },
        { 'w-full': fullWidth },
        { 'opacity-45 cursor-not-allowed hover:translate-y-0': disabled },
        className,
      )}
      disabled={disabled}
      {...props}
    >
      {children}
    </button>
  );
}
