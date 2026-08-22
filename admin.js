import {createClient} from "https://esm.sh/@supabase/supabase-js@2";
import {SUPABASE_URL,SUPABASE_ANON_KEY} from "./config.js";
const db=createClient(SUPABASE_URL,SUPABASE_ANON_KEY);
const $=s=>document.querySelector(s);

async function showDashboard(){
  const {data:{user}}=await db.auth.getUser();
  if(!user){$("#loginPanel").classList.remove("hidden");$("#dashboard").classList.add("hidden");return}
  $("#loginPanel").classList.add("hidden");$("#dashboard").classList.remove("hidden");
  $("#adminEmail").textContent=user.email;
  const {data,error}=await db.from("rolls").select("*").order("created_at",{ascending:false}).limit(100);
  if(error){$("#adminRolls").textContent="You are signed in, but your account is not allowed to read admin data yet.";return}
  $("#totalRolls").textContent=data.length;
  const today=new Date().toDateString();
  $("#todayRolls").textContent=data.filter(x=>new Date(x.created_at).toDateString()===today).length;
  $("#lastRoll").textContent=data[0]?new Date(data[0].created_at).toLocaleTimeString():"—";
  $("#adminRolls").innerHTML=data.slice(0,25).map(x=>`<div class="admin-roll"><code>${x.code}</code><span>${x.colours.join(" • ")}</span><time>${new Date(x.created_at).toLocaleString()}</time></div>`).join("");
}

$("#loginBtn").onclick=async()=>{
  const email=$("#email").value.trim(),password=$("#password").value;
  $("#loginMessage").textContent="Signing in…";
  const {error}=await db.auth.signInWithPassword({email,password});
  $("#loginMessage").textContent=error?error.message:"";
  if(!error)showDashboard();
};
$("#logoutBtn").onclick=async()=>{await db.auth.signOut();showDashboard()};
showDashboard();