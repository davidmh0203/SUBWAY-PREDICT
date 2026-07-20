import React from "react";
function TransferStationMarker({ x, y, r = 4.5, strokeWidth = 2.2 }) {
  return /* @__PURE__ */ React.createElement("circle", {
    cx: x,
    cy: y,
    r,
    fill: "#ffffff",
    stroke: "#1a1a1a",
    strokeWidth,
  });
}
export { TransferStationMarker };
