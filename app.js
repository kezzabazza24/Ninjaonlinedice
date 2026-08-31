import {createClient} from "https://esm.sh/@supabase/supabase-js@2";
import {SUPABASE_URL,SUPABASE_ANON_KEY} from "./config.js";

const db=createClient(SUPABASE_URL,SUPABASE_ANON_KEY);
const colours=["red","blue","green","yellow","orange","purple"];
const stage=document.querySelector("#diceStage");
const history=document.querySelector("#rollHistory");
const rollBtn=document.querySelector("#rollBtn");
let rolling=false;
let diceCount=Number(localStorage.getItem("ninjaDiceCount")||4);
if(!Number.isInteger(diceCount)||diceCount<1||diceCount>6)diceCount=4;

function secureColour(){
  const a=new Uint32Array(1),limit=Math.floor(4294967296/colours.length)*colours.length;
  do{crypto.getRandomValues(a)}while(a[0]>=limit);
  return colours[a[0]%colours.length];
}
function makeCode(){
  const a=new Uint32Array(2);crypto.getRandomValues(a);
  return "NINJA-"+[...a].map(x=>x.toString(36).toUpperCase().slice(0,5).padStart(5,"0")).join("-");
}
function renderDice(results,rollingState=false){
  stage.innerHTML=results.map((c,i)=>`<div class="die ${c}${rollingState?' rolling-die':''}" style="animation-delay:${i*0.04}s"></div>`).join("");
  stage.dataset.count=results.length;
}
function playRollSound(){
  const AudioCtx=window.AudioContext||window.webkitAudioContext;if(!AudioCtx)return;
  const ctx=new AudioCtx(),now=ctx.currentTime;
  for(let i=0;i<Math.max(7,diceCount*2);i++){
    const t=now+i*.075,osc=ctx.createOscillator(),gain=ctx.createGain();
    osc.type="triangle";osc.frequency.setValueAtTime(150+Math.random()*300,t);osc.frequency.exponentialRampToValueAtTime(65,t+.05);
    gain.gain.setValueAtTime(.0001,t);gain.gain.exponentialRampToValueAtTime(.08,t+.008);gain.gain.exponentialRampToValueAtTime(.0001,t+.055);
    osc.connect(gain).connect(ctx.destination);osc.start(t);osc.stop(t+.06);
  }
  setTimeout(()=>ctx.close(),1200);
}
function dots(r){return r.map(c=>`<i class="dot ${c}"></i>`).join("")}
const KEY="ninjaPersonalRolls";
const SCORE_KEY="ninjaPickScore";
function getPersonalRolls(){try{const v=JSON.parse(localStorage.getItem(KEY)||"[]");return Array.isArray(v)?v:[]}catch{return[]}}
function savePersonalRoll(r){const rolls=getPersonalRolls();rolls.unshift(r);localStorage.setItem(KEY,JSON.stringify(rolls.slice(0,20)))}
function renderPersonalRolls(){
  if(!history)return;const rolls=getPersonalRolls();
  history.innerHTML=rolls.length?rolls.map(x=>{
    const when=x.created_at?new Date(x.created_at).toLocaleTimeString([], {hour:"2-digit",minute:"2-digit",second:"2-digit"}):"Just now";
    return `<div class="history-item"><time>${when}</time><span class="dots">${dots(Array.isArray(x.colours)?x.colours:[])}</span><code class="history-code">${x.code||"NO CODE"}</code><button class="history-copy" data-code="${x.code||""}" type="button">COPY</button></div>`;
  }).join(""):"<div class=\"history-empty\">No rolls yet — your last 20 rolls will appear here.</div>";
}
function updateDiceChoice(){
  document.querySelectorAll("#diceCount button").forEach(b=>b.classList.toggle("selected",Number(b.dataset.count)===diceCount));
  document.querySelector("#rollBtn").textContent=`✦ ROLL ${diceCount} DICE ✦`;
  document.querySelector("#diceStat").textContent=diceCount;
}
function playCount(){return getPersonalRolls().length}
async function loadStats(){
  try{
    const {data,error}=await db.rpc("roll_stats");
    if(error) throw error;
    const stats=data||{};
    if(document.querySelector("#totalRolls"))document.querySelector("#totalRolls").textContent=Number(stats.total||0).toLocaleString();
    if(document.querySelector("#rollsToday"))document.querySelector("#rollsToday").textContent=Number(stats.today||0).toLocaleString();
  }catch(e){console.error(e)}
}
const wait=ms=>new Promise(r=>setTimeout(r,ms));

