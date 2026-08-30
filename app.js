import {createClient} from "https://esm.sh/@supabase/supabase-js@2";
import {SUPABASE_URL,SUPABASE_ANON_KEY} from "./config.js";

const db=createClient(SUPABASE_URL,SUPABASE_ANON_KEY);
const colours=["red","blue","green","yellow","orange","purple"];
const stage=document.querySelector("#diceStage");
const history=document.querySelector("#rollHistory");
const rollBtn=document.querySelector("#rollBtn");
let rolling=false;

function secureColour(){
  const a=new Uint32Array(1), limit=Math.floor(4294967296/colours.length)*colours.length;
  do{crypto.getRandomValues(a)}while(a[0]>=limit);
  return colours[a[0]%colours.length];
}
function makeCode(){
  const a=new Uint32Array(2); crypto.getRandomValues(a);
  return "NINJA-"+[...a].map(x=>x.toString(36).toUpperCase().slice(0,5).padStart(5,"0")).join("-");
}
function renderDice(results,rollingState=false){
  stage.innerHTML=results.map((c,i)=>`<div class="die ${c}${rollingState?' rolling-die':''}" style="animation-delay:${i*0.04}s"></div>`).join("");
}
function playRollSound(){
  const AudioCtx=window.AudioContext||window.webkitAudioContext;if(!AudioCtx)return;
  const ctx=new AudioCtx(),now=ctx.currentTime;
  for(let i=0;i<11;i++){
    const t=now+i*.075,osc=ctx.createOscillator(),gain=ctx.createGain();
    osc.type="triangle";osc.frequency.setValueAtTime(150+Math.random()*300,t);osc.frequency.exponentialRampToValueAtTime(65,t+.05);
    gain.gain.setValueAtTime(.0001,t);gain.gain.exponentialRampToValueAtTime(.08,t+.008);gain.gain.exponentialRampToValueAtTime(.0001,t+.055);
    osc.connect(gain).connect(ctx.destination);osc.start(t);osc.stop(t+.06);
  }
  setTimeout(()=>ctx.close(),1200);
}
function dots(r){return r.map(c=>`<i class="dot ${c}"></i>`).join("")}
const KEY="ninjaPersonalRolls";
function getPersonalRolls(){try{const v=JSON.parse(localStorage.getItem(KEY)||"[]");return Array.isArray(v)?v:[]}catch{return[]}}
function savePersonalRoll(r){const rolls=getPersonalRolls();rolls.unshift(r);localStorage.setItem(KEY,JSON.stringify(rolls.slice(0,20)))}
function renderPersonalRolls(){
  if(!history)return;const rolls=getPersonalRolls();
  history.innerHTML=rolls.length?rolls.map(x=>{
    const when=x.created_at?new Date(x.created_at).toLocaleTimeString([], {hour:"2-digit",minute:"2-digit",second:"2-digit"}):"Just now";
    return `<div class="history-item"><time>${when}</time><span class="dots">${dots(Array.isArray(x.colours)?x.colours:[])}</span><code class="history-code">${x.code||"NO CODE"}</code></div>`;
  }).join(""):"<div class=\"history-empty\">No rolls yet — your last 20 rolls will appear here.</div>";
}
async function loadStats(){
  try{
    const {count,error}=await db.from("rolls").select("*",{count:"exact",head:true});
    if(!error&&document.querySelector("#totalRolls"))document.querySelector("#totalRolls").textContent=(count||0).toLocaleString();
    const start=new Date();start.setHours(0,0,0,0);
    const {count:today,error:todayError}=await db.from("rolls").select("*",{count:"exact",head:true}).gte("created_at",start.toISOString());
    if(!todayError&&document.querySelector("#rollsToday"))document.querySelector("#rollsToday").textContent=(today||0).toLocaleString();
  }catch(e){console.error(e)}
}
const wait=ms=>new Promise(r=>setTimeout(r,ms));

