/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';
import { cn } from '../../lib/utils.ts';

export interface BadgeProps extends React.HTMLAttributes<HTMLDivElement> {
  variant?: 'default' | 'secondary' | 'destructive' | 'outline' | 'success' | 'warning' | 'info';
}

export const Badge: React.FC<BadgeProps> = ({
  className,
  variant = 'default',
  ...props
}) => {
  const variantStyles = {
    default: 'border-transparent bg-zinc-800 text-zinc-100',
    secondary: 'border-transparent bg-zinc-800/80 text-zinc-300',
    destructive: 'border-rose-500/20 bg-rose-500/10 text-rose-400',
    outline: 'border-zinc-700 bg-transparent text-zinc-300',
    success: 'border-emerald-500/20 bg-emerald-500/10 text-emerald-400',
    warning: 'border-amber-500/20 bg-amber-500/10 text-amber-400',
    info: 'border-sky-500/20 bg-sky-500/10 text-sky-400',
  };

  return (
    <div
      className={cn(
        'inline-flex items-center rounded-md border px-2 py-0.5 text-xs font-semibold font-mono transition-colors',
        variantStyles[variant],
        className
      )}
      {...props}
    />
  );
};
