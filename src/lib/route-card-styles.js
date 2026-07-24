/**
 * 추천 경로 카드 강조 시안 (최단=파란 / 쾌적=초록).
 * 노선도 halo처럼 라벨색을 낮은 opacity로 깔아 구분한다.
 */

export const ROUTE_CARD_STYLE_IDS = [
  "headerWash",
  "leftAccent",
  "softWash",
  "haloRing",
];

/** @typedef {'softWash'|'leftAccent'|'haloRing'|'headerWash'} RouteCardStyleId */

/** @type {Record<RouteCardStyleId, { id: RouteCardStyleId, title: string, blurb: string }>} */
export const ROUTE_CARD_STYLE_PRESETS = {
  headerWash: {
    id: "headerWash",
    title: "상단만 워시",
    blurb: "시간·뱃지 줄만 연한 배경 (배포 기본)",
  },
  leftAccent: {
    id: "leftAccent",
    title: "왼쪽 액센트",
    blurb: "왼쪽 컬러 바 + 아주 옅은 배경",
  },
  softWash: {
    id: "softWash",
    title: "소프트 워시",
    blurb: "카드 전체에 라벨색을 아주 옅게 (노선도 halo 느낌)",
  },
  haloRing: {
    id: "haloRing",
    title: "할로 링",
    blurb: "뱃지색 테두리를 그림자처럼 두름",
  },
};

/** 배포(prod) 고정 시안. 로컬 `#card-style`에서만 다른 시안 미리보기 가능. */
export const DEFAULT_ROUTE_CARD_STYLE = "headerWash";

const STORAGE_KEY = "yeoyuro.routeCardStyle";

/** 뱃지 라벨과 맞춘 강조색 (blue-600 / emerald-600) */
export const BADGE_ACCENT = {
  shortest: { hex: "#2563eb", label: "최단" },
  comfortable: { hex: "#059669", label: "쾌적" },
};

/**
 * @param {Array<'shortest'|'comfortable'|string>} badges
 * @returns {'shortest'|'comfortable'|'both'|null}
 */
export function resolveAccentKind(badges = []) {
  const hasShort = badges.includes("shortest");
  const hasComfort = badges.includes("comfortable");
  if (hasShort && hasComfort) return "both";
  if (hasShort) return "shortest";
  if (hasComfort) return "comfortable";
  return null;
}

/**
 * @param {'shortest'|'comfortable'|'both'|null} kind
 * @param {number} alpha 0–1
 */
export function accentFill(kind, alpha = 0.1) {
  if (!kind) return "transparent";
  if (kind === "both") {
    const a = BADGE_ACCENT.shortest.hex;
    const b = BADGE_ACCENT.comfortable.hex;
    return `linear-gradient(135deg, ${hexAlpha(a, alpha)} 0%, ${hexAlpha(b, alpha)} 100%)`;
  }
  return hexAlpha(BADGE_ACCENT[kind].hex, alpha);
}

export function accentSolid(kind) {
  if (!kind) return null;
  if (kind === "both") return BADGE_ACCENT.shortest.hex;
  return BADGE_ACCENT[kind].hex;
}

export function hexAlpha(hex, alpha) {
  const h = hex.replace("#", "");
  const full =
    h.length === 3
      ? h
          .split("")
          .map((c) => c + c)
          .join("")
      : h;
  const n = Number.parseInt(full, 16);
  const r = (n >> 16) & 255;
  const g = (n >> 8) & 255;
  const b = n & 255;
  return `rgba(${r},${g},${b},${alpha})`;
}

/** @returns {RouteCardStyleId} */
export function readRouteCardStyle() {
  try {
    const v = localStorage.getItem(STORAGE_KEY);
    if (v && ROUTE_CARD_STYLE_IDS.includes(v)) return /** @type {RouteCardStyleId} */ (v);
  } catch {
    /* ignore */
  }
  return DEFAULT_ROUTE_CARD_STYLE;
}

/** @param {RouteCardStyleId} id */
export function writeRouteCardStyle(id) {
  if (!ROUTE_CARD_STYLE_IDS.includes(id)) return;
  try {
    localStorage.setItem(STORAGE_KEY, id);
  } catch {
    /* ignore */
  }
}

/**
 * 카드 외곽 class / style 계산
 * @param {{ badges?: string[], styleId?: RouteCardStyleId }} opts
 */
export function getRouteCardChrome({ badges = [], styleId = DEFAULT_ROUTE_CARD_STYLE }) {
  const kind = resolveAccentKind(badges);
  const featured = Boolean(kind);
  const base =
    "w-full cursor-pointer rounded-2xl border border-slate-100 p-4 text-left shadow-[0_1px_3px_rgba(15,23,42,0.04)] transition hover:shadow-[0_2px_8px_rgba(15,23,42,0.08)]";

  if (!featured) {
    return {
      kind: null,
      className: `${base} bg-white`,
      style: undefined,
      headerStyle: undefined,
      showLeftBar: false,
      leftBarColor: null,
    };
  }

  const solid = accentSolid(kind);

  switch (styleId) {
    case "softWash":
      return {
        kind,
        className: `${base} border-transparent`,
        style: {
          background: accentFill(kind, 0.1),
          boxShadow: `0 0 0 1px ${hexAlpha(solid, 0.18)}, 0 1px 3px rgba(15,23,42,0.04)`,
        },
        headerStyle: undefined,
        showLeftBar: false,
        leftBarColor: null,
      };
    case "leftAccent":
      return {
        kind,
        className: `${base} relative overflow-hidden bg-white pl-5`,
        style: { background: accentFill(kind, 0.06) },
        headerStyle: undefined,
        showLeftBar: true,
        leftBarColor: solid,
      };
    case "haloRing":
      return {
        kind,
        className: `${base} bg-white`,
        style: {
          boxShadow: `0 0 0 1px ${hexAlpha(solid, 0.35)}, 0 0 0 5px ${hexAlpha(solid, 0.12)}, 0 1px 3px rgba(15,23,42,0.04)`,
        },
        headerStyle: undefined,
        showLeftBar: false,
        leftBarColor: null,
      };
    case "headerWash":
    default:
      return {
        kind,
        className: `${base} bg-white ring-1 ring-slate-200/80`,
        style: undefined,
        headerStyle: {
          margin: "-1rem -1rem 0.75rem",
          padding: "0.85rem 1rem 0.75rem",
          borderRadius: "1rem 1rem 0 0",
          background: accentFill(kind, 0.12),
        },
        showLeftBar: false,
        leftBarColor: null,
      };
  }
}
