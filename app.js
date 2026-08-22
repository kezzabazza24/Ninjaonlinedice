const colours=['red','blue','green','yellow','orange','purple'];
const stage=document.querySelector('#diceStage');
const historyKey='ninjaVividLast20';
let total=Number(localStorage.getItem('ninjaVividTotal')||0);

function secureIndex(){
  const a=new Uint32Array(1), limit=Math.floor(4294967296/colours.length)*colours.length;
  do{crypto.getRandomValues(a)}while(a[0]>=limit);
  return a[0]%colours.length;
}
function makeCode(){
  const a=new Uint32Array(2);crypto.getRandomValues(a);
  return 'NINJA-'+[...a].map(x=>x.toString(36).toUpperCase().slice(0,5).padStart(5,'0')).join('-');
}
function diceHTML(roll){stage.innerHTML=roll.map(c=>`<div class="die ${c}"></div>`).join('')}
function renderHistory(){
  const target=document.querySelector('#rollHistory');
  const history=JSON.parse(localStorage.getItem(historyKey)||'[]');
  if(!history.length){target.innerHTML='<div class="history-item">—<span>No rolls yet</span><span></span><span></span></div>';return;}
  target.innerHTML=history.map((item,i)=>{
    const dots=item.roll.map(c=>`<i class="dot ${c}"></i>`).join('');
    const time=new Date(item.time).toLocaleTimeString([], {hour:'2-digit',minute:'2-digit',second:'2-digit'});
    return `<div class="history-item"><b>${20-i}</b><span class="roll-dots">${dots}</span><span class="history-time">${time}</span><span class="history-code">${item.code}</span></div>`;
  }).join('');
}
function saveRoll(roll,code){
  const history=JSON.parse(localStorage.getItem(historyKey)||'[]');
  history.unshift({roll,code,time:new Date().toISOString()});
  localStorage.setItem(historyKey,JSON.stringify(history.slice(0,20)));
}
function updateStats(){
  document.querySelector('#totalRolls').textContent=total.toLocaleString();
  document.querySelector('#todayRolls').textContent=total.toLocaleString();
  document.querySelector('#verifiedRolls').textContent=total.toLocaleString();
}
document.querySelector('#rollBtn').onclick=async()=>{
  const btn=document.querySelector('#rollBtn');btn.disabled=true;
  const rolling=['red','blue','green','purple'];diceHTML(rolling);
  document.querySelectorAll('.die').forEach(d=>d.classList.add('rolling'));
  await new Promise(r=>setTimeout(r,850));
  const roll=Array.from({length:4},()=>colours[secureIndex()]);
  diceHTML(roll);
  const code=makeCode();
  document.querySelector('#code').textContent=code;
  saveRoll(roll,code);total++;localStorage.setItem('ninjaVividTotal',total);
  updateStats();renderHistory();btn.disabled=false;
};
document.querySelector('#copyBtn').onclick=async()=>{const c=document.querySelector('#code').textContent;if(c!=='ROLL TO GENERATE'){await navigator.clipboard.writeText(c);document.querySelector('#copyBtn').textContent='✓ COPIED';setTimeout(()=>document.querySelector('#copyBtn').textContent='▣  COPY CODE',1200)}};
setInterval(()=>document.querySelector('#clock').textContent=new Date().toLocaleTimeString([], {hour12:false}),1000);
diceHTML(['red','blue','green','purple']);renderHistory();updateStats();
