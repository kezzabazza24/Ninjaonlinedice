import {createClient} from "https://esm.sh/@supabase/supabase-js@2";
import {SUPABASE_URL,SUPABASE_ANON_KEY} from "./config.js";
const db=createClient(SUPABASE_URL,SUPABASE_ANON_KEY);
const $=s=>document.querySelector(s);

let currentVip=null;
async function refreshAccess(){
 const {data:{user}}=await db.auth.getUser();
 if(!user){
   currentVip=null;
   $("#vipLoginPanel").classList.remove("hidden");
   $("#vipArena").classList.add("hidden");
   return false;
 }
 const {data:member,error}=await db.from("vip_members").select("*").eq("user_id",user.id).maybeSingle();
 if(error || !member){
   currentVip=null;
   $("#vipLoginPanel").classList.remove("hidden");
   $("#vipArena").classList.add("hidden");
   return false;
 }
 currentVip=member;
 document.querySelectorAll("[data-vip-name]").forEach(el=>el.textContent=member.display_name || "VIP MEMBER");
 document.title = `${member.display_name || "VIP Member"} | Ninja Online Dice`;
 const colourControls=$(".vip-colour-controls");
 if(colourControls) colourControls.classList.toggle("vip-eliminator-hidden", member.show_colour_eliminator !== true);
 $("#vipLoginPanel").classList.add("hidden");
 $("#vipArena").classList.remove("hidden");
 return true;
}

$("#vipLoginBtn").onclick=async()=>{
 const email=$("#vipEmail").value.trim().toLowerCase(),password=$("#vipPassword").value;
 $("#vipLoginMessage").textContent="Checking VIP access…";
 const {error}=await db.auth.signInWithPassword({email,password});
 if(error){$("#vipLoginMessage").textContent="Login failed. Check your email and password.";return}
 const allowed=await refreshAccess();
 if(!allowed){
   await db.auth.signOut();
   $("#vipLoginMessage").textContent="This account does not have VIP access.";
   return;
 }
 $("#vipLoginMessage").textContent="";
};
$("#vipLogoutBtn").onclick=async()=>{await db.auth.signOut();refreshAccess()};

const colours=["red","blue","green","yellow","orange","purple"];
const stage=$("#vipDiceStage"), btn=$("#vipRollBtn"); let rolling=false;
function availableColours(){
  const blocked=[...document.querySelectorAll(".colour-toggle input:checked")].map(x=>x.value);
  const available=colours.filter(c=>!blocked.includes(c));
  return available.length?available:colours;
}
function pick(){
  const options=availableColours(), a=new Uint32Array(1),limit=Math.floor(4294967296/options.length)*options.length;
  do{crypto.getRandomValues(a)}while(a[0]>=limit);
  return options[a[0]%options.length];
}
function makeCode(){const a=new Uint32Array(2);crypto.getRandomValues(a);return "VIP-"+[...a].map(x=>x.toString(36).toUpperCase().slice(0,5).padStart(5,"0")).join("-")}
function draw(r,spin=false){stage.innerHTML=r.map((c,i)=>`<div class="die ${c}${spin?" rolling-die":""}" style="--delay:${i*.04}s"></div>`).join("")}
function sound(){
 const C=window.AudioContext||window.webkitAudioContext;if(!C)return;
 const c=new C(),n=c.currentTime;
 if(c.state==='suspended')c.resume();
 // Fast neon "dice machine" sweep while rolling.
 const master=c.createGain();master.gain.value=.72;master.connect(c.destination);
 for(let i=0;i<12;i++){
   const t=n+i*.075,o=c.createOscillator(),g=c.createGain();
   o.type=i%3===0?'square':'triangle';
   o.frequency.setValueAtTime(110+i*24+Math.random()*70,t);
   o.frequency.exponentialRampToValueAtTime(65+Math.random()*35,t+.055);
   g.gain.setValueAtTime(.0001,t);g.gain.exponentialRampToValueAtTime(.07,t+.006);g.gain.exponentialRampToValueAtTime(.0001,t+.06);
   o.connect(g).connect(master);o.start(t);o.stop(t+.065);
 }
 // Bright three-note VIP chime at the end.
 [523.25,659.25,783.99].forEach((f,i)=>{
   const t=n+1.02+i*.11,o=c.createOscillator(),g=c.createGain();o.type='sine';o.frequency.value=f;
   g.gain.setValueAtTime(.0001,t);g.gain.exponentialRampToValueAtTime(.11,t+.015);g.gain.exponentialRampToValueAtTime(.0001,t+.42);
   o.connect(g).connect(master);o.start(t);o.stop(t+.44);
 });
 setTimeout(()=>c.close(),1900);
}
const wait=ms=>new Promise(r=>setTimeout(r,ms));
btn.onclick=async()=>{if(rolling)return;rolling=true;btn.disabled=true;btn.textContent="⚡ VIP ROLLING...";sound();stage.classList.add("is-rolling");const start=Date.now();while(Date.now()-start<1000){draw([pick(),pick(),pick(),pick()],true);await wait(85)}const roll=[pick(),pick(),pick(),pick()];draw(roll);stage.classList.remove("is-rolling");const code=makeCode();$("#vipCode").textContent=code;$("#vipStatus").textContent="Saving VIP verified roll…";const {error}=await db.from("rolls").insert({code,colours:roll});$("#vipStatus").textContent=error?"VIP roll completed but could not be saved.":"✓ VIP roll verified and saved.";btn.disabled=false;btn.textContent="👑 ROLL VIP DICE 👑";rolling=false};
draw(["purple","yellow","red","blue"]);
refreshAccess();


const vipClock=$("#vipClock");
function updateVipClock(){ if(vipClock) vipClock.textContent=new Date().toLocaleTimeString("en-GB",{hour12:false}); }
updateVipClock(); setInterval(updateVipClock,1000);
document.querySelector(".vip-reset")?.addEventListener("click",()=>document.querySelectorAll(".colour-toggle input").forEach(x=>x.checked=false));

// VIP privacy mode: soften/blur the dice without hiding their colours.
const vipPrivacyToggle=$("#vipPrivacyToggle");
const vipDiceCard=document.querySelector(".vip-dice-card");
function updateVipPrivacy(){
  if(!vipDiceCard)return;
  vipDiceCard.classList.toggle("vip-privacy-on",!!vipPrivacyToggle?.checked);
}
vipPrivacyToggle?.addEventListener("change",updateVipPrivacy);
updateVipPrivacy();
