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
        'inline-flex items-center justify-center rounded-[9px] font-semibold tracking-[-0.01em] transition-colors duration-150 cursor-pointer',
        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand/30 focus-visible:ring-offset-2 focus-visible:ring-offset-app',
        {
          'maple-btn-primary bg-brand text-white hover:bg-brand-hover': variant === 'primary',
          'border border-line bg-card text-t1 hover:border-brand/25 hover:bg-brand-soft': variant === 'secondary',
          'bg-transparent text-t2 hover:bg-surface hover:text-t1': variant === 'ghost',
          'bg-negative text-white hover:brightness-95': variant === 'danger',
        },
        {
          'h-9 px-4 text-sm': size === 'sm',
          'h-12 px-6 text-[15px]': size === 'md',
          'h-14 px-8 text-[17px]': size === 'lg',
        },
        { 'w-full': fullWidth },
        { 'opacity-45 cursor-not-allowed': disabled },
        className,
      )}
      disabled={disabled}
      {...props}
    >
      {children}
    </button>
  );
}
