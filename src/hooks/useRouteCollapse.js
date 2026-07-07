import { useCallback, useMemo, useState } from "react";
import { buildRouteStationGroups } from "@/lib/route-station-groups";

export function useRouteCollapse(segments) {
  const { flat, groups } = useMemo(
    () => buildRouteStationGroups(segments ?? []),
    [segments],
  );
  const [expandedGroups, setExpandedGroups] = useState(() => new Set());

  const toggleGroup = useCallback((groupId) => {
    setExpandedGroups((prev) => {
      const next = new Set(prev);
      if (next.has(groupId)) next.delete(groupId);
      else next.add(groupId);
      return next;
    });
  }, []);

  return { flat, groups, expandedGroups, toggleGroup };
}
