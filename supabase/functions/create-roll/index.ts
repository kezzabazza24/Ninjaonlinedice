import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Content-Type": "application/json",
};

const colours = [
  "red",
  "blue",
  "green",
  "yellow",
  "orange",
  "purple",
];

function randomInt(max: number): number {
  if (!Number.isInteger(max) || max <= 0) {
    throw new Error("Invalid random range");
  }

  const limit = Math.floor(256 / max) * max;
  const bytes = new Uint8Array(1);

  do {
    crypto.getRandomValues(bytes);
  } while (bytes[0] >= limit);

  return bytes[0] % max;
}

function generateCode(): string {
  const bytes = new Uint8Array(8);
  crypto.getRandomValues(bytes);

  const value = Array.from(bytes)
    .map((b) => b.toString(36).toUpperCase().padStart(2, "0"))
    .join("");

  return `NINJA-${value.slice(0, 5)}-${value.slice(5, 10)}`;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", {
      headers: corsHeaders,
    });
  }

  if (req.method !== "POST") {
    return new Response(
      JSON.stringify({ error: "Method not allowed" }),
      {
        status: 405,
        headers: corsHeaders,
      },
    );
  }

  try {
    const body = await req.json();
    const diceCount = Number(body?.diceCount);

    if (
      !Number.isInteger(diceCount) ||
      diceCount < 1 ||
      diceCount > 6
    ) {
      return new Response(
        JSON.stringify({
          error: "diceCount must be an integer between 1 and 6",
        }),
        {
          status: 400,
          headers: corsHeaders,
        },
      );
    }

    const result = Array.from(
      { length: diceCount },
      () => colours[randomInt(colours.length)],
    );

    const code = generateCode();

    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

    if (!supabaseUrl || !serviceRoleKey) {
      throw new Error("Supabase server configuration is missing");
    }

    const supabase = createClient(
      supabaseUrl,
      serviceRoleKey,
      {
        auth: {
          autoRefreshToken: false,
          persistSession: false,
        },
      },
    );

    const { error } = await supabase
      .from("rolls")
      .insert({
        code,
        colours: result,
      });

    if (error) {
      console.error(error);

      return new Response(
        JSON.stringify({
          error: "Could not save verified roll",
        }),
        {
          status: 500,
          headers: corsHeaders,
        },
      );
    }

    return new Response(
      JSON.stringify({
        code,
        colours: result,
      }),
      {
        status: 200,
        headers: corsHeaders,
      },
    );
  } catch (error) {
    console.error(error);

    return new Response(
      JSON.stringify({
        error: "Invalid request",
      }),
      {
        status: 400,
        headers: corsHeaders,
      },
    );
  }
});
