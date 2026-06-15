import React from "react";
import { ChevronDown } from "lucide-react";
import { cn } from "../../../lib/utils";

interface SelectOption {
  value: string;
  label: string;
}

interface SelectProps {
  label?: string;
  value: string;
  onChange: (value: string) => void;
  options: SelectOption[];
  placeholder?: string;
  className?: string;
  disabled?: boolean;
}

export function Select({
  label,
  value,
  onChange,
  options,
  placeholder = "Select...",
  className,
  disabled,
}: SelectProps) {
  const id = label?.toLowerCase().replace(/\s+/g, "-");
  return (
    <div className="flex flex-col gap-1.5">
      {label && (
        <label htmlFor={id} className="text-sm font-medium text-[#0F172A]">
          {label}
        </label>
      )}
      <div className="relative">
        <select
          id={id}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          disabled={disabled}
          className={cn(
            "w-full h-9 bg-[#F8FAFC] border border-[#E2E8F0] rounded-lg text-sm text-[#0F172A]",
            "pl-3 pr-8 appearance-none cursor-pointer transition-all duration-150",
            "hover:border-[#CBD5E1]",
            "focus:outline-none focus:border-[#22C55E] focus:ring-2 focus:ring-[#22C55E]/10 focus:bg-white",
            "disabled:opacity-50 disabled:cursor-not-allowed",
            !value && "text-[#94A3B8]",
            className
          )}
        >
          {placeholder && (
            <option value="" disabled>
              {placeholder}
            </option>
          )}
          {options.map((opt) => (
            <option key={opt.value} value={opt.value}>
              {opt.label}
            </option>
          ))}
        </select>
        <ChevronDown className="absolute right-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-[#64748B] pointer-events-none" />
      </div>
    </div>
  );
}
