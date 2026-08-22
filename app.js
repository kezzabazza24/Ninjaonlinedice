import {createClient} from "https://esm.sh/@supabase/supabase-js@2";
import {SUPABASE_URL,SUPABASE_ANON_KEY} from "./config.js";
const db=createClient(SUPABASE_URL,SUPABASE_ANON_KEY);
const colours=["red","blue","green","yellow","orange","purple"];
const stage=document.querySelector("#diceStage"), history=document.querySelector("#rollHistory");
function secureColour(){const a=new Uint32Array(1),l=Math.floor(4294967296/6)*6;do{crypto.getRandomValues(a)}while(a[0]>=l);return colours[a[0]%6]}
function code(){const a=new Uint32Array(2);crypto.getRandomValues(a);return "NINJA-"+[...a].map(x=>x.toString(36).toUpperCase().slice(0,5).padStart(5,"0")).join("-")}
function showDice(r){stage.innerHTML=r.map(c=>`<div class="die ${c}"></div>`).join("")}
function dots(r){return r.map(c=>`<i class="dot ${c}"></i>`).join("")}
async function load(){const {data,error}=await db.from("rolls").select("*").order("created_at",{ascending:false}).limit(20);if(error){history.textContent="Database not connected yet.";return}history.innerHTML=data.map((x,i)=>`<div class="history-item"><b>#${data.length-i}</b><span class="dots">${dots(x.colours)}</span><time>${new Date(x.created_at).toLocaleString()}</time></div>`).join("");}
document.querySelector("#rollBtn").onclick=async()=>{const btn=document.querySelector("#rollBtn");btn.disabled=true;const roll=[secureColour(),secureColour(),secureColour(),secureColour()];showDice(roll);const c=code();document.querySelector("#code").textContent=c;document.querySelector("#rollStatus").textContent="Saving verified roll…";const {error}=await db.from("rolls").insert({code:c,colours:roll});document.querySelector("#rollStatus").textContent=error?"Roll created, but database needs configuring.":"✓ Roll saved and verifiable.";btn.disabled=false;load()}
document.querySelector("#copyBtn").onclick=()=>navigator.clipboard.writeText(document.querySelector("#code").textContent);
document.querySelector("#privacyToggle").onchange=e=>document.querySelector("#privacy").classList.toggle("on",e.target.checked);
const channel=db.channel("presence",{config:{presence:{key:crypto.randomUUID()}}});channel.on("presence",{event:"sync"},()=>document.querySelector("#activePlayers").textContent=Object.keys(channel.presenceState()).length).subscribe(async s=>{if(s==="SUBSCRIBED")await channel.track({online_at:new Date().toISOString()})});
showDice(["red","blue","green","purple"]);load();db.channel("roll-updates").on("postgres_changes",{event:"INSERT",schema:"public",table:"rolls"},load).subscribe();