import { useCallback, useMemo, useState } from "react";
import { buildRidingLegs } from "@/lib/route-station-groups";

export function useRouteCollapse(segments) {
  const legs = useMemo(() => buildRidingLegs(segments ?? []), [segments]);
  const [expandedGroups, setExpandedGroups] = useState(() => new Set());

  const toggleGroup = useCallback((legId) => {
    setExpandedGroups((prev) => {
      const next = new Set(prev);
      if (next.has(legId)) next.delete(legId);
      else next.add(legId);
      return next;
    });
  }, []);

  return { legs, expandedGroups, toggleGroup };
}
