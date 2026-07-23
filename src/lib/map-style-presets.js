/**
 * 노선도 표현 프리셋
 * — 좌표 소스는 capital-metro-map 유지, 노드·라벨·선 표현만 분기
 */

/** @typedef {'baseline' | 'cleanNodes' | 'labelDiscipline' | 'stationCompact'} MapStyleId */

/**
 * @typedef {object} MapStylePreset
 * @property {MapStyleId} id
 * @property {'baseline' | 'clean'} nodeStyle
 * @property {boolean} lineStrokeUniform
 * @property {number} [uniformStrokeWidth]
 * @property {'classic' | 'orthogonal'} labelMode
 * @property {boolean} compactCenter
 * @property {number | null} transferOnlyLabelsBelowScale
 * @property {number} regularR
 * @property {number} transferR
 * @property {number} transferStroke
 */

/** @type {Record<MapStyleId, MapStylePreset>} */
export const MAP_STYLE_PRESETS = {
  baseline: {
    id: "baseline",
    nodeStyle: "baseline",
    lineStrokeUniform: false,
    labelMode: "classic",
    compactCenter: false,
    transferOnlyLabelsBelowScale: null,
    regularR: 4.5,
    transferR: 4.5,
    transferStroke: 2.2,
  },
  cleanNodes: {
    id: "cleanNodes",
    nodeStyle: "clean",
    lineStrokeUniform: true,
    uniformStrokeWidth: 3.2,
    labelMode: "classic",
    compactCenter: false,
    transferOnlyLabelsBelowScale: null,
    regularR: 3.2,
    transferR: 5.5,
    transferStroke: 1.8,
  },
  labelDiscipline: {
    id: "labelDiscipline",
    nodeStyle: "clean",
    lineStrokeUniform: true,
    uniformStrokeWidth: 3.2,
    labelMode: "orthogonal",
    compactCenter: false,
    transferOnlyLabelsBelowScale: 1.15,
    regularR: 3.2,
    transferR: 5.5,
    transferStroke: 1.8,
  },
  stationCompact: {
    id: "stationCompact",
    nodeStyle: "clean",
    lineStrokeUniform: true,
    uniformStrokeWidth: 3.2,
    labelMode: "orthogonal",
    compactCenter: true,
    transferOnlyLabelsBelowScale: 1.15,
    regularR: 3.2,
    transferR: 5.5,
    transferStroke: 1.8,
  },
};

/** @param {string | undefined} id */
export function getMapStylePreset(id) {
  return MAP_STYLE_PRESETS[id] ?? MAP_STYLE_PRESETS.baseline;
}
