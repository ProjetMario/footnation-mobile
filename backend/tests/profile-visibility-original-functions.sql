CREATE OR REPLACE FUNCTION public.get_profile_connections(requested_user uuid, connection_type text, page_limit integer DEFAULT 10, page_offset integer DEFAULT 0, search_term text DEFAULT NULL::text)
 RETURNS TABLE(connection_id uuid, created_at timestamp with time zone, status text, user_id uuid, connected_user_id uuid, other_profile_id uuid, other_full_name text, other_username text, other_avatar_url text, other_primary_role text, other_position text, other_club text, other_city text, other_favorite_pro_club text, total_count bigint)
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
AS $function$
declare
  normalized_type text := lower(coalesce(connection_type, 'connections'));
  normalized_search text := nullif(trim(search_term), '');
begin
  if normalized_type = 'connections' then
    return query
      select
        c.id,
        c.created_at,
        c.status,
        c.user_id,
        c.connected_user_id,
        case when c.user_id = requested_user then c.connected_user_id else c.user_id end as other_profile_id,
        p.full_name,
        p.username,
        p.avatar_url,
        p.primary_role,
        p.position,
        p.club,
        p.city,
        p.favorite_pro_club,
        count(*) over ()::bigint as total_count
      from connections c
      join profiles p
        on p.id = case when c.user_id = requested_user then c.connected_user_id else c.user_id end
      where c.status = 'accepted'
        and (c.user_id = requested_user or c.connected_user_id = requested_user)
        and (
          normalized_search is null or
          p.full_name ilike '%' || normalized_search || '%' or
          p.username ilike '%' || normalized_search || '%' or
          p.primary_role ilike '%' || normalized_search || '%' or
          p.club ilike '%' || normalized_search || '%' or
          p.city ilike '%' || normalized_search || '%' or
          p.favorite_pro_club ilike '%' || normalized_search || '%'
        )
      order by c.created_at desc
      limit page_limit
      offset page_offset;
  elsif normalized_type = 'pending' then
    return query
      select
        c.id,
        c.created_at,
        c.status,
        c.user_id,
        c.connected_user_id,
        c.user_id as other_profile_id,
        p.full_name,
        p.username,
        p.avatar_url,
        p.primary_role,
        p.position,
        p.club,
        p.city,
        p.favorite_pro_club,
        count(*) over ()::bigint as total_count
      from connections c
      join profiles p on p.id = c.user_id
      where c.status = 'pending'
        and c.connected_user_id = requested_user
        and (
          normalized_search is null or
          p.full_name ilike '%' || normalized_search || '%' or
          p.username ilike '%' || normalized_search || '%' or
          p.primary_role ilike '%' || normalized_search || '%' or
          p.club ilike '%' || normalized_search || '%' or
          p.city ilike '%' || normalized_search || '%' or
          p.favorite_pro_club ilike '%' || normalized_search || '%'
        )
      order by c.created_at desc
      limit page_limit
      offset page_offset;
  elsif normalized_type = 'sent' then
    return query
      select
        c.id,
        c.created_at,
        c.status,
        c.user_id,
        c.connected_user_id,
        c.connected_user_id as other_profile_id,
        p.full_name,
        p.username,
        p.avatar_url,
        p.primary_role,
        p.position,
        p.club,
        p.city,
        p.favorite_pro_club,
        count(*) over ()::bigint as total_count
      from connections c
      join profiles p on p.id = c.connected_user_id
      where c.status = 'pending'
        and c.user_id = requested_user
        and (
          normalized_search is null or
          p.full_name ilike '%' || normalized_search || '%' or
          p.username ilike '%' || normalized_search || '%' or
          p.primary_role ilike '%' || normalized_search || '%' or
          p.club ilike '%' || normalized_search || '%' or
          p.city ilike '%' || normalized_search || '%' or
          p.favorite_pro_club ilike '%' || normalized_search || '%'
        )
      order by c.created_at desc
      limit page_limit
      offset page_offset;
  else
    raise exception 'Unknown connection_type %. Expected connections, pending or sent.', connection_type;
  end if;
