import * as React from "react";
import { cn } from "@/lib/utils";
const Card = React.forwardRef(
  ({ className, ...props }, ref) => /* @__PURE__ */ React.createElement(
    "div",
    {
      ref,
      className: cn(
        "rounded-2xl bg-white text-slate-800 shadow-[0_1px_2px_rgba(15,23,42,0.04),0_4px_16px_rgba(15,23,42,0.05)]",
        className
      ),
      ...props
    }
  )
);
Card.displayName = "Card";
const CardHeader = React.forwardRef(
  ({ className, ...props }, ref) => /* @__PURE__ */ React.createElement("div", { ref, className: cn("flex flex-col space-y-1.5 p-4", className), ...props })
);
CardHeader.displayName = "CardHeader";
const CardTitle = React.forwardRef(
  ({ className, ...props }, ref) => /* @__PURE__ */ React.createElement("h3", { ref, className: cn("text-base font-semibold leading-none tracking-tight text-slate-800", className), ...props })
);
CardTitle.displayName = "CardTitle";
const CardDescription = React.forwardRef(
  ({ className, ...props }, ref) => /* @__PURE__ */ React.createElement("p", { ref, className: cn("text-sm text-slate-500", className), ...props })
);
CardDescription.displayName = "CardDescription";
const CardContent = React.forwardRef(
  ({ className, ...props }, ref) => /* @__PURE__ */ React.createElement("div", { ref, className: cn("p-4 pt-0", className), ...props })
);
CardContent.displayName = "CardContent";
export {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle
};
