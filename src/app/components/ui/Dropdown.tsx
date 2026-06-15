import React, { useState, useRef, useEffect } from "react";
import { cn } from "../../../lib/utils";

interface DropdownItem {
  label: string;
  icon?: React.ReactNode;
  onClick: () => void;
  variant?: "default" | "danger";
  disabled?: boolean;
  divider?: boolean;
}

interface DropdownProps {
  trigger: React.ReactNode;
  items: DropdownItem[];
  align?: "left" | "right";
}

export function Dropdown({ trigger, items, align = "right" }: DropdownProps) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  return (
    <div ref={ref} className="relative inline-block">
      <div onClick={() => setOpen((v) => !v)}>{trigger}</div>
      {open && (
        <div
          className={cn(
            "absolute z-20 mt-1 min-w-[160px] bg-white border border-[#E2E8F0] rounded-xl shadow-lg py-1",
            align === "right" ? "right-0" : "left-0"
          )}
        >
          {items.map((item, idx) => (
            <React.Fragment key={idx}>
              {item.divider && idx > 0 && (
                <div className="my-1 border-t border-[#E2E8F0]" />
              )}
              <button
                onClick={() => {
                  if (!item.disabled) {
                    item.onClick();
                    setOpen(false);
                  }
                }}
                disabled={item.disabled}
                className={cn(
                  "w-full flex items-center gap-2.5 px-3 py-2 text-sm text-left transition-colors",
                  "disabled:opacity-40 disabled:cursor-not-allowed",
                  item.variant === "danger"
                    ? "text-red-500 hover:bg-red-50"
                    : "text-[#0F172A] hover:bg-[#F8FAFC]"
                )}
              >
                {item.icon && (
                  <span className="w-4 h-4 flex items-center justify-center flex-shrink-0">
                    {item.icon}
                  </span>
                )}
                {item.label}
              </button>
            </React.Fragment>
          ))}
        </div>
      )}
    </div>
  );
}
