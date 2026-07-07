import * as React from "react";
import { cva } from "class-variance-authority";
import { cn } from "@/lib/utils";
const badgeVariants = cva(
  "inline-flex items-center rounded-md px-2 py-0.5 text-xs font-medium",
  {
    variants: {
      variant: {
        default: "bg-slate-100 text-slate-600",
        smooth: "bg-emerald-50 text-emerald-700",
        warning: "bg-amber-50 text-amber-700",
        danger: "bg-rose-50 text-rose-700",
        primary: "bg-slate-100 text-slate-700"
      }
    },
    defaultVariants: { variant: "default" }
  }
);
function Badge({ className, variant, ...props }) {
  return /* @__PURE__ */ React.createElement("div", { className: cn(badgeVariants({ variant }), className), ...props });
}
export {
  Badge
};
