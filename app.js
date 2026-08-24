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

function code(){
  const a=new Uint32Array(2);
  crypto.getRandomValues(a);
  return "NINJA-"+[...a].map(x=>x.toString(36).toUpperCase().slice(0,5).padStart(5,"0")).join("-");
}

function renderDice(results, rollingState=false){
  stage.innerHTML=results.map((c,i)=>`<div class="die ${c}${rollingState?' rolling-die':''}" style="--delay:${i*0.04}s"></div>`).join("");
}

function playRollSound(){
  // Web Audio sound effect: no external audio file is required.
  const AudioCtx=window.AudioContext||window.webkitAudioContext;
  if(!AudioCtx) return;
  const ctx=new AudioCtx();
  const now=ctx.currentTime;
  for(let i=0;i<11;i++){
    const t=now+i*0.085;
    const osc=ctx.createOscillator();
    const gain=ctx.createGain();
    osc.type="triangle";
    osc.frequency.setValueAtTime(170+(Math.random()*220),t);
    osc.frequency.exponentialRampToValueAtTime(70,t+0.055);
    gain.gain.setValueAtTime(0.0001,t);
    gain.gain.exponentialRampToValueAtTime(0.09,t+0.008);
    gain.gain.exponentialRampToValueAtTime(0.0001,t+0.06);
    osc.connect(gain).connect(ctx.destination);
    osc.start(t); osc.stop(t+0.065);
  }
  setTimeout(()=>ctx.close(),1300);
}

function dots(r){return r.map(c=>`<i class="dot ${c}"></i>`).join("")}

const PERSONAL_ROLLS_KEY="ninjaPersonalRolls";

function getPersonalRolls(){
  try{
    const value=JSON.parse(localStorage.getItem(PERSONAL_ROLLS_KEY)||"[]");
    return Array.isArray(value)?value:[];
  }catch{return []}
}
function savePersonalRoll(roll){
  const rolls=getPersonalRolls();
  rolls.unshift(roll);
  localStorage.setItem(PERSONAL_ROLLS_KEY,JSON.stringify(rolls.slice(0,20)));
}
function renderPersonalRolls(){
  const rolls=getPersonalRolls();
  history.innerHTML=rolls.length
    ? rolls.map(x=>{
        const results=Array.isArray(x.colours)?x.colours:[];
        const when=x.created_at?new Date(x.created_at).toLocaleTimeString([], {hour:"2-digit",minute:"2-digit",second:"2-digit"}):"Just now";
        return `<div class="history-item">
          <time>${when}</time>
          <span class="dots">${dots(results)}</span>
          <code class="history-code">${x.code||"NO CODE"}</code>
        </div>`;
      }).join("")
    : '<div class="history-empty">No rolls yet — your last 20 rolls will appear here.</div>';
}
async function load(){
  renderPersonalRolls();
  try{
    const {count,error}=await db.from("rolls").select("*",{count:"exact",head:true});
    if(!error && document.querySelector("#totalRolls")) document.querySelector("#totalRolls").textContent=(count||0).toLocaleString();
    const startToday=new Date(); startToday.setHours(0,0,0,0);
    const {count:todayCount,error:todayError}=await db.from("rolls").select("*",{count:"exact",head:true}).gte("created_at",startToday.toISOString());
    if(!todayError && document.querySelector("#rollsToday")) document.querySelector("#rollsToday").textContent=(todayCount||0).toLocaleString();
  }catch(error){console.error("Could not load site stats:",error)}
}

function wait(ms){return new Promise(resolve=>setTimeout(resolve,ms))}

rollBtn.onclick=async()=>{
  if(rolling) return;
  rolling=true;
  rollBtn.disabled=true;
  rollBtn.textContent="🎲 ROLLING...";
  document.querySelector("#rollStatus").textContent="Rolling the dice...";

  playRollSound();
  stage.classList.add("is-rolling");

  // Rapidly change colours during the 1-second roll animation.
  const start=Date.now();
  while(Date.now()-start<1000){
    renderDice([secureColour(),secureColour(),secureColour(),secureColour()],true);
    await wait(85);
  }

  // Only after the animation finishes do we generate the final random result.
  const roll=[secureColour(),secureColour(),secureColour(),secureColour()];
  renderDice(roll,false);
  stage.classList.remove("is-rolling");

  const c=code();
  document.querySelector("#code").textContent=c;
  document.querySelector("#rollStatus").textContent="Saving verified roll…";

  const created_at=new Date().toISOString();
  const {error}=await db.from("rolls").insert({code:c,colours:roll,created_at});
  if(!error){
    savePersonalRoll({code:c,colours:roll,created_at});
  }
  document.querySelector("#rollStatus").textContent=error
    ?"Roll completed, but the verified result could not be saved."
    :"✓ Roll complete and saved as a verified result.";

  rollBtn.disabled=false;
  rollBtn.textContent="✦ ROLL 4 DICE ✦";
  rolling=false;
  load();
};

