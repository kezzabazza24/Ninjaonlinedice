import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const COLOURS = ["red", "blue", "green", "yellow", "orange", "purple"] as const;
const ORIGIN = "https://ninjadice.co.uk";
const windowMs = 60_000;
const maxPerWindow = 20;
const rate = new Map<string, { started: number; count: number }>();

function randomIndex() {
  const a = new Uint32Array(1);
  const limit = Math.floor(4294967296 / COLOURS.length) * COLOURS.length;
  do crypto.getRandomValues(a); while (a[0] >= limit);
  return a[0] % COLOURS.length;
}

function makeCode() {
  const a = new Uint32Array(2);
  crypto.getRandomValues(a);
  return "NINJA-" + [...a].map(x => x.toString(36).toUpperCase().slice(0, 5).padStart(5, "0")).join("-");
}

function corsHeaders(origin: string | null) {
  return {
    "Access-Control-Allow-Origin": origin === ORIGIN ? ORIGIN : ORIGIN,
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Content-Type": "application/json",
  };
}

serve(async (req) => {
  const origin = req.headers.get("origin");
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders(origin) });
  if (req.method !== "POST") return Response.json({ error: "Method not allowed" }, { status: 405, headers: corsHeaders(origin) });
  // This function is intended to be called only by the live website.
  // Reject non-browser/direct callers rather than relying on CORS alone.
  if (origin !== ORIGIN) return Response.json({ error: "Origin not allowed" }, { status: 403, headers: corsHeaders(origin) });

  const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "unknown";
  const now = Date.now();
  const bucket = rate.get(ip);
  if (!bucket || now - bucket.started >= windowMs) rate.set(ip, { started: now, count: 1 });
  else {
    bucket.count++;
    if (bucket.count > maxPerWindow) return Response.json({ error: "Too many rolls. Please wait a moment." }, { status: 429, headers: { ...corsHeaders(origin), "Retry-After": "60" } });
  }

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
  );

  let diceCount = 4;
  try {
    const body = await req.json();
    const requested = Number(body?.diceCount);
    if (Number.isInteger(requested) && requested >= 1 && requested <= 6) diceCount = requested;
  } catch {}

  const roll = Array.from({ length: diceCount }, () => COLOURS[randomIndex()]);
  const code = makeCode();
  const { data, error } = await supabase.from("rolls").insert({ code, colours: roll }).select("code,colours,created_at").single();
  if (error) return Response.json({ error: "Could not save roll" }, { status: 500, headers: corsHeaders(origin) });
  return Response.json(data, { headers: corsHeaders(origin) });
});