end;
$function$
;
CREATE OR REPLACE FUNCTION public.get_connection_suggestions(requested_user uuid, page_limit integer DEFAULT 10, page_offset integer DEFAULT 0, search_term text DEFAULT NULL::text)
 RETURNS TABLE(profile_id uuid, full_name text, username text, avatar_url text, primary_role text, "position" text, club text, city text, favorite_pro_club text, mutual_count bigint, total_count bigint)
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
AS $function$
declare
  normalized_search text := nullif(trim(search_term), '');
begin
  return query
  with accepted as (
    select
      case when c.user_id = requested_user then c.connected_user_id else c.user_id end as friend_id
    from connections c
    where c.status = 'accepted'
      and (c.user_id = requested_user or c.connected_user_id = requested_user)
  ),
  existing as (
    select
      case when c.user_id = requested_user then c.connected_user_id else c.user_id end as profile_id
    from connections c
    where c.user_id = requested_user or c.connected_user_id = requested_user
  ),
  candidates as (
    select p.*
    from profiles p
    where p.id <> requested_user
      and not exists (
        select 1
        from existing e
        where e.profile_id = p.id
      )
      and (
        normalized_search is null or (
          p.full_name ilike '%' || normalized_search || '%'
          or p.username ilike '%' || normalized_search || '%'
          or p.primary_role ilike '%' || normalized_search || '%'
          or p.position ilike '%' || normalized_search || '%'
          or p.club ilike '%' || normalized_search || '%'
          or p.city ilike '%' || normalized_search || '%'
          or p.favorite_pro_club ilike '%' || normalized_search || '%'
        )
      )
  ),
  mutual_links as (
    select
      cand.id as candidate_id,
      case when c.user_id = cand.id then c.connected_user_id else c.user_id end as other_id
    from candidates cand
    join connections c
      on c.status = 'accepted'
     and (c.user_id = cand.id or c.connected_user_id = cand.id)
  ),
  mutual_counts as (
    select
      ml.candidate_id,
      count(distinct ml.other_id) filter (where ml.other_id in (select friend_id from accepted)) as mutual_count
    from mutual_links ml
    group by ml.candidate_id
  )
  select
    cand.id as profile_id,
    cand.full_name,
    cand.username,
    cand.avatar_url,
    cand.primary_role,
    cand.position as "position",
    cand.club,
    cand.city,
    cand.favorite_pro_club,
    coalesce(mc.mutual_count, 0) as mutual_count,
    count(*) over ()::bigint as total_count
  from candidates cand
  left join mutual_counts mc on mc.candidate_id = cand.id
  order by coalesce(mc.mutual_count, 0) desc, cand.full_name nulls last
  limit page_limit
  offset page_offset;
end;
$function$
;
CREATE OR REPLACE FUNCTION public.get_ranked_connection_suggestions(requested_user uuid, page_limit integer DEFAULT 10, page_offset integer DEFAULT 0, search_term text DEFAULT NULL::text)
 RETURNS TABLE(profile_id uuid, full_name text, username text, avatar_url text, primary_role text, club text, department text, city text, favorite_pro_club text, mutual_count integer, shared_club boolean, shared_city boolean, shared_department boolean, final_score numeric, scoring_details jsonb)
 LANGUAGE sql
 STABLE SECURITY DEFINER
