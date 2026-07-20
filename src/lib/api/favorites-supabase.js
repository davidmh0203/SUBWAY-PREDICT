import { getSupabase } from "@/lib/supabase-client";

function mapRow(row) {
  return {
    id: row.id,
    start_name: row.start_name,
    end_name: row.end_name,
    route_key: row.route_key,
    route_label: row.route_label,
    departure_time: row.departure_time,
    created_at: row.created_at,
  };
}

export async function listFavoritesSupabase() {
  const supabase = getSupabase();
  if (!supabase) return [];

  const { data: session } = await supabase.auth.getSession();
  if (!session.session) return [];

  const { data, error } = await supabase
    .from("favorite_routes")
    .select("*")
    .order("created_at", { ascending: false });

  if (error) throw new Error(error.message);
  return (data ?? []).map(mapRow);
}

export async function addFavoriteSupabase({
  startName,
  endName,
  routeKey,
  routeLabel,
  departureTime,
}) {
  const supabase = getSupabase();
  if (!supabase) throw new Error("Supabase가 설정되지 않았습니다");

  const { data: session } = await supabase.auth.getSession();
  if (!session.session) throw new Error("로그인이 필요합니다");

  const { data, error } = await supabase
    .from("favorite_routes")
    .insert({
      user_id: session.session.user.id,
      start_name: startName,
      end_name: endName,
      route_key: routeKey,
      route_label: routeLabel,
      departure_time: departureTime,
    })
    .select()
    .single();

  if (error) throw new Error(error.message);
  return mapRow(data);
}

export async function removeFavoriteSupabase(id) {
  const supabase = getSupabase();
  if (!supabase) throw new Error("Supabase가 설정되지 않았습니다");

  const { error } = await supabase.from("favorite_routes").delete().eq("id", id);
  if (error) throw new Error(error.message);
}
