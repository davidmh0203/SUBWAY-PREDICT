import * as React from "react";
import * as TabsPrimitive from "@radix-ui/react-tabs";
import { cn } from "@/lib/utils";
const Tabs = TabsPrimitive.Root;
const TabsList = React.forwardRef(({ className, ...props }, ref) => /* @__PURE__ */ React.createElement(
  TabsPrimitive.List,
  {
    ref,
    className: cn(
      "inline-flex h-11 items-center justify-center rounded-xl bg-slate-100 p-1 text-slate-500 shadow-[inset_0_1px_3px_rgba(15,23,42,0.05)]",
      className
    ),
    ...props
  }
));
TabsList.displayName = TabsPrimitive.List.displayName;
const TabsTrigger = React.forwardRef(({ className, ...props }, ref) => /* @__PURE__ */ React.createElement(
  TabsPrimitive.Trigger,
  {
    ref,
    className: cn(
      "inline-flex items-center justify-center whitespace-nowrap rounded-lg px-4 py-2 text-sm font-medium transition-all focus-visible:outline-none disabled:pointer-events-none disabled:opacity-50 data-[state=active]:bg-white data-[state=active]:text-slate-800 data-[state=active]:shadow-[0_1px_3px_rgba(15,23,42,0.08)]",
      className
    ),
    ...props
  }
));
TabsTrigger.displayName = TabsPrimitive.Trigger.displayName;
const TabsContent = React.forwardRef(({ className, ...props }, ref) => /* @__PURE__ */ React.createElement(
  TabsPrimitive.Content,
  {
    ref,
    className: cn("mt-2 focus-visible:outline-none", className),
    ...props
  }
));
TabsContent.displayName = TabsPrimitive.Content.displayName;
export {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger
};
