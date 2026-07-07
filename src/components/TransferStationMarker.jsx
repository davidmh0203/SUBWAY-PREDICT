import React from "react";
import { TRANSFER_STATION_R } from "@/lib/metro-label-layout";
function TransferStationMarker({ x, y }) {
  return /* @__PURE__ */ React.createElement(
    "circle",
    {
      cx: x,
      cy: y,
      r: TRANSFER_STATION_R,
      fill: "#ffffff",
      stroke: "#1a1a1a",
      strokeWidth: 2.2
    }
  );
}
export {
  TransferStationMarker
};
