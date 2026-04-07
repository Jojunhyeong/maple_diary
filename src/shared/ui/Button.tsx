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
        'inline-flex items-center justify-center rounded-xl font-semibold transition-all active:scale-95 cursor-pointer',
        {
          'bg-amber-500 text-white hover:bg-amber-400': variant === 'primary',
          'bg-surface text-t1 hover:brightness-95 border border-line': variant === 'secondary',
          'bg-transparent text-t2 hover:text-t1': variant === 'ghost',
          'bg-red-500 text-white hover:bg-red-600': variant === 'danger',
        },
        {
          'h-9 px-4 text-sm': size === 'sm',
          'h-12 px-6 text-base': size === 'md',
          'h-14 px-8 text-lg': size === 'lg',
        },
        { 'w-full': fullWidth },
        { 'opacity-40 cursor-not-allowed active:scale-100': disabled },
        className,
      )}
      disabled={disabled}
      {...props}
    >
      {children}
    </button>
  );
}
