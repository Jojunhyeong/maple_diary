import { HTMLAttributes } from 'react';
import { clsx } from 'clsx';

interface CardProps extends HTMLAttributes<HTMLDivElement> {
  variant?: 'default' | 'highlight';
}

export function Card({ variant = 'default', className, children, ...props }: CardProps) {
  return (
    <div
      className={clsx(
        'rounded-2xl p-4',
        {
          'bg-card border border-line': variant === 'default',
          'bg-amber-500/10 border border-amber-500/40': variant === 'highlight',
        },
        className,
      )}
      {...props}
    >
      {children}
    </div>
  );
}
