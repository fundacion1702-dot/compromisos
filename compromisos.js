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
     ✅ FIX layout: botón Texto grande arriba derecha SIEMPRE
     + controles “lupa desplegable” para filtros/búsquedas
  ========================= */
  (function injectUiCss(){
    try{
      const st = document.createElement("style");
      st.textContent = `
        /* Botón arriba derecha, sin romper el título */
        .topbarInner{
          grid-template-columns: 1fr auto !important;
          align-items: start !important;
        }
        .topActions{
          display:flex !important;
          flex-direction:column !important;
          align-items:flex-end !important;
          justify-content:flex-start !important;
          gap:10px !important;
        }
        .pills{
          justify-content:flex-end !important;
          flex-wrap:wrap !important;
        }
        #btnA11yTop{
          margin:0 !important;
        }

        /* Filtros/buscadores tipo “lupa desplegable” */
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

        @media (max-width:520px){
          .topbarInner{
            grid-template-columns: 1fr auto !important;
          }
          .brand{ min-width:0 !important; }
          .title, .subtitle{ max-width: calc(100vw - 140px) !important; }
          .pills{ width:auto !important; }
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
  let view = "pending";     // pending | done

  // ✅ filtros/búsquedas (desplegable)
  let uiCommitFiltersOpen = false;
  let uiContactsSearchOpen = false;

  let commitFriendFilter = "all"; // all | __none__ | <contactId>
  let commitTextFilter = "";      // búsqueda en texto / quién
  let contactsTextFilter = "";    // búsqueda amigos

  /* =========================
     Accesibilidad: Texto grande (robusto)
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

  function bindA11yButtons(){
    const top = $("btnA11yTop");
    const inSettings = $("btnA11y");

    const bind = (el)=>{
      if(!el) return;
      el.style.pointerEvents = "auto";
      el.addEventListener("click", (e)=>{ e.preventDefault(); e.stopPropagation(); toggleTextScale(); }, { passive:false });
      // en algunos móviles el click se “pierde” si hay scroll: añadimos touchend
      el.addEventListener("touchend", (e)=>{ e.preventDefault(); e.stopPropagation(); toggleTextScale(); }, { passive:false });
    };

    bind(top);
    bind(inSettings);
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

  function setViewPending(){
    view = "pending";
    const a = $("tabPending"), b = $("tabDone");
    if(a) a.classList.add("active");
    if(b) b.classList.remove("active");
    renderCommitments();
  }
  function setViewDone(){
    view = "done";
    const a = $("tabDone"), b = $("tabPending");
    if(a) a.classList.add("active");
    if(b) b.classList.remove("active");
    renderCommitments();
  }

  function bindNav(){
    if($("tabCommitments")) $("tabCommitments").onclick = ()=> setPane("commitments");
    if($("tabContacts")) $("tabContacts").onclick = ()=> setPane("contacts");

    if($("tabPending")) $("tabPending").onclick = setViewPending;
    if($("tabDone")) $("tabDone").onclick = setViewDone;

    // Tiles (menú)
    const bindTile = (id, fn)=>{
      const el = $(id);
      if(!el) return;
      el.addEventListener("click", fn);
      el.addEventListener("keydown", (e)=>{
        if(e.key==="Enter" || e.key===" "){ e.preventDefault(); fn(); }
      });
    };
    bindTile("tilePending", ()=>{ setPane("commitments"); setViewPending(); });
    bindTile("tileDone", ()=>{ setPane("commitments"); setViewDone(); });
    bindTile("tileContacts", ()=>{ setPane("contacts"); });
    bindTile("tileSettings", ()=>{ setPane("settings"); });

    // Pills
    if($("btnOverdue")){
      $("btnOverdue").addEventListener("click", ()=>{
        setPane("commitments");
        setViewPending();
        const overdue = data.filter(x=> !x.done && isOverdue(x.when)).length;
        toast(overdue ? `⏰ ${overdue} vencido(s)` : "Sin vencidos ✅");
      });
    }
    if($("btnReceived")){
      $("btnReceived").addEventListener("click", ()=>{
        setPane("commitments");
        setViewPending();
        const c = Math.max(0, Number(received?.c || 0));
        toast(c ? `📥 Recibidos: ${c}` : "Sin recibidos");
      });
    }
  }

  /* =========================
     ✅ UI desplegable: filtros/búsquedas
  ========================= */
  function ensureCommitFiltersUi(){
    const paneEl = $("commitmentsPane");
    if(!paneEl) return;

    // Si ya existe, no duplicar
    if($("miniCommitTools")) return;

    // Inserta justo debajo del sectionHead (dentro del pane)
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
      <div class="miniHint">Se aplica sobre la lista actual (<b>Pendientes</b> o <b>Hechos</b>).</div>
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
    // aplica estado (cerrado por defecto)
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
     Render
  ========================= */
  function normalizedWho(item){
    if(item.whoId){
      const c = contacts.find(x=>x.id===item.whoId);
      if(c && c.name) return c.name;
    }
    return item.whoName || "Sin nombre";
  }

  function updateCounts(){
    const pending = data.filter(x=>!x.done);
    const done = data.filter(x=>x.done);

    if($("tilePendingCount")) $("tilePendingCount").textContent = String(pending.length);
    if($("tileDoneCount")) $("tileDoneCount").textContent = String(done.length);
    if($("tileContactsCount")) $("tileContactsCount").textContent = String(contacts.length);
    if($("bContacts")) $("bContacts").textContent = String(contacts.length);

    const overdue = pending.filter(x=>isOverdue(x.when)).length;
    if($("bOverdue")) $("bOverdue").textContent = String(overdue);

    const rec = Math.max(0, Number(received?.c || 0));
    if($("bReceived")) $("bReceived").textContent = String(rec);
  }

  function passesCommitFilters(it){
    // friend filter
    if(commitFriendFilter && commitFriendFilter !== "all"){
      if(commitFriendFilter === "__none__"){
        if(it.whoId) return false;
      }else{
        if(it.whoId !== commitFriendFilter) return false;
      }
    }

    // text filter
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
      .filter(x=> view==="pending" ? !x.done : x.done)
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
        return new Date(b.doneAt||0).getTime() - new Date(a.doneAt||0).getTime();
      });

    if(empty) empty.style.display = items.length ? "none" : "block";

    items.forEach((it)=>{
      const card = document.createElement("div");
      card.className = "card";

      const who = normalizedWho(it);
      const dueText = it.when ? fmtDate(it.when) : "Sin fecha";
      const overdue = (!it.done && isOverdue(it.when));

      card.innerHTML = `
        <div class="cardTop" style="align-items:flex-start;">
          <div class="who" style="min-width:0;">
            <p class="name" title="${esc(who)}">${esc(who)}</p>
            <p class="meta">
              <span class="chip">📝 ${esc(fmtDate(it.createdAt))}</span>
              ${it.updatedAt ? `<span class="chip">✍️ ${esc(fmtDate(it.updatedAt))}</span>` : ``}
              ${it.done ? `<span class="chip">✅ ${esc(fmtDate(it.doneAt))}</span>` : ``}
            </p>
          </div>
          <div class="due ${overdue ? "bad" : ""}">
            ⏰ ${esc(dueText)}${overdue ? " · Vencido" : ""}
          </div>
        </div>

        <div class="desc">${esc(it.what || "—")}</div>

        <div class="actions">
          <button class="btn good" type="button" data-act="done">${it.done ? "↩️ Reabrir" : "✅ Hecho"}</button>
          <button class="btn" type="button" data-act="edit">✍️ Editar</button>
          <button class="btn danger" type="button" data-act="del">🗑️ Eliminar</button>
        </div>
      `;

      card.querySelector('[data-act="done"]').addEventListener("click", ()=>{
        if(it.done){ it.done=false; it.doneAt=null; }
        else { it.done=true; it.doneAt=new Date().toISOString(); }
        it.updatedAt = new Date().toISOString();
        save(KEY, data);
        renderCommitments();
      });

      card.querySelector('[data-act="edit"]').addEventListener("click", ()=> openCommitModal(it.id));
      card.querySelector('[data-act="del"]').addEventListener("click", ()=> deleteCommit(it.id));

      list.appendChild(card);
    });
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

      // ✅ quitado “Amigo guardado en tu móvil.” si no hay nota
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
  }

  function renderAll(){
    renderCommitments();
    renderContacts();
    updateCounts();
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
     Confirm modal
  ========================= */
  function openConfirm(title, msg, yesLabel, onYes){
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

    b.classList.add("show");
    b.setAttribute("aria-hidden","false");

    const close = ()=>{
      b.classList.remove("show");
      b.setAttribute("aria-hidden","true");
      if(yes) yes.onclick = null;
      if(no) no.onclick = null;
      if(x) x.onclick = null;
    };

    if(no) no.onclick = close;
    if(x) x.onclick = close;
    if(yes) yes.onclick = ()=>{ close(); try{ onYes && onYes(); }catch(e){} };
  }

  /* =========================
     Modales: Compromisos
  ========================= */
  let editingCommitId = null;

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

  function getContactById(id){
    return contacts.find(x=>x.id===id) || null;
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
      ? "Escribe un nombre sin guardarlo (solo para este compromiso)."
      : "Elige un amigo guardado.";

    if(isCustom && whoInput){
      whoInput.value = customName || "";
      setTimeout(()=>{ try{ whoInput.focus(); }catch(e){} }, 0);
    }
  }

  function resolveWho(){
    const sel = $("fContact");
    const whoInput = $("fWho");
    if(!sel) return { whoId:null, whoName:"" };

    if(sel.value && sel.value !== "__custom__"){
      const c = getContactById(sel.value);
      return { whoId: c ? c.id : sel.value, whoName: "" };
    }
    return { whoId:null, whoName: (whoInput?.value || "").trim() };
  }

  function openCommitModal(id, presetContactId){
    editingCommitId = id || null;

    const it = id ? data.find(x=>x.id===id) : null;

    const whoId = it?.whoId || presetContactId || null;
    const whoName = it?.whoName || "";

    rebuildContactSelect(whoId, whoName);

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
    const who = resolveWho();

    const now = new Date().toISOString();

    if(editingCommitId){
      const idx = data.findIndex(x=>x.id===editingCommitId);
      if(idx >= 0){
        data[idx] = {
          ...data[idx],
          whoId: who.whoId,
          whoName: who.whoName,
          what,
          when: whenIso,
          remindMin,
          afterMin,
          updatedAt: now
        };
      }
      save(KEY, data);
      toast("✍️ Compromiso editado");
      closeCommitModal();
      openShareModal(data[idx]);
    }else{
      const item = {
        id: uid(),
        whoId: who.whoId,
        whoName: who.whoName,
        what,
        when: whenIso,
        remindMin,
        afterMin,
        done:false,
        doneAt:null,
        createdAt: now,
        updatedAt: null
      };
      data = [item, ...data];
      save(KEY, data);
      toast("✅ Compromiso creado");
      closeCommitModal();
      openShareModal(item);
    }

    renderAll();
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

    const sel = $("fContact");
    if(sel){
      sel.addEventListener("change", ()=>{
        rebuildContactSelect(sel.value === "__custom__" ? null : sel.value, ($("fWho")?.value || ""));
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
    const name = ($("cName")?.value || "").trim();
    const note = ($("cNote")?.value || "").trim();

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
    fillCommitFriendSelect(); // refresca filtro
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

        // si había compromisos con whoId, los pasamos a whoName
        data = data.map(it=>{
          if(it.whoId === id){
            return { ...it, whoId:null, whoName: it.whoName || name || "Sin nombre", updatedAt: new Date().toISOString() };
          }
          return it;
        });
        save(KEY, data);

        fillCommitFriendSelect();
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

    const item = {
      id: uid(),
      whoId: incoming.whoId || null,
      whoName: incoming.whoId ? "" : (incoming.whoName || "Sin nombre"),
      what: incoming.what || "",
      when: incoming.when || null,
      remindMin: Number(incoming.remindMin||0) || 0,
      afterMin: Number(incoming.afterMin||0) || 0,
      done:false,
      doneAt:null,
      createdAt: now,
      updatedAt: null
    };

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
    setViewPending();
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
            setViewPending();
            renderAll();
          }
        );
      });
    }

    updateNotifHint();
  }

  /* =========================
     Install banner + service worker
  ========================= */
  let deferredPrompt = null;
  function bindInstall(){
    const banner = $("installBanner");
    const btnHide = $("btnHideBanner");
    const btnInstallBanner = $("btnInstallBanner");
    const btnOpenChrome = $("btnOpenChrome");
    const btnCopyLink = $("btnCopyLink");

    if(btnHide) btnHide.onclick = ()=> banner && banner.classList.remove("show");
    if(btnCopyLink) btnCopyLink.onclick = ()=> copyText(appBaseUrl());

    window.addEventListener("beforeinstallprompt", (e)=>{
      e.preventDefault();
      deferredPrompt = e;
      if(banner){
        banner.classList.add("show");
        if(btnInstallBanner) btnInstallBanner.style.display = "";
        if(btnOpenChrome) btnOpenChrome.style.display = "none";
        if(btnCopyLink) btnCopyLink.style.display = "";
      }
    });

    if(btnInstallBanner){
      btnInstallBanner.onclick = async ()=>{
        if(!deferredPrompt) return;
        deferredPrompt.prompt();
        try{ await deferredPrompt.userChoice; }catch(e){}
        deferredPrompt = null;
        if(banner) banner.classList.remove("show");
      };
    }

    setTimeout(()=>{
      if(!deferredPrompt && banner){
        banner.classList.add("show");
        if(btnInstallBanner) btnInstallBanner.style.display = "none";
        if(btnOpenChrome) btnOpenChrome.style.display = "";
        if(btnCopyLink) btnCopyLink.style.display = "";
      }
    }, 1200);

    if(btnOpenChrome){
      btnOpenChrome.onclick = ()=>{
        toast("Abre este enlace en Chrome para instalar.");
        copyText(appBaseUrl());
      };
    }

    if("serviceWorker" in navigator){
      navigator.serviceWorker.register("sw.js").catch(()=>{});
    }
  }

  /* =========================
     Boot
  ========================= */
  // normaliza ids en contactos antiguos
  (function normalizeContacts(){
    let changed = false;
    contacts = (contacts||[]).map(c=>{
      if(!c.id){ changed = true; return { ...c, id: uid() }; }
      return c;
    });
    if(changed) save(CONTACTS_KEY, contacts);
  })();

  // aplica accesibilidad guardada
  const a11y = load(A11Y_KEY, { big:false });
  applyTextScale(!!a11y.big);

  bindA11yButtons();
  bindNav();
  bindFab();
  bindCommitModal();
  bindContactModal();
  bindShare();
  bindSettings();
  bindInstall();

  // importar si viene paquete en hash
  importFromHash();

  // refresca selects de filtro
  fillCommitFriendSelect();

  renderAll();

})();