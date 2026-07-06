import { TRANSFER_STATION_R } from "@/lib/metro-label-layout";

interface TransferStationMarkerProps {
  x: number;
  y: number;
}

export function TransferStationMarker({ x, y }: TransferStationMarkerProps) {
  return (
    <circle
      cx={x}
      cy={y}
      r={TRANSFER_STATION_R}
      fill="#ffffff"
      stroke="#1a1a1a"
      strokeWidth={2.2}
    />
  );
}