rollBtn?.addEventListener("click",async()=>{
  if(rolling)return;rolling=true;rollBtn.disabled=true;rollBtn.textContent="🎲 ROLLING...";
  document.querySelector("#rollStatus").textContent="Rolling your dice...";playRollSound();stage.classList.add("is-rolling");
  const start=Date.now();while(Date.now()-start<1000){renderDice(Array.from({length:diceCount},secureColour),true);await wait(80)}
  stage.classList.remove("is-rolling");
  document.querySelector("#code").textContent="SAVING…";document.querySelector("#rollStatus").textContent="Saving verified result…";
  const {data,error}=await db.functions.invoke("create-roll",{body:{diceCount}});
  const saved=data&&data.code&&Array.isArray(data.colours);
  if(saved){
    // The Edge Function is authoritative. Render the exact colours that were saved.
    renderDice(data.colours);
    document.querySelector("#code").textContent=data.code;
    savePersonalRoll(data);
  }
  document.querySelector("#rollStatus").textContent=error||!saved?"Roll completed, but the verified result could not be saved.":"✓ Roll complete and saved as a verified result.";
  const statusEl=document.querySelector("#rollStatus");
  statusEl?.classList.remove("roll-success-pulse");
  if(saved){requestAnimationFrame(()=>statusEl?.classList.add("roll-success-pulse"));}
  document.querySelector("#sessionRolls").textContent=playCount();
  rollBtn.disabled=false;rollBtn.textContent=`✦ ROLL ${diceCount} DICE ✦`;rolling=false;renderPersonalRolls();loadStats();
});

document.querySelector("#copyBtn")?.addEventListener("click",async()=>{const value=document.querySelector("#code").textContent;if(value==="ROLL TO GENERATE")return;try{await navigator.clipboard.writeText(value);const b=document.querySelector("#copyBtn"),old=b.textContent;b.textContent="COPIED ✓";setTimeout(()=>b.textContent=old,1200)}catch{}});
const privacyBtn=document.querySelector("#privacy");
privacyBtn?.addEventListener("click",()=>{
  const on=privacyBtn.classList.toggle("on");
  privacyBtn.setAttribute("aria-pressed",String(on));
  privacyBtn.querySelector("b").textContent=on?"PRIVACY BLUR ON":"PRIVACY BLUR";
  stage.classList.toggle("privacy-blurred",on);
});

const channel=db.channel("presence",{config:{presence:{key:crypto.randomUUID()}}});
channel.on("presence",{event:"sync"},()=>{const count=Object.keys(channel.presenceState()).length;document.querySelector("#activePlayers").textContent=count;document.querySelector("#onlineStat").textContent=count});
channel.subscribe(async s=>{if(s==="SUBSCRIBED")await channel.track({online_at:new Date().toISOString()})});

