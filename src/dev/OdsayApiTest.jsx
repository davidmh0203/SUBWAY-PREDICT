import { useCallback, useEffect, useMemo, useState } from "react";
import { getOdsayStatus, searchOdsayStation } from "@/lib/odsay-api";
import {
  formatOdsayStationLabel,
  getOdsayStationKey,
  groupOdsayStationsByName,
  normalizeStationSearchQuery,
  ODSAY_SEOUL_CID,
  rankOdsayStations,
} from "@/lib/odsay-station";

function maskKey(key) {
  if (!key) return "(없음)";
  if (key.length <= 6) return "***";
  return `${key.slice(0, 4)}…${key.slice(-2)}`;
}

export function OdsayApiTest() {
  const [backendStatus, setBackendStatus] = useState(null);
  const [stationName, setStationName] = useState("강남");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState(null);
  const [compareResult, setCompareResult] = useState(null);
  const [error, setError] = useState(null);
  const [filterSeoul, setFilterSeoul] = useState(true);

  const keyStatus = useMemo(() => {
    if (!backendStatus) return { ok: false, text: "백엔드 확인 중…" };
    if (!backendStatus.configured) {
      return { ok: false, text: "백엔드 ODSAY_API_KEY 미설정" };
    }
    return { ok: true, text: "백엔드 ODsay 프록시 연결됨" };
  }, [backendStatus]);

  useEffect(() => {
    getOdsayStatus()
      .then(setBackendStatus)
      .catch(() => setBackendStatus({ configured: false }));
  }, []);

  const apiStationName = useMemo(
    () => normalizeStationSearchQuery(stationName),
    [stationName],
  );

  const runSearchStation = useCallback(async () => {
    setLoading(true);
    setError(null);
    setResult(null);
    setCompareResult(null);
    try {
      const response = await searchOdsayStation(stationName, {
        cid: filterSeoul ? ODSAY_SEOUL_CID : undefined,
        displayCnt: 20,
      });
      setResult(response);

      if (stationName.trim().endsWith("역")) {
        const raw = await searchOdsayStation(stationName, {
          cid: filterSeoul ? ODSAY_SEOUL_CID : undefined,
          displayCnt: 5,
          normalize: false,
        });
        setCompareResult({
          label: `「${stationName.trim()}」 그대로 API 전달 (역 제거 없음)`,
          count: raw.data?.result?.totalCount ?? 0,
          note:
            raw.data?.result?.totalCount === 0
              ? "ODsay DB에 「역」 접미사가 없어 0건입니다. 앱에서는 검색 전 「역」을 제거해야 합니다."
              : undefined,
        });
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setLoading(false);
    }
  }, [stationName, filterSeoul, apiStationName]);

  const run역SuffixCompare = useCallback(async () => {
    setLoading(true);
    setError(null);
    setCompareResult(null);
    try {
      const with역Normalized = await searchOdsayStation("강남역", {
        cid: ODSAY_SEOUL_CID,
        displayCnt: 5,
      });
      const raw강남역 = await searchOdsayStation("강남역", {
        cid: ODSAY_SEOUL_CID,
        displayCnt: 5,
        normalize: false,
      });

      setStationName("강남역");
      setResult(with역Normalized);
      setCompareResult({
        label: "「강남역」 그대로 API 전달 (역 제거 없음)",
        count: raw강남역.data?.result?.totalCount ?? 0,
        note: "정규화 후 「강남」 검색 시 " + (with역Normalized.data?.result?.totalCount ?? 0) + "건. ODsay 역명에는 「역」이 없습니다.",
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setLoading(false);
    }
  }, []);

  const stations = useMemo(() => {
    const raw = result?.data?.result?.station ?? [];
    return rankOdsayStations(raw, stationName);
  }, [result, stationName]);

  const groups = useMemo(() => groupOdsayStationsByName(stations), [stations]);

  return (
    <div className="mx-auto min-h-screen max-w-lg bg-slate-50 px-4 py-6 text-slate-800">
      <header className="mb-6">
        <p className="text-xs font-medium uppercase tracking-wide text-slate-500">
          Dev · ODsay 백엔드 프록시
        </p>
        <h1 className="mt-1 text-xl font-bold">/api/odsay 테스트</h1>
        <p className="mt-2 text-sm text-slate-600">
          searchStation은 역명 끝 <strong>「역」 없이</strong> 저장됩니다.{" "}
          <code className="rounded bg-white px-1">stationID</code>·
          <code className="rounded bg-white px-1">laneName</code>으로 노선별 구분.
        </p>
      </header>

      <section className="mb-4 rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
        <div className="flex items-center justify-between gap-3">
          <span className="text-sm text-slate-600">백엔드 ODsay</span>
          <span
            className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${
              keyStatus.ok
                ? "bg-emerald-50 text-emerald-700"
                : "bg-rose-50 text-rose-700"
            }`}
          >
            {keyStatus.text}
          </span>
        </div>
      </section>

      <section className="mb-4 rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
        <label className="mb-2 block text-sm font-medium" htmlFor="station">
          역 이름 (searchStation)
        </label>
        <div className="flex gap-2">
          <input
            id="station"
            value={stationName}
            onChange={(e) => setStationName(e.target.value)}
            className="flex-1 rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none focus:border-slate-400"
            placeholder="강남 또는 강남역"
          />
          <button
            type="button"
            onClick={runSearchStation}
            disabled={loading || !apiKey}
            className="rounded-lg bg-slate-800 px-4 py-2 text-sm font-medium text-white disabled:opacity-40"
          >
            {loading ? "호출 중…" : "API 호출"}
          </button>
        </div>
        {stationName.trim() && (
          <p className="mt-2 text-xs text-slate-500">
            API 전달값: <code className="text-slate-700">{apiStationName || "(빈 값)"}</code>
            {stationName.trim().endsWith("역") && apiStationName && (
              <span className="ml-1 text-amber-700">← 「역」 제거됨</span>
            )}
          </p>
        )}
        <label className="mt-3 flex items-center gap-2 text-xs text-slate-600">
          <input
            type="checkbox"
            checked={filterSeoul}
            onChange={(e) => setFilterSeoul(e.target.checked)}
            className="rounded"
          />
          서울(CID 1000)만 — 유사명(강남대 등) 제외에 도움
        </label>
        <button
          type="button"
          onClick={run역SuffixCompare}
          disabled={loading || !apiKey}
          className="mt-3 w-full rounded-lg border border-slate-200 bg-slate-50 py-2 text-xs font-medium text-slate-700 hover:bg-slate-100 disabled:opacity-40"
        >
          「강남역」 vs 「강남」 비교 테스트
        </button>
      </section>

      {error && (
        <section className="mb-4 rounded-xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-800">
          <p className="font-semibold">오류</p>
          <p className="mt-1 whitespace-pre-wrap">{error}</p>
        </section>
      )}

      {result && (
        <section className="space-y-4">
          <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-900">
            <p className="font-semibold">성공 (HTTP {result.status})</p>
            <p className="mt-1">
              입력 「{result.query.input}」 → API 「{result.query.apiStationName}」 ·{" "}
              {result.data?.result?.totalCount ?? stations.length}건
            </p>
            {result.query.stripped역 && (
              <p className="mt-1 text-xs text-emerald-800">
                ODsay는 역명에 「역」을 붙이지 않습니다. 접미사를 제거한 뒤 검색했습니다.
              </p>
            )}
          </div>

          {compareResult && (
            <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
              <p className="font-semibold">비교</p>
              <p className="mt-1">
                {compareResult.label}: {compareResult.count}건
              </p>
              {compareResult.note && (
                <p className="mt-1 text-xs">{compareResult.note}</p>
              )}
            </div>
          )}

          {stations.length === 0 ? (
            <div className="rounded-xl border border-slate-200 bg-white p-4 text-sm text-slate-600">
              검색 결과 없음. 「역」 접미사 제거·2자 이상·서울 필터를 확인하세요.
            </div>
          ) : (
            <div className="space-y-3">
              {[...groups.entries()].map(([name, items]) => (
                <div
                  key={name}
                  className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm"
                >
                  <p className="text-sm font-semibold text-slate-800">
                    {name}
                    {items.length > 1 && (
                      <span className="ml-2 text-xs font-normal text-slate-500">
                        {items.length}개 노선/정류장
                      </span>
                    )}
                  </p>
                  <ul className="mt-2 space-y-2">
                    {items.map((s) => (
                      <li
                        key={getOdsayStationKey(s)}
                        className="rounded-lg bg-slate-50 px-3 py-2 text-xs text-slate-700"
                      >
                        <p className="font-medium">{formatOdsayStationLabel(s)}</p>
                        <p className="mt-0.5 text-slate-500">
                          stationID {s.stationID} · arsID {s.arsID ?? "-"} · type {s.type ?? "-"}
                        </p>
                      </li>
                    ))}
                  </ul>
                </div>
              ))}
            </div>
          )}

          <details className="rounded-xl border border-slate-200 bg-white p-4">
            <summary className="cursor-pointer text-sm font-medium text-slate-700">
              원본 JSON
            </summary>
            <pre className="mt-3 max-h-80 overflow-auto rounded-lg bg-slate-900 p-3 text-xs text-slate-100">
              {JSON.stringify(result.data, null, 2)}
            </pre>
          </details>
        </section>
      )}

      <p className="mt-8 text-center text-xs text-slate-400">
        <a href="/" className="underline hover:text-slate-600">
          앱으로 돌아가기
        </a>
      </p>
    </div>
  );
}
