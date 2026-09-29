-- Values and optimistic snapshot travel in the request body, not URL filters.
CREATE OR REPLACE FUNCTION public.update_native_profile_snapshot(p_values jsonb, p_expected jsonb)
RETURNS jsonb LANGUAGE plpgsql SET search_path = '' AS $$
DECLARE allowed text[] := ARRAY[
 'account_type','skills','username','bio','city','department','country','nationality',
 'first_name','last_name','primary_role','position','club','highest_level','gender','birthdate',
 'favorite_pro_club','favorite_amateur_club','height','weight','strong_foot','technical_skills','characteristics',
 'club_official_name','club_year_founded','club_colors','club_website','club_phone','club_address',
 'business_name','business_sector','business_description','business_website','business_email','business_phone','business_address',
 'institution_name','institution_type','institution_level','institution_description','institution_email','institution_phone','institution_address',
 'full_name','avatar_url'
];
DECLARE keys text[]; expected_keys text[]; assignments text; result jsonb;
BEGIN
 IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Authentication required' USING ERRCODE='42501'; END IF;
 IF jsonb_typeof(p_values) IS DISTINCT FROM 'object' OR jsonb_typeof(p_expected) IS DISTINCT FROM 'object' THEN
  RAISE EXCEPTION 'Profile values and snapshot must be objects' USING ERRCODE='22023';
 END IF;
 SELECT array_agg(key ORDER BY key) INTO keys FROM jsonb_object_keys(p_values) key;
 SELECT array_agg(key ORDER BY key) INTO expected_keys FROM jsonb_object_keys(p_expected) key;
 IF keys IS NULL OR NOT keys <@ allowed OR keys IS DISTINCT FROM expected_keys THEN
  RAISE EXCEPTION 'Unsupported fields or incomplete snapshot' USING ERRCODE='22023';
 END IF;
 SELECT string_agg(format('%I = (jsonb_populate_record(NULL::public.profiles, $1)).%I',key,key),', ')
 INTO assignments FROM unnest(keys) key;
 EXECUTE format('UPDATE public.profiles p SET %s WHERE p.id=auth.uid() AND NOT EXISTS (
   SELECT 1 FROM jsonb_each($2) old WHERE (to_jsonb(p)->old.key) IS DISTINCT FROM old.value
 ) RETURNING to_jsonb(p)',assignments) INTO result USING p_values,p_expected;
 IF result IS NULL THEN RAISE EXCEPTION 'Profile changed or unavailable; reload the form' USING ERRCODE='40001'; END IF;
 RETURN result;
END $$;
REVOKE ALL ON FUNCTION public.update_native_profile_snapshot(jsonb,jsonb) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.update_native_profile_snapshot(jsonb,jsonb) TO authenticated;
