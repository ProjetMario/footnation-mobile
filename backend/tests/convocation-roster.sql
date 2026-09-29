\ir member-convocations.sql
RESET ROLE;
ALTER TABLE club_players ADD COLUMN name text DEFAULT 'Joueur',ADD COLUMN category text DEFAULT 'Senior',ADD COLUMN is_active boolean DEFAULT true;
CREATE TABLE teams(id uuid PRIMARY KEY,club_id uuid);
CREATE TABLE team_members(team_id uuid,profile_id uuid,is_active boolean);
CREATE FUNCTION public.is_fff_club_admin(uuid) RETURNS boolean LANGUAGE sql STABLE AS $$ SELECT auth.uid()='00000000-0000-0000-0000-000000000009'::uuid AND $1='00000000-0000-0000-0000-000000000100'::uuid $$;
CREATE POLICY admin_players ON club_players USING(is_fff_club_admin(club_id));
CREATE POLICY admin_convocations ON club_convocations USING(is_fff_club_admin(club_id));
CREATE POLICY admin_invited ON club_convocation_players USING(EXISTS(SELECT 1 FROM club_convocations c WHERE c.id=convocation_id AND is_fff_club_admin(c.club_id)));
GRANT SELECT ON club_players,club_convocations TO authenticated;
GRANT SELECT,INSERT,UPDATE,DELETE ON club_convocation_players TO authenticated;
INSERT INTO club_players(id,profile_id,club_id,name) VALUES('00000000-0000-0000-0000-000000000013','00000000-0000-0000-0000-000000000003','00000000-0000-0000-0000-000000000100','Nouveau joueur'),('00000000-0000-0000-0000-000000000014','00000000-0000-0000-0000-000000000004','00000000-0000-0000-0000-000000000200','Autre club');
INSERT INTO teams VALUES('00000000-0000-0000-0000-000000000050','00000000-0000-0000-0000-000000000100'),('00000000-0000-0000-0000-000000000051','00000000-0000-0000-0000-000000000200');
INSERT INTO team_members VALUES('00000000-0000-0000-0000-000000000050','00000000-0000-0000-0000-000000000003',true);
\ir ../migrations/20260908036000_native_convocation_roster.sql
SET ROLE authenticated;
SET request.jwt.claim.sub='00000000-0000-0000-0000-000000000009';
DO $$ DECLARE club uuid:='00000000-0000-0000-0000-000000000100'; c uuid:='00000000-0000-0000-0000-000000000021'; p uuid:='00000000-0000-0000-0000-000000000013'; old jsonb; BEGIN
 IF (SELECT count(*) FROM get_native_convocation_candidates(club,c))<>1 THEN RAISE EXCEPTION 'Candidate scope'; END IF;
 IF (SELECT id FROM get_native_convocation_candidates(club,c,'00000000-0000-0000-0000-000000000050','nouveau'))<>p THEN RAISE EXCEPTION 'Team profile/player mapping'; END IF;
 BEGIN PERFORM get_native_convocation_candidates(club,c,'00000000-0000-0000-0000-000000000051'); RAISE EXCEPTION 'Other club team'; EXCEPTION WHEN invalid_parameter_value THEN NULL; END;
 BEGIN INSERT INTO club_convocation_players(id,convocation_id,player_id,status) VALUES('00000000-0000-0000-0000-000000000034',c,'00000000-0000-0000-0000-000000000014','pending'); RAISE EXCEPTION 'Cross club insert'; EXCEPTION WHEN invalid_parameter_value THEN NULL; END;
 BEGIN INSERT INTO club_convocation_players(id,convocation_id,player_id,status) VALUES('00000000-0000-0000-0000-000000000034',c,p,'accepted'); RAISE EXCEPTION 'Forged initial response'; EXCEPTION WHEN invalid_parameter_value THEN NULL; END;
 INSERT INTO club_convocation_players(id,convocation_id,player_id,status) VALUES('00000000-0000-0000-0000-000000000034',c,p,'pending');
 IF EXISTS(SELECT 1 FROM get_native_convocation_candidates(club,c)) THEN RAISE EXCEPTION 'Invited candidate not excluded'; END IF;
 PERFORM set_config('request.jwt.claim.sub','00000000-0000-0000-0000-000000000003',true);
 PERFORM respond_native_member_convocation('00000000-0000-0000-0000-000000000034','accepted','pending',NULL);
 BEGIN PERFORM get_native_convocation_candidates(club,c); RAISE EXCEPTION 'Member admin read'; EXCEPTION WHEN insufficient_privilege THEN NULL; END;
 PERFORM set_config('request.jwt.claim.sub','00000000-0000-0000-0000-000000000009',true);
 SELECT to_jsonb(x) INTO old FROM club_convocation_players x WHERE id='00000000-0000-0000-0000-000000000034';
 UPDATE club_convocation_players SET notes=repeat('é',3000) WHERE id='00000000-0000-0000-0000-000000000034';
 BEGIN PERFORM delete_native_convocation_player('00000000-0000-0000-0000-000000000034',c,old); RAISE EXCEPTION 'Stale deletion'; EXCEPTION WHEN serialization_failure THEN NULL; END;
 SELECT to_jsonb(x) INTO old FROM club_convocation_players x WHERE id='00000000-0000-0000-0000-000000000034';
 PERFORM delete_native_convocation_player('00000000-0000-0000-0000-000000000034',c,old);
 IF (SELECT count(*) FROM get_native_convocation_candidates(club,c))<>1 THEN RAISE EXCEPTION 'Candidate not restored'; END IF;
END $$;
\echo Convocation roster: player mapping, team/club scope, pending insert, member reply compatibility and snapshot deletion passed.
