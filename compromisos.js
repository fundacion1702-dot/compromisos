/* compromisos.js (COMPLETO) */
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
  function fmtDate(iso){
    try{
      if(!iso) return "";
      const d = (iso instanceof Date) ? iso : new Date(iso);
      if(isNaN(d.getTime())) return "";
      return d.toLocaleString("es-ES", {
        year:"numeric", month:"2-digit", day:"2-digit",
        hour:"2-digit", minute:"2-digit"
      });
    }catch(e){ return ""; }
  }
  function isOverdue(iso){
    if(!iso) return false;
    const t = new Date(iso).getTime();
    if(!isFinite(t)) return false;
    return t < Date.now();
  }
  function appBaseUrl(){
    const u = new URL(location.href);
    u.hash = "";
    u.search = "";
    return u.toString();
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

  let pane = "commitments"; // commitments | contacts | settings
  let view = "pending";     // pending | waiting | closed
  let lastCommitView = "pending";

  // ✅ filtros/búsquedas (desplegable como antes: botón + panel)
  let commitFriendFilter = "all"; // all | __none__ | <contactId>
  let commitTextFilter = "";      // búsqueda en texto / quién
  let contactsTextFilter = "";    // búsqueda amigos
  let commitToolsOpen = false;

  /* =========================
     ✅ Migración: done -> status
     status: pending | waiting | closed
  ========================= */
  function normalizeStatus(it){
    const nowIso = new Date().toISOString();

    let status = it.status;
    if(status !== "pending" && status !== "waiting" && status !== "closed"){
      if(it.done === true) status = "closed";
      else status = "pending";
    }

    const done = (status === "closed");
    const closedAt = it.closedAt || it.doneAt || (done ? (it.doneAt || nowIso) : null);

    return {
      ...it,
      status,
      done,
      doneAt: done ? (it.doneAt || closedAt) : null,
      closedAt: done ? closedAt : null
    };
  }

  function migrateAllData(){
    let changed = false;
    data = (data || []).map(it=>{
      const before = JSON.stringify({ status:it.status, done:it.done, doneAt:it.doneAt, closedAt:it.closedAt });
      const afterObj = normalizeStatus(it);
      const after = JSON.stringify({ status:afterObj.status, done:afterObj.done, doneAt:afterObj.doneAt, closedAt:afterObj.closedAt });
      if(before !== after) changed = true;
      return afterObj;
    });
    if(changed) save(KEY, data);
  }

  /* =========================
     ✅ Texto grande
  ========================= */
  function applyTextScale(big){
    document.documentElement.style.setProperty("--fs", big ? "18px" : "16px");
    document.documentElement.style.setProperty("--fsBig", big ? "20px" : "18px");
    document.body.classList.toggle("bigText", !!big);

    const label = big ? "🔎 Texto normal" : "🔎 Texto grande";
    const bTop = $("btnA11yTop");
    const bSet = $("btnA11y");
    if(bTop) bTop.textContent = label;
    if(bSet) bSet.textContent = label;
  }

  function setTextScale(big){
    save(A11Y_KEY, { big: !!big });
    applyTextScale(!!big);
  }

  function toggleTextScale(){
    const cur = load(A11Y_KEY, { big:false });
    const next = !cur.big;
    setTextScale(next);
    toast(next ? "🔎 Texto grande: ON" : "🔎 Texto grande: OFF");
  }

  const _a11yGuard = { last: 0, lockMs: 420 };
  function guardedToggle(e){
    const now = Date.now();
    if(now - _a11yGuard.last < _a11yGuard.lockMs) return;
    _a11yGuard.last = now;
    try{ e && e.preventDefault && e.preventDefault(); }catch(_){}
    try{ e && e.stopPropagation && e.stopPropagation(); }catch(_){}
    toggleTextScale();
  }

  function bindA11yDelegation(){
    const matchA11y = (node)=>{
      if(!node) return null;
      const el = node.closest?.("#btnA11yTop,#btnA11y,.a11yBtn,[data-a11y='bigtext']");
      if(!el) return null;
      const txt = (el.textContent || "").toLowerCase();
      if(!txt.includes("texto grande") && !txt.includes("texto normal")) return null;
      return el;
    };

    const handler = (e)=>{
      const el = matchA11y(e.target);
      if(!el) return;
      guardedToggle(e);
    };

    document.addEventListener("click", handler, true);
    document.addEventListener("touchend", handler, true);
    document.addEventListener("pointerup", handler, true);
    document.addEventListener("keydown", (e)=>{
      if(e.key!=="Enter" && e.key!==" ") return;
      const el = matchA11y(document.activeElement);
      if(!el) return;
      guardedToggle(e);
    }, true);
  }

  /* =========================
     Click en logo/título => home
  ========================= */
  function bindBrandHome(){
    const brand = document.querySelector(".brand");
    if(brand){
      try{
        brand.style.cursor = "pointer";
        if(!brand.hasAttribute("tabindex")) brand.setAttribute("tabindex","0");
        brand.setAttribute("role","button");
        brand.setAttribute("aria-label","Ir a pantalla principal");
      }catch(e){}
    }

    const isBrandTarget = (node)=>{
      if(!node) return null;
      return node.closest?.(".brand, .brand .logo, .brand .titleBox, .brand .title, .brand .subtitle") || null;
    };

    const goHome = (e)=>{
      try{ e && e.preventDefault && e.preventDefault(); }catch(_){}
      try{ e && e.stopPropagation && e.stopPropagation(); }catch(_){}
      setPane("commitments");
      setView("pending");
      try{ window.scrollTo({ top:0, behavior:"smooth" }); }catch(_){ window.scrollTo(0,0); }
    };

    document.addEventListener("click", (e)=>{
      const el = isBrandTarget(e.target);
      if(!el) return;
      goHome(e);
    }, true);

    document.addEventListener("touchend", (e)=>{
      const el = isBrandTarget(e.target);
      if(!el) return;
      goHome(e);
    }, { capture:true, passive:false });

    document.addEventListener("keydown", (e)=>{
      if(e.key!=="Enter" && e.key!==" ") return;
      const el = isBrandTarget(document.activeElement);
      if(!el) return;
      goHome(e);
    }, true);
  }

  /* =========================
     Pills (Recibidos, En espera, Vencidos)
  ========================= */
  function ensureWaitingPill(){
    try{
      const pills = document.querySelector(".pills");
      if(!pills) return;

      if($("btnWaitingTop")) return;

      const btn = document.createElement("button");
      btn.className = "pillBtn";
      btn.id = "btnWaitingTop";
      btn.type = "button";
      btn.title = "En espera";
      btn.innerHTML = `
        <span class="pillDot" aria-hidden="true"></span>
        <span>En espera</span>
        <span class="pillCount" id="bWaiting">0</span>
      `;

      pills.insertBefore(btn, pills.firstElementChild || null);

      btn.addEventListener("click", ()=>{
        setPane("commitments");
        setView("waiting");
        const w = data.filter(x=>x.status==="waiting").length;
        toast(w ? `⏳ En espera: ${w}` : "Nada en espera");
      });
    }catch(e){}
  }

  function fixPillsOrder(){
    // Mantener orden DOM: En espera -> Recibidos -> Vencidos
    try{
      const pills = document.querySelector(".pills");
      if(!pills) return;

      const w = pills.querySelector("#btnWaitingTop");
      const r = pills.querySelector("#btnReceived");
      const v = pills.querySelector("#btnOverdue");

      if(w) pills.appendChild(w);
      if(r) pills.appendChild(r);
      if(v) pills.appendChild(v);

      if(w) pills.insertBefore(w, pills.firstElementChild);
      if(r && v) pills.insertBefore(r, v);
    }catch(e){}
  }

  /* =========================
     Quitar “Instálala / Consejo”
     (sin romper HTML: limpiamos y ocultamos banner)
  ========================= */
  function removeBottomInstallText(){
    try{
      const ban = $("installBanner");
      if(ban){
        ban.classList.remove("show");
        ban.style.display = "none";
        ban.setAttribute("aria-hidden","true");
      }
      const t = $("installTitle");
      const p = $("installText");
      if(t) t.textContent = "";
      if(p) p.textContent = "";

      const candidates = document.querySelectorAll("a,button,div,span,p,li");
      candidates.forEach(el=>{
        if(!el || el.children.length) return;
        const txt = (el.textContent || "").trim();
        if(txt === "Instálala" || txt === "Consejo"){
          el.textContent = "";
          el.style.display = "none";
        }
      });
    }catch(e){}
  }

  /* =========================
     Navegación panes
  ========================= */
  function safeShow(el, show){
    if(!el) return;
    el.style.display = show ? "" : "none";
  }

  function setPane(newPane){
    pane = newPane;

    const tC = $("tabCommitments");
    const tA = $("tabContacts");

    if(tC) tC.classList.toggle("active", pane==="commitments");
    if(tA) tA.classList.toggle("active", pane==="contacts");

    safeShow($("commitmentsPane"), pane==="commitments");
    safeShow($("contactsPane"), pane==="contacts");
    safeShow($("settingsPane"), pane==="settings");

    const fab = $("fab");
    if(fab){
      if(pane === "settings") fab.style.display = "none";
      else{
        fab.style.display = "grid";
        fab.setAttribute("aria-label", pane==="contacts" ? "Nuevo amigo" : "Nuevo compromiso");
      }
    }

    if(pane === "commitments"){
      setView(lastCommitView || "pending");
    }else{
      renderAll();
    }

    try{ window.scrollTo({ top:0, behavior:"smooth" }); }catch(e){ window.scrollTo(0,0); }
  }

  function titleForView(v){
    if(v==="waiting") return "En espera";
    if(v==="closed") return "Cerrados";
    return "Pendientes";
  }

  function updateCommitmentsHeading(){
    try{
      const paneEl = $("commitmentsPane");
      if(!paneEl) return;
      const h2 = paneEl.querySelector(".sectionHead h2");
      if(h2) h2.textContent = titleForView(view);

      const p = paneEl.querySelector(".sectionHead p");
      if(p){
        if(view==="pending") p.textContent = "Por hacer (lo tengo yo pendiente).";
        else if(view==="waiting") p.textContent = "Yo ya respondí; queda pendiente la otra persona.";
        else p.textContent = "Finalizados / ya no requieren nada.";
      }
    }catch(e){}
  }

  function setView(newView){
    view = newView;
    if(pane === "commitments") lastCommitView = newView;

    const a = $("tabPending");
    const w = $("tabWaiting");
    const c = $("tabDone");

    if(a) a.classList.toggle("active", view==="pending");
    if(w) w.classList.toggle("active", view==="waiting");
    if(c) c.classList.toggle("active", view==="closed");

    updateCommitmentsHeading();
    renderCommitments();
  }

  /* =========================
     ✅ Botón ⚙️: abrir/cerrar ajustes
  ========================= */
  function bindSettingsGear(){
    const gear = $("btnSettingsGear");
    if(!gear) return;

    if(gear.dataset.bound === "1") return;
    gear.dataset.bound = "1";

    gear.addEventListener("click", ()=>{
      if(pane === "settings"){
        setPane("commitments");
        return;
      }
      setPane("settings");
    });
  }

  function bindNav(){
    if($("tabCommitments")) $("tabCommitments").onclick = ()=> setPane("commitments");
    if($("tabContacts")) $("tabContacts").onclick = ()=> setPane("contacts");

    if($("tabPending")) $("tabPending").onclick = ()=> setView("pending");
    if($("tabWaiting")) $("tabWaiting").onclick = ()=> setView("waiting");
    if($("tabDone")) $("tabDone").onclick = ()=> setView("closed");

    const bindTile = (id, fn)=>{
      const el = $(id);
      if(!el) return;
      el.addEventListener("click", fn);
      el.addEventListener("keydown", (e)=>{
        if(e.key==="Enter" || e.key===" "){ e.preventDefault(); fn(); }
      });
    };
    bindTile("tilePending", ()=>{ setPane("commitments"); setView("pending"); });
    bindTile("tileWaiting", ()=>{ setPane("commitments"); setView("waiting"); });
    bindTile("tileDone", ()=>{ setPane("commitments"); setView("closed"); });
    bindTile("tileContacts", ()=>{ setPane("contacts"); });
    bindTile("tileSettings", ()=>{ setPane("settings"); });

    if($("btnOverdue")){
      $("btnOverdue").addEventListener("click", ()=>{
        setPane("commitments");
        setView("pending");
        const overdue = data.filter(x=> x.status==="pending" && isOverdue(x.when)).length;
        toast(overdue ? `⏰ ${overdue} vencido(s)` : "Sin vencidos ✅");
      });
    }
    if($("btnReceived")){
      $("btnReceived").addEventListener("click", ()=>{
        setPane("commitments");
        setView("pending");
        const c = Math.max(0, Number(received?.c || 0));
        toast(c ? `📥 Recibidos: ${c}` : "Sin recibidos");
      });
    }
  }

  /* =========================
     ✅ Búsqueda/Filtros (DESPLEGABLE como la foto)
     - Botón “🔍 Buscar / Filtrar”
     - Panel con: Filtrar por amigo + Buscar + Limpiar
     - Filtra en tiempo real
  ========================= */
  function ensureCommitFiltersUi(){
    const paneEl = $("commitmentsPane");
    if(!paneEl) return;

    // limpiar restos de versiones anteriores
    try{
      const legacyBtn = $("btnCommitTools");
      const legacyTools = $("miniCommitTools");
      if(legacyBtn) legacyBtn.remove();
      if(legacyTools) legacyTools.remove();
    }catch(_){}

    const head = paneEl.querySelector(".sectionHead");
    if(!head) return;

    // Botón toggle
    let toggle = $("commitToolsToggle");
    if(!toggle){
      toggle = document.createElement("button");
      toggle.id = "commitToolsToggle";
      toggle.type = "button";
      toggle.setAttribute("aria-expanded","false");
      toggle.innerHTML = "🔍&nbsp; Buscar / Filtrar";
      toggle.style.margin = "10px 12px 0";
      toggle.style.height = "34px";
      toggle.style.padding = "0 12px";
      toggle.style.borderRadius = "12px";
      toggle.style.border = "1px solid var(--border)";
      toggle.style.background = "var(--surface)";
      toggle.style.boxShadow = "var(--shadow2)";
      toggle.style.fontWeight = "900";
      toggle.style.cursor = "pointer";
      toggle.style.display = "inline-flex";
      toggle.style.alignItems = "center";
      toggle.style.gap = "8px";
      toggle.style.webkitTapHighlightColor = "transparent";

      head.insertAdjacentElement("afterend", toggle);
    }

    // Panel
    let panel = $("commitToolsPanel");
    if(!panel){
      panel = document.createElement("div");
      panel.id = "commitToolsPanel";
      panel.style.margin = "10px 12px 12px";
      panel.style.padding = "12px";
      panel.style.borderRadius = "16px";
      panel.style.border = "1px solid var(--border)";
      panel.style.background = "var(--surface)";
      panel.style.boxShadow = "var(--shadow2)";
      panel.style.display = "none";

      panel.innerHTML = `
        <div class="field" style="margin-top:0;">
          <label class="label" for="commitFriendSel">Filtrar por amigo</label>
          <select id="commitFriendSel"></select>
        </div>
        <div class="field">
          <label class="label" for="commitSearchTxt">Buscar</label>
          <input id="commitSearchTxt" type="text" placeholder="Ej: Ana / PDF / 20€" autocomplete="off"/>
        </div>
        <div class="actions" style="margin-top:10px;">
          <button class="btn" id="commitClearBtn" type="button">🧹 Limpiar</button>
        </div>
      `;

      toggle.insertAdjacentElement("afterend", panel);
    }

    const setOpen = (open)=>{
      commitToolsOpen = !!open;
      panel.style.display = commitToolsOpen ? "" : "none";
      toggle.setAttribute("aria-expanded", commitToolsOpen ? "true" : "false");
    };

    // bind toggle (solo una vez)
    if(toggle.dataset.bound !== "1"){
      toggle.dataset.bound = "1";
      toggle.addEventListener("click", ()=>{
        setOpen(!commitToolsOpen);
      });
    }

    // Mantener el panel como estaba visualmente (abierto por defecto en móvil si ya hay filtro/busqueda)
    const shouldOpen = !!(commitTextFilter || (commitFriendFilter && commitFriendFilter !== "all"));
    if(shouldOpen) setOpen(true);

    fillCommitFriendSelect();

    const clearBtn = $("commitClearBtn");
    if(clearBtn && clearBtn.dataset.bound !== "1"){
      clearBtn.dataset.bound = "1";
      clearBtn.addEventListener("click", ()=>{
        commitFriendFilter = "all";
        commitTextFilter = "";
        fillCommitFriendSelect();
        const inp = $("commitSearchTxt");
        if(inp) inp.value = "";
        renderCommitments();
      });
    }

    const txt = $("commitSearchTxt");
    if(txt){
      if(txt.value !== (commitTextFilter || "")) txt.value = commitTextFilter || "";
      if(txt.dataset.bound !== "1"){
        txt.dataset.bound = "1";
        txt.addEventListener("input", ()=>{
          commitTextFilter = (txt.value || "").trim();
          renderCommitments();
        });
      }
    }

    const sel = $("commitFriendSel");
    if(sel && sel.dataset.bound !== "1"){
      sel.dataset.bound = "1";
      sel.addEventListener("change", ()=>{
        commitFriendFilter = sel.value || "all";
        renderCommitments();
      });
    }
  }

  function fillCommitFriendSelect(){
    const sel = $("commitFriendSel");
    if(!sel) return;

    sel.innerHTML = "";
    const optAll = document.createElement("option");
    optAll.value = "all";
    optAll.textContent = "Todos";
    sel.appendChild(optAll);

    const optNone = document.createElement("option");
    optNone.value = "__none__";
    optNone.textContent = "Sin amigo (nombre escrito)";
    sel.appendChild(optNone);

    contacts
      .slice()
      .sort((a,b)=> (a.name||"").localeCompare(b.name||"", "es"))
      .forEach(c=>{
        const opt = document.createElement("option");
        opt.value = c.id;
        opt.textContent = c.name || "Sin nombre";
        sel.appendChild(opt);
      });

    sel.value = commitFriendFilter || "all";
  }

  function ensureContactsSearchUi(){
    const paneEl = $("contactsPane");
    if(!paneEl) return;

    // Limpieza de UI desplegable si existía
    try{
      const legacyBtn = $("btnContactsTools");
      const legacyTools = $("miniContactsTools");
      const legacyPanel = $("contactsToolsPanel");
      if(legacyBtn) legacyBtn.remove();
      if(legacyTools) legacyTools.remove();
      if(legacyPanel) legacyPanel.remove();
    }catch(_){}

    if(!$("contactsSearchBar")){
      const head = paneEl.querySelector(".sectionHead");
      if(!head) return;

      const bar = document.createElement("div");
      bar.id = "contactsSearchBar";
      bar.style.margin = "10px 12px 12px";
      bar.style.padding = "12px";
      bar.style.borderRadius = "16px";
      bar.style.border = "1px solid var(--border)";
      bar.style.background = "var(--surface)";
      bar.style.boxShadow = "var(--shadow2)";

      bar.innerHTML = `
        <div class="field" style="margin-top:0;">
          <label class="label" for="contactsSearchTxt">Buscar</label>
          <input id="contactsSearchTxt" type="text" placeholder="Ej: Ana / Trabajo" autocomplete="off"/>
        </div>
        <div class="actions" style="margin-top:10px;">
          <button class="btn" id="contactsClearBtn" type="button">🧹 Limpiar</button>
        </div>
      `;

      head.insertAdjacentElement("afterend", bar);
    }

    const clearBtn = $("contactsClearBtn");
    if(clearBtn && clearBtn.dataset.bound !== "1"){
      clearBtn.dataset.bound = "1";
      clearBtn.addEventListener("click", ()=>{
        contactsTextFilter = "";
        const inp = $("contactsSearchTxt");
        if(inp) inp.value = "";
        renderContacts();
      });
    }

    const txt = $("contactsSearchTxt");
    if(txt){
      if(txt.value !== (contactsTextFilter || "")) txt.value = contactsTextFilter || "";
      if(txt.dataset.bound !== "1"){
        txt.dataset.bound = "1";
        txt.addEventListener("input", ()=>{
          contactsTextFilter = (txt.value || "").trim();
          renderContacts();
        });
      }
    }
  }

  /* =========================
     Render helpers
  ========================= */
  function normalizeName(s){
    return String(s||"").trim().replace(/\s+/g," ");
  }
  function findContactByName(name){
    const n = normalizeName(name).toLowerCase();
    if(!n) return null;
    return contacts.find(c => normalizeName(c.name).toLowerCase() === n) || null;
  }
  function getContactById(id){
    return contacts.find(x=>x.id===id) || null;
  }

  function normalizedWho(item){
    if(item.whoId){
      const c = contacts.find(x=>x.id===item.whoId);
      if(c && c.name) return c.name;
    }
    return item.whoName || "Sin nombre";
  }

  function statusLabel(s){
    if(s==="waiting") return "⏳ En espera";
    if(s==="closed") return "✅ Cerrado";
    return "🟣 Pendiente";
  }

  function updateCounts(){
    const pending = data.filter(x=>x.status==="pending");
    const waiting = data.filter(x=>x.status==="waiting");
    const closed = data.filter(x=>x.status==="closed");

    if($("tilePendingCount")) $("tilePendingCount").textContent = String(pending.length);
    if($("tileWaitingCount")) $("tileWaitingCount").textContent = String(waiting.length);
    if($("tileDoneCount")) $("tileDoneCount").textContent = String(closed.length);

    if($("tileContactsCount")) $("tileContactsCount").textContent = String(contacts.length);
    if($("bContacts")) $("bContacts").textContent = String(contacts.length);

    const overdue = pending.filter(x=>isOverdue(x.when)).length;
    if($("bOverdue")) $("bOverdue").textContent = String(overdue);

    const rec = Math.max(0, Number(received?.c || 0));
    if($("bReceived")) $("bReceived").textContent = String(rec);

    if($("bWaiting")) $("bWaiting").textContent = String(waiting.length);
  }

  function passesCommitFilters(it){
    if(commitFriendFilter && commitFriendFilter !== "all"){
      if(commitFriendFilter === "__none__"){
        if(it.whoId) return false;
      }else{
        if(it.whoId !== commitFriendFilter) return false;
      }
    }

    const q = (commitTextFilter || "").trim().toLowerCase();
    if(q){
      const who = normalizedWho(it).toLowerCase();
      const what = String(it.what || "").toLowerCase();
      if(!who.includes(q) && !what.includes(q)) return false;
    }

    return true;
  }

  function renderCommitments(){
    ensureCommitFiltersUi();
    updateCommitmentsHeading();
    updateCounts();

    const list = $("list");
    const empty = $("empty");
    if(!list) return;

    list.innerHTML = "";

    const items = data
      .filter(x=> x.status === view)
      .filter(passesCommitFilters)
      .slice()
      .sort((a,b)=>{
        if(view==="pending"){
          const ao = isOverdue(a.when)?1:0, bo = isOverdue(b.when)?1:0;
          if(ao!==bo) return bo-ao;
          const ta = a.when ? new Date(a.when).getTime() : Number.POSITIVE_INFINITY;
          const tb = b.when ? new Date(b.when).getTime() : Number.POSITIVE_INFINITY;
          if(ta!==tb) return ta-tb;
          return new Date(b.updatedAt||b.createdAt||0).getTime() - new Date(a.updatedAt||a.createdAt||0).getTime();
        }
        if(view==="waiting"){
          return new Date(b.updatedAt||b.createdAt||0).getTime() - new Date(a.updatedAt||a.createdAt||0).getTime();
        }
        return new Date(b.closedAt||b.doneAt||0).getTime() - new Date(a.closedAt||a.createdAt||0).getTime();
      });

    if(empty) empty.style.display = items.length ? "none" : "block";

    items.forEach((it)=>{
      const card = document.createElement("div");
      card.className = "card";

      const who = normalizedWho(it);
      const dueText = it.when ? fmtDate(it.when) : "Sin fecha";
      const overdue = (it.status==="pending" && isOverdue(it.when));

      const stChip = `<span class="chip status">${esc(statusLabel(it.status))}</span>`;

      const btnPrimary = it.status==="closed" ? "↩️ Reabrir" : "✅ Cerrar";
      const btnSecondary =
        it.status==="pending" ? "⏳ En espera" :
        it.status==="waiting" ? "🟣 Pendiente" :
        "⏳ En espera";

      card.innerHTML = `
        <div class="cardTop" style="align-items:flex-start;">
          <div class="who" style="min-width:0;">
            <p class="name" title="${esc(who)}">${esc(who)}</p>
            <p class="meta">
              ${stChip}
              <span class="chip">📝 ${esc(fmtDate(it.createdAt))}</span>
              ${it.updatedAt ? `<span class="chip">✍️ ${esc(fmtDate(it.updatedAt))}</span>` : ``}
              ${it.status==="closed" ? `<span class="chip">✅ ${esc(fmtDate(it.closedAt||it.doneAt))}</span>` : ``}
            </p>
          </div>
          <div class="due ${overdue ? "bad" : ""}">
            ⏰ ${esc(dueText)}${overdue ? " · Vencido" : ""}
          </div>
        </div>

        <div class="desc">${esc(it.what || "—")}</div>

        <div class="actions">
          <button class="btn good" type="button" data-act="primary">${btnPrimary}</button>
          <button class="btn" type="button" data-act="secondary">${btnSecondary}</button>
          <button class="btn" type="button" data-act="edit">✍️ Editar</button>
          <button class="btn danger" type="button" data-act="del">🗑️ Eliminar</button>
        </div>
      `;

      const now = ()=> new Date().toISOString();

      card.querySelector('[data-act="primary"]').addEventListener("click", ()=>{
        if(it.status==="closed"){
          it.status = "pending";
          it.closedAt = null;
          it.done = false; it.doneAt = null;
          it.updatedAt = now();
          save(KEY, data);
          renderCommitments();
          return;
        }
        it.status = "closed";
        it.closedAt = now();
        it.done = true; it.doneAt = it.closedAt;
        it.updatedAt = now();
        save(KEY, data);
        renderCommitments();
      });

      card.querySelector('[data-act="secondary"]').addEventListener("click", ()=>{
        if(it.status==="pending"){
          it.status = "waiting";
          it.updatedAt = now();
          save(KEY, data);
          renderCommitments();
          return;
        }
        if(it.status==="waiting"){
          it.status = "pending";
          it.updatedAt = now();
          save(KEY, data);
          renderCommitments();
          return;
        }
        it.status = "waiting";
        it.closedAt = null;
        it.done = false; it.doneAt = null;
        it.updatedAt = now();
        save(KEY, data);
        renderCommitments();
      });

      card.querySelector('[data-act="edit"]').addEventListener("click", ()=> openCommitModal(it.id));
      card.querySelector('[data-act="del"]').addEventListener("click", ()=> deleteCommit(it.id));

      list.appendChild(card);
    });

    fixPillsOrder();
    removeBottomInstallText();
  }

  function renderContacts(){
    ensureContactsSearchUi();
    updateCounts();

    const list = $("contactsList");
    const empty = $("contactsEmpty");
    if(!list) return;

    list.innerHTML = "";

    const q = (contactsTextFilter || "").trim().toLowerCase();
    const items = contacts
      .slice()
      .sort((a,b)=> (a.name||"").localeCompare(b.name||"", "es"))
      .filter(c=>{
        if(!q) return true;
        const n = String(c.name||"").toLowerCase();
        const note = String(c.note||"").toLowerCase();
        return n.includes(q) || note.includes(q);
      });

    if(empty) empty.style.display = items.length ? "none" : "block";

    items.forEach((c)=>{
      const card = document.createElement("div");
      card.className = "card";

      const desc = (c.note || "").trim();

      card.innerHTML = `
        <div class="cardTop">
          <div class="who" style="min-width:0;">
            <p class="name">${esc(c.name || "Sin nombre")}</p>
            <p class="meta">
              <span class="chip">👥 Amigo</span>
              ${c.note ? `<span class="chip">🛈 ${esc(c.note)}</span>` : ``}
            </p>
          </div>
          <button class="btn primary" type="button" data-act="new" style="flex:0 0 auto;">➕ Compromiso</button>
        </div>
        ${desc ? `<div class="desc">${esc(desc)}</div>` : ``}
        <div class="actions">
          <button class="btn" type="button" data-act="edit">✍️ Editar</button>
          <button class="btn danger" type="button" data-act="del">🗑️ Eliminar</button>
        </div>
      `;

      card.querySelector('[data-act="new"]').addEventListener("click", ()=> openCommitModal(null, c.id));
      card.querySelector('[data-act="edit"]').addEventListener("click", ()=> openContactModal(c.id));
      card.querySelector('[data-act="del"]').addEventListener("click", ()=> deleteContact(c.id));

      list.appendChild(card);
    });

    fixPillsOrder();
    removeBottomInstallText();
  }

  function renderAll(){
    renderCommitments();
    renderContacts();
    updateCounts();
    fixPillsOrder();
    removeBottomInstallText();
  }

  /* =========================
     FAB
  ========================= */
  function bindFab(){
    const fab = $("fab");
    if(!fab) return;
    fab.addEventListener("click", ()=>{
      if(pane === "contacts") openContactModal(null);
      else openCommitModal(null, null);
    });
  }

  /* =========================
     Confirm modal
  ========================= */
  function openConfirm(title, msg, yesLabel, onYes, noLabel, onNo){
    const b = $("confirmBackdrop");
    if(!b) return;

    const t = $("confirmTitle");
    const m = $("confirmMsg");
    const yes = $("confirmYes");
    const no = $("confirmNo");
    const x = $("confirmClose");

    if(t) t.textContent = title || "Confirmar";
    if(m) m.textContent = msg || "";
    if(yes) yes.textContent = yesLabel || "Sí, continuar";
    if(no) no.textContent = noLabel || "Cancelar";

    b.classList.add("show");
    b.setAttribute("aria-hidden","false");

    const close = ()=>{
      b.classList.remove("show");
      b.setAttribute("aria-hidden","true");
      if(yes) yes.onclick = null;
      if(no) no.onclick = null;
      if(x) x.onclick = null;
    };

    if(no) no.onclick = ()=>{ close(); try{ onNo && onNo(); }catch(e){} };
    if(x) x.onclick  = ()=>{ close(); try{ onNo && onNo(); }catch(e){} };
    if(yes) yes.onclick = ()=>{ close(); try{ onYes && onYes(); }catch(e){} };
  }

  /* =========================
     Modales: Compromisos
     ✅ Autocompletado: datalist NATIVO
     - Siempre cargamos TODOS los amigos en <datalist>
     - El navegador filtra mientras escribes
     - Si coincide exacto: se vincula (modalWhoId)
     - Si no: al guardar, preguntar si crear amigo
  ========================= */
  let editingCommitId = null;
  let modalWhoId = null;

  function openModal(el){
    if(!el) return;
    el.classList.add("show");
    el.setAttribute("aria-hidden","false");
  }
  function closeModal(el){
    if(!el) return;
    el.classList.remove("show");
    el.setAttribute("aria-hidden","true");
  }

  function toLocalInputValue(iso){
    try{
      if(!iso) return "";
      const d = new Date(iso);
      if(isNaN(d.getTime())) return "";
      const pad = (n)=> String(n).padStart(2,"0");
      return `${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
    }catch(e){ return ""; }
  }
  function fromLocalInputValue(v){
    try{
      if(!v) return null;
      const d = new Date(v);
      if(isNaN(d.getTime())) return null;
      return d.toISOString();
    }catch(e){ return null; }
  }

  function fillFriendsDatalist(){
    const dl = $("friendsDatalist") || $("friendsList");
    if(!dl) return;
    dl.innerHTML = "";

    contacts
      .slice()
      .sort((a,b)=> (a.name||"").localeCompare(b.name||"", "es"))
      .forEach(c=>{
        const name = normalizeName(c.name || "");
        if(!name) return;
        const opt = document.createElement("option");
        opt.value = name;
        dl.appendChild(opt);
      });
  }

  function setModalWhoFromNameInput(){
    const inp = $("fWho");
    if(!inp) return;

    const raw = normalizeName(inp.value || "");
    if(!raw){ modalWhoId = null; return; }
    const match = findContactByName(raw);
    modalWhoId = match ? match.id : null;
  }

  function setNameInputForWho(whoId, whoName){
    const inp = $("fWho");
    if(!inp) return;

    if(whoId){
      const c = getContactById(whoId);
      inp.value = c?.name || "";
      modalWhoId = whoId;
      return;
    }
    inp.value = whoName || "";
    modalWhoId = null;
    setModalWhoFromNameInput();
  }

  function resolveWho_NEW(){
    const inp = $("fWho");
    const raw = normalizeName(inp?.value || "");
    if(modalWhoId) return { whoId: modalWhoId, whoName: "" };
    return { whoId:null, whoName: raw };
  }

  function openCommitModal(id, presetContactId){
    editingCommitId = id || null;

    const it = id ? data.find(x=>x.id===id) : null;

    const whoId = it?.whoId || presetContactId || null;
    const whoName = it?.whoName || "";

    fillFriendsDatalist();
    setNameInputForWho(whoId, whoName);

    const fWhat = $("fWhat");
    const fWhen = $("fWhen");
    const fRemind = $("fRemind");
    const fAfter = $("fAfter");

    if(fWhat) fWhat.value = it?.what || "";
    if(fWhen) fWhen.value = it?.when ? toLocalInputValue(it.when) : "";
    if(fRemind) fRemind.value = String(it?.remindMin || 0);
    if(fAfter) fAfter.value = String(it?.afterMin || 0);

    const mt = $("modalTitle");
    if(mt) mt.textContent = id ? "Editar compromiso" : "Nuevo compromiso";

    openModal($("backdrop"));
  }

  function closeCommitModal(){
    closeModal($("backdrop"));
    editingCommitId = null;
    modalWhoId = null;
  }

  function proceedMaybeSaveNewFriend(rawName, onLinked, onCustom){
    if(!rawName){ onCustom(); return; }
    const existing = findContactByName(rawName);
    if(existing){ onLinked(existing); return; }

    openConfirm(
      "¿Guardar nuevo amigo?",
      `Has escrito “${rawName}”. ¿Quieres guardarlo en tus Amigos para reutilizarlo?`,
      "Sí, guardar",
      ()=>{
        const newC = { id: uid(), name: rawName, note: "" };
        contacts = [newC, ...contacts];
        save(CONTACTS_KEY, contacts);

        fillCommitFriendSelect();
        fillFriendsDatalist();

        onLinked(newC);
      },
      "No, solo para este",
      ()=> onCustom()
    );
  }

  function saveCommitFromForm(){
    const fWhat = $("fWhat");
    const fWhen = $("fWhen");
    const fRemind = $("fRemind");
    const fAfter = $("fAfter");

    const what = (fWhat?.value || "").trim();
    if(!what){
      toast("Escribe qué se acordó.");
      try{ fWhat.focus(); }catch(e){}
      return;
    }

    const whenIso = fromLocalInputValue(fWhen?.value || "");
    const remindMin = Number(fRemind?.value || 0) || 0;
    const afterMin = Number(fAfter?.value || 0) || 0;

    const now = new Date().toISOString();

    const proceedSave = (who)=>{
      if(editingCommitId){
        const idx = data.findIndex(x=>x.id===editingCommitId);
        if(idx >= 0){
          data[idx] = normalizeStatus({
            ...data[idx],
            whoId: who.whoId,
            whoName: who.whoName,
            what,
            when: whenIso,
            remindMin,
            afterMin,
            updatedAt: now
          });
        }
        save(KEY, data);
        toast("✍️ Compromiso editado");
        closeCommitModal();
        openShareModal(data[idx]);
      }else{
        const item = normalizeStatus({
          id: uid(),
          whoId: who.whoId,
          whoName: who.whoName,
          what,
          when: whenIso,
          remindMin,
          afterMin,
          status:"pending",
          createdAt: now,
          updatedAt: null
        });
        data = [item, ...data];
        save(KEY, data);
        toast("✅ Compromiso creado");
        closeCommitModal();
        openShareModal(item);
      }

      renderAll();
    };

    setModalWhoFromNameInput();
    const whoResolved = resolveWho_NEW();

    if(!whoResolved.whoId){
      const raw = whoResolved.whoName || "";
      proceedMaybeSaveNewFriend(
        raw,
        (linked)=> proceedSave({ whoId: linked.id, whoName: "" }),
        ()=> proceedSave({ whoId: null, whoName: raw })
      );
      return;
    }

    proceedSave(whoResolved);
  }

  function deleteCommit(id){
    const it = data.find(x=>x.id===id);
    openConfirm(
      "Eliminar compromiso",
      it ? `¿Seguro que quieres eliminar “${it.what || "compromiso"}”?` : "¿Seguro que quieres eliminar este compromiso?",
      "Sí, eliminar",
      ()=>{
        data = data.filter(x=>x.id!==id);
        save(KEY, data);
        toast("🗑️ Eliminado");
        renderAll();
      }
    );
  }

  function bindCommitModal(){
    const b = $("backdrop");
    if(b){
      b.addEventListener("click", (e)=>{ if(e.target === b) closeCommitModal(); });
    }
    if($("btnClose")) $("btnClose").onclick = closeCommitModal;
    if($("btnCancel")) $("btnCancel").onclick = closeCommitModal;
    if($("btnSave")) $("btnSave").onclick = saveCommitFromForm;

    const who = $("fWho");
    if(who && who.dataset.bound !== "1"){
      who.dataset.bound = "1";

      // ✅ datalist: el navegador muestra sugerencias; nosotros solo mantenemos modalWhoId sincronizado
      who.addEventListener("input", ()=>{
        setModalWhoFromNameInput();
      });

      who.addEventListener("change", ()=>{
        setModalWhoFromNameInput();
        if(modalWhoId){
          const c = getContactById(modalWhoId);
          if(c?.name) toast(`👥 Vinculado: ${c.name}`);
        }
      });
    }
  }

  /* =========================
     Modales: Amigos
  ========================= */
  let editingContactId = null;

  function openContactModal(id){
    editingContactId = id || null;
    const c = id ? contacts.find(x=>x.id===id) : null;

    if($("cName")) $("cName").value = c?.name || "";
    if($("cNote")) $("cNote").value = c?.note || "";

    const t = $("cModalTitle");
    if(t) t.textContent = id ? "Editar amigo" : "Nuevo amigo";

    openModal($("cBackdrop"));
    setTimeout(()=>{ try{ $("cName").focus(); }catch(e){} }, 0);
  }

  function closeContactModal(){
    closeModal($("cBackdrop"));
    editingContactId = null;
  }

  function saveContactFromForm(){
    const name = normalizeName($("cName")?.value || "");
    const note = normalizeName($("cNote")?.value || "");

    if(!name){
      toast("Escribe un nombre.");
      try{ $("cName").focus(); }catch(e){}
      return;
    }

    if(editingContactId){
      const idx = contacts.findIndex(x=>x.id===editingContactId);
      if(idx>=0) contacts[idx] = { ...contacts[idx], name, note };
      toast("✍️ Amigo editado");
    }else{
      contacts = [{ id: uid(), name, note }, ...contacts];
      toast("✅ Amigo creado");
    }

    save(CONTACTS_KEY, contacts);

    fillCommitFriendSelect();
    fillFriendsDatalist();

    closeContactModal();
    renderAll();
  }

  function deleteContact(id){
    const c = contacts.find(x=>x.id===id);
    openConfirm(
      "Eliminar amigo",
      c ? `¿Seguro que quieres eliminar a “${c.name}”?` : "¿Seguro que quieres eliminar este amigo?",
      "Sí, eliminar",
      ()=>{
        const name = c?.name || "";
        contacts = contacts.filter(x=>x.id!==id);
        save(CONTACTS_KEY, contacts);

        data = data.map(it=>{
          if(it.whoId === id){
            return normalizeStatus({ ...it, whoId:null, whoName: it.whoName || name || "Sin nombre", updatedAt: new Date().toISOString() });
          }
          return it;
        });
        save(KEY, data);

        fillCommitFriendSelect();
        fillFriendsDatalist();

        toast("🗑️ Amigo eliminado");
        renderAll();
      }
    );
  }

  function bindContactModal(){
    const b = $("cBackdrop");
    if(b){
      b.addEventListener("click", (e)=>{ if(e.target === b) closeContactModal(); });
    }
    if($("cBtnClose")) $("cBtnClose").onclick = closeContactModal;
    if($("cBtnCancel")) $("cBtnCancel").onclick = closeContactModal;
    if($("cBtnSave")) $("cBtnSave").onclick = saveContactFromForm;
  }

  /* =========================
     Compartir (sin cambios)
  ========================= */
  let shareItem = null;
  let shareMode = "short"; // short | long

  function encodePackage(pkg){
    const json = JSON.stringify(pkg);
    const b64 = btoa(unescape(encodeURIComponent(json)))
      .replaceAll("+","-").replaceAll("/","_").replaceAll("=","");
    return b64;
  }

  function buildPackage(item){
    return {
      v: 1,
      p: {
        id: uid(),
        whoId: item.whoId || null,
        whoName: item.whoId ? "" : (item.whoName || ""),
        what: item.what || "",
        when: item.when || null,
        remindMin: Number(item.remindMin||0) || 0,
        afterMin: Number(item.afterMin||0) || 0,
        createdAt: new Date().toISOString()
      }
    };
  }

  function buildImportUrl(pkg){
    return appBaseUrl() + "#p=" + encodePackage(pkg);
  }

  function formatShareText(item, url, mode){
    const who = item.whoId ? (getContactById(item.whoId)?.name || "Amigo") : (item.whoName || "Sin nombre");
    const whenTxt = item.when ? fmtDate(item.when) : "Sin fecha";
    const afterMin = Number(item.afterMin||0) || 0;

    if(mode === "long"){
      return [
        "📌 Compromiso",
        "",
        `👤 Con: ${who}`,
        `📝 Qué: ${item.what || "—"}`,
        `⏰ Para: ${whenTxt}`,
        afterMin ? `⏳ Aviso en: ${afterMin >= 60 ? (afterMin/60)+"h" : afterMin+"m"}` : "",
        "",
        "🔗 Abre el enlace para importar:",
        url
      ].filter(Boolean).join("\n");
    }

    return [
      item.updatedAt ? "✍️ Compromiso editado" : "✅ Nuevo compromiso",
      `👤 ${who}`,
      `📝 ${item.what || "—"}`,
      afterMin ? `⏳ Aviso en: ${afterMin >= 60 ? (afterMin/60)+"h" : afterMin+"m"}` : "",
      `🔗 Abre el enlace para importar. ${url}`
    ].filter(Boolean).join("\n");
  }

  async function copyText(text){
    try{
      await navigator.clipboard.writeText(text);
      toast("📋 Copiado");
      return true;
    }catch(e){
      try{
        const ta = document.createElement("textarea");
        ta.value = text;
        ta.style.position="fixed";
        ta.style.left="-9999px";
        document.body.appendChild(ta);
        ta.select();
        document.execCommand("copy");
        document.body.removeChild(ta);
        toast("📋 Copiado");
        return true;
      }catch(err){
        toast("No se pudo copiar");
        return false;
      }
    }
  }

  async function shareNative(text){
    try{
      if(navigator.share){
        await navigator.share({ text });
        return true;
      }
      return false;
    }catch(e){
      return false;
    }
  }

  function openShareModal(item){
    shareItem = item;
    shareMode = "short";

    const pkg = buildPackage(item);
    const url = buildImportUrl(pkg);

    if($("shareTitle")) $("shareTitle").textContent = "Se enviará un texto completo + enlace de importación.";
    if($("shareShort")) $("shareShort").classList.add("active");
    if($("shareLong")) $("shareLong").classList.remove("active");

    if($("shareTextBox")) $("shareTextBox").textContent = formatShareText(item, url, shareMode);
    if($("shareUrlBox")) $("shareUrlBox").textContent = url;

    openModal($("shareBackdrop"));
  }

  function closeShareModal(){
    closeModal($("shareBackdrop"));
    shareItem = null;
  }

  function bindShare(){
    if($("shareShort")) $("shareShort").onclick = ()=>{
      shareMode = "short";
      $("shareShort").classList.add("active");
      $("shareLong").classList.remove("active");
      if(!shareItem) return;
      const url = $("shareUrlBox")?.textContent || "";
      $("shareTextBox").textContent = formatShareText(shareItem, url, shareMode);
    };

    if($("shareLong")) $("shareLong").onclick = ()=>{
      shareMode = "long";
      $("shareLong").classList.add("active");
      $("shareShort").classList.remove("active");
      if(!shareItem) return;
      const url = $("shareUrlBox")?.textContent || "";
      $("shareTextBox").textContent = formatShareText(shareItem, url, shareMode);
    };

    if($("shareCopyUrl")) $("shareCopyUrl").onclick = ()=> copyText($("shareUrlBox")?.textContent || "");
    if($("shareCopyAll")) $("shareCopyAll").onclick = ()=>{
      const txt = ($("shareTextBox")?.textContent || "") + "\n";
      return copyText(txt);
    };

    if($("shareSend")) $("shareSend").onclick = async ()=>{
      const txt = ($("shareTextBox")?.textContent || "");
      const ok = await shareNative(txt);
      if(!ok) await copyText(txt);
    };

    if($("shareCancel")) $("shareCancel").onclick = closeShareModal;
    if($("shareClose")) $("shareClose").onclick = closeShareModal;

    const b = $("shareBackdrop");
    if(b){
      b.addEventListener("click", (e)=>{ if(e.target === b) closeShareModal(); });
    }
  }

  /* =========================
     Import desde #p=...
  ========================= */
  function decodePackage(b64url){
    try{
      const b64 = b64url.replaceAll("-","+").replaceAll("_","/");
      const pad = "=".repeat((4 - (b64.length % 4)) % 4);
      const bin = atob(b64 + pad);
      const json = decodeURIComponent(escape(bin));
      return JSON.parse(json);
    }catch(e){
      return null;
    }
  }

  function importFromHash(){
    const m = (location.hash || "").match(/(?:^|[#&])p=([^&]+)/);
    if(!m) return false;

    const pkg = decodePackage(m[1]);
    if(!pkg || pkg.v !== 1 || !pkg.p) return false;

    const incoming = pkg.p;
    const now = new Date().toISOString();

    const item = normalizeStatus({
      id: uid(),
      whoId: incoming.whoId || null,
      whoName: incoming.whoId ? "" : (incoming.whoName || "Sin nombre"),
      what: incoming.what || "",
      when: incoming.when || null,
      remindMin: Number(incoming.remindMin||0) || 0,
      afterMin: Number(incoming.afterMin||0) || 0,
      status:"pending",
      createdAt: now,
      updatedAt: null
    });

    const exists = data.some(x=>
      (x.what||"") === item.what &&
      (x.whoId||"") === (item.whoId||"") &&
      (x.whoName||"") === (item.whoName||"") &&
      (x.when||"") === (item.when||"")
    );

    if(!exists){
      data = [item, ...data];
      save(KEY, data);
      toast("📥 Compromiso importado");
    }else{
      toast("📥 Ya lo tenías importado");
    }

    received = received || { c:0, lastAt:null };
    received.c = Math.max(0, Number(received.c||0)) + 1;
    received.lastAt = now;
    save(RECEIVED_KEY, received);

    try{ history.replaceState(null, "", appBaseUrl()); }catch(e){ location.hash = ""; }

    setPane("commitments");
    setView("pending");
    renderAll();
    return true;
  }

  /* =========================
     Settings (mínimo)
  ========================= */
  function setSwitch(el, on){
    if(!el) return;
    el.classList.toggle("on", !!on);
    el.setAttribute("aria-checked", !!on ? "true" : "false");
  }

  function updateNotifHint(){
    const h = $("notifHint");
    if(!h) return;

    if(!("Notification" in window)){
      h.textContent = "ℹ️ Este navegador no soporta notificaciones.";
      return;
    }
    const perm = Notification.permission;
    if(perm === "granted") h.textContent = "✅ Permiso concedido. Recordatorios listos.";
    else if(perm === "denied") h.textContent = "❌ Permiso denegado. Actívalo en ajustes del navegador.";
    else h.textContent = "ℹ️ Pulsa “Permitir” para recibir recordatorios.";
  }

  function bindSettings(){
    const swPin = $("swPin");
    if(swPin){
      setSwitch(swPin, !!settings?.pinEnabled);
      swPin.addEventListener("click", ()=>{
        settings = { ...(settings||{}), pinEnabled: !settings?.pinEnabled };
        save(SETTINGS_KEY, settings);
        setSwitch(swPin, !!settings.pinEnabled);
        toast(settings.pinEnabled ? "🔒 PIN activado" : "🔓 PIN desactivado");
      });
    }

    const selAutoLock = $("selAutoLock");
    if(selAutoLock){
      selAutoLock.value = String(settings?.autoLockMin ?? 0);
      selAutoLock.addEventListener("change", ()=>{
        settings = { ...(settings||{}), autoLockMin: Number(selAutoLock.value||0) || 0 };
        save(SETTINGS_KEY, settings);
      });
    }

    const selRemember = $("selRemember");
    if(selRemember){
      selRemember.value = String(settings?.rememberMin ?? 0);
      selRemember.addEventListener("change", ()=>{
        settings = { ...(settings||{}), rememberMin: Number(selRemember.value||0) || 0 };
        save(SETTINGS_KEY, settings);
      });
    }

    const swNotif = $("swNotif");
    if(swNotif){
      setSwitch(swNotif, !!settings?.notifEnabled);
      swNotif.addEventListener("click", ()=>{
        settings = { ...(settings||{}), notifEnabled: !settings?.notifEnabled };
        save(SETTINGS_KEY, settings);
        setSwitch(swNotif, !!settings.notifEnabled);
        updateNotifHint();
      });
    }

    const btnNotifPerm = $("btnNotifPerm");
    if(btnNotifPerm){
      btnNotifPerm.addEventListener("click", async ()=>{
        try{
          if(!("Notification" in window)){
            toast("Este móvil no soporta notificaciones.");
            return;
          }
          const res = await Notification.requestPermission();
          toast(res === "granted" ? "✅ Permiso concedido" : "❌ Permiso no concedido");
          updateNotifHint();
        }catch(e){
          toast("No se pudo pedir permiso");
        }
      });
    }

    const btnResetAll = $("btnResetAll");
    if(btnResetAll){
      btnResetAll.addEventListener("click", ()=>{
        openConfirm(
          "Borrar todo",
          "Esto borrará compromisos, amigos y ajustes del móvil.",
          "Sí, borrar todo",
          ()=>{
            try{
              localStorage.removeItem(KEY);
              localStorage.removeItem(CONTACTS_KEY);
              localStorage.removeItem(SETTINGS_KEY);
              localStorage.removeItem(RECEIVED_KEY);
              localStorage.removeItem(A11Y_KEY);
            }catch(e){}
            data = [];
            contacts = [];
            settings = {
              pinEnabled:false,
              autoLockMin:0,
              rememberMin:0,
              notifEnabled:false
            };
            received = { c:0, lastAt:null };
            save(KEY, data);
            save(CONTACTS_KEY, contacts);
            save(SETTINGS_KEY, settings);
            save(RECEIVED_KEY, received);
            save(A11Y_KEY, { big:false });
            applyTextScale(false);
            commitFriendFilter = "all";
            commitTextFilter = "";
            contactsTextFilter = "";
            toast("🧹 Borrado");
            setPane("commitments");
            setView("pending");
            renderAll();
          }
        );
      });
    }

    updateNotifHint();
  }

  /* =========================
     Service worker
  ========================= */
  let deferredPrompt = null;
  function bindInstall(){
    removeBottomInstallText();

    window.addEventListener("beforeinstallprompt", (e)=>{
      e.preventDefault();
      deferredPrompt = e;
    });

    if("serviceWorker" in navigator){
      navigator.serviceWorker.register("sw.js").catch(()=>{});
    }
  }

  /* =========================
     Boot
  ========================= */
  (function normalizeContacts(){
    let changed = false;
    contacts = (contacts||[]).map(c=>{
      if(!c.id){ changed = true; return { ...c, id: uid() }; }
      return c;
    });
    if(changed) save(CONTACTS_KEY, contacts);
  })();

  function start(){
    const a11y = load(A11Y_KEY, { big:false });
    applyTextScale(!!a11y.big);

    migrateAllData();

    ensureWaitingPill();

    bindA11yDelegation();
    bindBrandHome();
    bindNav();
    bindSettingsGear();
    bindFab();
    bindCommitModal();
    bindContactModal();
    bindShare();
    bindSettings();
    bindInstall();

    fillFriendsDatalist();

    importFromHash();

    fillCommitFriendSelect();

    fixPillsOrder();
    removeBottomInstallText();

    updateCommitmentsHeading();

    renderAll();
  }

  if(document.readyState === "loading"){
    document.addEventListener("DOMContentLoaded", start, { once:true });
  }else{
    start();
  }

  /* SIGUIENTE PASO:
     Pega el archivo `compromisos.html` (el completo, tal cual lo tienes ahora) y dime:
     1) Si el panel “🔍 Buscar / Filtrar” ya queda como en tu foto (botón + desplegable).
     2) Si al escribir en “Nombre” (nuevo compromiso) el datalist vuelve a sugerir y filtrar como antes. */
})();