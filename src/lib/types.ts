export type CongestionStatus = "SMOOTH" | "WARNING" | "DANGER";

/** 서울교통공사 스타일 4단계 혼잡도 */
export type CrowdLevel = "RELAXED" | "NORMAL" | "BUSY" | "VERY_BUSY";

export interface HourlyCongestion {
  hour: number;
  rate: number;
  level: CrowdLevel;
}

export interface CarCongestionRow {
  stationName: string;
  cars: CrowdLevel[];
  overallRate: number;
}

export interface MapSegment {
  id: string;
  label: string;
  path: string;
  baseColor: string;
  level: CrowdLevel;
}

export interface StationPrediction {
  stationId: number;
  stationName: string;
  congestionRate: number;
  status: CongestionStatus;
  heading: string;
  arrivalTime?: string;
  trigger?: "KOPIS_EVENT";
}

export interface ExternalFactors {
  weather: { status: string; weight: number };
  event: { title: string; location: string; scale: string; weight: number };
}

export interface CongestionPredictResponse {
  targetDateTime: string;
  externalFactors: ExternalFactors;
  predictions: StationPrediction[];
}

export interface RoutePath {
  id: string;
  label: string;
  badge?: string;
  totalTime: number;
  payment: number;
  transfers: number;
  lineName: string;
  maxCongestion: number;
  overallStatus: CongestionStatus;
  description: string;
  stations: string[];
  stationPredictions: StationPrediction[];
  recommended?: boolean;
}

export interface SearchForm {
  departure: string;
  destination: string;
  departureStationId: string | null;
  destinationStationId: string | null;
  targetTime: Date;
}

export type AppView = "home" | "results" | "detail" | "macro";

export type MacroLineKey =
  | "line-2-west"
  | "line-2-east"
  | "line-4"
  | "line-sinbundang"
  | "station-sadang"
  | "station-gangnam";

export type MacroPredictMap = Record<MacroLineKey, CongestionStatus>;
