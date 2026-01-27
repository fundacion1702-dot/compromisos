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
     ✅ CSS SOLO para “lupa desplegable”
  ========================= */
  (function injectMiniToolsCss(){
    try{
      const st = document.createElement("style");
      st.textContent = `
        .miniTools{
          padding:12px 14px 0;
          display:flex;
          justify-content:flex-end;
        }
        .miniBtn{
          height:36px;
          padding:0 12px;
          border-radius:999px;
          border:1px solid var(--border);
          background:var(--surface2);
          box-shadow:var(--shadow2);
          font-weight:900;
          cursor:pointer;
          display:inline-flex;
          align-items:center;
          gap:8px;
          -webkit-tap-highlight-color:transparent;
        }
        .miniBtn:active{ transform:translateY(1px); }
        .miniPanel{
          display:none;
          padding:10px 14px 12px;
          border-top:1px dashed rgba(229,231,235,.95);
          background:linear-gradient(180deg,#fff,#fbfbfc);
        }
        .miniPanel.show{ display:block; }
        .miniRow{
          display:flex;
          gap:10px;
          flex-wrap:wrap;
          align-items:flex-end;
        }
        .miniRow .field{ margin-top:0; flex:1; min-width:160px; }
        .miniHint{
          margin-top:8px;
          color:var(--muted);
          font-size:12.5px;
          line-height:1.35;
        }
        .chip.status{
          font-weight:900;
        }
      `;
      document.head.appendChild(st);
    }catch(e){}
  })();

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
  // ✅ 3 vistas
  let view = "pending";     // pending | waiting | closed

  // ✅ filtros/búsquedas (desplegable)
  let uiCommitFiltersOpen = false;
  let uiContactsSearchOpen = false;

  let commitFriendFilter = "all"; // all | __none__ | <contactId>
  let commitTextFilter = "";      // búsqueda en texto / quién
  let contactsTextFilter = "";    // búsqueda amigos

  /* =========================
     ✅ Migración de datos: done -> status
     status: pending | waiting | closed
  ========================= */
  function normalizeStatus(it){
    const nowIso = new Date().toISOString();

    let status = it.status;
    if(status !== "pending" && status !== "waiting" && status !== "closed"){
      // retrocompat: si existía done, lo usamos
      if(it.done === true) status = "closed";
      else status = "pending";
    }

    // Mantener compat con campos antiguos
    const done = (status === "closed");
    const closedAt = it.closedAt || it.doneAt || (done ? (it.doneAt || nowIso) : null);

    return {
      ...it,
      status,
      done,                         // retrocompat
      doneAt: done ? (it.doneAt || closedAt) : null, // retrocompat
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
     ✅ FIX 1: Texto grande
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
     ✅ Click en logo/título => ir a pantalla principal
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
     ✅ FIX 2: Cambiar orden Vencidos / Recibidos
  ========================= */
  function fixPillsOrder(){
    try{
      const pills = document.querySelector(".pills");
      if(!pills) return;

      const children = Array.from(pills.children).filter(el=>el && el.nodeType===1);
      if(children.length < 2) return;

      const findByText = (needle)=>{
        const n = needle.toLowerCase();
        return children.find(el => (el.textContent || "").toLowerCase().includes(n)) || null;
      };

      const elV = findByText("vencid");
      const elR = findByText("recibid");

      const firstTxt = (pills.firstElementChild?.textContent || "").toLowerCase();
      const ok = firstTxt.includes("recibid");
      if(!ok){
        if(elR && elV){
          pills.insertBefore(elR, pills.firstElementChild);
          pills.appendChild(elV);
        }else{
          const x = children[0], y = children[1];
          pills.insertBefore(y, x);
        }
      }else{
        if(elR && elV && elR.nextElementSibling !== elV){
          pills.insertBefore(elV, elR.nextElementSibling);
        }
      }
    }catch(e){}
  }

  /* =========================
     ✅ FIX 3: Quitar texto “Instálala / Consejo”
  ========================= */
  function removeBottomInstallText(){
    try{
      const ban = document.querySelector("#installBanner, .installBanner");
      if(ban) ban.remove();

      const candidates = document.querySelectorAll("a,button,div,span,p,li");
      candidates.forEach(el=>{
        if(!el || el.children.length) return;
        const t = (el.textContent || "").trim();
        if(t === "Instálala" || t === "Consejo"){
          el.style.display = "none";
        }
      });

      const blocks = document.querySelectorAll("div,section,footer,aside");
      blocks.forEach(el=>{
        const t = (el.textContent || "").trim().replace(/\s+/g," ");
        if(!t) return;
        if((t === "Instálala Consejo") || (t === "Instálala\nConsejo") || (t === "Consejo Instálala")){
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

    renderAll();
    try{ window.scrollTo({ top:0, behavior:"smooth" }); }catch(e){ window.scrollTo(0,0); }
  }

  function setView(newView){
    view = newView;

    const a = $("tabPending");
    const w = $("tabWaiting"); // puede no existir aún
    const c = $("tabDone");    // lo reutilizamos como Cerrados

    if(a) a.classList.toggle("active", view==="pending");
    if(w) w.classList.toggle("active", view==="waiting");
    if(c) c.classList.toggle("active", view==="closed");

    renderCommitments();
  }

  function bindNav(){
    if($("tabCommitments")) $("tabCommitments").onclick = ()=> setPane("commitments");
    if($("tabContacts")) $("tabContacts").onclick = ()=> setPane("contacts");

    if($("tabPending")) $("tabPending").onclick = ()=> setView("pending");
    if($("tabWaiting")) $("tabWaiting").onclick = ()=> setView("waiting"); // opcional
    if($("tabDone")) $("tabDone").onclick = ()=> setView("closed"); // Cerrados

    // Tiles (menú)
    const bindTile = (id, fn)=>{
      const el = $(id);
      if(!el) return;
      el.addEventListener("click", fn);
      el.addEventListener("keydown", (e)=>{
        if(e.key==="Enter" || e.key===" "){ e.preventDefault(); fn(); }
      });
    };
    bindTile("tilePending", ()=>{ setPane("commitments"); setView("pending"); });
    bindTile("tileWaiting", ()=>{ setPane("commitments"); setView("waiting"); }); // opcional
    bindTile("tileDone", ()=>{ setPane("commitments"); setView("closed"); });
    bindTile("tileContacts", ()=>{ setPane("contacts"); });
    bindTile("tileSettings", ()=>{ setPane("settings"); });

    // Pills
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
     ✅ UI desplegable: filtros/búsquedas
  ========================= */
  function hideLegacyCommitFilters(paneEl){
    try{
      const fields = paneEl.querySelectorAll(".field");
      fields.forEach((f)=>{
        const lab = f.querySelector("label");
        const sel = f.querySelector("select");
        const inp = f.querySelector("input[type='text'], input[type='search']");
        const labelTxt = (lab?.textContent || "").trim().toLowerCase();

        if(labelTxt.includes("filtrar por amigo")){
          if(sel && sel.id !== "commitFriendSel"){
            f.style.display = "none";
            const next = f.nextElementSibling;
            if(next && next.classList.contains("hint")) next.style.display = "none";
          }
        }

        if(labelTxt === "buscar" || labelTxt.includes("buscar")){
          if(inp && inp.id !== "commitSearchTxt"){
            f.style.display = "none";
            const next = f.nextElementSibling;
            if(next && next.classList.contains("hint")) next.style.display = "none";
          }
        }
      });
    }catch(e){}
  }

  function ensureCommitFiltersUi(){
    const paneEl = $("commitmentsPane");
    if(!paneEl) return;

    hideLegacyCommitFilters(paneEl);

    if($("miniCommitTools")) return;

    const head = paneEl.querySelector(".sectionHead");
    if(!head) return;

    const tools = document.createElement("div");
    tools.className = "miniTools";
    tools.id = "miniCommitTools";
    tools.innerHTML = `
      <button class="miniBtn" id="btnCommitTools" type="button" aria-expanded="false">
        🔍 Buscar / Filtrar
      </button>
    `;

    const panel = document.createElement("div");
    panel.className = "miniPanel";
    panel.id = "commitToolsPanel";
    panel.innerHTML = `
      <div class="miniRow">
        <div class="field">
          <label class="label" for="commitFriendSel">Filtrar por amigo</label>
          <select id="commitFriendSel"></select>
        </div>
        <div class="field">
          <label class="label" for="commitSearchTxt">Buscar</label>
          <input id="commitSearchTxt" type="text" placeholder="Ej: Ana / PDF / 20€" autocomplete="off"/>
        </div>
        <div class="field" style="flex:0 0 auto; min-width:auto;">
          <label class="label" style="opacity:0;">.</label>
          <button class="btn" id="commitClearBtn" type="button">🧹 Limpiar</button>
        </div>
      </div>
      <div class="miniHint">Se aplica sobre la lista actual (<b>Pendientes</b>, <b>En espera</b> o <b>Cerrados</b>).</div>
    `;

    head.insertAdjacentElement("afterend", tools);
    tools.insertAdjacentElement("afterend", panel);

    const btn = $("btnCommitTools");
    btn.addEventListener("click", ()=>{
      uiCommitFiltersOpen = !uiCommitFiltersOpen;
      btn.setAttribute("aria-expanded", uiCommitFiltersOpen ? "true" : "false");
      panel.classList.toggle("show", uiCommitFiltersOpen);
      if(uiCommitFiltersOpen){
        setTimeout(()=>{ try{ $("commitSearchTxt").focus(); }catch(e){} }, 0);
      }
    });

    $("commitClearBtn").addEventListener("click", ()=>{
      commitFriendFilter = "all";
      commitTextFilter = "";
      fillCommitFriendSelect();
      const inp = $("commitSearchTxt");
      if(inp) inp.value = "";
      renderCommitments();
    });

    $("commitSearchTxt").addEventListener("input", ()=>{
      commitTextFilter = ($("commitSearchTxt").value || "").trim();
      renderCommitments();
    });

    $("commitFriendSel").addEventListener("change", ()=>{
      commitFriendFilter = $("commitFriendSel").value || "all";
      renderCommitments();
    });

    fillCommitFriendSelect();
    panel.classList.toggle("show", uiCommitFiltersOpen);
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

    if($("miniContactsTools")) return;

    const head = paneEl.querySelector(".sectionHead");
    if(!head) return;

    const tools = document.createElement("div");
    tools.className = "miniTools";
    tools.id = "miniContactsTools";
    tools.innerHTML = `
      <button class="miniBtn" id="btnContactsTools" type="button" aria-expanded="false">
        🔍 Buscar amigos
      </button>
    `;

    const panel = document.createElement("div");
    panel.className = "miniPanel";
    panel.id = "contactsToolsPanel";
    panel.innerHTML = `
      <div class="miniRow">
        <div class="field">
          <label class="label" for="contactsSearchTxt">Buscar</label>
          <input id="contactsSearchTxt" type="text" placeholder="Ej: Ana / Trabajo" autocomplete="off"/>
        </div>
        <div class="field" style="flex:0 0 auto; min-width:auto;">
          <label class="label" style="opacity:0;">.</label>
          <button class="btn" id="contactsClearBtn" type="button">🧹 Limpiar</button>
        </div>
      </div>
      <div class="miniHint">Busca por nombre o nota del amigo.</div>
    `;

    head.insertAdjacentElement("afterend", tools);
    tools.insertAdjacentElement("afterend", panel);

    const btn = $("btnContactsTools");
    btn.addEventListener("click", ()=>{
      uiContactsSearchOpen = !uiContactsSearchOpen;
      btn.setAttribute("aria-expanded", uiContactsSearchOpen ? "true" : "false");
      panel.classList.toggle("show", uiContactsSearchOpen);
      if(uiContactsSearchOpen){
        setTimeout(()=>{ try{ $("contactsSearchTxt").focus(); }catch(e){} }, 0);
      }
    });

    $("contactsClearBtn").addEventListener("click", ()=>{
      contactsTextFilter = "";
      const inp = $("contactsSearchTxt");
      if(inp) inp.value = "";
      renderContacts();
    });

    $("contactsSearchTxt").addEventListener("input", ()=>{
      contactsTextFilter = ($("contactsSearchTxt").value || "").trim();
      renderContacts();
    });

    panel.classList.toggle("show", uiContactsSearchOpen);
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
        // closed
        return new Date(b.closedAt||b.doneAt||0).getTime() - new Date(a.closedAt||a.doneAt||0).getTime();
      });

    if(empty) empty.style.display = items.length ? "none" : "block";

    items.forEach((it)=>{
      const card = document.createElement("div");
      card.className = "card";

      const who = normalizedWho(it);
      const dueText = it.when ? fmtDate(it.when) : "Sin fecha";
      const overdue = (it.status==="pending" && isOverdue(it.when));

      const stChip = `<span class="chip status">${esc(statusLabel(it.status))}</span>`;

      const btnPrimary =
        it.status==="closed" ? "↩️ Reabrir" : "✅ Cerrar";

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
        // cerrar desde pending o waiting
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
        // closed -> en espera (por si lo quieres)
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
     FAB + binds base
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
     Confirm modal (mejorado)
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
     - Soporta MODO NUEVO (solo input Nombre+datalist)
     - Soporta MODO ANTIGUO (select fContact)
  ========================= */
  let editingCommitId = null;

  // ✅ estado temporal del modal (para modo “Nombre” sin selector)
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

  /* =========================
     ✅ Datalist (lista de amigos)
  ========================= */
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

  /* =========================
     ✅ MODO ANTIGUO: selector fContact
  ========================= */
  function fixWhoLabel(){
    try{
      const customField = $("customWhoField");
      if(!customField) return;
      const lab = customField.querySelector("label");
      if(!lab) return;
      const t = (lab.textContent || "").trim();
      if(/nombre/i.test(t)){
        lab.textContent = "Nombre";
      }
    }catch(e){}
  }

  function rebuildContactSelect(selectedId, customName){
    const sel = $("fContact");
    const customField = $("customWhoField");
    const whoInput = $("fWho");
    const hint = $("contactHint");
    if(!sel) return;

    sel.innerHTML = "";

    const opt0 = document.createElement("option");
    opt0.value = "__custom__";
    opt0.textContent = "— Sin amigo (escribir nombre) —";
    sel.appendChild(opt0);

    contacts
      .slice()
      .sort((a,b)=> (a.name||"").localeCompare(b.name||"", "es"))
      .forEach(c=>{
        const opt = document.createElement("option");
        opt.value = c.id;
        opt.textContent = c.name || "Sin nombre";
        sel.appendChild(opt);
      });

    if(selectedId) sel.value = selectedId;
    else sel.value = "__custom__";

    const isCustom = (sel.value === "__custom__");
    if(customField) customField.style.display = isCustom ? "" : "none";
    if(hint) hint.textContent = isCustom
      ? "Escribe un nombre o elígelo de la lista."
      : "Elige un amigo guardado.";

    fixWhoLabel();
    fillFriendsDatalist();

    if(isCustom && whoInput){
      whoInput.value = customName || "";
      setTimeout(()=>{ try{ whoInput.focus(); }catch(e){} }, 0);
    }
  }

  function tryAutoSelectFriendFromWhoInput_OLD(){
    const sel = $("fContact");
    const whoInput = $("fWho");
    if(!sel || !whoInput) return;
    if(sel.value !== "__custom__") return;

    const raw = normalizeName(whoInput.value || "");
    if(!raw) return;

    const match = findContactByName(raw);
    if(!match) return;

    sel.value = match.id;
    rebuildContactSelect(match.id, "");
    toast(`👥 Marcado: ${match.name || "Amigo"}`);
  }

  function resolveWho_OLD(){
    const sel = $("fContact");
    const whoInput = $("fWho");
    if(!sel) return { whoId:null, whoName:"" };

    if(sel.value && sel.value !== "__custom__"){
      const c = getContactById(sel.value);
      return { whoId: c ? c.id : sel.value, whoName: "" };
    }
    return { whoId:null, whoName: normalizeName(whoInput?.value || "") };
  }

  /* =========================
     ✅ MODO NUEVO: solo input “Nombre”
     - input id esperado: fWho
     - datalist id esperado: friendsDatalist (o friendsList)
  ========================= */
  function setModalWhoFromNameInput(){
    const inp = $("fWho");
    if(!inp) return;

    const raw = normalizeName(inp.value || "");
    if(!raw){
      modalWhoId = null;
      return;
    }
    const match = findContactByName(raw);
    if(match){
      modalWhoId = match.id;
      // no toast agresivo mientras escribes; solo si viene de change/selección
    }else{
      modalWhoId = null;
    }
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
    // por si el nombre coincide exacto con un amigo, lo marcamos:
    setModalWhoFromNameInput();
  }

  function resolveWho_NEW(){
    const inp = $("fWho");
    const raw = normalizeName(inp?.value || "");
    // Si coincide exacto, whoId gana
    if(modalWhoId){
      return { whoId: modalWhoId, whoName: "" };
    }
    return { whoId:null, whoName: raw };
  }

  function openCommitModal(id, presetContactId){
    editingCommitId = id || null;

    const it = id ? data.find(x=>x.id===id) : null;

    const whoId = it?.whoId || presetContactId || null;
    const whoName = it?.whoName || "";

    // ✅ Si existe selector antiguo, úsalo (retrocompat)
    if($("fContact")){
      rebuildContactSelect(whoId, whoName);
    }else{
      fillFriendsDatalist();
      setNameInputForWho(whoId, whoName);
    }

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
    if(!rawName){
      onCustom();
      return;
    }
    const existing = findContactByName(rawName);
    if(existing){
      onLinked(existing);
      return;
    }

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
      ()=>{
        onCustom();
      }
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

    // ✅ MODO ANTIGUO: selector
    if($("fContact")){
      const sel = $("fContact");
      const whoInput = $("fWho");
      const rawCustomName = normalizeName(whoInput?.value || "");
      const isCustom = sel && sel.value === "__custom__";

      if(isCustom){
        proceedMaybeSaveNewFriend(
          rawCustomName,
          (linked)=> proceedSave({ whoId: linked.id, whoName: "" }),
          ()=> proceedSave({ whoId: null, whoName: rawCustomName })
        );
        return;
      }

      // modo amigo seleccionado normal
      proceedSave(resolveWho_OLD());
      return;
    }

    // ✅ MODO NUEVO: solo Nombre + datalist
    setModalWhoFromNameInput();
    const whoResolved = resolveWho_NEW();

    // Si NO hay whoId, preguntamos si guardar amigo (si hay nombre)
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

    // ✅ retrocompat selector
    const sel = $("fContact");
    if(sel){
      sel.addEventListener("change", ()=>{
        rebuildContactSelect(sel.value === "__custom__" ? null : sel.value, ($("fWho")?.value || ""));
      });
    }

    // ✅ input Nombre: en modo nuevo o para el custom del modo antiguo
    const who = $("fWho");
    if(who){
      who.addEventListener("input", ()=>{
        if($("fContact")){
          // modo antiguo: autoselect si coincide exacto
          tryAutoSelectFriendFromWhoInput_OLD();
        }else{
          // modo nuevo
          setModalWhoFromNameInput();
        }
      });
      who.addEventListener("change", ()=>{
        if($("fContact")){
          tryAutoSelectFriendFromWhoInput_OLD();
        }else{
          setModalWhoFromNameInput();
          // si eligió de la lista, mostramos feedback suave
          if(modalWhoId){
            const c = getContactById(modalWhoId);
            if(c?.name) toast(`👥 Marcado: ${c.name}`);
          }
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
     Compartir: TEXTO COMPLETO + enlace importable #p=
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
        // status NO se sincroniza aún (fase 1: local)
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
     ✅ Install banner + service worker
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
     Boot (DOM READY)
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
    // aplica accesibilidad guardada
    const a11y = load(A11Y_KEY, { big:false });
    applyTextScale(!!a11y.big);

    // ✅ migración de estados
    migrateAllData();

    // listeners robustos
    bindA11yDelegation();
    bindBrandHome();
    bindNav();
    bindFab();
    bindCommitModal();
    bindContactModal();
    bindShare();
    bindSettings();
    bindInstall();

    // ✅ label “Nombre” (modo antiguo)
    fixWhoLabel();

    // ✅ datalist de amigos listo desde el inicio
    fillFriendsDatalist();

    // importar si viene paquete en hash
    importFromHash();

    // refresca selects de filtro
    fillCommitFriendSelect();

    // orden y limpieza visual
    fixPillsOrder();
    removeBottomInstallText();

    renderAll();
  }

  if(document.readyState === "loading"){
    document.addEventListener("DOMContentLoaded", start, { once:true });
  }else{
    start();
  }

})();