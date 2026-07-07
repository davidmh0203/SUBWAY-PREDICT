import { getStationByName } from "@/lib/metro-network";

function getStationLineColor(stationName, segments) {
  if (!segments?.length) return "#00A84D";
  for (const seg of segments) {
    if (seg.stations.some((s) => s.name === stationName)) return seg.lineColor;
  }
  return segments[0].lineColor;
}

export { getStationLineColor };
