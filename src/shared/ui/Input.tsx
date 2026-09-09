'use client';

import { InputHTMLAttributes, forwardRef } from 'react';
import { clsx } from 'clsx';

interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
  suffix?: string;
}

export const Input = forwardRef<HTMLInputElement, InputProps>(
  ({ label, error, suffix, className, ...props }, ref) => {
    return (
      <div className="flex flex-col gap-2">
        {label && (
          <label className="text-sm font-semibold tracking-[-0.01em] text-t2">{label}</label>
        )}
        <div className="relative flex items-center">
          <input
            ref={ref}
            className={clsx(
              'w-full rounded-[9px] bg-field border border-line-str px-4 py-3 text-t1 text-base shadow-none',
              'placeholder:text-t3/80 focus:outline-none focus:border-brand/70 focus:ring-2 focus:ring-brand/15 transition-colors',
              { 'border-negative': error },
              { 'pr-14': suffix },
              className,
            )}
            {...props}
          />
          {suffix && (
            <span className="absolute right-4 text-sm font-medium text-t3 pointer-events-none">
              {suffix}
            </span>
          )}
        </div>
        {error && <p className="text-xs text-negative">{error}</p>}
      </div>
    );
  },
);

Input.displayName = 'Input';
