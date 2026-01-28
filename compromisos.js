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

/* =========================
     UI: Modales genéricos (Confirm)
  ========================= */
  function showConfirm(title, msg, yesText, noText, danger, onYes){
    const bd = $("confirmBackdrop");
    if(!bd) return;

    $("confirmTitle").textContent = title || "Confirmar";
    $("confirmMsg").innerHTML = esc(msg || "").replace(/\n/g,"<br>");

    const bYes = $("confirmYes");
    const bNo = $("confirmNo");
    const bX = $("confirmClose");

    bYes.textContent = yesText || "Sí, continuar";
    bNo.textContent = noText || "Cancelar";

    bYes.classList.toggle("danger", danger !== false); // por defecto danger
    bd.classList.add("show");
    bd.setAttribute("aria-hidden","false");

    const close = ()=>{
      bd.classList.remove("show");
      bd.setAttribute("aria-hidden","true");
      bYes.onclick = null;
      bNo.onclick = null;
      bX.onclick = null;
    };

    bNo.onclick = close;
    bX.onclick = close;
    bd.addEventListener("click", (e)=>{
      if(e.target === bd) close();
    }, { once:true });

    bYes.onclick = ()=>{
      close();
      try{ onYes && onYes(); }catch(e){}
    };
  }

  /* =========================
     Datos: contactos (amigos)
  ========================= */
  function normalizeContacts(){
    contacts = Array.isArray(contacts) ? contacts : [];
    contacts = contacts.map(c=>{
      const id = c.id || c.contactId || uid();
      return {
        id,
        name: String(c.name || c.nombre || "").trim(),
        note: String(c.note || c.nota || "").trim(),
        createdAt: c.createdAt || new Date().toISOString()
      };
    }).filter(c=>c.name);
    save(CONTACTS_KEY, contacts);
  }

  function findContactByExactName(name){
    const n = String(name||"").trim().toLowerCase();
    if(!n) return null;
    return contacts.find(c => String(c.name||"").trim().toLowerCase() === n) || null;
  }

  function contactNameById(id){
    const c = contacts.find(x=>x.id===id);
    return c ? c.name : "";
  }

  function ensureFriendsDatalist(){
    // mantenemos el datalist en HTML por compat, pero el suggest real es el nuestro
    // esto solo actualiza el <datalist> si existe.
    const dl = $("friendsDatalist");
    if(!dl) return;

    dl.innerHTML = "";
    const frag = document.createDocumentFragment();
    [...contacts]
      .sort((a,b)=>a.name.localeCompare(b.name,"es",{sensitivity:"base"}))
      .forEach(c=>{
        const opt = document.createElement("option");
        opt.value = c.name;
        frag.appendChild(opt);
      });
    dl.appendChild(frag);
  }

  /* =========================
     Datos: compromisos
  ========================= */
  function normalizeData(){
    data = Array.isArray(data) ? data : [];
    data = data.map(it=>{
      const id = it.id || it.commitId || uid();
      const whoName = String(it.whoName || it.who || it.nombre || "").trim();
      const whoId = it.whoId || it.contactId || null;

      return normalizeStatus({
        ...it,
        id,
        whoId: whoId || null,
        whoName: whoName || (whoId ? contactNameById(whoId) : ""),
        what: String(it.what || it.text || it.descripcion || "").trim(),
        when: it.when || it.date || it.fecha || "",
        remind: Number(it.remind || 0),
        after: Number(it.after || 0),
        createdAt: it.createdAt || new Date().toISOString(),
        updatedAt: it.updatedAt || it.createdAt || new Date().toISOString()
      });
    });
    save(KEY, data);
  }

  function saveData(){
    save(KEY, data);
  }

  function byViewFilter(it){
    if(view === "pending") return it.status === "pending";
    if(view === "waiting") return it.status === "waiting";
    return it.status === "closed";
  }

  function matchesCommitFilters(it){
    // filtro por amigo seleccionado
    if(commitFriendFilter && commitFriendFilter !== "all"){
      if(commitFriendFilter === "__none__"){
        if(it.whoId) return false;
      }else{
        if(it.whoId !== commitFriendFilter) return false;
      }
    }

    const q = (commitTextFilter || "").trim().toLowerCase();
    if(!q) return true;

    const who = String(it.whoName || (it.whoId ? contactNameById(it.whoId) : "") || "").toLowerCase();
    const what = String(it.what || "").toLowerCase();

    return who.includes(q) || what.includes(q);
  }

  function currentList(){
    return data
      .filter(byViewFilter)
      .filter(matchesCommitFilters);
  }

  function sortCommitments(arr){
    // Pendientes/En espera: por fecha (vencidos arriba), luego por createdAt
    // Cerrados: más recientes arriba
    const a = [...arr];

    if(view === "closed"){
      a.sort((x,y)=>{
        const tx = new Date(x.closedAt || x.doneAt || x.updatedAt || x.createdAt).getTime() || 0;
        const ty = new Date(y.closedAt || y.doneAt || y.updatedAt || y.createdAt).getTime() || 0;
        return ty - tx;
      });
      return a;
    }

    a.sort((x,y)=>{
      const wx = x.when ? new Date(x.when).getTime() : Infinity;
      const wy = y.when ? new Date(y.when).getTime() : Infinity;

      const ox = isFinite(wx) ? (wx < Date.now() ? 0 : 1) : 2;
      const oy = isFinite(wy) ? (wy < Date.now() ? 0 : 1) : 2;
      if(ox !== oy) return ox - oy;

      if(wx !== wy) return wx - wy;

      const cx = new Date(x.createdAt).getTime() || 0;
      const cy = new Date(y.createdAt).getTime() || 0;
      return cy - cx;
    });

    return a;
  }

  /* =========================
     ✅ Panel Buscar / Filtrar (debajo del header)
     - MISMO estilo de lista que #fWho
     - Busca: nombres + textos
     - Al elegir sugerencia: rellena input y filtra automático
  ========================= */
  function ensureCommitSearchPanel(){
    const paneEl = $("commitmentsPane");
    if(!paneEl) return;

    // Si ya existe, no duplicar
    if($("commitSearchBtn")) return;

    const head = paneEl.querySelector(".sectionHead");
    if(!head) return;

    // Botón "Buscar"
    const tools = document.createElement("div");
    tools.className = "miniTools";
    tools.innerHTML = `<button class="miniBtn" id="commitSearchBtn" type="button">🔎 Buscar</button>`;
    head.insertAdjacentElement("afterend", tools);

    // Panel
    const panel = document.createElement("div");
    panel.id = "commitSearchPanel";
    panel.className = "miniPanel";
    panel.innerHTML = `
      <div class="miniRow">
        <div class="field">
          <label class="label" for="commitSearchTxt">Buscar (nombre o texto)</label>
          <input id="commitSearchTxt" type="text" placeholder="Ej: Laura / 20€ / jueves / PDF…" autocomplete="off"/>
        </div>

        <div class="field" style="max-width:260px;">
          <label class="label" for="commitSearchFriend">Filtrar por amigo</label>
          <select id="commitSearchFriend">
            <option value="all">Todos</option>
            <option value="__none__">Sin vincular</option>
          </select>
        </div>

        <div class="field" style="max-width:160px;">
          <label class="label">&nbsp;</label>
          <button class="btn" id="commitSearchClear" type="button">🧹 Limpiar</button>
        </div>
      </div>
      <div class="miniHint">Escribe para ver sugerencias. Al elegir una, se rellena el campo y se filtra automáticamente.</div>
    `;
    tools.insertAdjacentElement("afterend", panel);

    // toggle
    $("commitSearchBtn").addEventListener("click", ()=>{
      uiCommitFiltersOpen = !uiCommitFiltersOpen;
      panel.classList.toggle("show", uiCommitFiltersOpen);
      if(uiCommitFiltersOpen){
        setTimeout(()=> $("commitSearchTxt")?.focus(), 50);
      }
    });

    // llenar select con amigos
    const sel = $("commitSearchFriend");
    const fillSel = ()=>{
      sel.innerHTML = `
        <option value="all">Todos</option>
        <option value="__none__">Sin vincular</option>
      `;
      [...contacts]
        .sort((a,b)=>a.name.localeCompare(b.name,"es",{sensitivity:"base"}))
        .forEach(c=>{
          const opt = document.createElement("option");
          opt.value = c.id;
          opt.textContent = c.name;
          sel.appendChild(opt);
        });

      sel.value = commitFriendFilter || "all";
    };
    fillSel();

    // bind filtros
    $("commitSearchTxt").addEventListener("input", ()=>{
      commitTextFilter = $("commitSearchTxt").value || "";
      renderCommitments();
      updateCounts();
    });

    sel.addEventListener("change", ()=>{
      commitFriendFilter = sel.value || "all";
      renderCommitments();
      updateCounts();
    });

    $("commitSearchClear").addEventListener("click", ()=>{
      commitTextFilter = "";
      commitFriendFilter = "all";
      $("commitSearchTxt").value = "";
      sel.value = "all";
      renderCommitments();
      updateCounts();
      toast("Filtros limpiados");
    });

    // ✅ SUGGEST para este input: sugiere nombres + fragmentos de texto
    attachSuggest("commitSearchTxt", "commitSearchSuggest", (q)=>{
      const items = [];

      const ql = q.toLowerCase();

      // nombres
      contacts.forEach(c=>{
        if(String(c.name||"").toLowerCase().includes(ql)) items.push(c.name);
      });

      // textos de compromisos + quién
      data.forEach(it=>{
        const who = String(it.whoName || (it.whoId ? contactNameById(it.whoId) : "") || "");
        const what = String(it.what || "");
        const blob = (who + " " + what).toLowerCase();
        if(!blob.includes(ql)) return;

        // si coincide en nombre, priorizar nombre
        if(who && who.toLowerCase().includes(ql)) items.push(who);

        // sugerencia de texto: un recorte limpio
        if(what){
          const clean = what.replace(/\s+/g," ").trim();
          const snip = clean.length > 44 ? (clean.slice(0, 44) + "…") : clean;
          items.push(snip);
        }
      });

      // quitar duplicados preservando orden
      const seen = new Set();
      const uniq = [];
      for(const t of items){
        const k = String(t).trim().toLowerCase();
        if(!k) continue;
        if(seen.has(k)) continue;
        seen.add(k);
        uniq.push(t);
      }
      return uniq;
    }, (txt)=>{
      // al elegir: rellena y filtra (commitTextFilter)
      commitTextFilter = txt || "";
      $("commitSearchTxt").value = commitTextFilter;
      renderCommitments();
      updateCounts();
    });
  }

  /* =========================
     Modal: Nuevo/Editar Compromiso
  ========================= */
  let editingId = null;

  function openCommitModal(item){
    editingId = item ? item.id : null;

    $("modalTitle").textContent = item ? "Editar compromiso" : "Nuevo compromiso";

    $("fWho").value = item ? (item.whoName || (item.whoId ? contactNameById(item.whoId) : "") || "") : "";
    $("fWhat").value = item ? (item.what || "") : "";
    $("fWhen").value = item ? (item.when ? String(item.when).slice(0,16) : "") : "";
    $("fRemind").value = item ? String(item.remind || 0) : "0";
    $("fAfter").value = item ? String(item.after || 0) : "0";

    showBackdrop("backdrop", true);

    // ✅ Suggest para NOMBRE (#fWho): nombres de contactos
    attachSuggest("fWho", "whoSuggest", (q)=>{
      const ql = q.toLowerCase();
      const items = [...contacts]
        .map(c=>c.name)
        .filter(n=> String(n).toLowerCase().includes(ql))
        .sort((a,b)=>a.localeCompare(b,"es",{sensitivity:"base"}));
      return items;
    }, (txt)=>{
      $("fWho").value = txt;
    });
  }

  function closeCommitModal(){
    showBackdrop("backdrop", false);
    editingId = null;
  }

  function showBackdrop(id, show){
    const bd = $(id);
    if(!bd) return;
    bd.classList.toggle("show", !!show);
    bd.setAttribute("aria-hidden", show ? "false" : "true");
  }

  function parseWhenValue(v){
    // datetime-local -> ISO string
    const s = String(v||"").trim();
    if(!s) return "";
    const d = new Date(s);
    if(isNaN(d.getTime())) return "";
    return d.toISOString();
  }

  function upsertCommitFromModal(){
    const whoInput = String($("fWho").value || "").trim();
    const what = String($("fWhat").value || "").trim();
    const whenIso = parseWhenValue($("fWhen").value);
    const remind = Number($("fRemind").value || 0);
    const after = Number($("fAfter").value || 0);

    if(!whoInput){
      toast("Escribe un nombre");
      $("fWho").focus();
      return;
    }
    if(!what){
      toast("Escribe qué se acordó");
      $("fWhat").focus();
      return;
    }

    const exact = findContactByExactName(whoInput);

    const nowIso = new Date().toISOString();

    if(editingId){
      const idx = data.findIndex(x=>x.id===editingId);
      if(idx >= 0){
        const prev = data[idx];
        data[idx] = normalizeStatus({
          ...prev,
          whoId: exact ? exact.id : null,
          whoName: whoInput,
          what,
          when: whenIso,
          remind,
          after,
          updatedAt: nowIso
        });
        saveData();
        closeCommitModal();
        toast("Guardado ✅");
        renderAll();
        return;
      }
    }

    // nuevo
    const newIt = normalizeStatus({
      id: uid(),
      status: "pending",
      whoId: exact ? exact.id : null,
      whoName: whoInput,
      what,
      when: whenIso,
      remind,
      after,
      createdAt: nowIso,
      updatedAt: nowIso
    });
    data.unshift(newIt);
    saveData();

    // si NO coincide con amigo, preguntar si guardar nuevo amigo (ya lo tenías y lo mantenemos)
    if(!exact){
      showConfirm(
        "¿Guardar nuevo amigo?",
        `Has escrito <b>${esc(whoInput)}</b> y no coincide con ningún amigo.\n\n¿Quieres guardarlo en “Amigos” para la próxima vez?`,
        "Sí, guardar",
        "No",
        false,
        ()=>{
          openContactModal({ name: whoInput, note: "" }, true);
        }
      );
    }

    closeCommitModal();
    toast("Creado ✅");
    renderAll();
  }

  /* =========================
     Modal: Nuevo/Editar Contacto
  ========================= */
  let editingContactId = null;
  let contactModalFromCommit = false;

  function openContactModal(prefill, fromCommit){
    contactModalFromCommit = !!fromCommit;
    editingContactId = prefill && prefill.id ? prefill.id : null;

    $("cModalTitle").textContent = editingContactId ? "Editar amigo" : "Nuevo amigo";
    $("cName").value = prefill && prefill.name ? prefill.name : "";
    $("cNote").value = prefill && prefill.note ? prefill.note : "";

    showBackdrop("cBackdrop", true);
    setTimeout(()=> $("cName")?.focus(), 50);
  }

  function closeContactModal(){
    showBackdrop("cBackdrop", false);
    editingContactId = null;
    contactModalFromCommit = false;
  }

  function saveContactFromModal(){
    const name = String($("cName").value || "").trim();
    const note = String($("cNote").value || "").trim();

    if(!name){
      toast("Escribe un nombre");
      $("cName").focus();
      return;
    }

    // evitar duplicado exacto por nombre
    const exact = findContactByExactName(name);
    if(exact && exact.id !== editingContactId){
      toast("Ese amigo ya existe");
      return;
    }

    const nowIso = new Date().toISOString();

    if(editingContactId){
      const idx = contacts.findIndex(x=>x.id===editingContactId);
      if(idx>=0){
        contacts[idx] = { ...contacts[idx], name, note, updatedAt: nowIso };
        save(CONTACTS_KEY, contacts);

        // actualizar compromisos vinculados
        data = data.map(it=>{
          if(it.whoId === editingContactId){
            return { ...it, whoName: name, updatedAt: nowIso };
          }
          return it;
        });
        saveData();

        closeContactModal();
        toast("Amigo actualizado ✅");
        renderAll();
        return;
      }
    }

    const c = { id: uid(), name, note, createdAt: nowIso };
    contacts.unshift(c);
    save(CONTACTS_KEY, contacts);

    closeContactModal();
    toast("Amigo guardado ✅");
    renderAll();

    // si venía de “guardar nuevo amigo” al crear compromiso: vinculamos el último compromiso si coincide exacto
    if(contactModalFromCommit){
      const last = data[0];
      if(last && String(last.whoName||"").trim().toLowerCase() === name.trim().toLowerCase()){
        last.whoId = c.id;
        saveData();
        renderAll();
      }
    }
  }

  /* =========================
     Acciones rápidas de compromiso
  ========================= */
  function setCommitStatus(id, status){
    const idx = data.findIndex(x=>x.id===id);
    if(idx<0) return;

    const nowIso = new Date().toISOString();
    const it = data[idx];

    if(status === "closed"){
      data[idx] = normalizeStatus({ ...it, status:"closed", closedAt: nowIso, doneAt: nowIso, updatedAt: nowIso });
    }else if(status === "waiting"){
      data[idx] = normalizeStatus({ ...it, status:"waiting", updatedAt: nowIso });
    }else{
      // pending
      data[idx] = normalizeStatus({ ...it, status:"pending", closedAt: null, doneAt: null, updatedAt: nowIso });
    }

    saveData();
    renderAll();
  }

  function deleteCommit(id){
    const it = data.find(x=>x.id===id);
    if(!it) return;

    showConfirm(
      "Eliminar compromiso",
      `Se eliminará este compromiso.\n\n<b>${esc(it.whoName||"")}</b>: ${esc(it.what||"")}`,
      "Sí, eliminar",
      "Cancelar",
      true,
      ()=>{
        data = data.filter(x=>x.id!==id);
        saveData();
        toast("Eliminado");
        renderAll();
      }
    );
  }

  /* =========================
     Render: tarjetas compromisos
  ========================= */
  function statusChip(it){
    if(it.status==="waiting") return `<span class="chip status">⏳ En espera</span>`;
    if(it.status==="closed") return `<span class="chip status">✅ Cerrado</span>`;
    return `<span class="chip status">📝 Pendiente</span>`;
  }

  function dueBadge(it){
    if(view==="closed"){
      const d = fmtDate(it.closedAt || it.doneAt);
      return d ? `<div class="due">Cerrado: ${esc(d)}</div>` : `<div class="due">Cerrado</div>`;
    }
    if(it.when){
      const d = fmtDate(it.when);
      const bad = isOverdue(it.when) ? " bad" : "";
      return `<div class="due${bad}">${esc(d || "Con fecha")}</div>`;
    }
    return `<div class="due">Sin fecha</div>`;
  }

  function renderCommitCard(it){
    const who = esc(it.whoName || (it.whoId ? contactNameById(it.whoId) : "") || "");
    const note = it.whoId ? (contacts.find(c=>c.id===it.whoId)?.note || "") : "";
    const chips = [];
    chips.push(statusChip(it));
    if(it.whoId) chips.push(`<span class="chip">👤 Vinculado</span>`);
    if(note) chips.push(`<span class="chip">📝 ${esc(note)}</span>`);
    if(it.when && isOverdue(it.when) && it.status==="pending") chips.push(`<span class="chip">⏰ Vencido</span>`);

    const actions = [];
    if(it.status==="pending"){
      actions.push(`<button class="btn good" data-act="close" data-id="${esc(it.id)}">✅ Cerrar</button>`);
      actions.push(`<button class="btn" data-act="wait" data-id="${esc(it.id)}">⏳ Pasar a En espera</button>`);
    }else if(it.status==="waiting"){
      actions.push(`<button class="btn good" data-act="close" data-id="${esc(it.id)}">✅ Cerrar</button>`);
      actions.push(`<button class="btn" data-act="reopen" data-id="${esc(it.id)}">📝 Reabrir a Pendiente</button>`);
    }else{
      actions.push(`<button class="btn" data-act="reopen" data-id="${esc(it.id)}">📝 Reabrir a Pendiente</button>`);
    }

    actions.push(`<button class="btn" data-act="edit" data-id="${esc(it.id)}">✏️ Editar</button>`);
    actions.push(`<button class="btn danger" data-act="del" data-id="${esc(it.id)}">🗑️ Eliminar</button>`);

    return `
      <div class="card" data-card="commit" data-id="${esc(it.id)}">
        <div class="cardTop">
          <div class="who">
            <p class="name">${who}</p>
            <p class="meta">${chips.join("")}</p>
          </div>
          ${dueBadge(it)}
        </div>
        <div class="desc">${esc(it.what || "")}</div>
        <div class="actions">${actions.join("")}</div>
      </div>
    `;
  }

  function bindCommitActions(){
    const list = $("list");
    if(!list) return;

    list.addEventListener("click", (e)=>{
      const btn = e.target.closest("button[data-act]");
      if(!btn) return;
      const act = btn.getAttribute("data-act");
      const id = btn.getAttribute("data-id");

      if(act==="close") setCommitStatus(id, "closed");
      else if(act==="wait") setCommitStatus(id, "waiting");
      else if(act==="reopen") setCommitStatus(id, "pending");
      else if(act==="edit"){
        const it = data.find(x=>x.id===id);
        if(it) openCommitModal(it);
      }
      else if(act==="del") deleteCommit(id);
    });
  }

  function renderCommitments(){
    ensureCommitSearchPanel();

    const list = $("list");
    const empty = $("empty");
    if(!list || !empty) return;

    updateCommitmentsHeading();

    const items = sortCommitments(currentList());
    list.innerHTML = items.map(renderCommitCard).join("");

    empty.style.display = items.length ? "none" : "";
  }

  /* =========================
     Render: contactos (amigos)
  ========================= */
  function renderContactCard(c){
    const name = esc(c.name);
    const note = esc(c.note || "");

    return `
      <div class="card" data-card="contact" data-id="${esc(c.id)}">
        <div class="cardTop">
          <div class="who">
            <p class="name">${name}</p>
            <p class="meta">
              ${note ? `<span class="chip">📝 ${note}</span>` : `<span class="chip">👤 Amigo</span>`}
            </p>
          </div>
          <div class="due">Amigo</div>
        </div>
        <div class="actions">
          <button class="btn primary" data-cact="newcommit" data-id="${esc(c.id)}">🗓️ Crear compromiso</button>
          <button class="btn" data-cact="edit" data-id="${esc(c.id)}">✏️ Editar</button>
          <button class="btn danger" data-cact="del" data-id="${esc(c.id)}">🗑️ Eliminar</button>
        </div>
      </div>
    `;
  }

  function deleteContact(id){
    const c = contacts.find(x=>x.id===id);
    if(!c) return;

    showConfirm(
      "Eliminar amigo",
      `Se eliminará el amigo <b>${esc(c.name)}</b>.\n\nLos compromisos vinculados quedarán “sin vincular” (pero conservarán el nombre).`,
      "Sí, eliminar",
      "Cancelar",
      true,
      ()=>{
        contacts = contacts.filter(x=>x.id!==id);
        save(CONTACTS_KEY, contacts);

        // desvincular compromisos
        const nowIso = new Date().toISOString();
        data = data.map(it=>{
          if(it.whoId === id){
            return { ...it, whoId:null, whoName: it.whoName || c.name, updatedAt: nowIso };
          }
          return it;
        });
        saveData();

        toast("Amigo eliminado");
        renderAll();
      }
    );
  }

  function renderContacts(){
    const list = $("contactsList");
    const empty = $("contactsEmpty");
    const badge = $("bContacts");
    if(!list || !empty) return;

    const q = (contactsTextFilter || "").trim().toLowerCase();
    const filtered = [...contacts]
      .filter(c=>{
        if(!q) return true;
        return (String(c.name||"").toLowerCase().includes(q)) ||
               (String(c.note||"").toLowerCase().includes(q));
      })
      .sort((a,b)=>a.name.localeCompare(b.name,"es",{sensitivity:"base"}));

    list.innerHTML = filtered.map(renderContactCard).join("");
    empty.style.display = filtered.length ? "none" : "";
    if(badge) badge.textContent = String(contacts.length);

    // bind
    list.onclick = (e)=>{
      const btn = e.target.closest("button[data-cact]");
      const card = e.target.closest("[data-card='contact']");
      if(!btn && !card) return;

      const id = (btn ? btn.getAttribute("data-id") : card.getAttribute("data-id")) || "";
      const c = contacts.find(x=>x.id===id);
      if(!c) return;

      if(btn){
        const act = btn.getAttribute("data-cact");
        if(act==="newcommit"){
          setPane("commitments");
          setView("pending");
          openCommitModal({ whoId:c.id, whoName:c.name, what:"", when:"", remind:0, after:0, status:"pending" });
        }else if(act==="edit"){
          openContactModal(c, false);
        }else if(act==="del"){
          deleteContact(id);
        }
        return;
      }

      // tocar tarjeta: crear compromiso
      setPane("commitments");
      setView("pending");
      openCommitModal({ whoId:c.id, whoName:c.name, what:"", when:"", remind:0, after:0, status:"pending" });
    };
  }

  /* =========================
     ✅ Buscador de Amigos (opcional rápido)
     - (mismo estilo que el resto, sin saturar)
  ========================= */
  function ensureContactsQuickSearch(){
    const paneEl = $("contactsPane");
    if(!paneEl) return;
    if($("contactsSearchTxt")) return;

    const head = paneEl.querySelector(".sectionHead");
    if(!head) return;

    const tools = document.createElement("div");
    tools.className = "miniTools";
    tools.innerHTML = `<button class="miniBtn" id="contactsSearchBtn" type="button">🔎 Buscar</button>`;
    head.insertAdjacentElement("afterend", tools);

    const panel = document.createElement("div");
    panel.id = "contactsSearchPanel";
    panel.className = "miniPanel";
    panel.innerHTML = `
      <div class="miniRow">
        <div class="field">
          <label class="label" for="contactsSearchTxt">Buscar amigo</label>
          <input id="contactsSearchTxt" type="text" placeholder="Nombre o nota…" autocomplete="off"/>
        </div>
        <div class="field" style="max-width:160px;">
          <label class="label">&nbsp;</label>
          <button class="btn" id="contactsSearchClear" type="button">🧹 Limpiar</button>
        </div>
      </div>
    `;
    tools.insertAdjacentElement("afterend", panel);

    $("contactsSearchBtn").addEventListener("click", ()=>{
      uiContactsSearchOpen = !uiContactsSearchOpen;
      panel.classList.toggle("show", uiContactsSearchOpen);
      if(uiContactsSearchOpen) setTimeout(()=> $("contactsSearchTxt")?.focus(), 50);
    });

    $("contactsSearchTxt").addEventListener("input", ()=>{
      contactsTextFilter = $("contactsSearchTxt").value || "";
      renderContacts();
    });

    $("contactsSearchClear").addEventListener("click", ()=>{
      contactsTextFilter = "";
      $("contactsSearchTxt").value = "";
      renderContacts();
    });

    // ✅ aquí NO hace falta sugerencias (ya lista abajo), pero si quieres luego lo igualamos
  }

  /* =========================
     Render: settings (simple)
  ========================= */
  function renderSettings(){
    // switches visuales (sin lógica compleja de PIN/Notifs aquí)
    const swPin = $("swPin");
    if(swPin) swPin.classList.toggle("on", !!settings.pinEnabled);

    const swNotif = $("swNotif");
    if(swNotif) swNotif.classList.toggle("on", !!settings.notifEnabled);

    if($("selAutoLock")) $("selAutoLock").value = String(settings.autoLockMin || 0);
    if($("selRemember")) $("selRemember").value = String(settings.rememberMin || 0);
  }

  /* =========================
     Contadores UI (tiles + pills)
  ========================= */
  function updateCounts(){
    const pending = data.filter(x=>x.status==="pending").length;
    const waiting = data.filter(x=>x.status==="waiting").length;
    const closed = data.filter(x=>x.status==="closed").length;

    if($("tilePendingCount")) $("tilePendingCount").textContent = String(pending);
    if($("tileWaitingCount")) $("tileWaitingCount").textContent = String(waiting);
    if($("tileDoneCount")) $("tileDoneCount").textContent = String(closed);
    if($("tileContactsCount")) $("tileContactsCount").textContent = String(contacts.length);

    const overdue = data.filter(x=>x.status==="pending" && isOverdue(x.when)).length;
    if($("bOverdue")) $("bOverdue").textContent = String(overdue);

    if($("bReceived")) $("bReceived").textContent = String(Math.max(0, Number(received?.c || 0)));

    if($("bWaiting")) $("bWaiting").textContent = String(waiting);
  }

  /* =========================
     Render general
  ========================= */
  function renderAll(){
    ensureWaitingPill();
    fixPillsOrder();
    removeBottomInstallText();

    ensureFriendsDatalist();
    ensureCommitSearchPanel();
    ensureContactsQuickSearch();

    updateCounts();

    if(pane==="commitments") renderCommitments();
    else if(pane==="contacts") renderContacts();
    else renderSettings();

    // subtitle "kicker" corto
    const kicker = $("statsKicker");
    if(kicker){
      const p = data.filter(x=>x.status==="pending").length;
      const w = data.filter(x=>x.status==="waiting").length;
      const o = data.filter(x=>x.status==="pending" && isOverdue(x.when)).length;
      kicker.textContent = o ? `⏰ ${o} vencido(s) · 📝 ${p} pendiente(s) · ⏳ ${w} en espera` : `📝 ${p} pendiente(s) · ⏳ ${w} en espera`;
    }
  }

  /* =========================
     Bind modales botones
  ========================= */
  function bindModals(){
    // compromiso
    if($("btnClose")) $("btnClose").onclick = closeCommitModal;
    if($("btnCancel")) $("btnCancel").onclick = closeCommitModal;
    if($("btnSave")) $("btnSave").onclick = upsertCommitFromModal;

    const bd = $("backdrop");
    if(bd){
      bd.addEventListener("click", (e)=>{
        if(e.target === bd) closeCommitModal();
      });
    }

    // contacto
    if($("cBtnClose")) $("cBtnClose").onclick = closeContactModal;
    if($("cBtnCancel")) $("cBtnCancel").onclick = closeContactModal;
    if($("cBtnSave")) $("cBtnSave").onclick = saveContactFromModal;

    const cbd = $("cBackdrop");
    if(cbd){
      cbd.addEventListener("click", (e)=>{
        if(e.target === cbd) closeContactModal();
      });
    }
  }

  /* =========================
     Bind FAB (Nuevo)
  ========================= */
  function bindFab(){
    const fab = $("fab");
    if(!fab) return;

    fab.onclick = ()=>{
      if(pane==="contacts"){
        openContactModal({ name:"", note:"" }, false);
      }else if(pane==="commitments"){
        openCommitModal(null);
      }
    };
  }

  /* =========================
     Bind Settings UI (mínimo)
  ========================= */
  function bindSettings(){
    const swPin = $("swPin");
    if(swPin){
      swPin.addEventListener("click", ()=>{
        settings.pinEnabled = !settings.pinEnabled;
        save(SETTINGS_KEY, settings);
        renderSettings();
        toast(settings.pinEnabled ? "PIN: ON" : "PIN: OFF");
      });
    }

    const swNotif = $("swNotif");
    if(swNotif){
      swNotif.addEventListener("click", ()=>{
        settings.notifEnabled = !settings.notifEnabled;
        save(SETTINGS_KEY, settings);
        renderSettings();
        toast(settings.notifEnabled ? "Notificaciones: ON" : "Notificaciones: OFF");
      });
    }

    if($("selAutoLock")){
      $("selAutoLock").addEventListener("change", ()=>{
        settings.autoLockMin = Number($("selAutoLock").value || 0);
        save(SETTINGS_KEY, settings);
        toast("Auto-bloqueo guardado");
      });
    }

    if($("selRemember")){
      $("selRemember").addEventListener("change", ()=>{
        settings.rememberMin = Number($("selRemember").value || 0);
        save(SETTINGS_KEY, settings);
        toast("Recordar desbloqueo guardado");
      });
    }

    if($("btnResetAll")){
      $("btnResetAll").addEventListener("click", ()=>{
        showConfirm(
          "Borrar todo",
          "Esto borrará compromisos, amigos y ajustes del móvil.",
          "Sí, borrar todo",
          "Cancelar",
          true,
          ()=>{
            localStorage.removeItem(KEY);
            localStorage.removeItem(CONTACTS_KEY);
            localStorage.removeItem(SETTINGS_KEY);
            localStorage.removeItem(RECEIVED_KEY);
            localStorage.removeItem(A11Y_KEY);
            data = [];
            contacts = [];
            settings = { pinEnabled:false, autoLockMin:0, rememberMin:0, notifEnabled:false };
            received = { c:0, lastAt:null };
            toast("Todo borrado");
            renderAll();
          }
        );
      });
    }
  }

  /* =========================
     Init (continúa en PARTE 3/3)
  ========================= */

