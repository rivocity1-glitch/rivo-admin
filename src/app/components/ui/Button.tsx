import React from "react";
import { cn } from "../../../lib/utils";
import { Loader2 } from "lucide-react";

type ButtonVariant = "primary" | "secondary" | "ghost" | "destructive" | "outline";
type ButtonSize = "sm" | "md" | "lg" | "icon";

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
  loading?: boolean;
  leftIcon?: React.ReactNode;
  rightIcon?: React.ReactNode;
}

const variantStyles: Record<ButtonVariant, string> = {
  primary:
    "bg-[#22C55E] text-white hover:bg-[#16A34A] active:bg-[#15803D] border border-[#22C55E] hover:border-[#16A34A]",
  secondary:
    "bg-white text-[#0F172A] hover:bg-[#F8FAFC] active:bg-[#F1F5F9] border border-[#E2E8F0]",
  outline:
    "bg-transparent text-[#0F172A] hover:bg-[#F8FAFC] active:bg-[#F1F5F9] border border-[#E2E8F0]",
  ghost:
    "bg-transparent text-[#64748B] hover:bg-[#F8FAFC] hover:text-[#0F172A] active:bg-[#F1F5F9] border border-transparent",
  destructive:
    "bg-red-500 text-white hover:bg-red-600 active:bg-red-700 border border-red-500 hover:border-red-600",
};

const sizeStyles: Record<ButtonSize, string> = {
  sm: "h-8 px-3 text-xs gap-1.5 rounded-md",
  md: "h-9 px-4 text-sm gap-2 rounded-lg",
  lg: "h-10 px-5 text-sm gap-2 rounded-lg",
  icon: "h-9 w-9 p-0 rounded-lg",
};

export function Button({
  variant = "secondary",
  size = "md",
  loading = false,
  leftIcon,
  rightIcon,
  disabled,
  children,
  className,
  ...props
}: ButtonProps) {
  return (
    <button
      disabled={disabled || loading}
      className={cn(
        "inline-flex items-center justify-center font-medium transition-all duration-150 cursor-pointer select-none",
        "focus:outline-none focus-visible:ring-2 focus-visible:ring-[#22C55E] focus-visible:ring-offset-1",
        "disabled:opacity-50 disabled:cursor-not-allowed",
        variantStyles[variant],
        sizeStyles[size],
        className
      )}
      {...props}
    >
      {loading ? (
        <Loader2 className="w-4 h-4 animate-spin" />
      ) : (
        <>
          {leftIcon && <span className="flex-shrink-0">{leftIcon}</span>}
          {children}
          {rightIcon && <span className="flex-shrink-0">{rightIcon}</span>}
        </>
      )}
    </button>
  );
}
