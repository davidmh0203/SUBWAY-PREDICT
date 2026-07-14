import * as React from "react";
import * as SliderPrimitive from "@radix-ui/react-slider";
import { cn } from "@/lib/utils";
const Slider = React.forwardRef(({ className, ...props }, ref) =>
  // 부모는 5개의 데이터를 던져주는데   자식은 Slider는 왜 2개의 데이터를 받을까?
  // props 객체 전체 : {className, ...props}
  //  넘기는 개수 = props의 객체의 키 개서, 함수 인자 개수아님
  // ref: ForwardRef 때문에 생긴 ref     부모가 <Slider ref={...}>로 넘긴값 => 지금은 안넘겨서 indefined/null

  //  부모가 보낸값들이 거대한 props라는 이름의 객체로 담겨져서 자식에게 전달
  // 부모가 보낸것중 classname만 빼둠 -> 안보내면 undefined
  //  ...props : 받는쪽에서는 rest  => {className, ...props} -> 구조분해
  //  {} 로 한번더 감싸는게 좋을까?
  //

  /* @__PURE__ */ React.createElement(
    SliderPrimitive.Root,
    {
      ref,
      className: cn(
        "relative flex w-full touch-none select-none items-center",
        className,
      ),
      ...props,
    },
    /* @__PURE__ */ React.createElement(
      SliderPrimitive.Track,
      {
        className:
          "relative h-1.5 w-full grow overflow-hidden rounded-full bg-slate-200 shadow-[inset_0_1px_2px_rgba(15,23,42,0.06)]",
      },
      /* @__PURE__ */ React.createElement(SliderPrimitive.Range, {
        className:
          "absolute h-full bg-gradient-to-r from-emerald-400 via-amber-400 to-rose-400",
      }),
    ),
    /* @__PURE__ */ React.createElement(SliderPrimitive.Thumb, {
      className:
        "block h-5 w-5 rounded-full bg-white shadow-[0_1px_4px_rgba(15,23,42,0.18),0_4px_12px_rgba(15,23,42,0.1)] ring-0 transition-transform focus-visible:outline-none hover:scale-110",
    }),
  ),
);
Slider.displayName = SliderPrimitive.Root.displayName;
export { Slider };
