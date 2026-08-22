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

async function load(){
  const {data,error}=await db.from("rolls").select("*").order("created_at",{ascending:false}).limit(20);
  if(error){history.textContent="Database not connected yet.";return}
  history.innerHTML=data.map((x,i)=>`<div class="history-item"><b>#${data.length-i}</b><span class="dots">${dots(x.colours)}</span><time>${new Date(x.created_at).toLocaleString()}</time></div>`).join("");
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

  const {error}=await db.from("rolls").insert({code:c,colours:roll});
  document.querySelector("#rollStatus").textContent=error
    ?"Roll completed, but the verified result could not be saved."
    :"✓ Roll complete and saved as a verified result.";

  rollBtn.disabled=false;
  rollBtn.textContent="✦ ROLL 4 DICE ✦";
  rolling=false;
  load();
};

document.querySelector("#copyBtn").onclick=()=>navigator.clipboard.writeText(document.querySelector("#code").textContent);
document.querySelector("#privacyToggle").onchange=e=>document.querySelector("#privacy").classList.toggle("on",e.target.checked);

const channel=db.channel("presence",{config:{presence:{key:crypto.randomUUID()}}});
channel.on("presence",{event:"sync"},()=>{
  document.querySelector("#activePlayers").textContent=Object.keys(channel.presenceState()).length;
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
