/* compromisos.js (COMPLETO) — PARTE 1/3 */
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
     ✅ CSS de soporte (layout + lupa + fixes + SUGGEST)
  ========================= */
  (function injectMiniToolsCss(){
    try{
      const st = document.createElement("style");
      st.textContent = `
        /* ✅ Topbar NO fija (que se mueva con scroll) */
        .topbar{ position: static !important; top:auto !important; }
        .topbarInner{ position: static !important; }

        /* ✅ Recolocar topActions: Texto grande arriba derecha, pills centradas al eje, ⚙️ debajo */
        .topActions{
          display:grid !important;
          grid-template-columns: 1fr auto;
          grid-template-rows: auto auto auto; /* 3 filas */
          column-gap: 12px;
          row-gap: 6px;
          align-items: center;
        }
        #btnA11yTop{ grid-column: 2; grid-row: 1; justify-self:end; }

        /* ✅ pills ocupan todo el ancho del grid para centrar real */
        .pills{
          grid-column: 1 / -1 !important;
          grid-row: 2 !important;
          justify-self: center !important;
          width: 100% !important;
          margin-top: 0 !important;
          display: flex !important;
          flex-wrap: wrap !important;
          justify-content: center !important;
          align-items: center !important;
          gap: 12px !important;
        }

        #btnSettingsGear{
          grid-column: 2 !important;
          grid-row: 3 !important;
          justify-self: end !important;
          align-self: end !important;
        }

        /* ✅ Evitar que la barra de estados “se coma” el último botón (Cerrados) */
        .sectionHead{ flex-wrap: wrap !important; gap: 10px !important; }
        .segTabs{ flex-wrap: wrap !important; gap: 8px !important; justify-content:flex-end !important; }
        .segBtn{ white-space: nowrap !important; }

        /* ✅ Botón buscar/filtrar “debajo del header, a la derecha” */
        .miniTools{
          padding:10px 14px 0;
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
        .chip.status{ font-weight:900; }

        /* =========================
           ✅ SUGGEST (lista bonita sin flechitas)
           - Para #fWho (Nombre) y #commitSearchTxt (Buscar)
           ========================= */
        .suggWrap{ position:relative; }
        .suggBox{
          position:absolute;
          left:0; right:0;
          top: calc(100% + 6px);
          background: var(--surface);
          border:1px solid rgba(229,231,235,.95);
          border-radius:16px;
          box-shadow:0 18px 40px rgba(17,24,39,.14);
          overflow:hidden;
          display:none;
          z-index:9999;
        }
        .suggBox.show{ display:block; }
        .suggItem{
          width:100%;
          text-align:left;
          padding:12px 12px;
          border:0;
          background:transparent;
          cursor:pointer;
          font-weight:950;
          font-size:15.5px; /* ✅ más grande */
          color: var(--text);
          display:block;
        }
        .suggItem + .suggItem{ border-top:1px solid rgba(229,231,235,.9); }
        .suggItem:active{ background:rgba(37,99,235,.08); }
        .suggEmpty{
          padding:12px 12px;
          font-weight:800;
          font-size:13.5px;
          color:var(--muted);
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
  let view = "pending";     // pending | waiting | closed
  let lastCommitView = "pending";

  // filtros/búsquedas (desplegable)
  let uiCommitFiltersOpen = false;
  let uiContactsSearchOpen = false;

  let commitFriendFilter = "all"; // all | __none__ | <contactId>
  let commitTextFilter = "";      // búsqueda en texto / quién
  let contactsTextFilter = "";    // búsqueda amigos

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
     Orden pills (Recibidos, En espera, Vencidos)
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
    try{
      const pills = document.querySelector(".pills");
      if(!pills) return;

      const get = (id)=> pills.querySelector("#"+id);
      const w = get("btnWaitingTop");
      const r = get("btnReceived");
      const v = get("btnOverdue");

      if(w) pills.appendChild(w);
      if(r) pills.appendChild(r);
      if(v) pills.appendChild(v);

      if(w) pills.insertBefore(w, pills.firstElementChild);
      if(r) pills.insertBefore(r, v || null);
    }catch(e){}
  }

  /* =========================
     Quitar “Instálala / Consejo”
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
     ✅ SUGGEST (motor compartido)
     - Sin flechas (no datalist nativo)
     - Lista pegada al input
     - Letra más grande
  ========================= */
  function ensureSuggestUI(inputId, boxId){
    const inp = $(inputId);
    if(!inp) return null;

    // envoltorio relativo
    if(!inp.parentElement) return null;
    if(!inp.parentElement.classList.contains("suggWrap")){
      const wrap = document.createElement("div");
      wrap.className = "suggWrap";
      inp.parentElement.insertBefore(wrap, inp);
      wrap.appendChild(inp);

      // mover también el datalist si está justo detrás (por si existe)
      const dl = inp.parentElement.querySelector?.("datalist");
      if(dl) wrap.appendChild(dl);
    }

    let box = $(boxId);
    if(!box){
      box = document.createElement("div");
      box.id = boxId;
      box.className = "suggBox";
      inp.parentElement.appendChild(box);
    }

    return { inp, box };
  }

  function hideSuggest(box){
    if(!box) return;
    box.classList.remove("show");
    box.innerHTML = "";
  }

  function showSuggest(box){
    if(!box) return;
    box.classList.add("show");
  }

  function renderSuggestList(box, items, onPick){
    if(!box) return;

    box.innerHTML = "";

    const max = 8;
    const sliced = (items || []).slice(0, max);

    if(!sliced.length){
      const empty = document.createElement("div");
      empty.className = "suggEmpty";
      empty.textContent = "Sin coincidencias";
      box.appendChild(empty);
      showSuggest(box);
      return;
    }

    sliced.forEach((txt)=>{
      const b = document.createElement("button");
      b.type = "button";
      b.className = "suggItem";
      b.textContent = txt; // ✅ sin “Amigo”, solo el nombre/texto
      b.addEventListener("click", ()=>{
        try{ onPick && onPick(txt); }catch(e){}
      });
      box.appendChild(b);
    });

    showSuggest(box);
  }

  function attachSuggest(inputId, boxId, getItems, onPick){
    const ui = ensureSuggestUI(inputId, boxId);
    if(!ui) return;

    const { inp, box } = ui;

    // ✅ desactivar datalist nativo (evita flechitas)
    try{ inp.removeAttribute("list"); }catch(e){}

    const update = ()=>{
      const q = (inp.value || "").trim().toLowerCase();
      if(!q){
        hideSuggest(box);
        return;
      }
      const items = (getItems && getItems(q)) || [];
      renderSuggestList(box, items, (txt)=>{
        inp.value = txt;
        hideSuggest(box);
        try{ onPick && onPick(txt); }catch(e){}
      });
    };

    if(inp.dataset.suggBound !== "1"){
      inp.dataset.suggBound = "1";

      inp.addEventListener("input", update);
      inp.addEventListener("focus", update);

      inp.addEventListener("blur", ()=>{
        setTimeout(()=> hideSuggest(box), 140);
      });

      document.addEventListener("click", (e)=>{
        if(!box.classList.contains("show")) return;
        const t = e.target;
        if(t === inp) return;
        if(box.contains(t)) return;
        hideSuggest(box);
      }, true);
    }
  }

  /* =========================
     (continúa en PARTE 2/3)
  ========================= */