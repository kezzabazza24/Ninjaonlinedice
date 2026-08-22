import {createClient} from "https://esm.sh/@supabase/supabase-js@2";
import {SUPABASE_URL,SUPABASE_ANON_KEY} from "./config.js";
const db=createClient(SUPABASE_URL,SUPABASE_ANON_KEY);
const colours=["red","blue","green","yellow","orange","purple"];
const stage=document.querySelector("#vipDiceStage"), btn=document.querySelector("#vipRollBtn");
let rolling=false;
function pick(){const a=new Uint32Array(1),limit=Math.floor(4294967296/6)*6;do{crypto.getRandomValues(a)}while(a[0]>=limit);return colours[a[0]%6]}
function makeCode(){const a=new Uint32Array(2);crypto.getRandomValues(a);return "VIP-"+[...a].map(x=>x.toString(36).toUpperCase().slice(0,5).padStart(5,"0")).join("-")}
function draw(r,spin=false){stage.innerHTML=r.map((c,i)=>`<div class="die ${c}${spin?" rolling-die":""}" style="--delay:${i*.04}s"></div>`).join("")}
function sound(){const C=window.AudioContext||window.webkitAudioContext;if(!C)return;const c=new C(),n=c.currentTime;for(let i=0;i<11;i++){const o=c.createOscillator(),g=c.createGain(),t=n+i*.085;o.type="triangle";o.frequency.setValueAtTime(170+Math.random()*220,t);o.frequency.exponentialRampToValueAtTime(70,t+.055);g.gain.setValueAtTime(.0001,t);g.gain.exponentialRampToValueAtTime(.09,t+.008);g.gain.exponentialRampToValueAtTime(.0001,t+.06);o.connect(g).connect(c.destination);o.start(t);o.stop(t+.065)}setTimeout(()=>c.close(),1300)}
const wait=ms=>new Promise(r=>setTimeout(r,ms));
btn.onclick=async()=>{if(rolling)return;rolling=true;btn.disabled=true;btn.textContent="⚡ VIP ROLLING...";sound();stage.classList.add("is-rolling");const start=Date.now();while(Date.now()-start<1000){draw([pick(),pick(),pick(),pick()],true);await wait(85)}const roll=[pick(),pick(),pick(),pick()];draw(roll);stage.classList.remove("is-rolling");const code=makeCode();document.querySelector("#vipCode").textContent=code;document.querySelector("#vipStatus").textContent="Saving VIP verified roll…";const {error}=await db.from("rolls").insert({code,colours:roll});document.querySelector("#vipStatus").textContent=error?"VIP roll completed but could not be saved.":"✓ VIP roll verified and saved.";btn.disabled=false;btn.textContent="👑 ROLL VIP DICE 👑";rolling=false};
draw(["purple","yellow","red","blue"]);