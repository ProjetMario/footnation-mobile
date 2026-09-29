import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { corsHeaders } from "../_shared/cors.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.3';

const supabaseAdmin = createClient(
  Deno.env.get('SUPABASE_URL') ?? '',
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
  {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  }
);

const getUserIdFromRequest = async (req: Request) => {
  const authHeader = req.headers.get('Authorization') || req.headers.get('authorization');
  if (!authHeader || !authHeader.toLowerCase().startsWith("bearer ")) {
    return null;
  }
  const token = authHeader.slice(7);
  if (!token) return null;

  try {
    const { data: { user }, error } = await supabaseAdmin.auth.getUser(token);
    if (error || !user?.id) {
      return null;
    }
    return user.id;
  } catch (err) {
    return null;
  }
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const userId = await getUserIdFromRequest(req);
    if (!userId) {
      return new Response(
        JSON.stringify({ error: 'Authentification requise.' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const body = await req.json().catch(() => ({}));
    const { clubId } = body;
    const sections: Record<string, string[]> = {
      infos: ['name', 'short_name', 'logo_url', 'founded_date'],
      about: ['description', 'history'],
      contact: ['address', 'city', 'postal_code', 'phone', 'email', 'website'],
    };
    const modern = body.section !== undefined;
    const section = modern ? body.section : 'infos';
    const reply = (status: number, error: string) => new Response(JSON.stringify({ error }), { status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    if (typeof clubId !== 'string' || !Object.hasOwn(sections, section)) return reply(400, 'Club ou section invalide.');
    const fields = sections[section];
    if (modern && (!body.expected || typeof body.expected !== 'object' || fields.some(key => !Object.hasOwn(body.expected, key) || (body.expected[key] !== null && typeof body.expected[key] !== 'string'))))
      return reply(400, 'Les valeurs d’origine sont requises. Rechargez le formulaire.');
    const patch: Record<string, string | null> = {};
    for (const key of fields) {
      const raw = body[key];
      if (modern && !Object.hasOwn(body, key)) return reply(400, 'Formulaire incomplet.');
      if (raw != null && typeof raw !== 'string') return reply(400, 'Champ invalide.');
      const value = raw?.trim() || null;
      if (key === 'name' && !value) return reply(400, 'Le nom du club est obligatoire.');
      if (value && (key === 'website' || key === 'logo_url')) {
        try {
          const url = new URL(value);
          if (!['http:', 'https:'].includes(url.protocol) || url.username || url.password || !url.hostname.includes('.')) throw new Error();
        } catch { return reply(400, 'Lien internet invalide.'); }
      }
      if (value && key === 'email' && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)) return reply(400, 'Adresse e-mail invalide.');
      if (value && key === 'phone' && !/^\+?\d{6,15}$/.test(value.replace(/[\s().-]/g, ''))) return reply(400, 'Téléphone invalide.');
      if (value && key === 'founded_date') {
        const date = new Date(value + 'T12:00:00Z');
        if (!/^\d{4}-\d{2}-\d{2}$/.test(value) || !Number.isFinite(date.getTime()) || date.toISOString().slice(0,10) !== value || value > new Date().toISOString().slice(0,10)) return reply(400, 'Date de fondation invalide.');
      }
      patch[key] = value;
    }
    // Preserve the old website payload; native requests never overwrite type.
    if (!modern) {
      if (body.type && !['club', 'five_center'].includes(body.type)) return reply(400, 'Type invalide.');
      patch.type = body.type || 'club';
    }

    // Evaluate the existing club/site administrator policy with the verified
    // caller's JWT. Never evaluate auth.uid() using the service-role client.
    const caller = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      {
        global: { headers: { Authorization: req.headers.get('Authorization') || '' } },
        auth: { autoRefreshToken: false, persistSession: false },
      }
    );
    const access = await caller.rpc('is_club_admin', { p_club_id: clubId });
    if (access.error || access.data !== true) {
      return new Response(
        JSON.stringify({ error: 'Cet espace est réservé aux administrateurs du club.' }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    let update = supabaseAdmin.from('fff_clubs').update(patch).eq('id', clubId);
    if (modern) {
      for (const key of fields) {
        update = body.expected[key] === null ? update.is(key, null) : update.eq(key, body.expected[key]);
      }
    }
    const { data, error } = await update.select(fields.join(',')).maybeSingle();
    if (error) throw error;
    if (!data) return reply(modern ? 409 : 404, modern ? 'Ces informations ont changé. Rechargez le formulaire avant de réessayer.' : 'Club introuvable.');

    return new Response(
      JSON.stringify({ success: true, values: data }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error: any) {
    console.error('update-club-info error:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
