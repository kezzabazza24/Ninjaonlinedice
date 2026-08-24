import {createClient} from "https://esm.sh/@supabase/supabase-js@2";
import {SUPABASE_URL,SUPABASE_ANON_KEY} from "./config.js";
const db=createClient(SUPABASE_URL,SUPABASE_ANON_KEY);
const $=s=>document.querySelector(s);

async function loadVipMembers(){
  const box=$("#vipMembers"); if(!box) return;
  const {data,error}=await db.from("vip_members").select("*").order("created_at",{ascending:true});
  if(error){box.textContent="VIP members could not load. Run supabase-vip-members.sql first.";return}
  box.innerHTML=data.length?data.map(m=>`<div class="vip-member-row">
    <div><b>${m.display_name}</b><small>/${m.page_slug} · ${m.user_id}</small></div>
    <button class="remove-vip" data-id="${m.user_id}">REMOVE</button>
  </div>`).join(""):"<p class='muted'>No VIP members yet.</p>";
  document.querySelectorAll(".remove-vip").forEach(b=>b.onclick=async()=>{
    if(!confirm("Remove this VIP member?")) return;
    const {error}=await db.from("vip_members").delete().eq("user_id",b.dataset.id);
    $("#vipMemberMessage").textContent=error?error.message:"VIP member removed.";
    loadVipMembers();
  });
}

async function showDashboard(){
  const {data:{user}}=await db.auth.getUser();
  if(!user){$("#loginPanel").classList.remove("hidden");$("#dashboard").classList.add("hidden");return}
  $("#loginPanel").classList.add("hidden");$("#dashboard").classList.remove("hidden");
  $("#adminEmail").textContent=user.email;
  const {data,error}=await db.from("rolls").select("*").order("created_at",{ascending:false}).limit(100);
  if(error){$("#adminRolls").textContent="You are signed in, but your account is not allowed to read VIP control data yet.";return}
  $("#totalRolls").textContent=data.length;
  const today=new Date().toDateString();
  $("#todayRolls").textContent=data.filter(x=>new Date(x.created_at).toDateString()===today).length;
  $("#lastRoll").textContent=data[0]?new Date(data[0].created_at).toLocaleTimeString():"—";
  $("#adminRolls").innerHTML=data.slice(0,25).map(x=>`<div class="admin-roll"><code>${x.code}</code><span>${x.colours.join(" • ")}</span><time>${new Date(x.created_at).toLocaleString()}</time></div>`).join("");
  loadVipMembers();
}

$("#loginBtn").onclick=async()=>{
  const email=$("#email").value.trim(),password=$("#password").value;
  $("#loginMessage").textContent="Signing in…";
  const {error}=await db.auth.signInWithPassword({email,password});
  $("#loginMessage").textContent=error?error.message:"";
  if(!error)showDashboard();
};
$("#logoutBtn").onclick=async()=>{await db.auth.signOut();showDashboard()};

$("#addVipBtn")?.addEventListener("click",async()=>{
  const user_id=$("#vipUserId").value.trim();
  const display_name=$("#vipDisplayName").value.trim();
  const page_slug=$("#vipSlug").value.trim().toLowerCase().replace(/[^a-z0-9-]/g,"");
  if(!user_id||!display_name||!page_slug){$("#vipMemberMessage").textContent="Please enter the UUID, display name and page slug.";return}
  $("#vipMemberMessage").textContent="Adding VIP member…";
  const {error}=await db.from("vip_members").insert({user_id,display_name,page_slug});
  $("#vipMemberMessage").textContent=error?error.message:"VIP member added successfully.";
  if(!error){$("#vipUserId").value="";$("#vipDisplayName").value="";$("#vipSlug").value="";loadVipMembers()}
});
showDashboard();