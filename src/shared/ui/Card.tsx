import { HTMLAttributes } from 'react';
import { clsx } from 'clsx';

interface CardProps extends HTMLAttributes<HTMLDivElement> {
  variant?: 'default' | 'highlight';
}

export function Card({ variant = 'default', className, children, ...props }: CardProps) {
  return (
    <div
      className={clsx(
        'maple-panel rounded-2xl p-4 backdrop-blur-sm',
        {
          'bg-card/95 border border-line shadow-[var(--shadow-sm)]': variant === 'default',
          'maple-panel-highlight bg-[linear-gradient(130deg,rgba(217,119,6,0.16),rgba(217,119,6,0.05)_55%,transparent)] border border-amber-600/30 shadow-[0_10px_24px_rgba(217,119,6,0.18)]': variant === 'highlight',
        },
        className,
      )}
      {...props}
    >
      {children}
    </div>
  );
}