rollBtn?.addEventListener("click",async()=>{
  if(rolling)return;rolling=true;rollBtn.disabled=true;rollBtn.textContent="🎲 ROLLING...";
  document.querySelector("#rollStatus").textContent="Rolling the dice...";playRollSound();stage.classList.add("is-rolling");
  const start=Date.now();while(Date.now()-start<1000){renderDice([secureColour(),secureColour(),secureColour(),secureColour()],true);await wait(80)}
  const roll=[secureColour(),secureColour(),secureColour(),secureColour()];renderDice(roll);stage.classList.remove("is-rolling");
  const c=makeCode();document.querySelector("#code").textContent=c;document.querySelector("#rollStatus").textContent="Saving verified roll…";
  const created_at=new Date().toISOString();const {error}=await db.from("rolls").insert({code:c,colours:roll,created_at});
  if(!error)savePersonalRoll({code:c,colours:roll,created_at});
  document.querySelector("#rollStatus").textContent=error?"Roll completed, but the verified result could not be saved.":"✓ Roll complete and saved as a verified result.";
  rollBtn.disabled=false;rollBtn.textContent="✦ ROLL 4 DICE ✦";rolling=false;renderPersonalRolls();loadStats();
});

document.querySelector("#copyBtn")?.addEventListener("click",async()=>{const value=document.querySelector("#code").textContent;if(value==="ROLL TO GENERATE")return;try{await navigator.clipboard.writeText(value);const b=document.querySelector("#copyBtn"),old=b.textContent;b.textContent="COPIED ✓";setTimeout(()=>b.textContent=old,1200)}catch{}});
document.querySelector("#privacyToggle")?.addEventListener("change",e=>{document.querySelector("#privacy").classList.toggle("on",e.target.checked);});

const channel=db.channel("presence",{config:{presence:{key:crypto.randomUUID()}}});
channel.on("presence",{event:"sync"},()=>{const count=Object.keys(channel.presenceState()).length;document.querySelector("#activePlayers").textContent=count;document.querySelector("#onlineStat").textContent=count});
channel.subscribe(async s=>{if(s==="SUBSCRIBED")await channel.track({online_at:new Date().toISOString()})});

const scoreValue=document.querySelector("#scoreValue"),plus=document.querySelector("#scorePlus"),minus=document.querySelector("#scoreMinus"),plus10=document.querySelector("#scorePlus10"),minus10=document.querySelector("#scoreMinus10"),reset=document.querySelector("#scoreReset");
let pickScore=Number(localStorage.getItem("ninjaPickScore")||0);if(!Number.isFinite(pickScore))pickScore=0;
function updateScore(){scoreValue.textContent=pickScore>0?`+${pickScore}`:pickScore;scoreValue.classList.toggle("positive",pickScore>0);scoreValue.classList.toggle("negative",pickScore<0);localStorage.setItem("ninjaPickScore",pickScore)}
plus?.addEventListener("click",()=>{pickScore++;updateScore()});minus?.addEventListener("click",()=>{pickScore--;updateScore()});plus10?.addEventListener("click",()=>{pickScore+=10;updateScore()});minus10?.addEventListener("click",()=>{pickScore-=10;updateScore()});reset?.addEventListener("click",()=>{pickScore=0;updateScore()});updateScore();

const qInput=document.querySelector("#quickVerifyCode"),qBtn=document.querySelector("#quickVerifyBtn"),qOut=document.querySelector("#quickVerifyResult");
qBtn?.addEventListener("click",async()=>{const value=(qInput?.value||"").trim().toUpperCase();if(!value){qOut.textContent="Enter a verification code first.";return}qOut.textContent="Checking…";const {data,error}=await db.from("rolls").select("*").eq("code",value).maybeSingle();if(error){qOut.textContent="Could not check this code right now.";return}if(!data){qOut.textContent="No verified roll was found with that code.";return}qOut.innerHTML=`✓ VERIFIED <span class="dots">${dots(Array.isArray(data.colours)?data.colours:[])}</span>`});

renderDice(["red","blue","green","purple"]);renderPersonalRolls();loadStats();