const scoreValue=document.querySelector("#scoreValue"),plus=document.querySelector("#scorePlus"),minus=document.querySelector("#scoreMinus"),plus10=document.querySelector("#scorePlus10"),minus10=document.querySelector("#scoreMinus10"),reset=document.querySelector("#scoreReset");
let pickScore=Number(localStorage.getItem(SCORE_KEY)||0);if(!Number.isFinite(pickScore))pickScore=0;
function updateScore(){scoreValue.textContent=pickScore>0?`+${pickScore}`:pickScore;scoreValue.classList.toggle("positive",pickScore>0);scoreValue.classList.toggle("negative",pickScore<0);localStorage.setItem(SCORE_KEY,pickScore)}
plus?.addEventListener("click",()=>{pickScore++;updateScore()});minus?.addEventListener("click",()=>{pickScore--;updateScore()});plus10?.addEventListener("click",()=>{pickScore+=10;updateScore()});minus10?.addEventListener("click",()=>{pickScore-=10;updateScore()});reset?.addEventListener("click",()=>{pickScore=0;updateScore()});updateScore();

const qInput=document.querySelector("#quickVerifyCode"),qBtn=document.querySelector("#quickVerifyBtn"),qOut=document.querySelector("#quickVerifyResult");
qBtn?.addEventListener("click",async()=>{const value=(qInput?.value||"").trim().toUpperCase();if(!value){qOut.textContent="Enter a verification code first.";return}qOut.textContent="Checking…";const {data,error}=await db.rpc("verify_roll",{p_code:value});const row=Array.isArray(data)?data[0]:null;if(error){qOut.textContent="Could not check this code right now.";return}if(!row){qOut.textContent="No verified roll was found with that code.";return}qOut.innerHTML=`✓ VERIFIED <span class="dots">${dots(Array.isArray(row.colours)?row.colours:[])}</span>`});

// Dice count selector
for(const button of document.querySelectorAll("#diceCount button"))button.addEventListener("click",()=>{diceCount=Number(button.dataset.count);localStorage.setItem("ninjaDiceCount",diceCount);updateDiceChoice();renderDice(Array.from({length:diceCount},()=>secureColour()))});

// Background selector
const themes=["classic","grid","space","cyber","forest","sunset","dark","ocean"];
function setTheme(theme){if(!themes.includes(theme))theme="classic";document.body.className=`ninja-home theme-${theme}`;localStorage.setItem("ninjaTheme",theme);document.querySelectorAll(".theme-option").forEach(b=>{const active=b.dataset.theme===theme;b.classList.toggle("active",active);b.querySelector("i").textContent=active?"✓":"○"})}
const savedTheme=localStorage.getItem("ninjaTheme")||"classic";setTheme(savedTheme);
document.querySelectorAll(".theme-option").forEach(b=>b.addEventListener("click",()=>setTheme(b.dataset.theme)));
document.querySelector("#randomTheme")?.addEventListener("click",()=>setTheme(themes[Math.floor(Math.random()*themes.length)]));

document.addEventListener("click",async e=>{const btn=e.target.closest(".history-copy");if(!btn)return;try{await navigator.clipboard.writeText(btn.dataset.code);btn.textContent="COPIED";setTimeout(()=>btn.textContent="COPY",1000)}catch{}});

updateDiceChoice();renderDice(Array.from({length:diceCount},()=>secureColour()));renderPersonalRolls();document.querySelector("#sessionRolls").textContent=playCount();loadStats();


/* =========================================================
   LIVE PRESENTATION MODE v1
   Presentation-only UI toggle. Roll/verification logic unchanged.
   ========================================================= */
const liveModeBtn=document.querySelector("#liveModeBtn");
if(liveModeBtn){
  const liveKey="ninjaLivePresentation";
  const setLiveMode=(on)=>{
    document.body.classList.toggle("live-presentation",on);
    liveModeBtn.setAttribute("aria-pressed",String(on));
    liveModeBtn.textContent=on?"◉ EXIT LIVE MODE":"◉ LIVE PRESENTATION MODE";
    try{localStorage.setItem(liveKey,on?"1":"0")}catch{}
  };
  let saved=false;
  try{saved=localStorage.getItem(liveKey)==="1"}catch{}
  setLiveMode(saved);
  liveModeBtn.addEventListener("click",()=>setLiveMode(!document.body.classList.contains("live-presentation")));
}
