// supabase/functions/create-roll/index.ts
// Deploy with: supabase functions deploy create-roll
import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const colours=["red","blue","green","yellow","orange","purple"];

function randomIndex(){
  const a=new Uint32Array(1);
  const limit=Math.floor(4294967296/colours.length)*colours.length;
  do crypto.getRandomValues(a); while(a[0]>=limit);
  return a[0]%colours.length;
}
function makeCode(){
  const a=new Uint32Array(2); crypto.getRandomValues(a);
  return "NINJA-"+[...a].map(x=>x.toString(36).toUpperCase().slice(0,5).padStart(5,"0")).join("-");
}

serve(async () => {
  const supabase=createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
  );
  const roll=[colours[randomIndex()],colours[randomIndex()],colours[randomIndex()],colours[randomIndex()]];
  const code=makeCode();
  const {data,error}=await supabase.from("rolls").insert({code,colours:roll}).select().single();
  if(error) return Response.json({error:error.message},{status:500});
  return Response.json(data,{headers:{"Access-Control-Allow-Origin":"https://ninjadice.co.uk"}});
});
