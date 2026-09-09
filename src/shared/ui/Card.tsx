import { HTMLAttributes } from 'react';
import { clsx } from 'clsx';

interface CardProps extends HTMLAttributes<HTMLDivElement> {
  variant?: 'default' | 'highlight';
}

export function Card({ variant = 'default', className, children, ...props }: CardProps) {
  return (
    <div
      className={clsx(
        'maple-panel rounded-[12px] p-4',
        {
          'border border-line bg-card': variant === 'default',
          'maple-panel-highlight border border-brand/20 bg-brand-soft': variant === 'highlight',
        },
        className,
      )}
      {...props}
    >
      {children}
    </div>
  );
}
