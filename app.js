(() => {
const cfg=window.BW_CONFIG||{},$=id=>document.getElementById(id),money=v=>Number(v||0).toLocaleString('en-US',{minimumFractionDigits:2,maximumFractionDigits:2}),esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c])),date=s=>s?new Date(s).toLocaleString([],{month:'short',day:'numeric',hour:'2-digit',minute:'2-digit'}):'—';

function mountNavigation(){
 const root=$('app'),stats=root.querySelector('.stats'),main=root.querySelector('.main-grid'),primary=main.firstElementChild,side=main.querySelector('.side-stack'),primaryPanels=[...primary.children],sidePanels=[...side.children],admin=$('admin-panel'),foot=root.querySelector('.foot');
 const pages=document.createElement('div');pages.className='page-stack';pages.id='page-stack';
 const make=(id)=>{const p=document.createElement('section');p.className='tab-page';p.dataset.page=id;pages.appendChild(p);return p};
 const home=make('home'),wallet=make('wallet'),rank=make('rank'),activity=make('activity'),dashboard=make('dashboard'),platform=make('requests'),adminPage=make('settings');
 home.append(stats,primaryPanels[0]);wallet.append(primaryPanels[1]);rank.append(sidePanels[0]);activity.append(sidePanels[1],sidePanels[2]);
 const adminGrid=admin.querySelector('.admin-grid'),settingsColumn=adminGrid.children[0],platformColumn=adminGrid.children[1];
 const dashboardPanel=document.createElement('section');dashboardPanel.className='panel';dashboardPanel.innerHTML='<div class="panel-head"><div><div class="eyebrow gold">Administrator · overview</div><h2>Control Center Home</h2></div><span class="pill">Live platform metrics</span></div><div id="admin-dashboard-stats" class="admin-dashboard-stats"><div class="empty">Loading platform metrics…</div></div>';
 dashboard.append(dashboardPanel);
 const platformPanel=document.createElement('section');platformPanel.className='panel';
 const platformHead=document.createElement('div');platformHead.className='panel-head';platformHead.innerHTML='<div><div class="eyebrow gold">Administrator · requests</div><h2>Player Requests</h2></div><button id="refresh-admin" class="btn small">Refresh</button>';
 platformPanel.append(platformHead,$('admin-requests'));
 const playersPanel=document.createElement('section');playersPanel.className='panel';playersPanel.innerHTML='<div class="panel-head"><div><div class="eyebrow">Accounts</div><h2>Player Accounts</h2></div></div>';
 playersPanel.append(platformColumn);
 platform.append(platformPanel,playersPanel);
 const requestsDivider=admin.querySelector('.divider');
 const requestsHead=admin.querySelector('.divider + .panel-head');
 if(requestsDivider)requestsDivider.remove();if(requestsHead)requestsHead.remove();
 adminGrid.replaceChildren(settingsColumn);
 adminPage.append(admin);
 main.replaceWith(pages);
 const nav=document.createElement('nav');nav.className='bottom-nav';nav.setAttribute('aria-label','Main navigation');
 nav.innerHTML='<button class="nav-item player-home active" data-go="home"><span class="nav-icon">⌂</span><span>Home</span></button><button class="nav-item player-rank" data-go="rank"><span class="nav-icon">♛</span><span>Rankings</span></button><button class="nav-item admin-home hidden" data-go="dashboard"><span class="nav-icon">⌂</span><span>Home</span></button><button class="nav-item platform-nav hidden" data-go="requests"><span class="nav-icon">▤</span><span>Requests</span></button><button class="nav-item admin-nav hidden" data-go="settings"><span class="nav-icon">⚙</span><span>Settings</span></button><button class="nav-item player-wallet" data-go="wallet"><span class="nav-icon">◇</span><span>Wallet</span></button><button class="nav-item player-activity" data-go="activity"><span class="nav-icon">◷</span><span>Activity</span></button>';
 root.insertBefore(nav,foot);
 function go(id){pages.querySelectorAll('.tab-page').forEach(p=>p.classList.toggle('active',p.dataset.page===id));nav.querySelectorAll('.nav-item').forEach(b=>b.classList.toggle('active',b.dataset.go===id));}
 nav.addEventListener('click',e=>{const b=e.target.closest('[data-go]');if(b&&!b.classList.contains('hidden'))go(b.dataset.go)});
 window.bwShowAdminNav=enabled=>{
  root.classList.toggle('admin-mode',!!enabled);
  nav.querySelector('.admin-home').classList.toggle('hidden',!enabled);
  nav.querySelector('.player-home').classList.toggle('hidden',!!enabled);
  nav.querySelector('.player-rank').classList.toggle('hidden',!!enabled);
  nav.querySelector('.admin-nav').classList.toggle('hidden',!enabled);
  nav.querySelector('.platform-nav').classList.toggle('hidden',!enabled);
  nav.querySelector('.player-wallet').classList.toggle('hidden',!!enabled);
  nav.querySelector('.player-activity').classList.toggle('hidden',!!enabled);
  if(enabled)go('dashboard');
  else go('home');
 };
 go('home');
}
mountNavigation();
if(!cfg.supabaseUrl||!cfg.supabaseKey){$('auth-msg').textContent='Deployment configuration is missing. Contact the administrator.';return}
const sb=supabase.createClient(cfg.supabaseUrl,cfg.supabaseKey,{auth:{persistSession:true,autoRefreshToken:true,detectSessionInUrl:true}});
let user=null,me=null,round=null,settings=null,myBet=null,picks=[],selectionSlots=[],gameState=null,offset=0,lastRound=null,lastRefresh=0,channel=null,signup=false,toastTimer=null,entering=false,lastRenderedShuffle=null;
function toast(s){$('toast').textContent=s;$('toast').classList.add('show');clearTimeout(toastTimer);toastTimer=setTimeout(()=>$('toast').classList.remove('show'),3200)}
function rpc(n,a){return sb.rpc(n,a||{}).then(r=>{if(r.error)throw r.error;return r.data})}
function authMode(v){signup=v;$('auth-title').textContent=v?'Create account':'Sign in';$('auth-desc').textContent=v?'':'Access your account.';$('signup-fields').classList.toggle('hidden',!v);$('auth-submit').textContent=v?'Create account':'Sign in';$('auth-switch-text').textContent=v?'Already registered?':'New to B-Will?';$('auth-switch').textContent=v?'Sign in':'Create account';$('auth-msg').textContent=''}
$('auth-switch').onclick=()=>authMode(!signup);
$('auth-form').onsubmit=async e=>{e.preventDefault();$('auth-submit').disabled=true;$('auth-msg').textContent='Please wait…';try{const email=$('email').value.trim(),password=$('password').value;if(signup){const username=$('username').value.trim();if(!/^[A-Za-z0-9_]{3,20}$/.test(username))throw Error('Username must be 3–20 letters, numbers or underscores.');if(!await rpc('bwl_username_available',{p:username}))throw Error('That username is already taken.');const r=await sb.auth.signUp({email,password,options:{data:{username}}});if(r.error)throw r.error;if(!r.data.session){$('auth-msg').textContent='Account created. Check your email to confirm, then sign in.';return}user=r.data.user;await enterApp()}else{const r=await sb.auth.signInWithPassword({email,password});if(r.error)throw r.error;user=r.data.user;await enterApp()}}catch(x){$('auth-msg').textContent=x.message||String(x)}finally{$('auth-submit').disabled=false}};
function isAdmin(){return !!(me&&me.is_admin&&user&&cfg.adminEmail&&String(user.email||'').toLowerCase()===String(cfg.adminEmail).toLowerCase())}
function showApp(){ $('auth').classList.add('hidden');$('app').classList.remove('hidden')}
async function enterApp(){if(!user||entering)return;entering=true;let timer;showApp();$('auth-msg').textContent='';try{await Promise.race([refreshAll(),new Promise((_,reject)=>{timer=setTimeout(()=>reject(Error('The app is taking too long to load. Please check your connection; you are signed in and can retry refresh.')),20000)})]);$('role-pill').textContent=isAdmin()?'ADMIN':'PLAYER';$('house-stat').classList.toggle('hidden',!isAdmin());$('admin-panel').classList.toggle('hidden',!isAdmin());if(window.bwShowAdminNav)window.bwShowAdminNav(isAdmin());subscribe();history().catch(()=>{});}catch(e){toast(e.message||String(e))}finally{if(timer)clearTimeout(timer);entering=false}}
async function refreshAll(){if(!user)return;const r=await Promise.all([rpc('bwl_me'),sb.from('bwl_round').select('*').eq('id',1).single(),sb.from('bwl_settings').select('*').eq('id',1).single(),rpc('bwl_leaderboard'),sb.from('bwl_results').select('*').order('round_id',{ascending:false}).limit(8),sb.from('bwl_requests').select('*').eq('user_id',user.id).order('created_at',{ascending:false}).limit(10),rpc('bwl_now'),rpc('bwl_game_state')]);me=r[0];if(!me)throw Error('Account profile is not ready.');round=r[1].data;settings=r[2].data;offset=new Date(r[6]).getTime()-Date.now();if(lastRound!==null&&lastRound!==round.round_id){picks=[];lastRenderedShuffle=null;}lastRound=round.round_id;const b=await sb.from('bwl_bets').select('*').eq('round_id',round.round_id).eq('user_id',user.id).maybeSingle();myBet=b.data||null;gameState=r[7]||{};picks=(gameState.guesses||myBet?.guesses||[]).map(Number);profile();renderRound();leaderboard(r[3]);results(r[4].data||[]);requests(r[5].data||[]);renderSettings();if(isAdmin())await admin();lastRefresh=Date.now()}
function profile(){$('available').textContent=money(me.available);$('user-pill').textContent=me.username||me.email||'Player'}
$('refresh-balance').onclick=async()=>{const b=$('refresh-balance');b.classList.add('spinning');try{await refreshAll()}catch(e){toast(e.message||String(e))}finally{b.classList.remove('spinning')}};
function arrangeCups(){
 const wrap=document.querySelector('.cups');
 let buttons=[...wrap.querySelectorAll('.cup')];
 buttons.forEach((b,i)=>{if(!b.dataset.identity)b.dataset.identity=b.dataset.cup||String(i+1);});
 const order=(gameState&&gameState.shuffle_order||[]).map(Number);
 const place=(identityOrder)=>{
  identityOrder.forEach((identity,index)=>{
   const b=buttons.find(x=>Number(x.dataset.identity)===identity);
   if(b){b.dataset.cup=String(index+1);b.querySelector('.cup-label').textContent='Cup '+(index+1);wrap.appendChild(b);}
  });
 };
 const phase=round&&round.phase;
 if(phase==='shuffle'&&order.length===3){
  const key=round.round_id+':'+order.join('');
  if(lastRenderedShuffle!==key){
   lastRenderedShuffle=key;
   const current=buttons.slice().sort((x,y)=>Number(x.dataset.cup)-Number(y.dataset.cup)).map(b=>Number(b.dataset.identity));
   const steps=[];
   let working=current.slice();
   // A chain of ordinary position swaps: cups stay upright-side-down and slide only.
   for(let i=0;i<5;i++){
    let x=i%3,y=(i+1+(i%2))%3;if(x===y)y=(y+1)%3;
    [working[x],working[y]]=[working[y],working[x]];
    steps.push(working.slice());
   }
   if(working.join('')!==order.join('')){
    for(let i=0;i<3;i++){
     const target=order[i],at=working.indexOf(target);
     if(at!==i){[working[i],working[at]]=[working[at],working[i]];steps.push(working.slice());}
    }
   }
   const animateOrder=next=>{
    const before=new Map([...wrap.querySelectorAll('.cup')].map(b=>[b, b.getBoundingClientRect()]));
    next.forEach(id=>{const b=buttons.find(x=>Number(x.dataset.identity)===id);if(b)wrap.appendChild(b);});
    const after=[...wrap.querySelectorAll('.cup')];
    after.forEach(b=>{
     const old=before.get(b),now=b.getBoundingClientRect();
     if(!old)return;
     const dx=old.left-now.left,dy=old.top-now.top,tilt=(Number(b.dataset.identity)%2?1:-1)*(8+(Math.abs(dx)/40));
     b.style.transition='none';b.style.transform='translate('+dx+'px,'+dy+'px) rotate('+tilt+'deg)';
    });
    requestAnimationFrame(()=>{
     after.forEach(b=>{b.style.transition='transform 250ms cubic-bezier(.2,.7,.2,1)';b.style.transform='translate(0,0) rotate(0deg)';});
     setTimeout(()=>after.forEach(b=>{b.style.transition='';b.style.transform='';}),280);
    });
   };
   steps.forEach((step,index)=>setTimeout(()=>animateOrder(step),index*300));
   setTimeout(()=>place(order),steps.length*300+300);
  }
 }else if(['picking','reveal'].includes(phase)&&order.length===3){
  place(order);
 }else if(phase==='betting'||phase==='preview'){
  place([1,2,3]);lastRenderedShuffle=null;
 }
}
function renderRound(){
 if(!round)return;
 const phase=round.phase,labels={betting:'STAKE OPEN',preview:'FIRST REVEAL',shuffle:'SHUFFLING',picking:'CHOOSE 1 OR 2',reveal:'FINAL REVEAL'};
 $('phase').textContent=labels[phase]||phase.toUpperCase();$('phase').classList.toggle('reveal',phase==='reveal');
 picks=(gameState?.guesses||myBet?.guesses||[]).map(Number);
 if(phase!=='picking')selectionSlots=[];
 arrangeCups();
 const starting=Number(gameState?.starting_cup||0);
 let hint='Enter your stake to join this round.';
 if(phase==='preview')hint='Look carefully. The item is under one of these cups.';
 if(phase==='shuffle')hint='Follow the cups as they shuffle.';
 if(phase==='picking')hint=!myBet?'You did not place a stake in this round.':picks.length?'Your selection is locked in. Wait for the result.':'Choose one cup or fill both slots, then confirm.';
 if(phase==='reveal')hint='The item was under Cup '+(round.revealed_cup||'—')+'. Payouts have been settled.';
 $('cup-hint').textContent=hint;
 $('selection-display').textContent=picks.length?(picks.length+' / 2'): (selectionSlots.length+' / 2');
 if(myBet&&document.activeElement!==$('stake'))$('stake').value=Number(myBet.stake).toFixed(2);
 $('stake').placeholder=money(settings.min_stake||5);$('minimum-stake').textContent=money(settings.min_stake||5);$('place-bet').textContent=myBet?'Stake placed':'Place Stake';
 $('place-bet').disabled=phase!=='betting';$('stake').disabled=phase!=='betting';
 document.querySelectorAll('.cup').forEach(b=>{
  const position=Number(b.dataset.cup),identity=Number(b.dataset.identity||b.dataset.cup);
  const win=phase==='reveal'&&Number(round.revealed_cup)===position;
  const tried=picks.includes(position),chosen=selectionSlots.includes(position);
  const token=b.querySelector('.item-token');
  token.classList.toggle('hidden',!(phase==='preview'&&identity===starting));
  b.classList.toggle('selected',phase==='picking'&&(tried||chosen));b.classList.toggle('winner',win);
  b.querySelector('.cup-check').textContent=win?'✦':tried?'✓':chosen?'✓':'';
  b.querySelector('small').textContent=win?'Item found':tried?'Submitted':chosen?'Slot selected':phase==='picking'?'Select':'';
  b.disabled=phase!=='picking'||!myBet||picks.length>0||(!chosen&&selectionSlots.length>=2);
 });
 [1,2].forEach(slotIndex=>{
  const slot=$('slot-'+slotIndex),cup=selectionSlots[slotIndex-1];
  slot.querySelector('.slot-value').textContent=cup?'CUP '+cup:'EMPTY';
  slot.classList.toggle('filled',!!cup);
  slot.disabled=phase!=='picking'||picks.length>0||!cup;
 });
 $('submit-guesses').disabled=phase!=='picking'||!myBet||picks.length>0||selectionSlots.length===0;
 $('submit-guesses').textContent=selectionSlots.length===1?'Confirm 1 Pick':selectionSlots.length===2?'Confirm 2 Picks':'Confirm Picks';
 $('bet-note').textContent=myBet?'Your stake: '+money(myBet.stake):'Minimum stake '+money(settings.min_stake)+' · One stake per round.';
}
document.querySelectorAll('.cup').forEach(b=>b.onclick=()=>{
 if(!round||round.phase!=='picking'||!myBet||picks.length>0)return;
 const cup=Number(b.dataset.cup),at=selectionSlots.indexOf(cup);
 if(at>=0)selectionSlots.splice(at,1);
 else if(selectionSlots.length<2)selectionSlots.push(cup);
 renderRound();
});
[1,2].forEach(n=>{
 $('slot-'+n).onclick=()=>{
  if(round?.phase!=='picking'||picks.length>0)return;
  selectionSlots.splice(n-1,1);renderRound();
 };
});
$('submit-guesses').onclick=async()=>{
 try{
  if(!selectionSlots.length||selectionSlots.length>2)throw Error('Choose one cup or two cups.');
  const chosen=selectionSlots.slice();
  await rpc('bwl_submit_guesses',{p_cups:chosen});
  selectionSlots=[];toast('Selection confirmed. Good luck!');await refreshAll();
 }catch(e){toast(e.message||String(e))}
};
document.querySelectorAll('[data-stake]').forEach(b=>b.onclick=()=>{if(!$('stake').disabled)$('stake').value=b.dataset.stake});
$('place-bet').onclick=async()=>{try{const stake=Number($('stake').value);if(!Number.isFinite(stake)||stake<=0)throw Error('Enter a valid stake.');await rpc('bwl_place_bet',{p_stake:stake});toast('Stake saved. Watch for the item reveal.');await refreshAll()}catch(e){toast(e.message||String(e))}};
$('deposit-btn').onclick=async()=>{try{await rpc('bwl_request_deposit',{p_amount:Number($('deposit-amount').value)});$('deposit-amount').value='';toast('Deposit request submitted.');await refreshAll()}catch(e){toast(e.message||String(e))}};
$('withdraw-btn').onclick=async()=>{try{await rpc('bwl_request_withdraw',{p_amount:Number($('withdraw-amount').value)});$('withdraw-amount').value='';toast('Withdrawal request submitted. Funds are locked.');await refreshAll()}catch(e){toast(e.message||String(e))}};
function requests(rows){$('my-requests').innerHTML=rows.length?rows.map(r=>'<div class="request"><div><strong>'+esc(r.kind)+' · '+money(r.amount)+'</strong><small>'+date(r.created_at)+'</small></div><div class="inline"><span class="status '+esc(r.status)+'">'+esc(r.status)+'</span>'+(r.kind==='withdraw'&&r.status==='pending'?'<button class="btn small danger" data-cancel="'+r.id+'">Cancel</button>':'')+'</div></div>').join(''):'<div class="empty">No wallet requests yet.</div>';$('my-requests').querySelectorAll('[data-cancel]').forEach(b=>b.onclick=async()=>{try{await rpc('bwl_cancel_withdraw',{p_id:Number(b.dataset.cancel)});toast('Withdrawal cancelled. Funds returned.');await refreshAll()}catch(e){toast(e.message||String(e))}})}
function leaderboard(rows){$('lb-status').textContent=settings.leaderboard_on?'Counting ON':'Counting OFF';$('leaderboard').innerHTML=rows.length?'<table class="table"><thead><tr><th>Rank</th><th>Player</th><th class="right">Wins</th></tr></thead><tbody>'+rows.map(r=>'<tr><td class="rank">'+r.rank+'</td><td>'+esc(r.username)+'</td><td class="right mono">'+r.wins+'</td></tr>').join('')+'</tbody></table>':'<div class="empty">No wins recorded yet.</div>'}
function results(rows){$('results').innerHTML=rows.length?'<table class="table"><thead><tr><th>Round</th><th>Winning cup</th><th class="right">Pool</th></tr></thead><tbody>'+rows.map(r=>'<tr><td class="mono">#'+r.round_id+'</td><td class="gold">Cup '+r.winning_cup+'</td><td class="right mono">'+money(r.total_pool)+'</td></tr>').join('')+'</tbody></table>':'<div class="empty">Round results will appear here.</div>'}
async function history(){const r=await sb.from('bwl_leaderboard_history').select('*').order('saved_at',{ascending:false}).limit(100);if(r.error){$('history').innerHTML='<div class="empty">History unavailable.</div>';return}const groups={};(r.data||[]).forEach(x=>(groups[x.batch_id]||(groups[x.batch_id]=[])).push(x));const keys=Object.keys(groups);$('history').innerHTML=keys.length?keys.map(k=>{const a=groups[k].sort((x,y)=>x.rank-y.rank);return '<div class="history-batch"><b>Saved '+date(a[0].saved_at)+'</b><table class="table"><tbody>'+a.slice(0,5).map(x=>'<tr><td class="rank">'+x.rank+'</td><td>'+esc(x.username)+'</td><td class="right mono">'+x.total_wins+' wins</td></tr>').join('')+'</tbody></table></div>'}).join(''):'<div class="empty">No archived tournaments yet.</div>'}
function renderSettings(){if($('admin-panel').dataset.settingsDirty==='true')return;$('set-betting').value=settings.betting_secs;$('set-preview').value=settings.preview_secs;$('set-shuffle').value=settings.shuffle_secs;$('set-picking').value=settings.picking_secs;$('set-reveal').value=settings.reveal_secs;$('set-min').value=settings.min_stake;$('set-cut').value=settings.house_cut_pct;$('set-lb').classList.toggle('on',!!settings.leaderboard_on);$('lb-status').textContent=settings.leaderboard_on?'Counting ON':'Counting OFF'}
['set-betting','set-preview','set-shuffle','set-picking','set-reveal','set-min','set-cut'].forEach(id=>$(id).addEventListener('input',()=>{$('admin-panel').dataset.settingsDirty='true'}));
$('set-lb').onclick=()=>{$('set-lb').classList.toggle('on');$('admin-panel').dataset.settingsDirty='true'};
$('save-settings').onclick=async()=>{try{await rpc('bwl_admin_save_settings',{p_betting:Number($('set-betting').value),p_preview:Number($('set-preview').value),p_shuffle:Number($('set-shuffle').value),p_picking:Number($('set-picking').value),p_reveal:Number($('set-reveal').value),p_min:Number($('set-min').value),p_cut:Number($('set-cut').value),p_lb:$('set-lb').classList.contains('on')});$('admin-panel').dataset.settingsDirty='false';toast('Settings saved.');await refreshAll()}catch(e){toast(e.message||String(e))}};
$('reset-leaderboard').onclick=async()=>{if(!confirm('Archive current standings and reset active wins?'))return;try{const r=await rpc('bwl_admin_save_reset_leaderboard');toast('Leaderboard archived: '+r.saved+' players.');await refreshAll();await history()}catch(e){toast(e.message||String(e))}};
async function admin(){try{const r=await Promise.all([rpc('bwl_admin_overview'),rpc('bwl_admin_requests')]),o=r[0],q=r[1];$('house').textContent=money(o.house_balance);$('admin-dashboard-stats').innerHTML='<div class="admin-metric"><span>House Profit</span><strong class="gold">'+money(o.house_profit)+'</strong><small>Cumulative house cut</small></div><div class="admin-metric"><span>House Balance</span><strong>'+money(o.house_balance)+'</strong><small>Current house funds</small></div><div class="admin-metric"><span>Total Game Volume</span><strong>'+money(o.total_volume)+'</strong><small>Across completed rounds</small></div><div class="admin-metric"><span>House Margin</span><strong class="green">'+Number(o.house_margin_pct||0).toFixed(2)+'%</strong><small>Profit as % of game volume</small></div><div class="admin-metric"><span>Players</span><strong>'+o.players+'</strong><small>Registered player accounts</small></div><div class="admin-metric"><span>Completed Rounds</span><strong>'+o.completed_rounds+'</strong><small>Settled game rounds</small></div><div class="admin-metric"><span>Pending Requests</span><strong>'+o.pending+'</strong><small>Awaiting admin decisions</small></div>'; $('admin-players').innerHTML=o.players_list.length?'<table class="table"><thead><tr><th>Player</th><th class="right">Available</th><th class="right">Wins</th></tr></thead><tbody>'+o.players_list.map(p=>'<tr><td>'+esc(p.username)+'</td><td class="right mono">'+money(p.available)+'</td><td class="right mono">'+p.wins+'</td></tr>').join('')+'</tbody></table>':'<div class="empty">No players yet.</div>';$('admin-requests').innerHTML=q.length?'<table class="table"><thead><tr><th>Player / Request</th><th>Amount</th><th>Status</th><th class="right">Action</th></tr></thead><tbody>'+q.map(x=>'<tr><td>'+esc(x.username)+'<small>'+esc(x.kind)+' · '+date(x.created_at)+'</small></td><td class="mono">'+money(x.amount)+'</td><td><span class="status '+esc(x.status)+'">'+esc(x.status)+'</span></td><td class="right">'+(x.status==='pending'?'<button class="btn small primary" data-approve="'+x.id+'">Approve</button> <button class="btn small danger" data-reject="'+x.id+'">Reject</button>':'—')+'</td></tr>').join('')+'</tbody></table>':'<div class="empty">No requests yet.</div>';$('admin-requests').querySelectorAll('[data-approve]').forEach(b=>b.onclick=()=>resolve(b.dataset.approve,true));$('admin-requests').querySelectorAll('[data-reject]').forEach(b=>b.onclick=()=>resolve(b.dataset.reject,false))}catch(e){$('admin-overview').textContent=e.message||String(e)}}
async function resolve(id,approve){try{await rpc('bwl_admin_resolve',{p_id:Number(id),p_approve:approve});toast(approve?'Request approved.':'Request rejected.');await refreshAll()}catch(e){toast(e.message||String(e))}}
$('refresh-admin').onclick=admin;
function subscribe(){if(channel)sb.removeChannel(channel);channel=sb.channel('bwill-live').on('postgres_changes',{event:'*',schema:'public',table:'bwl_round'},refreshAll).on('postgres_changes',{event:'*',schema:'public',table:'bwl_results'},refreshAll).on('postgres_changes',{event:'*',schema:'public',table:'bwl_settings'},refreshAll).on('postgres_changes',{event:'*',schema:'public',table:'bwl_profiles',filter:'id=eq.'+user.id},refreshAll).on('postgres_changes',{event:'*',schema:'public',table:'bwl_requests',filter:'user_id=eq.'+user.id},refreshAll).subscribe()}
setInterval(()=>{if(!round)return;const left=Math.max(0,Math.ceil((new Date(round.phase_ends_at).getTime()-(Date.now()+offset))/1000));if(left===0&&Date.now()-lastRefresh>800)refreshAll().catch(()=>{})},250);
setInterval(()=>{if(user&&Date.now()-lastRefresh>4500)refreshAll().catch(()=>{})},1000);setInterval(()=>{if(user)history().catch(()=>{})},30000);
$('signout').onclick=async()=>{if(channel)await sb.removeChannel(channel);await sb.auth.signOut();user=null;me=null;$('app').classList.add('hidden');$('auth').classList.remove('hidden');authMode(false)};
sb.auth.onAuthStateChange((ev,s)=>{if(ev==='SIGNED_OUT'||!s){user=null;me=null;entering=false;$('app').classList.add('hidden');$('auth').classList.remove('hidden')}});
(async()=>{authMode(false);const r=await sb.auth.getSession();if(r.data.session){user=r.data.session.user;await enterApp()}})();
if('serviceWorker'in navigator)navigator.serviceWorker.register('./sw.js').catch(()=>{});
})();