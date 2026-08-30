import {createClient} from "https://esm.sh/@supabase/supabase-js@2";
import {SUPABASE_URL,SUPABASE_ANON_KEY} from "./config.js";
const db=createClient(SUPABASE_URL,SUPABASE_ANON_KEY),out=document.querySelector("#verifyResult");
document.querySelector("#verifyBtn").onclick=async()=>{
 const c=document.querySelector("#verifyInput").value.trim().toUpperCase();out.textContent="Checking…";
 const {data,error}=await db.from("rolls").select("*").eq("code",c).maybeSingle();
 if(error||!data){out.className="verify-result invalid";out.innerHTML="<h2>✕ ROLL NOT FOUND</h2><p>Check the verification ID and try again.</p>";return}
 out.className="verify-result verified";out.innerHTML=`<h2>✓ VERIFIED — LEGIT ROLL</h2><p><b>${data.code}</b></p><div class="result-dice">${data.colours.map(x=>`<div class="die ${x}"></div>`).join("")}</div><p>Rolled: ${new Date(data.created_at).toLocaleString()}</p>`;
};