document.querySelector("#copyBtn").onclick=async()=>{
  const value=document.querySelector("#code").textContent;
  if(value==="ROLL TO GENERATE") return;
  try{
    await navigator.clipboard.writeText(value);
    const btn=document.querySelector("#copyBtn");
    const original=btn.textContent;
    btn.textContent="COPIED ✓";
    setTimeout(()=>btn.textContent=original,1200);
  }catch(error){
    console.error("Copy failed:",error);
  }
};
document.querySelector("#privacyToggle").onchange=e=>{
  const enabled=e.target.checked;
  const privacy=document.querySelector("#privacy");
  const wrap=document.querySelector(".dice-wrap");
  privacy.classList.toggle("on",enabled);
  wrap.classList.toggle("privacy-active",enabled);
};

const channel=db.channel("presence",{config:{presence:{key:crypto.randomUUID()}}});
channel.on("presence",{event:"sync"},()=>{
  const count=Object.keys(channel.presenceState()).length;
  document.querySelector("#activePlayers").textContent=count;
  const onlineStat=document.querySelector("#onlineStat");
  if(onlineStat) onlineStat.textContent=count;
  const plural=document.querySelector(".plural");
  if(plural) plural.style.display=count===1?"none":"inline";
}).subscribe(async s=>{
  if(s==="SUBSCRIBED") await channel.track({online_at:new Date().toISOString()});
});

renderDice(["red","blue","green","purple"]);
load();
db.channel("roll-updates")
  .on("postgres_changes",{event:"INSERT",schema:"public",table:"rolls"},load)
  .subscribe();

const liveClock=document.querySelector("#liveClock");
if(liveClock){
  const updateClock=()=>{
    const now=new Date();
    liveClock.textContent=now.toLocaleTimeString([],{
      hour:"2-digit",minute:"2-digit",second:"2-digit",hour12:false
    });
  };
  updateClock();
  setInterval(updateClock,1000);
}

// Personal pick counter — stored locally so each player can track their own session.
const scoreValue=document.querySelector("#scoreValue");
const scorePlus=document.querySelector("#scorePlus");
const scoreMinus=document.querySelector("#scoreMinus");
const scorePlus10=document.querySelector("#scorePlus10");
const scoreMinus10=document.querySelector("#scoreMinus10");
const scoreReset=document.querySelector("#scoreReset");
let pickScore=Number(localStorage.getItem("ninjaPickScore")||0);
if(!Number.isFinite(pickScore)) pickScore=0;
function updatePickScore(){
  scoreValue.textContent=pickScore>0?`+${pickScore}`:pickScore;
  scoreValue.classList.toggle("positive",pickScore>0);
  scoreValue.classList.toggle("negative",pickScore<0);
  scoreValue.classList.toggle("neutral",pickScore===0);
  localStorage.setItem("ninjaPickScore",String(pickScore));
}
scorePlus?.addEventListener("click",()=>{pickScore++;updatePickScore()});
scoreMinus?.addEventListener("click",()=>{pickScore--;updatePickScore()});
scorePlus10?.addEventListener("click",()=>{pickScore+=10;updatePickScore()});
scoreMinus10?.addEventListener("click",()=>{pickScore-=10;updatePickScore()});
scoreReset?.addEventListener("click",()=>{pickScore=0;updatePickScore()});
updatePickScore();

const quickVerifyInput=document.querySelector("#quickVerifyCode");
const quickVerifyBtn=document.querySelector("#quickVerifyBtn");
const quickVerifyResult=document.querySelector("#quickVerifyResult");
quickVerifyBtn?.addEventListener("click",async()=>{
  const value=(quickVerifyInput?.value||"").trim().toUpperCase();
  if(!value){quickVerifyResult.textContent="Enter a verification code first.";return}
  quickVerifyResult.textContent="Checking…";
  const {data,error}=await db.from("rolls").select("*").eq("code",value).maybeSingle();
  if(error){quickVerifyResult.textContent="Could not check this code right now.";return}
  if(!data){quickVerifyResult.textContent="No verified roll was found with that code.";return}
  quickVerifyResult.innerHTML=`✓ Verified: <span class="dots">${dots(Array.isArray(data.colours)?data.colours:[])}</span>`;
});
