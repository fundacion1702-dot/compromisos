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
     ✅ CSS de soporte (layout + lupa + fixes)
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
           ✅ AUTOCOMPLETADO PROPIO (sin datalist nativo)
           - Evita flechitas raras del navegador
           - Aparece solo al escribir
           - Pegado al input
        ========================= */
        .acPanel{
          display:none;
          margin-top:6px;
          border:1px solid var(--border);
          background:var(--surface);
          border-radius:16px;
          box-shadow:var(--shadow2);
          overflow:hidden;
          max-height:220px;
          overflow:auto;
        }
        .acPanel.show{ display:block; }
        .acItem{
          padding:12px 12px;
          font-weight:900;
          font-size:16px; /* ✅ un poco más grande */
          line-height:1.1;
          cursor:pointer;
          -webkit-tap-highlight-color:transparent;
          border-top:1px solid rgba(229,231,235,.75);
          background:var(--surface);
        }
        .acItem:first-child{ border-top:none; }
        .acItem:active{ background:var(--surface2); }
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

    if(!$("miniContactsTools")){
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
    }

    const btn = $("btnContactsTools");
    const panel = $("contactsToolsPanel");
    if(btn && panel && btn.dataset.bound !== "1"){
      btn.dataset.bound = "1";
      btn.addEventListener("click", ()=>{
        uiContactsSearchOpen = !uiContactsSearchOpen;
        btn.setAttribute("aria-expanded", uiContactsSearchOpen ? "true" : "false");
        panel.classList.toggle("show", uiContactsSearchOpen);
        if(uiContactsSearchOpen){
          setTimeout(()=>{ try{ $("contactsSearchTxt").focus(); }catch(_){} }, 0);
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
    }

    if(btn) btn.setAttribute("aria-expanded", uiContactsSearchOpen ? "true" : "false");
    if(panel) panel.classList.toggle("show", uiContactsSearchOpen);
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
        return new Date(b.closedAt||b.doneAt||0).getTime() - new Date(aClosedAt(b)||0).getTime();
      });

    function aClosedAt(x){
      return x.closedAt || x.doneAt || 0;
    }

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

/* ===== FIN PARTE 1/3 ===== */

/* compromisos.js (COMPLETO) — PARTE 2/3 */

/* =========================
   Modales base (abrir/cerrar)
========================= */
  function showBackdrop(id){
    const b = $(id);
    if(!b) return;
    b.classList.add("show");
    b.setAttribute("aria-hidden","false");
  }
  function hideBackdrop(id){
    const b = $(id);
    if(!b) return;
    b.classList.remove("show");
    b.setAttribute("aria-hidden","true");
  }

  function closeAllModals(){
    hideBackdrop("backdrop");
    hideBackdrop("cBackdrop");
    hideBackdrop("pinBackdrop");
    hideBackdrop("shareBackdrop");
    hideBackdrop("confirmBackdrop");
  }

  function bindModalClosers(){
    const pairs = [
      ["backdrop", "btnClose"],
      ["backdrop", "btnCancel"],

      ["cBackdrop", "cBtnClose"],
      ["cBackdrop", "cBtnCancel"],

      ["pinBackdrop", "pinClose"],
      ["pinBackdrop", "pinCancel"],

      ["shareBackdrop", "shareClose"],
      ["shareBackdrop", "shareCancel"],

      ["confirmBackdrop", "confirmClose"],
      ["confirmBackdrop", "confirmNo"]
    ];
    pairs.forEach(([bid, cid])=>{
      const c = $(cid);
      if(c) c.addEventListener("click", ()=> hideBackdrop(bid));
    });

    // click fuera => cerrar (solo si tocas backdrop)
    ["backdrop","cBackdrop","pinBackdrop","shareBackdrop","confirmBackdrop"].forEach(bid=>{
      const b = $(bid);
      if(!b) return;
      b.addEventListener("click", (e)=>{
        if(e.target === b) hideBackdrop(bid);
      });
    });
  }

  /* =========================
     Confirm modal
  ========================= */
  let confirmResolve = null;
  function askConfirm({ title="Confirmar", msg="¿Seguro?", yes="Sí, continuar", no="Cancelar" }){
    return new Promise((resolve)=>{
      confirmResolve = resolve;
      if($("confirmTitle")) $("confirmTitle").textContent = title;
      if($("confirmMsg")) $("confirmMsg").innerHTML = esc(msg);
      if($("confirmYes")) $("confirmYes").textContent = yes;
      if($("confirmNo")) $("confirmNo").textContent = no;

      showBackdrop("confirmBackdrop");

      const done = (v)=>{
        hideBackdrop("confirmBackdrop");
        const r = confirmResolve;
        confirmResolve = null;
        try{ r && r(v); }catch(_){}
      };

      const y = $("confirmYes");
      const n = $("confirmNo");

      const onY = ()=>{ cleanup(); done(true); };
      const onN = ()=>{ cleanup(); done(false); };

      function cleanup(){
        y && y.removeEventListener("click", onY);
        n && n.removeEventListener("click", onN);
      }

      y && y.addEventListener("click", onY);
      n && n.addEventListener("click", onN);
    });
  }

  /* =========================
     Amigos: CRUD
  ========================= */
  function openContactModal(contactId){
    const isEdit = !!contactId;
    const mTitle = $("cModalTitle");
    const fName = $("cName");
    const fNote = $("cNote");

    if(mTitle) mTitle.textContent = isEdit ? "Editar amigo" : "Nuevo amigo";

    const c = isEdit ? contacts.find(x=>x.id===contactId) : null;
    if(fName) fName.value = c?.name || "";
    if(fNote) fNote.value = c?.note || "";

    $("cBtnSave").onclick = ()=>{
      const name = normalizeName(fName.value);
      const note = normalizeName(fNote.value);

      if(!name){
        toast("Escribe un nombre.");
        try{ fName.focus(); }catch(_){}
        return;
      }

      // evitar duplicados exactos (solo para contactos)
      const existing = findContactByName(name);
      if(!isEdit && existing){
        toast("Ese amigo ya existe.");
        hideBackdrop("cBackdrop");
        setPane("contacts");
        return;
      }

      if(isEdit && c){
        c.name = name;
        c.note = note;
      }else{
        contacts.push({ id: uid(), name, note, createdAt:new Date().toISOString() });
      }

      save(CONTACTS_KEY, contacts);
      fillCommitFriendSelect();
      renderContacts();
      renderCommitments();

      hideBackdrop("cBackdrop");
      toast(isEdit ? "Amigo actualizado ✅" : "Amigo creado ✅");
    };

    showBackdrop("cBackdrop");
    setTimeout(()=>{ try{ fName.focus(); }catch(_){} }, 0);
  }

  async function deleteContact(contactId){
    const c = contacts.find(x=>x.id===contactId);
    if(!c) return;

    const ok = await askConfirm({
      title:"Eliminar amigo",
      msg:`Vas a eliminar a <b>${esc(c.name||"Sin nombre")}</b>. Los compromisos quedarán con el nombre escrito, pero sin vínculo. ¿Continuar?`,
      yes:"Sí, eliminar",
      no:"Cancelar"
    });
    if(!ok) return;

    // desvincular compromisos
    data.forEach(it=>{
      if(it.whoId === contactId){
        it.whoId = null;
        it.whoName = c.name || it.whoName || "";
        it.updatedAt = new Date().toISOString();
      }
    });

    contacts = contacts.filter(x=>x.id!==contactId);

    save(CONTACTS_KEY, contacts);
    save(KEY, data);

    fillCommitFriendSelect();
    renderAll();
    toast("Amigo eliminado.");
  }

  /* =========================
     Compromisos: CRUD + share
  ========================= */
  let editingCommitId = null;
  let preselectedFriendId = null;

  // ✅ Autocompletado propio para el input "Nombre"
  let acPanel = null;

  function ensureAutoCompletePanel(){
    const whoInput = $("fWho");
    if(!whoInput) return;

    // ⚠️ Quitamos el datalist nativo para evitar flechas raras
    if(whoInput.hasAttribute("list")){
      whoInput.removeAttribute("list");
    }

    // Crear panel si no existe
    if(!$("whoAcPanel")){
      const panel = document.createElement("div");
      panel.className = "acPanel";
      panel.id = "whoAcPanel";
      // lo insertamos justo después del input
      whoInput.insertAdjacentElement("afterend", panel);
    }
    acPanel = $("whoAcPanel");
  }

  function buildSuggestions(query){
    const q = normalizeName(query).toLowerCase();
    if(!q) return [];

    // filtrar por "empieza por" o "incluye", priorizando empieza por
    const all = contacts.slice().sort((a,b)=> (a.name||"").localeCompare(b.name||"", "es"));
    const starts = [];
    const contains = [];

    for(const c of all){
      const name = normalizeName(c.name).toLowerCase();
      if(!name) continue;
      if(name.startsWith(q)) starts.push(c);
      else if(name.includes(q)) contains.push(c);
    }
    return starts.concat(contains).slice(0, 12);
  }

  function showSuggestionsFor(query){
    ensureAutoCompletePanel();
    if(!acPanel) return;

    const items = buildSuggestions(query);

    // Solo mostrar si hay query y hay sugerencias
    if(!normalizeName(query) || items.length===0){
      acPanel.classList.remove("show");
      acPanel.innerHTML = "";
      return;
    }

    acPanel.innerHTML = items.map(c=>{
      return `<div class="acItem" data-id="${esc(c.id)}">${esc(c.name)}</div>`;
    }).join("");

    acPanel.classList.add("show");

    // click en item => set value y cerrar
    acPanel.querySelectorAll(".acItem").forEach(el=>{
      el.addEventListener("click", ()=>{
        const id = el.getAttribute("data-id");
        const c = contacts.find(x=>x.id===id);
        if(!c) return;

        const whoInput = $("fWho");
        if(whoInput) whoInput.value = c.name || "";
        preselectedFriendId = c.id;

        acPanel.classList.remove("show");
        acPanel.innerHTML = "";

        // foco al siguiente campo
        setTimeout(()=>{ try{ $("fWhat").focus(); }catch(_){} }, 0);
      });
    });
  }

  function hideSuggestions(){
    if(!acPanel) return;
    acPanel.classList.remove("show");
    acPanel.innerHTML = "";
  }

  function bindWhoAutocomplete(){
    const whoInput = $("fWho");
    if(!whoInput) return;

    ensureAutoCompletePanel();

    if(whoInput.dataset.acBound === "1") return;
    whoInput.dataset.acBound = "1";

    // cuando escribes => filtra
    whoInput.addEventListener("input", ()=>{
      const val = whoInput.value || "";
      const match = findContactByName(val);
      preselectedFriendId = match ? match.id : null;

      showSuggestionsFor(val);
    });

    // al enfocar: si hay texto, muestra (si hay resultados)
    whoInput.addEventListener("focus", ()=>{
      const val = whoInput.value || "";
      showSuggestionsFor(val);
    });

    // al salir: espera un pelín por si haces click en sugerencia
    whoInput.addEventListener("blur", ()=>{
      setTimeout(()=> hideSuggestions(), 140);
    });

    // tecla Enter: si hay panel abierto, coger el primero
    whoInput.addEventListener("keydown", (e)=>{
      if(e.key !== "Enter") return;
      if(!acPanel || !acPanel.classList.contains("show")) return;

      const first = acPanel.querySelector(".acItem");
      if(first){
        e.preventDefault();
        first.click();
      }
    });
  }

  function openCommitModal(commitId, friendId){
    editingCommitId = commitId || null;
    preselectedFriendId = friendId || null;

    const isEdit = !!editingCommitId;
    const t = $("modalTitle");
    if(t) t.textContent = isEdit ? "Editar compromiso" : "Nuevo compromiso";

    const it = isEdit ? data.find(x=>x.id===editingCommitId) : null;

    const fWho = $("fWho");
    const fWhat = $("fWhat");
    const fWhen = $("fWhen");
    const fRemind = $("fRemind");
    const fAfter = $("fAfter");

    // rellenar
    if(fWho){
      if(friendId){
        const c = getContactById(friendId);
        fWho.value = c?.name || "";
      }else{
        fWho.value = isEdit ? (normalizedWho(it) || "") : "";
      }
    }
    if(fWhat) fWhat.value = isEdit ? (it?.what || "") : "";
    if(fWhen){
      // input datetime-local requiere formato YYYY-MM-DDTHH:mm
      if(isEdit && it?.when){
        const d = new Date(it.when);
        if(!isNaN(d.getTime())){
          const pad=(n)=> String(n).padStart(2,"0");
          const v = `${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
          fWhen.value = v;
        }else fWhen.value = "";
      }else fWhen.value = "";
    }
    if(fRemind) fRemind.value = isEdit ? String(it?.remindMin || 0) : "0";
    if(fAfter) fAfter.value = isEdit ? String(it?.afterMin || 0) : "0";

    // ✅ Autocomplete
    bindWhoAutocomplete();
    hideSuggestions();

    // guardar
    $("btnSave").onclick = async ()=>{
      const whoRaw = normalizeName(fWho.value);
      const what = normalizeName(fWhat.value);
      const whenLocal = (fWhen.value || "").trim();
      const remindMin = Number(fRemind.value || 0);
      const afterMin = Number(fAfter.value || 0);

      if(!whoRaw){
        toast("Escribe un nombre.");
        try{ fWho.focus(); }catch(_){}
        return;
      }
      if(!what){
        toast("Escribe qué se acordó.");
        try{ fWhat.focus(); }catch(_){}
        return;
      }

      // fecha ISO (si hay)
      let whenIso = null;
      if(whenLocal){
        const d = new Date(whenLocal);
        if(!isNaN(d.getTime())) whenIso = d.toISOString();
      }

      // ✅ vínculo automático si coincide exacto
      let link = null;
      const exact = findContactByName(whoRaw);
      if(exact) link = exact;

      // si se eligió desde sugerencias, también cuenta
      if(!link && preselectedFriendId){
        const c = getContactById(preselectedFriendId);
        if(c && normalizeName(c.name).toLowerCase() === normalizeName(whoRaw).toLowerCase()){
          link = c;
        }
      }

      const now = new Date().toISOString();

      if(isEdit && it){
        it.whoId = link ? link.id : null;
        it.whoName = link ? null : whoRaw;
        it.what = what;
        it.when = whenIso;
        it.remindMin = remindMin;
        it.afterMin = afterMin;
        it.updatedAt = now;
      }else{
        data.push(normalizeStatus({
          id: uid(),
          whoId: link ? link.id : null,
          whoName: link ? null : whoRaw,
          what,
          when: whenIso,
          remindMin,
          afterMin,
          status: "pending",
          createdAt: now,
          updatedAt: null
        }));
      }

      save(KEY, data);

      // ✅ Si NO existe amigo exacto, preguntar si guardar nuevo amigo (ya lo tenías funcionando)
      if(!link){
        const ok = await askConfirm({
          title:"Guardar nuevo amigo",
          msg:`¿Quieres guardar a <b>${esc(whoRaw)}</b> como nuevo amigo para futuras sugerencias?`,
          yes:"Sí, guardar",
          no:"No"
        });
        if(ok){
          // evitar duplicado por si se creó mientras
          const ex2 = findContactByName(whoRaw);
          if(!ex2){
            contacts.push({ id: uid(), name: whoRaw, note:"", createdAt: now });
            save(CONTACTS_KEY, contacts);
          }
        }
      }

      // refrescar
      fillCommitFriendSelect();
      renderAll();

      hideBackdrop("backdrop");

      // abrir modal compartir
      openShareModalForLast(isEdit ? it : data[data.length-1]);
    };

    showBackdrop("backdrop");
    setTimeout(()=>{ try{ fWho.focus(); }catch(_){} }, 0);
  }

  function openShareModalForLast(it){
    if(!it) return;

    const who = normalizedWho(it);
    const dueText = it.when ? fmtDate(it.when) : "Sin fecha";
    const afterMin = Number(it.afterMin || 0);

    const pkg = {
      v:1,
      id: it.id,
      who,
      what: it.what || "",
      when: it.when || null,
      remindMin: Number(it.remindMin || 0),
      afterMin
    };

    const base = appBaseUrl();
    const hash = "#pkg=" + encodeURIComponent(btoa(unescape(encodeURIComponent(JSON.stringify(pkg)))));
    const url = base + hash;

    // UI
    if($("shareTitle")){
      $("shareTitle").innerHTML = `Compromiso con <b>${esc(who)}</b> · ⏰ ${esc(dueText)}`;
    }

    const shortTxt = `📌 Compromiso\n👤 ${who}\n📝 ${it.what || ""}\n⏰ ${dueText}\n🔗 ${url}`;
    const longTxt = `📌 Compromiso (detalle)\n\n👤 Nombre: ${who}\n📝 Qué: ${it.what || ""}\n⏰ Para cuándo: ${dueText}\n🔔 Recordatorio: ${Number(it.remindMin||0)} min\n⏳ Avisar desde ahora: ${afterMin} min\n\n🔗 Enlace:\n${url}`;

    let mode = "short";
    const renderShare = ()=>{
      const t = (mode==="short") ? shortTxt : longTxt;
      if($("shareTextBox")) $("shareTextBox").textContent = t;
      if($("shareUrlBox")) $("shareUrlBox").textContent = url;
      if($("shareShort")) $("shareShort").classList.toggle("active", mode==="short");
      if($("shareLong")) $("shareLong").classList.toggle("active", mode==="long");
    };

    $("shareShort").onclick = ()=>{ mode="short"; renderShare(); };
    $("shareLong").onclick = ()=>{ mode="long"; renderShare(); };

    $("shareCopyUrl").onclick = async ()=>{
      try{
        await navigator.clipboard.writeText(url);
        toast("Enlace copiado ✅");
      }catch(e){
        toast("No se pudo copiar.");
      }
    };

    $("shareCopyAll").onclick = async ()=>{
      try{
        await navigator.clipboard.writeText((mode==="short")?shortTxt:longTxt);
        toast("Texto copiado ✅");
      }catch(e){
        toast("No se pudo copiar.");
      }
    };

    $("shareSend").onclick = async ()=>{
      const txt = (mode==="short")?shortTxt:longTxt;
      if(navigator.share){
        try{
          await navigator.share({ text: txt });
          toast("Compartido ✅");
        }catch(e){}
      }else{
        try{
          await navigator.clipboard.writeText(txt);
          toast("Copiado ✅ (no hay compartir)");
        }catch(e){
          toast("No se pudo copiar.");
        }
      }
    };

    renderShare();
    showBackdrop("shareBackdrop");
  }

  async function deleteCommit(id){
    const it = data.find(x=>x.id===id);
    if(!it) return;

    const ok = await askConfirm({
      title:"Eliminar compromiso",
      msg:`Vas a eliminar este compromiso con <b>${esc(normalizedWho(it))}</b>. ¿Continuar?`,
      yes:"Sí, eliminar",
      no:"Cancelar"
    });
    if(!ok) return;

    data = data.filter(x=>x.id!==id);
    save(KEY, data);
    renderAll();
    toast("Compromiso eliminado.");
  }

  /* =========================
     Import por enlace (#pkg=)
  ========================= */
  function tryImportFromHash(){
    try{
      const h = location.hash || "";
      const m = h.match(/#pkg=([^&]+)/);
      if(!m) return;

      const raw = decodeURIComponent(m[1]);
      const json = decodeURIComponent(escape(atob(raw)));
      const pkg = safeJsonParse(json, null);
      if(!pkg || !pkg.id) return;

      // evitar duplicados
      const exists = data.find(x=>x.id===pkg.id);
      if(exists){
        toast("Paquete ya importado.");
        location.hash = "";
        return;
      }

      // crear item
      const now = new Date().toISOString();
      data.push(normalizeStatus({
        id: pkg.id,
        whoId: null,
        whoName: normalizeName(pkg.who || "Sin nombre"),
        what: normalizeName(pkg.what || ""),
        when: pkg.when || null,
        remindMin: Number(pkg.remindMin || 0),
        afterMin: Number(pkg.afterMin || 0),
        status: "pending",
        createdAt: now,
        updatedAt: null
      }));

      // marcar recibidos
      received = received || { c:0, lastAt:null };
      received.c = Math.max(0, Number(received.c||0)) + 1;
      received.lastAt = now;
      save(RECEIVED_KEY, received);

      save(KEY, data);
      renderAll();
      toast("Compromiso importado ✅");

      // limpiar hash para no reimportar
      location.hash = "";
    }catch(e){}
  }

/* ===== FIN PARTE 2/3 ===== */

/* compromisos.js (COMPLETO) — PARTE 3/3 */

/* =========================
   Render: compromisos
========================= */
  function renderCommitments(){
    const paneEl = $("commitmentsPane");
    if(!paneEl) return;

    ensureCommitFiltersUi();
    updateCommitmentsHeading();
    updateCounts();

    const list = $("list");
    const empty = $("empty");
    if(!list) return;

    list.innerHTML = "";

    const items = data
      .filter(x => x.status === view)
      .filter(passesCommitFilters)
      .slice()
      .sort((a,b)=>{
        if(view==="pending"){
          const ao = isOverdue(a.when)?1:0, bo=isOverdue(b.when)?1:0;
          if(ao!==bo) return bo-ao;
          const ta = a.when ? new Date(a.when).getTime() : Number.POSITIVE_INFINITY;
          const tb = b.when ? new Date(b.when).getTime() : Number.POSITIVE_INFINITY;
          if(ta!==tb) return ta-tb;
          return new Date(b.updatedAt||b.createdAt||0).getTime() - new Date(a.updatedAt||a.createdAt||0).getTime();
        }
        if(view==="waiting"){
          return new Date(b.updatedAt||b.createdAt||0).getTime() - new Date(a.updatedAt||a.createdAt||0).getTime();
        }
        return new Date(b.closedAt||b.doneAt||0).getTime() - new Date(a.closedAt||a.doneAt||0).getTime();
      });

    if(empty) empty.style.display = items.length ? "none" : "block";

    items.forEach((it)=>{
      const card = document.createElement("div");
      card.className = "card";

      const who = normalizedWho(it);
      const dueText = it.when ? fmtDate(it.when) : "Sin fecha";
      const overdue = (it.status==="pending" && isOverdue(it.when));

      const stChip =
        it.status==="pending" ? "🟣 Pendiente" :
        it.status==="waiting" ? "⏳ En espera" :
        "✅ Cerrado";

      const primaryLabel = it.status==="closed" ? "↩️ Reabrir" : "✅ Cerrar";
      const secondaryLabel =
        it.status==="pending" ? "⏳ En espera" :
        it.status==="waiting" ? "🟣 Pendiente" :
        "⏳ En espera";

      card.innerHTML = `
        <div class="cardTop" style="align-items:flex-start;">
          <div class="who" style="min-width:0;">
            <p class="name" title="${esc(who)}">${esc(who)}</p>
            <p class="meta">
              <span class="chip status">${esc(stChip)}</span>
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
          <button class="btn good" type="button" data-act="primary">${primaryLabel}</button>
          <button class="btn" type="button" data-act="secondary">${secondaryLabel}</button>
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
        }else{
          it.status = "closed";
          it.closedAt = now();
          it.done = true; it.doneAt = it.closedAt;
          it.updatedAt = now();
        }
        save(KEY, data);
        renderCommitments();
      });

      card.querySelector('[data-act="secondary"]').addEventListener("click", ()=>{
        if(it.status==="pending"){
          it.status = "waiting";
          it.updatedAt = now();
        }else if(it.status==="waiting"){
          it.status = "pending";
          it.updatedAt = now();
        }else{
          it.status = "waiting";
          it.closedAt = null;
          it.done = false; it.doneAt = null;
          it.updatedAt = now();
        }
        save(KEY, data);
        renderCommitments();
      });

      card.querySelector('[data-act="edit"]').addEventListener("click", ()=> openCommitModal(it.id, null));
      card.querySelector('[data-act="del"]').addEventListener("click", ()=> deleteCommit(it.id));

      list.appendChild(card);
    });

    fixPillsOrder();
    removeBottomInstallText();
  }

  /* =========================
     Render: contactos
  ========================= */
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

      card.innerHTML = `
        <div class="cardTop">
          <div class="who" style="min-width:0;">
            <p class="name">${esc(c.name || "Sin nombre")}</p>
            <p class="meta">
              ${c.note ? `<span class="chip">🛈 ${esc(c.note)}</span>` : ``}
            </p>
          </div>
          <button class="btn primary" type="button" data-act="new" style="flex:0 0 auto;">➕ Compromiso</button>
        </div>

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

    try{ window.scrollTo({ top:0, behavior:"smooth" }); }catch(_){ window.scrollTo(0,0); }
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

  function bindSettingsGear(){
    const gear = $("btnSettingsGear");
    if(!gear) return;
    if(gear.dataset.bound === "1") return;
    gear.dataset.bound = "1";

    gear.addEventListener("click", ()=>{
      if(pane === "settings") setPane("commitments");
      else setPane("settings");
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
    fixPillsOrder();
    removeBottomInstallText();

    bindA11yDelegation();
    bindBrandHome();
    bindNav();
    bindSettingsGear();
    bindFab();
    bindModalClosers();
    bindCommitModal();
    bindContactModal();
    bindShare();
    bindSettings();
    bindInstall();

    // ✅ Autocompletado (panel propio sin flechas)
    bindWhoAutocomplete();

    tryImportFromHash();

    fillCommitFriendSelect();
    updateCommitmentsHeading();
    renderAll();
  }

  if(document.readyState === "loading"){
    document.addEventListener("DOMContentLoaded", start, { once:true });
  }else{
    start();
  }

})();