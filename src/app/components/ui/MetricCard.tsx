import React from "react";
import { TrendingUp, TrendingDown, Minus } from "lucide-react";
import { cn } from "../../../lib/utils";

interface MetricCardProps {
  title: string;
  value: string;
  change?: number;
  changeLabel?: string;
  icon: React.ReactNode;
  iconBg?: string;
  description?: string;
  empty?: boolean;
}

export function MetricCard({
  title,
  value,
  change,
  changeLabel,
  icon,
  iconBg = "bg-green-50",
  description,
  empty = false,
}: MetricCardProps) {
  const isPositive = change !== undefined && change > 0;
  const isNegative = change !== undefined && change < 0;
  const isNeutral = change === undefined || change === 0;

  return (
    <div className="bg-white border border-[#E2E8F0] rounded-xl p-5 flex flex-col gap-4 hover:border-[#CBD5E1] transition-colors">
      <div className="flex items-start justify-between">
        <div className="flex flex-col gap-1">
          <span className="text-xs font-medium text-[#64748B] uppercase tracking-wide">{title}</span>
          {empty ? (
            <span className="text-2xl font-semibold text-[#CBD5E1]">—</span>
          ) : (
            <span className="text-2xl font-semibold text-[#0F172A]">{value}</span>
          )}
        </div>
        <div className={cn("p-2.5 rounded-lg", iconBg)}>
          {icon}
        </div>
      </div>
      <div className="flex items-center gap-1.5">
        {!empty && change !== undefined ? (
          <>
            <span
              className={cn(
                "inline-flex items-center gap-0.5 text-xs font-medium",
                isPositive && "text-green-600",
                isNegative && "text-red-500",
                isNeutral && "text-[#64748B]"
              )}
            >
              {isPositive && <TrendingUp className="w-3 h-3" />}
              {isNegative && <TrendingDown className="w-3 h-3" />}
              {isNeutral && <Minus className="w-3 h-3" />}
              {change !== undefined && change !== 0 && `${Math.abs(change)}%`}
            </span>
            {changeLabel && (
              <span className="text-xs text-[#64748B]">{changeLabel}</span>
            )}
          </>
        ) : (
          <span className="text-xs text-[#94A3B8]">{description || "No data yet"}</span>
        )}
      </div>
    </div>
  );
}
