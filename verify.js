import {createClient} from "https://esm.sh/@supabase/supabase-js@2";
import {SUPABASE_URL,SUPABASE_ANON_KEY} from "./config.js";
const db=createClient(SUPABASE_URL,SUPABASE_ANON_KEY),out=document.querySelector("#verifyResult");
document.querySelector("#verifyBtn").onclick=async()=>{
 const c=document.querySelector("#verifyInput").value.trim().toUpperCase();
 out.textContent="Checking…";
 if(!/^NINJA-[A-Z0-9]{5}-[A-Z0-9]{5}$/.test(c)){out.className="verify-result invalid";out.innerHTML="<h2>✕ INVALID ID</h2><p>Enter a valid Ninja verification ID.</p>";return}
 const {data,error}=await db.rpc("verify_roll",{p_code:c});
 const row=Array.isArray(data)?data[0]:null;
 if(error||!row){out.className="verify-result invalid";out.innerHTML="<h2>✕ ROLL NOT FOUND</h2><p>Check the verification ID and try again.</p>";return}
 const colours=Array.isArray(row.colours)?row.colours:[];
 out.className="verify-result verified";
 out.innerHTML=`<h2>✓ VERIFIED — LEGIT ROLL</h2><p><b>${row.code}</b></p><div class="result-dice">${colours.map(x=>`<div class="die ${x}"></div>`).join("")}</div><p>Rolled: ${new Date(row.created_at).toLocaleString()}</p>`;
};