AS $function$
  WITH user_profile AS (
    SELECT * FROM public.profiles WHERE id = requested_user
  ),
  excluded_ids AS (
    SELECT DISTINCT CASE WHEN c.user_id = requested_user THEN c.connected_user_id ELSE c.user_id END AS other_id
    FROM public.connections c
    WHERE (c.user_id = requested_user OR c.connected_user_id = requested_user)
      AND c.status IN ('pending', 'accepted')
  ),
  friend_list AS (
    SELECT DISTINCT CASE WHEN c.user_id = requested_user THEN c.connected_user_id ELSE c.user_id END AS friend_id
    FROM public.connections c
    WHERE c.status = 'accepted'
      AND (c.user_id = requested_user OR c.connected_user_id = requested_user)
  ),
  mutual_counts AS (
    SELECT candidate_id, COUNT(DISTINCT source_friend)::integer AS mutual_count
    FROM (
      SELECT
        CASE WHEN c.user_id = f.friend_id THEN c.connected_user_id ELSE c.user_id END AS candidate_id,
        f.friend_id AS source_friend
      FROM public.connections c
      JOIN friend_list f ON c.user_id = f.friend_id OR c.connected_user_id = f.friend_id
      WHERE c.status = 'accepted'
    ) pairs
    WHERE candidate_id IS NOT NULL AND candidate_id <> requested_user
    GROUP BY candidate_id
  ),
  scored AS (
    SELECT
      p.id AS profile_id,
      p.full_name,
      p.username,
      p.avatar_url,
      p.primary_role,
      p.club,
      p.department,
      p.city,
      p.favorite_pro_club,
      COALESCE(mc.mutual_count, 0) AS mutual_count,
      (up.club IS NOT NULL AND p.club IS NOT NULL AND LOWER(TRIM(up.club)) = LOWER(TRIM(p.club))) AS shared_club,
      (up.city IS NOT NULL AND p.city IS NOT NULL AND LOWER(TRIM(up.city)) = LOWER(TRIM(p.city))) AS shared_city,
      (up.department IS NOT NULL AND p.department IS NOT NULL AND up.department = p.department) AS shared_department,
      (
        0.35 * (CASE WHEN up.club IS NOT NULL AND p.club IS NOT NULL AND LOWER(TRIM(up.club)) = LOWER(TRIM(p.club)) THEN 1 ELSE 0 END) +
        0.30 * (CASE WHEN up.city IS NOT NULL AND p.city IS NOT NULL AND LOWER(TRIM(up.city)) = LOWER(TRIM(p.city)) THEN 1 
                     WHEN up.department IS NOT NULL AND p.department IS NOT NULL AND up.department = p.department THEN 0.7 
                     ELSE 0 END) +
        0.25 * (COALESCE(mc.mutual_count, 0)::numeric / GREATEST((SELECT COUNT(*) FROM friend_list), 1)) +
        0.10 * 0.5
      ) AS final_score
    FROM public.profiles p
    CROSS JOIN user_profile up
    LEFT JOIN excluded_ids ex ON ex.other_id = p.id
    LEFT JOIN mutual_counts mc ON mc.candidate_id = p.id
    WHERE p.id <> requested_user
      AND ex.other_id IS NULL
      AND (
        search_term IS NULL OR
        p.full_name ILIKE '%' || search_term || '%' OR
        p.username ILIKE '%' || search_term || '%' OR
        p.club ILIKE '%' || search_term || '%' OR
        p.city ILIKE '%' || search_term || '%' OR
        p.favorite_pro_club ILIKE '%' || search_term || '%'
      )
  )
  SELECT
    s.profile_id,
    s.full_name,
    s.username,
    s.avatar_url,
    s.primary_role,
    s.club,
    s.department,
    s.city,
    s.favorite_pro_club,
    s.mutual_count,
    s.shared_club,
    s.shared_city,
    s.shared_department,
    s.final_score,
    NULL::jsonb AS scoring_details
  FROM scored s
  WHERE s.final_score > 0 OR s.mutual_count > 0
  ORDER BY s.shared_club DESC, s.shared_city DESC, s.shared_department DESC, s.mutual_count DESC, s.final_score DESC
  LIMIT page_limit
  OFFSET page_offset;
$function$
;