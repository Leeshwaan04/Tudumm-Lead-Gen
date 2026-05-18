import * as React from "react";
import { cn } from "@/lib/utils";

export interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  startIcon?: React.ReactNode;
  endIcon?: React.ReactNode;
}

const Input = React.forwardRef<HTMLInputElement, InputProps>(
  ({ className, type, startIcon, endIcon, ...props }, ref) => {
    if (startIcon ?? endIcon) {
      return (
        <div className="relative flex items-center">
          {startIcon && (
            <div className="absolute left-3 flex items-center text-slate-400 pointer-events-none">
              {startIcon}
            </div>
          )}
          <input
            type={type}
            className={cn(
              "flex h-9 w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm text-white shadow-sm transition-colors file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-slate-500 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-500 focus-visible:border-violet-500 disabled:cursor-not-allowed disabled:opacity-50",
              startIcon && "pl-10",
              endIcon && "pr-10",
              className
            )}
            ref={ref}
            {...props}
          />
          {endIcon && (
            <div className="absolute right-3 flex items-center text-slate-400">
              {endIcon}
            </div>
          )}
        </div>
      );
    }

    return (
      <input
        type={type}
        className={cn(
          "flex h-9 w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm text-white shadow-sm transition-colors file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-slate-500 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-500 focus-visible:border-violet-500 disabled:cursor-not-allowed disabled:opacity-50",
          className
        )}
        ref={ref}
        {...props}
      />
    );
  }
);
Input.displayName = "Input";

export { Input };
