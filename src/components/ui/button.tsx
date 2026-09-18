/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';
import { cn } from '../../lib/utils.ts';

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'default' | 'destructive' | 'outline' | 'secondary' | 'ghost' | 'link' | 'emerald';
  size?: 'default' | 'sm' | 'lg' | 'icon';
}

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant = 'default', size = 'default', ...props }, ref) => {
    const variantStyles = {
      default: 'bg-zinc-100 text-zinc-900 hover:bg-zinc-200 font-semibold shadow-xs',
      emerald: 'bg-emerald-600 text-white hover:bg-emerald-500 font-semibold shadow-xs shadow-emerald-950',
      destructive: 'bg-rose-600 text-white hover:bg-rose-500 font-semibold',
      outline: 'border border-zinc-700 bg-transparent text-zinc-200 hover:bg-zinc-800/80 hover:text-zinc-100',
      secondary: 'bg-zinc-800 text-zinc-200 hover:bg-zinc-700/90',
      ghost: 'text-zinc-400 hover:bg-zinc-800/70 hover:text-zinc-100',
      link: 'text-emerald-400 underline-offset-4 hover:underline',
    };

    const sizeStyles = {
      default: 'h-9 px-3.5 py-2 text-xs',
      sm: 'h-7 rounded-md px-2.5 text-[11px]',
      lg: 'h-10 rounded-md px-5 text-sm',
      icon: 'h-8 w-8 p-0',
    };

    return (
      <button
        ref={ref}
        className={cn(
          'inline-flex items-center justify-center whitespace-nowrap rounded-lg font-medium ring-offset-zinc-950 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500 focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 cursor-pointer select-none',
          variantStyles[variant],
          sizeStyles[size],
          className
        )}
        {...props}
      />
    );
  }
);
Button.displayName = 'Button';
