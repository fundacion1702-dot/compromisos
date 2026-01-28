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
     ✅ CSS de soporte (layout + lupa + fixes + autocompletado)
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
          grid-template-rows: auto auto auto; /* ✅ 3 filas */
          column-gap: 12px;
          row-gap: 6px;
          align-items: center;
        }
        #btnA11yTop{ grid-column: 2; grid-row: 1; justify-self:end; }

        /* ✅ MUY IMPORTANTE: pills ocupan TODAS las columnas para centrar respecto al eje de la página */
        .pills{
          grid-column: 1 / -1 !important; /* ✅ ocupa todo el ancho del grid */
          grid-row: 2 !important;
          justify-self: center !important;
          width: 100% !important;
          margin-top: 0 !important;

          /* ✅ centrado real de los botones */
          display: flex !important;
          flex-wrap: wrap !important;
          justify-content: center !important;
          align-items: center !important;
          gap: 12px !important;
        }

        #btnSettingsGear{
          grid-column: 2 !important;
          grid-row: 3 !important;  /* ✅ debajo de las pills */
          justify-self: end !important;
          align-self: end !important;
        }

        /* ✅ Evitar que la barra de estados “se coma” el último botón (Cerrados) */
        .sectionHead{ flex-wrap: wrap !important; gap: 10px !important; }
        .segTabs{ flex-wrap: wrap !important; gap: 8px !important; justify-content:flex-end !important; }
        .segBtn{ white-space: nowrap !important; }

        /* ✅ Botón buscar/filtrar “como al principio” (debajo del header, a la derecha) */
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
           ✅ Autocompletado (mismo estilo en “Nombre” y en “Buscar”)
           - Lista flotante justo debajo del input
           - Solo visible cuando escribes
           - Sin flechitas raras del datalist nativo
        ========================= */
        .acPanel{
          position:fixed;
          z-index:9999;
          min-width:220px;
          max-width:calc(100vw - 24px);
          background:var(--surface);
          border:1px solid var(--border);
          box-shadow:0 22px 60px rgba(17,24,39,.18);
          border-radius:16px;
          overflow:hidden;
          display:none;
        }
        .acPanel.show{ display:block; }
        .acList{ display:flex; flex-direction:column; }
        .acItem{
          padding:10px 12px;
          display:flex;
          align-items:center;
          gap:10px;
          cursor:pointer;
          -webkit-tap-highlight-color:transparent;
          border-top:1px solid rgba(229,231,235,.85);
          font-weight:900;
          font-size:16px; /* ✅ un poquito más grande */
          line-height:1.15;
        }
        .acItem:first-child{ border-top:none; }
        .acItem:active{ background:rgba(37,99,235,.08); }
        .acIcon{
          width:28px; height:28px;
          border-radius:12px;
          display:grid;
          place-items:center;
          background:var(--surface2);
          border:1px solid rgba(229,231,235,.9);
          flex:0 0 auto;
          font-size:14px;
        }
        .acText{ min-width:0; overflow:hidden; text-overflow:ellipsis; white-space:nowrap; }
        .acHint{
          padding:8px 12px;
          font-size:12.5px;
          color:var(--muted);
          background:linear-gradient(180deg,#fff,#fbfbfc);
          border-top:1px solid rgba(229,231,235,.9);
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

  // ✅ filtros/búsquedas (desplegable)
  let uiCommitFiltersOpen = false;
  let uiContactsSearchOpen = false;

  let commitFriendFilter = "all"; // all | __none__ | <contactId>
  let commitTextFilter = "";      // búsqueda en texto / quién
  let contactsTextFilter = "";    // búsqueda amigos

  /* =========================
     ✅ Autocompletado flotante (reutilizable)
     - Lo usamos en:
       1) Modal “Nombre” (fWho)
       2) Buscar compromisos (commitSearchTxt)
  ========================= */
  const AC = (function(){
    let panel = null;
    let list = null;
    let hint = null;
    let activeInput = null;
    let activeOnPick = null;
    let activeGetItems = null;
    let lastQuery = "";
    let bound = false;

    function ensure(){
      if(panel) return;
      panel = document.createElement("div");
      panel.className = "acPanel";
      panel.id = "acPanel";

      list = document.createElement("div");
      list.className = "acList";

      hint = document.createElement("div");
      hint.className = "acHint";
      hint.textContent = "Escribe para ver sugerencias.";

      panel.appendChild(list);
      panel.appendChild(hint);
      document.body.appendChild(panel);

      if(bound) return;
      bound = true;

      // cerrar al tocar fuera
      document.addEventListener("pointerdown", (e)=>{
        if(!panel.classList.contains("show")) return;
        const t = e.target;
        if(t === activeInput) return;
        if(panel.contains(t)) return;
        hide();
      }, true);

      window.addEventListener("scroll", ()=>{
        if(panel.classList.contains("show")) position();
      }, true);

      window.addEventListener("resize", ()=>{
        if(panel.classList.contains("show")) position();
      }, true);
    }

    function position(){
      if(!activeInput || !panel) return;
      const r = activeInput.getBoundingClientRect();
      const gap = 6;
      const top = Math.min(window.innerHeight - 12, r.bottom + gap);
      const left = Math.max(12, r.left);
      const width = Math.max(220, Math.min(r.width, window.innerWidth - 24));
      panel.style.top = top + "px";
      panel.style.left = left + "px";
      panel.style.width = width + "px";
      panel.style.maxHeight = Math.min(260, window.innerHeight - top - 12) + "px";
      panel.style.overflow = "auto";
    }

    function hide(){
      if(!panel) return;
      panel.classList.remove("show");
      activeInput = null;
      activeOnPick = null;
      activeGetItems = null;
      lastQuery = "";
      try{ list.innerHTML = ""; }catch(_){}
    }

    function render(items, q){
      if(!panel) return;
      list.innerHTML = "";

      if(!q){
        hint.textContent = "Escribe para ver sugerencias.";
      }else{
        hint.textContent = items.length ? "Toca para seleccionar." : "Sin coincidencias.";
      }

      items.forEach((it)=>{
        const row = document.createElement("div");
        row.className = "acItem";
        row.innerHTML = `
          <span class="acIcon" aria-hidden="true">${esc(it.icon || "👤")}</span>
          <span class="acText">${esc(it.value)}</span>
        `;
        row.addEventListener("click", ()=>{
          try{
            if(activeInput) activeInput.value = it.value;
            if(activeOnPick) activeOnPick(it);
          }catch(e){}
          hide();
        });
        list.appendChild(row);
      });

      position();
      panel.classList.toggle("show", true);
    }

    function normalize(s){
      return String(s||"").trim().replace(/\s+/g," ");
    }

    function setUpFor(input, getItems, onPick){
      ensure();
      activeInput = input;
      activeGetItems = getItems;
      activeOnPick = onPick;

      const q = normalize(input.value);
      lastQuery = q;

      if(!q){
        hide();
        return;
      }

      const items = (getItems(q) || []).slice(0, 8);
      render(items, q);
    }

    function attach(input, getItems, onPick){
      if(!input) return;
      if(input.dataset.acBound === "1") return;
      input.dataset.acBound = "1";

      const onInput = ()=>{
        setUpFor(input, getItems, onPick);
      };

      input.addEventListener("input", onInput);
      input.addEventListener("focus", onInput);

      input.addEventListener("blur", ()=>{
        // pequeño delay para permitir click en la lista
        setTimeout(()=>{
          if(document.activeElement === input) return;
          hide();
        }, 140);
      });

      input.addEventListener("keydown", (e)=>{
        if(e.key === "Escape"){
          hide();
        }
      });
    }

    return { attach, hide, normalize };
  })();

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
     ✅ UI desplegable: Buscar / Filtrar
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

    let tools = $("miniCommitTools");
    let panel = $("commitToolsPanel");

    const bindIfNeeded = ()=>{
      const btn = $("btnCommitTools");
      if(!btn || !panel) return;
      if(btn.dataset.bound === "1") return;
      btn.dataset.bound = "1";

      btn.addEventListener("click", (e)=>{
        e.preventDefault();
        uiCommitFiltersOpen = !uiCommitFiltersOpen;
        btn.setAttribute("aria-expanded", uiCommitFiltersOpen ? "true" : "false");
        panel.classList.toggle("show", uiCommitFiltersOpen);
        if(uiCommitFiltersOpen){
          setTimeout(()=>{ try{ $("commitSearchTxt").focus(); }catch(_){} }, 0);
        }else{
          try{ AC.hide(); }catch(_){}
        }
      });

      const clearBtn = $("commitClearBtn");
      if(clearBtn && clearBtn.dataset.bound !== "1"){
        clearBtn.dataset.bound = "1";
        clearBtn.addEventListener("click", ()=>{
          commitFriendFilter = "all";
          commitTextFilter = "";
          fillCommitFriendSelect();
          const inp = $("commitSearchTxt");
          if(inp) inp.value = "";
          try{ AC.hide(); }catch(_){}
          renderCommitments();
        });
      }

      const txt = $("commitSearchTxt");
      if(txt && txt.dataset.bound !== "1"){
        txt.dataset.bound = "1";
        txt.addEventListener("input", ()=>{
          commitTextFilter = (txt.value || "").trim();
          renderCommitments();
        });
      }

      const sel = $("commitFriendSel");
      if(sel && sel.dataset.bound !== "1"){
        sel.dataset.bound = "1";
        sel.addEventListener("change", ()=>{
          commitFriendFilter = sel.value || "all";
          renderCommitments();
        });
      }
    };

    if(!tools){
      const head = paneEl.querySelector(".sectionHead");
      if(!head) return;

      tools = document.createElement("div");
      tools.className = "miniTools";
      tools.id = "miniCommitTools";
      tools.innerHTML = `
        <button class="miniBtn" id="btnCommitTools" type="button" aria-expanded="false">
          🔍 Buscar / Filtrar
        </button>
      `;

      panel = document.createElement("div");
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
    }

    fillCommitFriendSelect();

    const btn = $("btnCommitTools");
    if(btn) btn.setAttribute("aria-expanded", uiCommitFiltersOpen ? "true" : "false");
    if(panel) panel.classList.toggle("show", uiCommitFiltersOpen);

    bindIfNeeded();

    // ✅ Activar autocompletado en el “Buscar” de compromisos (nombre + texto)
    bindCommitSearchAutocomplete();
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

  /* =========================
     ✅ Autocompletado del buscador de compromisos (panel Buscar/Filtrar)
     - Sugiere: Nombres (amigos + whoName) + Textos (what)
     - Al tocar: rellena el input y filtra automáticamente
  ========================= */
  function uniquePush(arr, set, value){
    const v = AC.normalize(value);
    if(!v) return;
    const k = v.toLowerCase();
    if(set.has(k)) return;
    set.add(k);
    arr.push(v);
  }

  function buildCommitSearchSuggestions(query){
    const q = AC.normalize(query).toLowerCase();
    if(!q) return [];

    const names = [];
    const texts = [];
    const seenN = new Set();
    const seenT = new Set();

    // 1) amigos guardados
    contacts.forEach(c=>{
      const n = c?.name || "";
      if(!n) return;
      if(n.toLowerCase().includes(q)) uniquePush(names, seenN, n);
    });

    // 2) nombres escritos en compromisos (whoName) + quien normalizado
    (data||[]).forEach(it=>{
      const who = normalizedWho(it);
      if(who && who.toLowerCase().includes(q)) uniquePush(names, seenN, who);
    });

    // 3) textos (what)
    (data||[]).forEach(it=>{
      const w = String(it?.what || "");
      if(!w) return;
      if(w.toLowerCase().includes(q)){
        // sugerimos una versión “corta” si es muy largo
        const s = AC.normalize(w);
        const short = s.length > 44 ? (s.slice(0, 44).trim() + "…") : s;
        uniquePush(texts, seenT, short);
      }
    });

    const out = [];

    // nombres primero
    names.slice(0, 6).forEach(v=>{
      out.push({ value:v, icon:"👤", kind:"name" });
    });

    // luego textos
    texts.slice(0, 6).forEach(v=>{
      out.push({ value:v, icon:"📝", kind:"text" });
    });

    return out;
  }

  function bindCommitSearchAutocomplete(){
    const inp = $("commitSearchTxt");
    if(!inp) return;
    if(inp.dataset.ac2 === "1") return;
    inp.dataset.ac2 = "1";

    AC.attach(
      inp,
      (q)=> buildCommitSearchSuggestions(q),
      (picked)=>{
        // ✅ rellena y filtra automáticamente (el input ya tiene el valor)
        commitTextFilter = (inp.value || "").trim();
        renderCommitments();
      }
    );
  }

  /* =========================
     Render (continúa en PARTE 2/3)

  ========================= */

function renderCommitments(){
    ensureCommitFiltersUi();
    updateCounts();

    const list = $("list");
    const empty = $("empty");
    if(!list || !empty) return;

    let items = (data || []).filter(x=>x.status===view);
    items = items.filter(passesCommitFilters);

    // Orden: vencidos arriba en pendientes; luego por fecha (si hay), y luego por creación
    items.sort((a,b)=>{
      if(view==="pending"){
        const ao = isOverdue(a.when), bo = isOverdue(b.when);
        if(ao && !bo) return -1;
        if(!ao && bo) return 1;
      }
      const at = a.when ? new Date(a.when).getTime() : Infinity;
      const bt = b.when ? new Date(b.when).getTime() : Infinity;
      if(at !== bt) return at - bt;

      const ac = a.createdAt ? new Date(a.createdAt).getTime() : 0;
      const bc = b.createdAt ? new Date(b.createdAt).getTime() : 0;
      return bc - ac;
    });

    list.innerHTML = "";

    if(!items.length){
      empty.style.display = "block";
      return;
    }
    empty.style.display = "none";

    items.forEach(it=>{
      const who = normalizedWho(it);
      const when = it.when ? fmtDate(it.when) : "Sin fecha";
      const overdue = (it.status==="pending" && isOverdue(it.when));

      const chips = [];
      chips.push(`<span class="chip status">${esc(statusLabel(it.status))}</span>`);
      if(it.whoId) chips.push(`<span class="chip">👥 Amigo</span>`);
      else chips.push(`<span class="chip">✍️ Escrito</span>`);

      // recordatorio simple
      if(it.remindMin && Number(it.remindMin)>0 && it.when){
        chips.push(`<span class="chip">🔔 ${esc(String(it.remindMin))} min</span>`);
      }
      if(it.afterMin && Number(it.afterMin)>0){
        chips.push(`<span class="chip">⏱️ ${esc(String(it.afterMin))} min</span>`);
      }

      const dueClass = overdue ? "due bad" : "due";
      const dueText = overdue ? `${esc(when)} · Vencido` : esc(when);

      const el = document.createElement("div");
      el.className = "card";
      el.innerHTML = `
        <div class="cardTop">
          <div class="who">
            <p class="name">${esc(who)}</p>
            <p class="meta">${chips.join("")}</p>
          </div>
          <div class="${dueClass}">⏰ ${dueText}</div>
        </div>
        <div class="desc">${esc(it.what || "")}</div>
        <div class="actions" data-id="${esc(it.id)}"></div>
      `;

      const actions = el.querySelector(".actions");
      if(actions){
        // ✅ acciones rápidas
        if(it.status === "pending"){
          actions.appendChild(btn("✅ Cerrar", "good", ()=> setStatus(it.id, "closed")));
          actions.appendChild(btn("⏳ Pasar a En espera", "primary", ()=> setStatus(it.id, "waiting")));
          actions.appendChild(btn("✏️ Editar", "", ()=> openEdit(it.id)));
          actions.appendChild(btn("🗑️ Eliminar", "danger", ()=> askDelete(it.id)));
        }else if(it.status === "waiting"){
          actions.appendChild(btn("✅ Cerrar", "good", ()=> setStatus(it.id, "closed")));
          actions.appendChild(btn("🟣 Reabrir a Pendiente", "primary", ()=> setStatus(it.id, "pending")));
          actions.appendChild(btn("✏️ Editar", "", ()=> openEdit(it.id)));
          actions.appendChild(btn("🗑️ Eliminar", "danger", ()=> askDelete(it.id)));
        }else{
          actions.appendChild(btn("🟣 Reabrir a Pendiente", "primary", ()=> setStatus(it.id, "pending")));
          actions.appendChild(btn("✏️ Editar", "", ()=> openEdit(it.id)));
          actions.appendChild(btn("🗑️ Eliminar", "danger", ()=> askDelete(it.id)));
        }
      }

      list.appendChild(el);
    });
  }

  function btn(label, cls, onClick){
    const b = document.createElement("button");
    b.className = "btn" + (cls ? " " + cls : "");
    b.type = "button";
    b.textContent = label;
    b.addEventListener("click", onClick);
    return b;
  }

  function renderContacts(){
    updateCounts();

    const list = $("contactsList");
    const empty = $("contactsEmpty");
    if(!list || !empty) return;

    let items = (contacts || []).slice().sort((a,b)=> (a.name||"").localeCompare(b.name||"", "es"));

    const q = (contactsTextFilter || "").trim().toLowerCase();
    if(q){
      items = items.filter(c=>{
        const n = (c.name||"").toLowerCase();
        const note = (c.note||"").toLowerCase();
        return n.includes(q) || note.includes(q);
      });
    }

    list.innerHTML = "";
    if(!items.length){
      empty.style.display = "block";
      return;
    }
    empty.style.display = "none";

    items.forEach(c=>{
      const el = document.createElement("div");
      el.className = "card";
      el.innerHTML = `
        <div class="cardTop">
          <div class="who">
            <p class="name">${esc(c.name||"Sin nombre")}</p>
            <p class="meta">${c.note ? `<span class="chip">📝 ${esc(c.note)}</span>` : `<span class="chip">👥 Amigo</span>`}</p>
          </div>
          <div class="due">👤</div>
        </div>
        <div class="actions"></div>
      `;
      const a = el.querySelector(".actions");
      if(a){
        a.appendChild(btn("🗓️ Nuevo compromiso", "primary", ()=>{
          setPane("commitments");
          openNewWithContact(c);
        }));
        a.appendChild(btn("✏️ Editar", "", ()=> openContactEdit(c.id)));
        a.appendChild(btn("🗑️ Eliminar", "danger", ()=> askDeleteContact(c.id)));
      }
      list.appendChild(el);
    });
  }

  function renderSettings(){
    // switches (PIN / Notif) se actualizan por estado
    const swPin = $("swPin");
    const swNotif = $("swNotif");
    if(swPin){
      swPin.classList.toggle("on", !!settings.pinEnabled);
      swPin.setAttribute("aria-checked", settings.pinEnabled ? "true" : "false");
    }
    if(swNotif){
      swNotif.classList.toggle("on", !!settings.notifEnabled);
      swNotif.setAttribute("aria-checked", settings.notifEnabled ? "true" : "false");
    }
    const selAuto = $("selAutoLock");
    const selRem = $("selRemember");
    if(selAuto) selAuto.value = String(settings.autoLockMin ?? 0);
    if(selRem) selRem.value = String(settings.rememberMin ?? 0);
  }

  function renderAll(){
    ensureWaitingPill();
    fixPillsOrder();
    updateCommitmentsHeading();
    updateCounts();

    if(pane === "commitments"){
      renderCommitments();
    }else if(pane === "contacts"){
      renderContacts();
    }else{
      renderSettings();
    }
  }

  /* =========================
     Datos: CRUD compromisos
  ========================= */
  function persist(){
    save(KEY, data);
    renderAll();
  }

  function setStatus(id, status){
    const it = data.find(x=>x.id===id);
    if(!it) return;
    it.status = status;
    it.done = (status==="closed");
    if(status==="closed"){
      it.closedAt = new Date().toISOString();
      it.doneAt = it.closedAt;
    }else{
      it.closedAt = null;
      it.doneAt = null;
    }
    persist();
  }

  function askDelete(id){
    confirmModal("Eliminar compromiso", "Se eliminará de tu móvil. ¿Continuar?", ()=>{
      data = data.filter(x=>x.id!==id);
      persist();
    });
  }

  function openEdit(id){
    const it = data.find(x=>x.id===id);
    if(!it) return;
    openCommitModal(it);
  }

  function createOrUpdateCommit(payload){
    if(payload.id){
      const idx = data.findIndex(x=>x.id===payload.id);
      if(idx>=0){
        data[idx] = normalizeStatus({ ...data[idx], ...payload, updatedAt:new Date().toISOString() });
      }
    }else{
      const now = new Date().toISOString();
      data.unshift(normalizeStatus({
        id: uid(),
        createdAt: now,
        updatedAt: now,
        status: "pending",
        done: false,
        ...payload
      }));
    }
    save(KEY, data);
  }

  /* =========================
     Datos: CRUD contactos
  ========================= */
  function persistContacts(){
    save(CONTACTS_KEY, contacts);
    renderAll();
  }

  function askDeleteContact(id){
    confirmModal("Eliminar amigo", "Se eliminará el amigo de tu móvil. Los compromisos que lo usen quedarán como nombre escrito.", ()=>{
      const c = getContactById(id);
      contacts = contacts.filter(x=>x.id!==id);
      // desvincular compromisos
      data = (data||[]).map(it=>{
        if(it.whoId === id){
          return { ...it, whoId:null, whoName: (c?.name || it.whoName || "") };
        }
        return it;
      });
      save(KEY, data);
      persistContacts();
    });
  }

  function openContactEdit(id){
    const c = getContactById(id);
    if(!c) return;
    openContactModal(c);
  }

  /* =========================
     ✅ MODAL genérico confirm
  ========================= */
  function confirmModal(title, msg, onYes){
    const bd = $("confirmBackdrop");
    if(!bd) return;

    $("confirmTitle").textContent = title || "Confirmar";
    $("confirmMsg").innerHTML = esc(msg || "");

    const close = ()=>{
      bd.classList.remove("show");
      bd.setAttribute("aria-hidden","true");
      $("confirmNo").onclick = null;
      $("confirmYes").onclick = null;
      $("confirmClose").onclick = null;
    };

    $("confirmNo").onclick = ()=> close();
    $("confirmClose").onclick = ()=> close();
    $("confirmYes").onclick = ()=>{
      close();
      try{ onYes && onYes(); }catch(e){}
    };

    bd.classList.add("show");
    bd.setAttribute("aria-hidden","false");
  }

  /* =========================
     MODAL: Nuevo/Editar Compromiso
     - Campo “Nombre” con autocompletado bonito (sin datalist nativo)
     - Si no existe y guardas -> pregunta crear amigo (ya lo tenías; lo mantenemos)
  ========================= */
  let editingCommitId = null;

  function openCommitModal(existing){
    editingCommitId = existing?.id || null;

    const bd = $("backdrop");
    if(!bd) return;

    // refs
    const title = $("modalTitle");
    const who = $("fWho");
    const what = $("fWhat");
    const when = $("fWhen");
    const remind = $("fRemind");
    const after = $("fAfter");

    title.textContent = editingCommitId ? "Editar compromiso" : "Nuevo compromiso";

    // rellenar
    who.value = existing ? (normalizedWho(existing) || "") : "";
    what.value = existing ? (existing.what || "") : "";
    when.value = existing && existing.when ? toLocalInput(existing.when) : "";
    remind.value = String(existing?.remindMin || 0);
    after.value = String(existing?.afterMin || 0);

    // ✅ Atar autocompletado “Nombre”
    bindWhoAutocomplete();

    // abrir
    bd.classList.add("show");
    bd.setAttribute("aria-hidden","false");

    // focus
    setTimeout(()=>{ try{ who.focus(); }catch(e){} }, 0);
  }

  function toLocalInput(iso){
    try{
      if(!iso) return "";
      const d = new Date(iso);
      if(isNaN(d.getTime())) return "";
      const pad = (n)=> String(n).padStart(2,"0");
      return `${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
    }catch(e){ return ""; }
  }

  function closeCommitModal(){
    const bd = $("backdrop");
    if(!bd) return;
    bd.classList.remove("show");
    bd.setAttribute("aria-hidden","true");
    editingCommitId = null;
    try{ AC.hide(); }catch(_){}
  }

  function openNewWithContact(contact){
    openCommitModal({
      whoId: contact.id,
      whoName: contact.name || "",
      what: "",
      when: null,
      remindMin: 0,
      afterMin: 0,
      status: "pending",
      done: false
    });
  }

  function bindCommitModalButtons(){
    const bd = $("backdrop");
    if(!bd) return;

    const close = $("btnClose");
    const cancel = $("btnCancel");
    if(close) close.onclick = closeCommitModal;
    if(cancel) cancel.onclick = closeCommitModal;

    const saveBtn = $("btnSave");
    if(saveBtn){
      saveBtn.onclick = ()=>{
        const whoVal = AC.normalize($("fWho").value);
        const whatVal = AC.normalize($("fWhat").value);
        const whenVal = $("fWhen").value ? new Date($("fWhen").value).toISOString() : null;

        const remindMin = Number($("fRemind").value || 0);
        const afterMin = Number($("fAfter").value || 0);

        if(!whoVal){
          toast("Escribe un nombre");
          return;
        }
        if(!whatVal){
          toast("Escribe qué se acordó");
          return;
        }

        // ✅ si coincide exacto con amigo -> vincula
        const c = findContactByName(whoVal);
        const whoId = c ? c.id : null;
        const whoName = c ? (c.name || whoVal) : whoVal;

        const payload = {
          id: editingCommitId || undefined,
          whoId,
          whoName,
          what: whatVal,
          when: whenVal,
          remindMin,
          afterMin
        };

        // si editaba: mantener status actual
        if(editingCommitId){
          const it = data.find(x=>x.id===editingCommitId);
          if(it) payload.status = it.status;
        }

        // ✅ si no coincide con amigo -> preguntar si guardar nuevo amigo (ya funcionaba; lo mantenemos)
        if(!c){
          confirmModal(
            "¿Guardar nuevo amigo?",
            `No existe “${whoVal}” en tus amigos. ¿Quieres guardarlo para que aparezca en la lista?`,
            ()=>{
              addContactFromName(whoVal);
              const cc = findContactByName(whoVal);
              if(cc) payload.whoId = cc.id;
              createOrUpdateCommit(payload);
              closeCommitModal();
              openShare(payload);
            }
          );
        }else{
          createOrUpdateCommit(payload);
          closeCommitModal();
          openShare(payload);
        }
      };
    }
  }

  function addContactFromName(name){
    const n = AC.normalize(name);
    if(!n) return;
    if(findContactByName(n)) return;
    contacts.unshift({ id: uid(), name: n, note: "" });
    persistContacts();
  }

  /* =========================
     ✅ Autocompletado para “Nombre” (fWho)
     - Sin flechitas raras
     - Lista solo cuando escribes
     - Letra más grande + “uno debajo de otro”
  ========================= */
  function buildWhoSuggestions(query){
    const q = AC.normalize(query).toLowerCase();
    if(!q) return [];
    const out = [];
    const seen = new Set();

    // Prioridad: amigos guardados
    contacts
      .slice()
      .sort((a,b)=> (a.name||"").localeCompare(b.name||"", "es"))
      .forEach(c=>{
        const n = c?.name || "";
        if(!n) return;
        if(n.toLowerCase().includes(q)){
          const k = n.toLowerCase();
          if(seen.has(k)) return;
          seen.add(k);
          out.push({ value:n, icon:"👤", kind:"friend", id:c.id });
        }
      });

    // También sugerimos nombres ya usados como texto (por si no están guardados)
    (data||[]).forEach(it=>{
      if(it.whoId) return;
      const n = AC.normalize(it.whoName);
      if(!n) return;
      if(n.toLowerCase().includes(q)){
        const k = n.toLowerCase();
        if(seen.has(k)) return;
        seen.add(k);
        out.push({ value:n, icon:"✍️", kind:"typed" });
      }
    });

    return out.slice(0, 8);
  }

  function bindWhoAutocomplete(){
    const inp = $("fWho");
    if(!inp) return;
    if(inp.dataset.acWho === "1") return;
    inp.dataset.acWho = "1";

    // ✅ IMPORTANTE: quitamos el datalist nativo para evitar iconitos/flechas raras
    try{
      inp.removeAttribute("list");
      const dl = $("friendsDatalist");
      if(dl) dl.innerHTML = "";
    }catch(e){}

    AC.attach(
      inp,
      (q)=> buildWhoSuggestions(q),
      (picked)=>{
        // ✅ al elegir, solo rellenamos el input; la vinculación se hace al guardar (como ya tienes)
      }
    );
  }

  /* =========================
     MODAL: Contactos (Nuevo/Editar)
  ========================= */
  let editingContactId = null;

  function openContactModal(existing){
    editingContactId = existing?.id || null;
    const bd = $("cBackdrop");
    if(!bd) return;

    $("cModalTitle").textContent = editingContactId ? "Editar amigo" : "Nuevo amigo";
    $("cName").value = existing?.name || "";
    $("cNote").value = existing?.note || "";

    bd.classList.add("show");
    bd.setAttribute("aria-hidden","false");
    setTimeout(()=>{ try{ $("cName").focus(); }catch(e){} }, 0);
  }

  function closeContactModal(){
    const bd = $("cBackdrop");
    if(!bd) return;
    bd.classList.remove("show");
    bd.setAttribute("aria-hidden","true");
    editingContactId = null;
  }

  function bindContactModalButtons(){
    const bd = $("cBackdrop");
    if(!bd) return;

    const close = $("cBtnClose");
    const cancel = $("cBtnCancel");
    if(close) close.onclick = closeContactModal;
    if(cancel) cancel.onclick = closeContactModal;

    const saveBtn = $("cBtnSave");
    if(saveBtn){
      saveBtn.onclick = ()=>{
        const name = AC.normalize($("cName").value);
        const note = AC.normalize($("cNote").value);

        if(!name){
          toast("Escribe un nombre");
          return;
        }

        const existingByName = findContactByName(name);
        if(existingByName && existingByName.id !== editingContactId){
          toast("Ya existe un amigo con ese nombre");
          return;
        }

        if(editingContactId){
          const idx = contacts.findIndex(x=>x.id===editingContactId);
          if(idx>=0){
            contacts[idx] = { ...contacts[idx], name, note };
          }
        }else{
          contacts.unshift({ id: uid(), name, note });
        }
        persistContacts();
        closeContactModal();
      };
    }
  }

  /* =========================
     Share (paquete por enlace)
     (continúa en PARTE 3/3)
  ========================= */

/* =========================
     Share (paquete por enlace)
  ========================= */
  function openShare(payload){
    // payload puede ser el objeto recién creado/actualizado (sin id quizá)
    const bd = $("shareBackdrop");
    if(!bd) return;

    const isEdit = !!payload?.id;
    const whoVal = AC.normalize(payload?.whoName || $("fWho")?.value || "");
    const whatVal = AC.normalize(payload?.what || $("fWhat")?.value || "");
    const whenIso = payload?.when || ($("fWhen")?.value ? new Date($("fWhen").value).toISOString() : null);

    const remindMin = Number(payload?.remindMin ?? $("fRemind")?.value ?? 0);
    const afterMin = Number(payload?.afterMin ?? $("fAfter")?.value ?? 0);

    // Paquete sencillo (fase 1: solo local)
    const pack = {
      v: 1,
      type: "commitment",
      whoName: whoVal,
      what: whatVal,
      when: whenIso,
      remindMin,
      afterMin
    };

    const shortTxt = [
      `📌 Compromiso`,
      `👤 ${whoVal}`,
      `📝 ${whatVal}`,
      whenIso ? `⏰ ${fmtDate(whenIso)}` : `⏰ Sin fecha`,
      remindMin && whenIso ? `🔔 Recordatorio: ${remindMin} min antes` : "",
      afterMin ? `⏱️ Avisar desde ahora: ${afterMin} min` : "",
    ].filter(Boolean).join("\n");

    const longTxt = [
      `📌 Compromiso (Compromisos)`,
      ``,
      `Nombre: ${whoVal}`,
      `Qué: ${whatVal}`,
      `Para cuándo: ${whenIso ? fmtDate(whenIso) : "Sin fecha"}`,
      `Recordatorio por fecha: ${remindMin && whenIso ? `${remindMin} min antes` : "Ninguno"}`,
      `Avisar “desde ahora”: ${afterMin ? `${afterMin} min` : "No"}`,
      ``,
      `👉 Abre el enlace para importarlo en tu móvil:`
    ].join("\n");

    const url = buildShareUrl(pack);

    const title = $("shareTitle");
    const textBox = $("shareTextBox");
    const urlBox = $("shareUrlBox");
    if(title) title.textContent = isEdit ? "Paquete para compartir (editado)" : "Paquete para compartir";
    if(textBox) textBox.textContent = shortTxt;
    if(urlBox) urlBox.textContent = url;

    // selector corto/largo
    const bShort = $("shareShort");
    const bLong = $("shareLong");

    const setMode = (mode)=>{
      if(bShort) bShort.classList.toggle("active", mode==="short");
      if(bLong) bLong.classList.toggle("active", mode==="long");
      if(textBox) textBox.textContent = (mode==="long" ? longTxt : shortTxt);
    };
    if(bShort) bShort.onclick = ()=> setMode("short");
    if(bLong) bLong.onclick = ()=> setMode("long");
    setMode("short");

    // botones
    const close = ()=> {
      bd.classList.remove("show");
      bd.setAttribute("aria-hidden","true");
    };
    $("shareClose").onclick = close;
    $("shareCancel").onclick = close;

    $("shareCopyUrl").onclick = ()=> copyToClipboard(url, "Enlace copiado");
    $("shareCopyAll").onclick = ()=> copyToClipboard((textBox?.textContent || "") + "\n\n" + url, "Texto+enlace copiado");

    $("shareSend").onclick = async ()=>{
      const txt = (textBox?.textContent || "") + "\n\n" + url;
      try{
        if(navigator.share){
          await navigator.share({ text: txt });
        }else{
          copyToClipboard(txt, "Copiado (no hay compartir)");
        }
      }catch(e){
        // cancelado o fallo
      }
    };

    bd.classList.add("show");
    bd.setAttribute("aria-hidden","false");
  }

  function buildShareUrl(pack){
    const base = location.origin + location.pathname;
    const encoded = encodeURIComponent(btoa(unescape(encodeURIComponent(JSON.stringify(pack)))));
    const u = new URL(base, location.origin);
    u.searchParams.set("p", encoded);
    return u.toString();
  }

  function tryImportFromUrl(){
    try{
      const u = new URL(location.href);
      const p = u.searchParams.get("p");
      if(!p) return;

      let raw = decodeURIComponent(p);
      let json = decodeURIComponent(escape(atob(raw)));
      const pack = JSON.parse(json);

      if(pack?.type !== "commitment") return;

      // Importar como nuevo compromiso (pendiente)
      const whoVal = AC.normalize(pack.whoName);
      const whatVal = AC.normalize(pack.what);

      if(!whoVal || !whatVal){
        toast("Paquete inválido");
        return;
      }

      const c = findContactByName(whoVal);
      const whoId = c ? c.id : null;
      const whoName = c ? c.name : whoVal;

      const now = new Date().toISOString();
      data.unshift(normalizeStatus({
        id: uid(),
        createdAt: now,
        updatedAt: now,
        status: "pending",
        done: false,
        whoId,
        whoName,
        what: whatVal,
        when: pack.when || null,
        remindMin: Number(pack.remindMin || 0),
        afterMin: Number(pack.afterMin || 0),
      }));
      save(KEY, data);

      // limpiar URL para que no reimporte al recargar
      u.searchParams.delete("p");
      history.replaceState({}, "", u.toString());

      toast("Compromiso importado");
      renderAll();
    }catch(e){
      // silencioso
    }
  }

  /* =========================
     A11y: Texto grande (persistente)
  ========================= */
  function applyBigText(){
    document.body.classList.toggle("bigText", !!settings.bigText);
    document.documentElement.classList.toggle("bigText", !!settings.bigText);
  }

  function toggleBigText(){
    settings.bigText = !settings.bigText;
    save(SETTINGS_KEY, settings);
    applyBigText();
    renderAll();
    toast(settings.bigText ? "Texto grande activado" : "Texto grande desactivado");
  }

  /* =========================
     PIN lock
  ========================= */
  function bindPin(){
    const swPin = $("swPin");
    const btnChange = $("btnChangePin");
    const btnLockNow = $("btnLockNow");
    const selAuto = $("selAutoLock");
    const selRem = $("selRemember");

    if(swPin){
      swPin.onclick = ()=>{
        settings.pinEnabled = !settings.pinEnabled;
        save(SETTINGS_KEY, settings);
        renderSettings();
        toast(settings.pinEnabled ? "PIN activado" : "PIN desactivado");
        if(settings.pinEnabled && !settings.pinHash){
          openPinSetup();
        }
      };
      swPin.onkeydown = (e)=>{ if(e.key==="Enter" || e.key===" "){ e.preventDefault(); swPin.click(); } };
    }

    if(btnChange) btnChange.onclick = ()=> openPinSetup(true);
    if(btnLockNow) btnLockNow.onclick = ()=> lockNow();

    if(selAuto){
      selAuto.onchange = ()=>{
        settings.autoLockMin = Number(selAuto.value || 0);
        save(SETTINGS_KEY, settings);
        toast("Auto-bloqueo actualizado");
      };
    }
    if(selRem){
      selRem.onchange = ()=>{
        settings.rememberMin = Number(selRem.value || 0);
        save(SETTINGS_KEY, settings);
        toast("Recordar desbloqueo actualizado");
      };
    }
  }

  function lockNow(){
    locked = true;
    showLock(true);
  }

  function showLock(show){
    const bd = $("lockOverlay");
    if(!bd) return;
    if(show){
      bd.classList.add("show");
      bd.setAttribute("aria-hidden","false");
      pinBuf = "";
      paintDots();
    }else{
      bd.classList.remove("show");
      bd.setAttribute("aria-hidden","true");
    }
  }

  function paintDots(){
    for(let i=1;i<=4;i++){
      const d = $("d"+i);
      if(!d) continue;
      d.classList.toggle("on", pinBuf.length >= i);
    }
  }

  function bindKeypad(){
    const pad = $("keypad");
    if(!pad) return;
    pad.addEventListener("click",(e)=>{
      const b = e.target.closest(".key");
      if(!b) return;
      const k = b.getAttribute("data-k");
      if(!k) return;

      if(k==="del"){
        pinBuf = pinBuf.slice(0,-1);
        paintDots();
        return;
      }
      if(k==="ok"){
        verifyPin();
        return;
      }
      if(pinBuf.length>=4) return;
      pinBuf += k;
      paintDots();
      if(pinBuf.length===4) verifyPin();
    });

    const c = $("lockClose");
    if(c) c.onclick = ()=> { /* no cerrar si está bloqueado */ };

    const copy = $("btnLockCopyLink");
    if(copy) copy.onclick = ()=> copyToClipboard(location.href, "Enlace copiado");

    const reset = $("btnLockReset");
    if(reset) reset.onclick = ()=>{
      confirmModal("Borrar todo", "Se borrarán compromisos, amigos y ajustes de este móvil. ¿Continuar?", ()=>{
        localStorage.clear();
        location.reload();
      });
    };
  }

  function verifyPin(){
    if(!settings.pinEnabled) { locked=false; showLock(false); return; }
    const ok = (hash(pinBuf) === settings.pinHash);
    if(ok){
      locked = false;
      lastUnlockAt = Date.now();
      showLock(false);
      toast("Desbloqueado");
    }else{
      toast("PIN incorrecto");
      pinBuf = "";
      paintDots();
    }
  }

  function openPinSetup(requireOld=false){
    const bd = $("pinBackdrop");
    if(!bd) return;

    const hasPin = !!settings.pinHash;
    const needOld = requireOld && hasPin;

    $("pinTitle").textContent = hasPin ? "Cambiar PIN" : "Configurar PIN";
    $("pinHint").textContent = hasPin ? (needOld ? "Introduce tu PIN actual y el nuevo." : "Define tu nuevo PIN.") : "Crea un PIN para bloquear la app.";

    $("pinOldWrap").style.display = needOld ? "block" : "none";
    $("pinOld").value = "";
    $("pinNew").value = "";
    $("pinNew2").value = "";

    const close = ()=> {
      bd.classList.remove("show");
      bd.setAttribute("aria-hidden","true");
    };
    $("pinClose").onclick = close;
    $("pinCancel").onclick = close;

    $("pinOk").onclick = ()=>{
      const oldV = $("pinOld").value.trim();
      const n1 = $("pinNew").value.trim();
      const n2 = $("pinNew2").value.trim();

      if(needOld){
        if(hash(oldV) !== settings.pinHash){
          toast("PIN actual incorrecto");
          return;
        }
      }
      if(!/^\d{4}$/.test(n1) || !/^\d{4}$/.test(n2)){
        toast("El PIN debe tener 4 dígitos");
        return;
      }
      if(n1 !== n2){
        toast("Los PIN no coinciden");
        return;
      }

      settings.pinHash = hash(n1);
      settings.pinEnabled = true;
      save(SETTINGS_KEY, settings);
      renderSettings();
      close();
      toast("PIN guardado");
    };

    bd.classList.add("show");
    bd.setAttribute("aria-hidden","false");
  }

  /* =========================
     Notificaciones (permiso básico)
  ========================= */
  function bindNotif(){
    const sw = $("swNotif");
    const btn = $("btnNotifPerm");
    const hint = $("notifHint");

    function update(){
      if(!hint) return;
      const p = (Notification && Notification.permission) ? Notification.permission : "default";
      if(p === "granted") hint.textContent = "✅ Permiso concedido. Los recordatorios se podrán mostrar si están programados.";
      else if(p === "denied") hint.textContent = "⛔ Permiso denegado. Actívalo desde Ajustes del navegador.";
      else hint.textContent = "ℹ️ Pulsa “Permitir” para recibir recordatorios.";
    }

    if(sw){
      sw.onclick = ()=>{
        settings.notifEnabled = !settings.notifEnabled;
        save(SETTINGS_KEY, settings);
        renderSettings();
        toast(settings.notifEnabled ? "Notificaciones activadas" : "Notificaciones desactivadas");
      };
      sw.onkeydown = (e)=>{ if(e.key==="Enter" || e.key===" "){ e.preventDefault(); sw.click(); } };
    }

    if(btn){
      btn.onclick = async ()=>{
        try{
          if(!("Notification" in window)){
            toast("Tu navegador no soporta notificaciones");
            return;
          }
          const p = await Notification.requestPermission();
          update();
          if(p==="granted") toast("Permiso concedido");
        }catch(e){
          toast("No se pudo pedir permiso");
        }
      };
    }

    update();
  }

  /* =========================
     Navegación panes + botones
  ========================= */
  function bindNav(){
    const tabC = $("tabCommitments");
    const tabA = $("tabContacts");
    const fab = $("fab");
    const btnA11yTop = $("btnA11yTop");
    const btnA11y = $("btnA11y");
    const gear = $("btnSettingsGear");

    if(tabC) tabC.onclick = ()=> setPane("commitments");
    if(tabA) tabA.onclick = ()=> setPane("contacts");

    if(fab) fab.onclick = ()=> openCommitModal(null);

    if(btnA11yTop) btnA11yTop.onclick = toggleBigText;
    if(btnA11y) btnA11y.onclick = toggleBigText;

    if(gear) gear.onclick = ()=> setPane("settings");

    // tiles menú
    const tPend = $("tilePending");
    const tWait = $("tileWaiting");
    const tDone = $("tileDone");
    const tCon = $("tileContacts");

    if(tPend) tPend.onclick = ()=>{ setPane("commitments"); setView("pending"); };
    if(tWait) tWait.onclick = ()=>{ setPane("commitments"); setView("waiting"); };
    if(tDone) tDone.onclick = ()=>{ setPane("commitments"); setView("closed"); };
    if(tCon) tCon.onclick = ()=>{ setPane("contacts"); };

    // seg tabs compromisos
    $("tabPending").onclick = ()=> setView("pending");
    $("tabWaiting").onclick = ()=> setView("waiting");
    $("tabDone").onclick = ()=> setView("closed");
  }

  function setPane(which){
    pane = which;

    // panes
    const pC = $("commitmentsPane");
    const pA = $("contactsPane");
    const pS = $("settingsPane");
    if(pC) pC.style.display = (pane==="commitments") ? "" : "none";
    if(pA) pA.style.display = (pane==="contacts") ? "" : "none";
    if(pS) pS.style.display = (pane==="settings") ? "" : "none";

    // bottom nav active
    const tabC = $("tabCommitments");
    const tabA = $("tabContacts");
    if(tabC) tabC.classList.toggle("active", pane==="commitments");
    if(tabA) tabA.classList.toggle("active", pane==="contacts");

    renderAll();
  }

  function setView(v){
    view = v;
    $("tabPending").classList.toggle("active", view==="pending");
    $("tabWaiting").classList.toggle("active", view==="waiting");
    $("tabDone").classList.toggle("active", view==="closed");
    renderCommitments();
  }

  /* =========================
     Misc: sticky/topbar bug guard
  ========================= */
  function mitigateStickyBug(){
    // En algunos móviles/Chrome, el position:sticky con blur puede “quedarse fijo” raro.
    // Forzamos repaint en scroll/resize, y desactivamos backdrop-filter si detectamos glitch.
    let t = null;
    window.addEventListener("scroll", ()=>{
      if(t) cancelAnimationFrame(t);
      t = requestAnimationFrame(()=>{
        const tb = document.querySelector(".topbar");
        if(!tb) return;
        // reflow
        tb.style.transform = "translateZ(0)";
        setTimeout(()=>{ tb.style.transform = ""; }, 0);
      });
    }, { passive:true });

    window.addEventListener("resize", ()=>{
      const tb = document.querySelector(".topbar");
      if(!tb) return;
      tb.style.transform = "translateZ(0)";
      setTimeout(()=>{ tb.style.transform = ""; }, 0);
    }, { passive:true });
  }

  /* =========================
     INIT
  ========================= */
  function init(){
    // cargar datos
    data = load(KEY, []);
    contacts = load(CONTACTS_KEY, []);
    settings = load(SETTINGS_KEY, settings);

    // normalizar por si venían de versiones antiguas
    data = (data||[]).map(normalizeStatus);
    save(KEY, data);

    applyBigText();

    // binds
    bindNav();
    bindCommitModalButtons();
    bindContactModalButtons();
    bindPin();
    bindKeypad();
    bindNotif();

    // importar paquete desde URL (si lo hay)
    tryImportFromUrl();

    // render
    renderAll();

    // guard sticky bug
    mitigateStickyBug();

    // auto-lock cuando se oculta la página (si pin)
    document.addEventListener("visibilitychange", ()=>{
      if(document.hidden){
        if(settings.pinEnabled && Number(settings.autoLockMin||0)===0){
          lockNow();
        }else if(settings.pinEnabled){
          const mins = Number(settings.autoLockMin||0);
          if(mins>0){
            setTimeout(()=>{
              if(document.hidden) lockNow();
            }, mins*60*1000);
          }
        }
      }else{
        // si volver y está bloqueado, mantener
      }
    });

    // recordar desbloqueo
    window.addEventListener("focus", ()=>{
      if(settings.pinEnabled){
        const rem = Number(settings.rememberMin||0);
        if(rem>0 && lastUnlockAt){
          const okUntil = lastUnlockAt + rem*60*1000;
          if(Date.now() < okUntil){
            locked = false;
            showLock(false);
            return;
          }
        }
        if(locked) showLock(true);
      }
    });
  }

  // Arranque
  if(document.readyState === "loading"){
    document.addEventListener("DOMContentLoaded", init);
  }else{
    init();
  }

})();