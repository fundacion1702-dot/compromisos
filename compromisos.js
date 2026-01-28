/* compromisos.js (PARTE 1/3) */
(function(){
  "use strict";

  /* =========================
     Helpers básicos
  ========================= */
  const $ = (id) => document.getElementById(id);

  const KEY = "compromisos.data.v1";
  const CONTACTS_KEY = "compromisos.contacts.v1";
  const SETTINGS_KEY = "compromisos.settings.v1";
  const RECEIVED_KEY = "compromisos.received.v1";
  const A11Y_KEY = "compromisos.a11y.v1";

  function safeJsonParse(s, fallback){
    try{ return JSON.parse(s); }catch(e){ return fallback; }
  }
  function load(key, fallback){
    const v = localStorage.getItem(key);
    if(v == null) return fallback;
    return safeJsonParse(v, fallback);
  }
  function save(key, val){
    localStorage.setItem(key, JSON.stringify(val));
  }
  function uid(){
    return Math.random().toString(36).slice(2) + Date.now().toString(36);
  }
  function esc(s){
    return String(s ?? "")
      .replaceAll("&","&amp;")
      .replaceAll("<","&lt;")
      .replaceAll(">","&gt;")
      .replaceAll('"',"&quot;")
      .replaceAll("'","&#039;");
  }

  function toast(msg){
    const t = $("toast");
    if(!t) return;
    t.textContent = msg;
    t.classList.add("show");
    clearTimeout(toast._tm);
    toast._tm = setTimeout(()=> t.classList.remove("show"), 2200);
  }

  function normalizeName(s){
    return String(s||"").trim().replace(/\s+/g," ");
  }

  /* =========================
     Estado / datos
  ========================= */
  let data = load(KEY, []);
  let contacts = load(CONTACTS_KEY, []);
  let settings = load(SETTINGS_KEY, {
    pinEnabled:false,
    autoLockMin:0,
    rememberMin:0,
    notifEnabled:false
  });
  let received = load(RECEIVED_KEY, { c:0, lastAt:null });

  let pane = "commitments";
  let view = "pending";
  let lastCommitView = "pending";

  let commitFriendFilter = "all";
  let commitTextFilter = "";
  let contactsTextFilter = "";

  /* =========================
     Migración estados
  ========================= */
  function normalizeStatus(it){
    let status = it.status;
    if(!["pending","waiting","closed"].includes(status)){
      status = it.done ? "closed" : "pending";
    }
    return {
      ...it,
      status,
      done: status==="closed",
      closedAt: status==="closed" ? (it.closedAt || it.doneAt || new Date().toISOString()) : null
    };
  }

  function migrateAllData(){
    let changed=false;
    data = data.map(it=>{
      const n = normalizeStatus(it);
      if(JSON.stringify(it)!==JSON.stringify(n)) changed=true;
      return n;
    });
    if(changed) save(KEY,data);
  }

  /* =========================
     Utilidades contactos
  ========================= */
  function findContactByName(name){
    const n = normalizeName(name).toLowerCase();
    return contacts.find(c=> normalizeName(c.name).toLowerCase()===n) || null;
  }
  function getContactById(id){
    return contacts.find(c=>c.id===id) || null;
  }

  function fillFriendsDatalist(){
    const dl = $("friendsDatalist");
    if(!dl) return;
    dl.innerHTML = "";
    contacts
      .slice()
      .sort((a,b)=>(a.name||"").localeCompare(b.name||"","es"))
      .forEach(c=>{
        const opt=document.createElement("option");
        opt.value = normalizeName(c.name||"");
        dl.appendChild(opt);
      });
  }

  /* =========================
     Navegación básica
  ========================= */
  function setPane(p){
    pane=p;
    $("commitmentsPane").style.display = p==="commitments"?"":"none";
    $("contactsPane").style.display = p==="contacts"?"":"none";
    $("settingsPane").style.display = p==="settings"?"":"none";
  }

  function setView(v){
    view=v;
    lastCommitView=v;
    renderCommitments();
  }

  /* =========================
     Render compromisos (base)
  ========================= */
  function passesCommitFilters(it){
    if(commitFriendFilter!=="all"){
      if(commitFriendFilter==="__none__" && it.whoId) return false;
      if(commitFriendFilter!=="__none__" && it.whoId!==commitFriendFilter) return false;
    }
    if(commitTextFilter){
      const q = commitTextFilter.toLowerCase();
      const who = (it.whoId ? getContactById(it.whoId)?.name : it.whoName || "").toLowerCase();
      const what = (it.what||"").toLowerCase();
      if(!who.includes(q) && !what.includes(q)) return false;
    }
    return true;
  }

  function renderCommitments(){
    const list = $("list");
    const empty = $("empty");
    if(!list) return;

    list.innerHTML="";
    const items = data.filter(it=>it.status===view).filter(passesCommitFilters);

    empty.style.display = items.length?"none":"block";

    items.forEach(it=>{
      const card=document.createElement("div");
      card.className="card";
      card.innerHTML = `
        <div class="cardTop">
          <div class="who">
            <p class="name">${esc(it.whoId?getContactById(it.whoId)?.name:it.whoName||"—")}</p>
            <p class="meta"><span class="chip">${it.status}</span></p>
          </div>
        </div>
        <div class="desc">${esc(it.what||"")}</div>
      `;
      list.appendChild(card);
    });
  }

  /* =========================
     Boot (continuará)
  ========================= */
  function start(){
    migrateAllData();
    fillFriendsDatalist();
    renderCommitments();
  }

  if(document.readyState==="loading"){
    document.addEventListener("DOMContentLoaded", start);
  }else{
    start();
  }