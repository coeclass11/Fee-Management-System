(() => {
  const cfg = window.APP_CONFIG || {};
  const ready = window.supabase && cfg.SUPABASE_URL && cfg.SUPABASE_ANON_KEY &&
    !cfg.SUPABASE_URL.includes("YOUR_PROJECT") && !cfg.SUPABASE_ANON_KEY.includes("YOUR_");
  const client = ready ? window.supabase.createClient(cfg.SUPABASE_URL, cfg.SUPABASE_ANON_KEY) : null;
  const $ = (id) => document.getElementById(id);
  const state = { user:null, profile:null, page:"dashboard", students:[], fees:[], payments:[], search:"", filter:"all" };
  const money = (n) => "Rs. " + Number(n || 0).toLocaleString("en-IN",{maximumFractionDigits:2});
  const date = (v) => v ? new Date(v+"T00:00:00").toLocaleDateString("en-GB",{day:"2-digit",month:"short",year:"numeric"}) : "—";
  const initials = (s="A") => s.trim().split(/\s+/).slice(0,2).map(x=>x[0]).join("").toUpperCase();
  const esc = (s="") => String(s).replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
  function toast(message,error=false){const el=document.createElement("div");el.className="toast"+(error?" error":"");el.textContent=message;$("toast-region").append(el);setTimeout(()=>el.remove(),3600)}
  function showAuth(mode="login"){
    $("auth-screen").classList.remove("hidden");$("app-shell").classList.add("hidden");
    const signup=mode==="signup";$("auth-eyebrow").textContent=signup?"GET STARTED":"WELCOME BACK";
    $("auth-title").textContent=signup?"Create your account":"Sign in to your account";
    $("auth-description").textContent=signup?"The first account becomes the workspace administrator.":"Enter your details to access the admin workspace.";
    $("name-field").classList.toggle("hidden",!signup);$("auth-name").required=signup;
    $("auth-password").autocomplete=signup?"new-password":"current-password";
    $("auth-submit").innerHTML=signup?"Create account <span>→</span>":"Sign in <span>→</span>";
    $("auth-switch").textContent=signup?"Back to sign in":"Create first admin";
    $("forgot-password").classList.toggle("hidden",signup);
    $("auth-form").dataset.mode=mode;
  }
  async function loadProfile(){
    const {data,error}=await client.from("profiles").select("*").eq("id",state.user.id).maybeSingle();
    if(error) throw error;
    state.profile=data||{full_name:state.user.user_metadata?.full_name||state.user.email,role:"staff"};
    const name=state.profile.full_name||state.user.email;
    $("user-name").textContent=name;$("user-role").textContent=state.profile.role||"staff";
    $("user-avatar").textContent=initials(name);$("top-avatar").textContent=initials(name);
  }
  async function loadData(){
    const [s,f,p]=await Promise.all([
      client.from("students").select("*").order("created_at",{ascending:false}),
      client.from("fee_structures").select("*").order("created_at",{ascending:false}),
      client.from("payments").select("*, students(full_name, student_code)").order("paid_on",{ascending:false})
    ]);
    if(s.error) throw s.error;if(f.error) throw f.error;if(p.error) throw p.error;
    state.students=s.data||[];state.fees=f.data||[];state.payments=p.data||[];
  }
  function studentBalance(student){
    const assigned=state.fees.filter(f=>f.class_name===student.class_name && (!f.academic_year||f.academic_year===student.academic_year)).reduce((a,f)=>a+Number(f.amount),0);
    const paid=state.payments.filter(p=>p.student_id===student.id).reduce((a,p)=>a+Number(p.amount),0);
    return {assigned,paid,balance:Math.max(0,assigned-paid)};
  }
  function studentStatus(student){const b=studentBalance(student);return b.assigned===0?"No fee":b.balance<=0?"Paid":"Pending"}
  function statusPill(status){const cls=status.toLowerCase()==="paid"?"paid":status.toLowerCase()==="overdue"?"overdue":status.toLowerCase()==="active"?"active":"pending";return '<span class="status '+cls+'">'+esc(status)+'</span>'}
  function stat(label,value,icon,foot,cls=""){return '<article class="stat-card '+cls+'"><div class="stat-head"><span>'+label+'</span><span class="stat-icon">'+icon+'</span></div><div class="stat-value">'+value+'</div><div class="stat-foot">'+foot+'</div></article>'}
  function pageIntro(title,desc,button=""){return '<div class="page-intro"><div><h2>'+title+'</h2><p>'+desc+'</p></div>'+button+'</div>'}
  function renderDashboard(){
    const total=state.fees.reduce((a,f)=>a+Number(f.amount),0)*Math.max(1,new Set(state.students.map(s=>s.class_name)).size);
    const collected=state.payments.reduce((a,p)=>a+Number(p.amount),0);
    const pending=Math.max(0,total-collected);
    const paidCount=state.students.filter(s=>studentStatus(s)==="Paid").length;
    const due=state.students.map(s=>({...s,b:studentBalance(s)})).filter(s=>s.b.balance>0).sort((a,b)=>b.b.balance-a.b.balance).slice(0,5);
    const recent=state.payments.slice(0,6);
    const pct=total?Math.min(100,collected/total*100):0;
    return pageIntro("Good to see you back","Here’s what’s happening with your school finances today.",'<button class="btn btn-primary" data-action="add-payment">＋ Record payment</button>')+
    '<div class="stats-grid">'+stat("TOTAL COLLECTED",money(collected),"↗","Payments received","green")+stat("OUTSTANDING",money(pending),"◷","Estimated fee balance","amber")+stat("TOTAL STUDENTS",state.students.length,"♙","Registered students")+stat("STUDENTS WITH DUES",state.students.length-paidCount,"!","Students with pending fees","red")+'</div>'+
    '<div class="dashboard-grid"><section class="panel"><div class="panel-heading"><div><h3>Recent payments</h3><p>Latest transactions recorded in the system</p></div><button class="link-button" data-nav="payments">View all →</button></div>'+
    (recent.length?'<div class="table-wrap"><table><thead><tr><th>Student</th><th>Date</th><th>Method</th><th>Amount</th></tr></thead><tbody>'+recent.map(p=>'<tr><td><div class="student-cell"><span class="mini-avatar">'+initials(p.students?.full_name||"?")+'</span><div><b>'+esc(p.students?.full_name||"Student")+'</b><small>'+esc(p.students?.student_code||"")+'</small></div></div></td><td>'+date(p.paid_on)+'</td><td>'+esc(p.method||"Cash")+'</td><td><b>'+money(p.amount)+'</b></td></tr>').join("")+'</tbody></table></div>':'<div class="empty-state">No payments recorded yet.</div>')+
    '</section><section class="panel"><div class="panel-heading"><div><h3>Students with dues</h3><p>Highest outstanding balances</p></div><button class="link-button" data-nav="students">All students →</button></div>'+
    (due.length?'<div class="remaining-list">'+due.map(s=>'<div class="remaining-item"><div><b>'+esc(s.full_name)+'</b><small>'+esc(s.student_code)+' · Class '+esc(s.class_name)+'</small></div><span class="remaining-amount">'+money(s.b.balance)+'</span></div>').join("")+'</div>':'<div class="empty-state">No outstanding balances. Nice.</div>')+
    '<div class="progress-wrap"><div class="progress-label"><span>Collection progress</span><b>'+pct.toFixed(1)+'%</b></div><div class="progress"><span style="width:'+pct+'%"></span></div><div class="progress-label" style="margin-top:8px"><span>Collected '+money(collected)+'</span><span>Target '+money(total)+'</span></div></div></section></div>';
  }
  function renderStudents(){
    const rows=state.students.filter(s=>(s.full_name+" "+s.student_code+" "+s.class_name).toLowerCase().includes(state.search.toLowerCase())).filter(s=>state.filter==="all"||studentStatus(s).toLowerCase()===state.filter);
    return pageIntro("Students","Manage student profiles and track their fee status.",'<button class="btn btn-primary" data-action="add-student">＋ Add student</button>')+
    '<div class="toolbar"><div class="search-box"><input id="table-search" placeholder="Search name, ID or class…" value="'+esc(state.search)+'"></div><select id="table-filter" class="control filter-select"><option value="all">All statuses</option><option value="paid">Paid</option><option value="pending">Pending</option></select></div>'+
    '<section class="table-panel"><div class="table-wrap"><table><thead><tr><th>Student</th><th>Class</th><th>Contact</th><th>Total fee</th><th>Paid</th><th>Balance</th><th>Status</th><th>Actions</th></tr></thead><tbody>'+
    rows.map(s=>{const b=studentBalance(s);return '<tr><td><div class="student-cell"><span class="mini-avatar">'+initials(s.full_name)+'</span><div><b>'+esc(s.full_name)+'</b><small>'+esc(s.student_code)+'</small></div></div></td><td>'+esc(s.class_name)+'</td><td>'+esc(s.guardian_phone||"—")+'</td><td>'+money(b.assigned)+'</td><td>'+money(b.paid)+'</td><td><b>'+money(b.balance)+'</b></td><td>'+statusPill(studentStatus(s))+'</td><td><div class="table-actions"><button class="small-action" data-action="edit-student" data-id="'+s.id+'">Edit</button><button class="small-action" data-action="add-payment" data-id="'+s.id+'">Pay</button></div></td></tr>'}).join("")+
    '</tbody></table>'+(rows.length?"":'<div class="empty-state">No matching students found.</div>')+'</div></section>';
  }
  function renderFees(){
    return pageIntro("Fee structure","Set fee amounts by class and academic year.",'<button class="btn btn-primary" data-action="add-fee">＋ Add fee</button>')+
    '<section class="table-panel"><div class="table-wrap"><table><thead><tr><th>Fee name</th><th>Class</th><th>Academic year</th><th>Amount</th><th>Due date</th><th>Actions</th></tr></thead><tbody>'+
    state.fees.map(f=>'<tr><td><b>'+esc(f.title)+'</b></td><td>'+esc(f.class_name)+'</td><td>'+esc(f.academic_year||"—")+'</td><td><b>'+money(f.amount)+'</b></td><td>'+date(f.due_date)+'</td><td><div class="table-actions"><button class="small-action" data-action="edit-fee" data-id="'+f.id+'">Edit</button><button class="small-action" data-action="delete-fee" data-id="'+f.id+'">Delete</button></div></td></tr>').join("")+
    '</tbody></table>'+(state.fees.length?"":'<div class="empty-state">No fee structures yet. Add a fee to get started.</div>')+'</div></section>';
  }
  function renderPayments(){
    const rows=state.payments.filter(p=>((p.students?.full_name||"")+" "+(p.students?.student_code||"")+" "+(p.reference||"")).toLowerCase().includes(state.search.toLowerCase()));
    const total=state.payments.reduce((a,p)=>a+Number(p.amount),0);
    return pageIntro("Payments","Record collections and review transaction history.",'<button class="btn btn-primary" data-action="add-payment">＋ Record payment</button>')+
    '<div class="summary-strip"><div class="summary-chip"><small>Total collected</small><b>'+money(total)+'</b></div><div class="summary-chip"><small>Transactions</small><b>'+state.payments.length+'</b></div><div class="summary-chip"><small>Payment methods</small><b>'+new Set(state.payments.map(p=>p.method)).size+'</b></div></div>'+
    '<div class="toolbar"><div class="search-box"><input id="table-search" placeholder="Search student or reference…" value="'+esc(state.search)+'"></div><button class="btn btn-light" data-action="export-payments">↓ Export CSV</button></div>'+
    '<section class="table-panel"><div class="table-wrap"><table><thead><tr><th>Receipt ref.</th><th>Student</th><th>Date</th><th>Method</th><th>Amount</th><th>Note</th></tr></thead><tbody>'+
    rows.map(p=>'<tr><td><b>'+esc(p.reference||"—")+'</b></td><td>'+esc(p.students?.full_name||"Student")+' <small>'+esc(p.students?.student_code||"")+'</small></td><td>'+date(p.paid_on)+'</td><td>'+esc(p.method||"Cash")+'</td><td><b>'+money(p.amount)+'</b></td><td>'+esc(p.note||"—")+'</td></tr>').join("")+
    '</tbody></table>'+(rows.length?"":'<div class="empty-state">No payments found.</div>')+'</div></section>';
  }
  function renderReports(){
    const collected=state.payments.reduce((a,p)=>a+Number(p.amount),0);
    const due=state.students.map(s=>({...s,b:studentBalance(s)})).filter(s=>s.b.balance>0);
    return pageIntro("Reports","A clear snapshot of collections and outstanding fees.")+
    '<div class="summary-strip"><div class="summary-chip"><small>Total collected</small><b>'+money(collected)+'</b></div><div class="summary-chip"><small>Students with dues</small><b>'+due.length+'</b></div><div class="summary-chip"><small>Transactions</small><b>'+state.payments.length+'</b></div></div>'+
    '<div class="report-grid"><article class="report-card"><h3>Student fee statement</h3><p>Export every student with their assigned fee, total paid and remaining balance.</p><button class="btn btn-light" data-action="export-students">↓ Download CSV</button></article><article class="report-card"><h3>Payment register</h3><p>Download the full payment transaction register with dates and references.</p><button class="btn btn-light" data-action="export-payments">↓ Download CSV</button></article><article class="report-card"><h3>Outstanding dues</h3><p>Export a list of students who still have a fee balance to pay.</p><button class="btn btn-light" data-action="export-dues">↓ Download CSV</button></article><article class="report-card"><h3>Collection summary</h3><p>Export a simple summary of total collections by payment method.</p><button class="btn btn-light" data-action="export-summary">↓ Download CSV</button></article></div>';
  }
  function renderSettings(){
    return pageIntro("Settings","Account and workspace information.")+
    '<section class="panel settings-card"><div class="panel-heading"><div><h3>Signed-in account</h3><p>Your current authentication details</p></div></div>'+
    '<div class="settings-row"><div><b>Email address</b><small>'+esc(state.user.email)+'</small></div>'+statusPill("Active")+'</div>'+
    '<div class="settings-row"><div><b>Display name</b><small>'+esc(state.profile?.full_name||"Not set")+'</small></div><button class="btn btn-light" data-action="edit-profile">Edit</button></div>'+
    '<div class="settings-row"><div><b>Access role</b><small>'+esc(state.profile?.role||"staff")+'</small></div></div>'+
    '<div class="settings-row"><div><b>Password</b><small>Update your password through a secure email link.</small></div><button class="btn btn-light" data-action="reset-password">Send reset link</button></div>'+
    '<div class="notice">Database connection and authentication are provided by Supabase. Keep your project credentials private and never use a service-role key in this browser application.</div></section>';
  }
  const renderers={dashboard:renderDashboard,students:renderStudents,fees:renderFees,payments:renderPayments,reports:renderReports,settings:renderSettings};
  function render(){
    $("page-heading").textContent=({dashboard:"Overview",students:"Students",fees:"Fee structure",payments:"Payments",reports:"Reports",settings:"Settings"})[state.page];
    $("today-label").textContent=new Date().toLocaleDateString("en-US",{weekday:"short",day:"numeric",month:"short",year:"numeric"});
    document.querySelectorAll(".nav-link[data-page]").forEach(b=>b.classList.toggle("active",b.dataset.page===state.page));
    $("page-content").innerHTML=renderers[state.page]();
    const search=$("table-search");if(search)search.addEventListener("input",e=>{state.search=e.target.value;const pos=e.target.selectionStart;render();$("table-search").focus();$("table-search").setSelectionRange(pos,pos)});
    const filter=$("table-filter");if(filter){filter.value=state.filter;filter.addEventListener("change",e=>{state.filter=e.target.value;render()})}
  }
  function setPage(page){state.page=page;state.search="";state.filter="all";$("sidebar").classList.remove("open");render()}
  function openDialog(html){$("dialog-content").innerHTML=html;$("record-dialog").showModal()}
  function closeDialog(){$("record-dialog").close()}
  function formShell(title,subtitle,body,submit="Save"){
    return '<h2 class="dialog-title">'+title+'</h2><p class="dialog-subtitle">'+subtitle+'</p><form id="record-form">'+body+'<div class="dialog-actions"><button type="button" class="btn btn-light" data-action="close-dialog">Cancel</button><button class="btn btn-primary" type="submit">'+submit+'</button></div></form>';
  }
  function studentForm(s={}){
    openDialog(formShell(s.id?"Edit student":"Add student","Student information and guardian contact.",'<div class="form-grid"><label class="field full">Full name<input name="full_name" required value="'+esc(s.full_name||"")+'"></label><label class="field">Student ID<input name="student_code" required value="'+esc(s.student_code||"")+'" placeholder="STU-001"></label><label class="field">Class<input name="class_name" required value="'+esc(s.class_name||"")+'" placeholder="10"></label><label class="field">Academic year<input name="academic_year" value="'+esc(s.academic_year||"2083")+'"></label><label class="field">Guardian phone<input name="guardian_phone" value="'+esc(s.guardian_phone||"")+'"></label><label class="field full">Address<input name="address" value="'+esc(s.address||"")+'"></label></div>'));
    $("record-form").addEventListener("submit",async e=>{e.preventDefault();const v=Object.fromEntries(new FormData(e.target));await saveRecord("students",s.id,v,"Student saved")});
  }
  function feeForm(f={}){
    openDialog(formShell(f.id?"Edit fee":"Add fee structure","Assign a fee to a class and academic year.",'<div class="form-grid"><label class="field full">Fee name<input name="title" required value="'+esc(f.title||"Tuition fee")+'"></label><label class="field">Class<input name="class_name" required value="'+esc(f.class_name||"")+'" placeholder="10"></label><label class="field">Amount (Rs.)<input name="amount" type="number" min="0.01" step="0.01" required value="'+esc(f.amount||"")+'"></label><label class="field">Academic year<input name="academic_year" value="'+esc(f.academic_year||"2083")+'"></label><label class="field">Due date<input name="due_date" type="date" value="'+esc(f.due_date||"")+'"></label></div>'));
    $("record-form").addEventListener("submit",async e=>{e.preventDefault();const v=Object.fromEntries(new FormData(e.target));v.amount=Number(v.amount);await saveRecord("fee_structures",f.id,v,"Fee structure saved")});
  }
  function paymentForm(studentId=""){
    if(!state.students.length){toast("Add a student before recording a payment.",true);return}
    const options=state.students.map(s=>'<option value="'+s.id+'" '+(s.id===studentId?"selected":"")+'>'+esc(s.full_name)+' · '+esc(s.student_code)+'</option>').join("");
    openDialog(formShell("Record a payment","Add a full or partial fee payment.",'<div class="form-grid"><label class="field full">Student<select name="student_id" required>'+options+'</select></label><label class="field">Amount (Rs.)<input name="amount" type="number" min="0.01" step="0.01" required></label><label class="field">Payment date<input name="paid_on" type="date" required value="'+new Date().toISOString().slice(0,10)+'"></label><label class="field">Payment method<select name="method"><option>Cash</option><option>Bank transfer</option><option>Card</option><option>Online</option></select></label><label class="field">Reference<input name="reference" placeholder="Receipt / transaction no."></label><label class="field full">Note<input name="note" placeholder="Optional note"></label></div>'));
    $("record-form").addEventListener("submit",async e=>{e.preventDefault();const v=Object.fromEntries(new FormData(e.target));v.amount=Number(v.amount);await saveRecord("payments",null,v,"Payment recorded")});
  }
  async function saveRecord(table,id,values,message){
    const btn=$("record-form").querySelector('[type="submit"]');btn.disabled=true;btn.textContent="Saving…";
    const result=id?await client.from(table).update(values).eq("id",id):await client.from(table).insert(values);
    if(result.error){toast(result.error.message,true);btn.disabled=false;btn.textContent="Save";return}
    closeDialog();await refresh();toast(message);
  }
  async function refresh(){await loadData();render();$("last-updated").textContent="Updated "+new Date().toLocaleTimeString([],{hour:"2-digit",minute:"2-digit"})}
  function downloadCSV(name,rows){
    if(!rows.length){toast("There is no data to export.",true);return}
    const keys=Object.keys(rows[0]);const csv=[keys.join(","),...rows.map(r=>keys.map(k=>'"'+String(r[k]??"").replace(/"/g,'""')+'"').join(","))].join("\n");
    const url=URL.createObjectURL(new Blob(["\ufeff"+csv],{type:"text/csv;charset=utf-8"}));const a=document.createElement("a");a.href=url;a.download=name+".csv";a.click();URL.revokeObjectURL(url);
  }
  function exportData(type){
    if(type==="payments")downloadCSV("payment-register",state.payments.map(p=>({reference:p.reference,student:p.students?.full_name,student_id:p.students?.student_code,date:p.paid_on,method:p.method,amount:p.amount,note:p.note})));
    if(type==="students"||type==="dues"){const rows=state.students.map(s=>{const b=studentBalance(s);return {student:s.full_name,student_id:s.student_code,class:s.class_name,assigned_fee:b.assigned,paid:b.paid,balance:b.balance,status:studentStatus(s)}}).filter(r=>type!=="dues"||r.balance>0);downloadCSV(type==="dues"?"outstanding-dues":"student-fee-statement",rows)}
    if(type==="summary"){const methods={};state.payments.forEach(p=>methods[p.method]=(methods[p.method]||0)+Number(p.amount));downloadCSV("collection-summary",Object.entries(methods).map(([method,amount])=>({method,amount})))}
  }
  async function handleAction(action,id){
    if(action==="add-student")studentForm();if(action==="edit-student")studentForm(state.students.find(s=>s.id===id)||{});
    if(action==="add-fee")feeForm();if(action==="edit-fee")feeForm(state.fees.find(f=>f.id===id)||{});
    if(action==="add-payment")paymentForm(id||"");if(action==="close-dialog")closeDialog();
    if(action==="delete-fee"){if(!confirm("Delete this fee structure?"))return;const {error}=await client.from("fee_structures").delete().eq("id",id);if(error)toast(error.message,true);else{await refresh();toast("Fee structure deleted")}}
    if(action==="export-payments")exportData("payments");if(action==="export-students")exportData("students");if(action==="export-dues")exportData("dues");if(action==="export-summary")exportData("summary");
    if(action==="reset-password"){const {error}=await client.auth.resetPasswordForEmail(state.user.email,{redirectTo:location.origin+location.pathname});if(error)toast(error.message,true);else toast("Password reset email sent")}
    if(action==="edit-profile")profileForm();
  }
  function profileForm(){
    openDialog(formShell("Update profile","Change the name displayed in the workspace.",'<label class="field">Full name<input name="full_name" required value="'+esc(state.profile?.full_name||"")+'"></label>'));
    $("record-form").addEventListener("submit",async e=>{e.preventDefault();const full_name=new FormData(e.target).get("full_name");const {error}=await client.from("profiles").update({full_name}).eq("id",state.user.id);if(error){toast(error.message,true);return}state.profile.full_name=full_name;closeDialog();render();toast("Profile updated")});
  }
  $("auth-switch").addEventListener("click",()=>showAuth($("auth-form").dataset.mode==="signup"?"login":"signup"));
  $("auth-form").addEventListener("submit",async e=>{
    e.preventDefault();if(!client){toast("Add your Supabase URL and anon key in config.js first.",true);return}
    const mode=e.currentTarget.dataset.mode,email=$("auth-email").value.trim(),password=$("auth-password").value;
    $("auth-submit").disabled=true;
    try{
      if(mode==="signup"){
        const {data,error}=await client.auth.signUp({email,password,options:{data:{full_name:$("auth-name").value.trim()}}});
        if(error)throw error;
        if(data.session){toast("Account created. Welcome!")}else{toast("Check your email to confirm your account before signing in.")}
      }else{const {error}=await client.auth.signInWithPassword({email,password});if(error)throw error}
    }catch(err){toast(err.message,true)}finally{$("auth-submit").disabled=false}
  });
  $("forgot-password").addEventListener("click",async()=>{if(!client){toast("Configure Supabase first.",true);return}const email=$("auth-email").value.trim();if(!email){toast("Enter your email address first.",true);return}const {error}=await client.auth.resetPasswordForEmail(email,{redirectTo:location.origin+location.pathname});toast(error?"Could not send reset email: "+error.message:"Password reset email sent.",!!error)});
  $("sign-out").addEventListener("click",async()=>{await client.auth.signOut();state.user=null;showAuth()});
  $("mobile-menu").addEventListener("click",()=>$("sidebar").classList.toggle("open"));
  document.addEventListener("click",e=>{
    const nav=e.target.closest("[data-page],[data-nav]");if(nav){setPage(nav.dataset.page||nav.dataset.nav);return}
    const act=e.target.closest("[data-action]");if(act)handleAction(act.dataset.action,act.dataset.id);
  });
  $("record-dialog").addEventListener("click",e=>{if(e.target===$("record-dialog"))closeDialog()});
  async function enterApp(user){
    state.user=user;try{await loadProfile();await refresh();$("auth-screen").classList.add("hidden");$("app-shell").classList.remove("hidden")}catch(err){toast(err.message,true);await client.auth.signOut()}
  }
  async function init(){
    if(!client){showAuth();toast("Setup required: add Supabase project details in config.js.",true);return}
    const {data:{session}}=await client.auth.getSession();
    if(session)await enterApp(session.user);else showAuth();
    client.auth.onAuthStateChange((_event,session)=>{if(session&&state.user?.id!==session.user.id)enterApp(session.user);else if(!session&&state.user){state.user=null;showAuth()}});
  }
  init();
})();