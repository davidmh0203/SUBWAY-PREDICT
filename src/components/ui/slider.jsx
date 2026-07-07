import * as React from "react";
import * as SliderPrimitive from "@radix-ui/react-slider";
import { cn } from "@/lib/utils";
const Slider = React.forwardRef(({ className, ...props }, ref) => /* @__PURE__ */ React.createElement(
  SliderPrimitive.Root,
  {
    ref,
    className: cn("relative flex w-full touch-none select-none items-center", className),
    ...props
  },
  /* @__PURE__ */ React.createElement(SliderPrimitive.Track, { className: "relative h-1.5 w-full grow overflow-hidden rounded-full bg-slate-200 shadow-[inset_0_1px_2px_rgba(15,23,42,0.06)]" }, /* @__PURE__ */ React.createElement(SliderPrimitive.Range, { className: "absolute h-full bg-gradient-to-r from-emerald-400 via-amber-400 to-rose-400" })),
  /* @__PURE__ */ React.createElement(SliderPrimitive.Thumb, { className: "block h-5 w-5 rounded-full bg-white shadow-[0_1px_4px_rgba(15,23,42,0.18),0_4px_12px_rgba(15,23,42,0.1)] ring-0 transition-transform focus-visible:outline-none hover:scale-110" })
));
Slider.displayName = SliderPrimitive.Root.displayName;
export {
  Slider
};
