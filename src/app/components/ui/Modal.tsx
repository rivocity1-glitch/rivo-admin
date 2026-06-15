import React, { useEffect } from "react";
import { X } from "lucide-react";
import { cn } from "../../../lib/utils";

interface ModalProps {
  open: boolean;
  onClose: () => void;
  title?: string;
  description?: string;
  children: React.ReactNode;
  footer?: React.ReactNode;
  size?: "sm" | "md" | "lg" | "xl";
}

const sizeStyles = {
  sm: "max-w-sm",
  md: "max-w-lg",
  lg: "max-w-2xl",
  xl: "max-w-4xl",
};

export function Modal({ open, onClose, title, description, children, footer, size = "md" }: ModalProps) {
  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    if (open) document.addEventListener("keydown", handleKey);
    return () => document.removeEventListener("keydown", handleKey);
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div
        className="absolute inset-0 bg-black/40 backdrop-blur-sm"
        onClick={onClose}
      />
      <div
        className={cn(
          "relative w-full bg-white rounded-xl border border-[#E2E8F0] shadow-xl",
          "flex flex-col max-h-[90vh]",
          sizeStyles[size]
        )}
      >
        {(title || description) && (
          <div className="flex items-start justify-between p-6 border-b border-[#E2E8F0]">
            <div>
              {title && <h2 className="text-base font-semibold text-[#0F172A]">{title}</h2>}
              {description && (
                <p className="mt-1 text-sm text-[#64748B]">{description}</p>
              )}
            </div>
            <button
              onClick={onClose}
              className="ml-4 p-1 rounded-md text-[#64748B] hover:text-[#0F172A] hover:bg-[#F8FAFC] transition-colors"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        )}
        <div className="flex-1 overflow-y-auto p-6">{children}</div>
        {footer && (
          <div className="p-6 border-t border-[#E2E8F0] flex items-center justify-end gap-3">
            {footer}
          </div>
        )}
      </div>
    </div>
  );
}

interface SlideOverProps {
  open: boolean;
  onClose: () => void;
  title?: string;
  children: React.ReactNode;
  width?: string;
}

export function SlideOver({ open, onClose, title, children, width = "max-w-2xl" }: SlideOverProps) {
  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    if (open) document.addEventListener("keydown", handleKey);
    return () => document.removeEventListener("keydown", handleKey);
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex justify-end">
      <div className="absolute inset-0 bg-black/30 backdrop-blur-sm" onClick={onClose} />
      <div
        className={cn(
          "relative w-full bg-white border-l border-[#E2E8F0] shadow-2xl flex flex-col h-full overflow-hidden",
          width
        )}
      >
        <div className="flex items-center justify-between px-6 py-4 border-b border-[#E2E8F0]">
          {title && <h2 className="text-base font-semibold text-[#0F172A]">{title}</h2>}
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-[#64748B] hover:text-[#0F172A] hover:bg-[#F8FAFC] transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
        <div className="flex-1 overflow-y-auto">{children}</div>
      </div>
    </div>
  );
}
