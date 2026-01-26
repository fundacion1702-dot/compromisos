/* compromisos.js (1/2) */
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

  function qsParam(name){
    try{
      const h = location.hash || "";
      const q = h.includes("?") ? h.split("?")[1] : "";
      if(!q) return null;
      const params = new URLSearchParams(q);
      return params.get(name);
    }catch(e){ return null; }
  }

  /* =========================
     Estado / datos
  ========================= */
  let data = load(KEY, []);
  let contacts = load(CONTACTS_KEY, []);
  let settings = load(SETTINGS_KEY, {
    pinEnabled:false,
    pinHash:null,         // hash simple (no es seguridad real, solo bloqueo casual)
    autoLockMin:0,         // 0 inmediato
    rememberMin:0,         // 0 no recordar
    notifEnabled:false
  });
  let received = load(RECEIVED_KEY, { c:0, lastAt:null });

  let pane = "commitments"; // commitments | contacts | settings
  let view = "pending";     // pending | done

  // filtros/buscadores
  let contactsSearch = "";
  let filterFriendId = "";  // para filtrar compromisos por amigo (id) o "" sin filtro

  /* =========================
     Accesibilidad: Texto grande (robusto)
  ========================= */
  function applyA11yUI(big){
    // variables base
    document.documentElement.style.setProperty("--fs", big ? "18px" : "16px");
    document.documentElement.style.setProperty("--fsBig", big ? "20px" : "18px");

    // clase por si quieres ajustar en CSS
    document.documentElement.classList.toggle("bigText", !!big);

    // texto de botones
    const label = big ? "🔎 Texto normal" : "🔎 Texto grande";
    const bTop = $("btnA11yTop");
    const bSet = $("btnA11y");
    if(bTop) bTop.textContent = label;
    if(bSet) bSet.textContent = label;
  }

  function setTextScale(big){
    save(A11Y_KEY, { big: !!big });
    applyA11yUI(!!big);
  }

  function toggleTextScale(){
    const cur = load(A11Y_KEY, { big:false });
    const next = !cur.big;
    setTextScale(next);
    toast(next ? "🔎 Texto grande: activado" : "🔎 Texto normal");
  }

  function bindA11yButtons(){
    const top = $("btnA11yTop");
    const inSettings = $("btnA11y");

    const bind = (el)=>{
      if(!el) return;
      el.addEventListener("click", (e)=>{ e.preventDefault(); toggleTextScale(); }, { passive:false });
      // en algunos móviles el click se “pierde”; touchend ayuda
      el.addEventListener("touchend", (e)=>{ e.preventDefault(); toggleTextScale(); }, { passive:false });
      el.style.pointerEvents = "auto";
    };
    bind(top);
    bind(inSettings);
  }

  /* =========================
     UI extra: buscador amigos + filtro por amigo (se inyecta si no existe)
  ========================= */
  function ensureContactsSearchUI(){
    const paneEl = $("contactsPane");
    if(!paneEl) return;

    if($("contactsSearch")) return; // ya existe

    const head = paneEl.querySelector(".sectionHead");
    if(!head) return;

    const wrap = document.createElement("div");
    wrap.className = "field";
    wrap.style.marginTop = "10px";
    wrap.innerHTML = `
      <label class="label" for="contactsSearch">Buscar amigo</label>
      <input id="contactsSearch" type="text" placeholder="Escribe un nombre…" autocomplete="off"/>
      <div class="hint">Filtra la lista de amigos mientras escribes.</div>
    `;
    // lo metemos justo después del header
    head.insertAdjacentElement("afterend", wrap);

    const inp = $("contactsSearch");
    inp.addEventListener("input", ()=>{
      contactsSearch = (inp.value || "").trim().toLowerCase();
      renderContacts();
    });
  }

  function ensureCommitmentsFilterUI(){
    const paneEl = $("commitmentsPane");
    if(!paneEl) return;

    if($("friendFilter")) return;

    const head = paneEl.querySelector(".sectionHead");
    if(!head) return;

    const rightBox = head.querySelector(".segTabs");
    if(!rightBox) return;

    // contenedor para meter filtro sin romper tabs
    // dejamos tabs como están y añadimos un select debajo en pantallas pequeñas
    const filterWrap = document.createElement("div");
    filterWrap.className = "field";
    filterWrap.style.marginTop = "10px";
    filterWrap.innerHTML = `
      <label class="label" for="friendFilter">Filtrar por amigo</label>
      <select id="friendFilter">
        <option value="">Todos</option>
      </select>
      <div class="hint">Muestra solo los compromisos de ese amigo (Pendientes o Hechos).</div>
    `;

    head.insertAdjacentElement("afterend", filterWrap);

    const sel = $("friendFilter");
    sel.addEventListener("change", ()=>{
      filterFriendId = sel.value || "";
      renderCommitments();
    });
  }

  function fillFriendFilterOptions(){
    const sel = $("friendFilter");
    if(!sel) return;

    const cur = sel.value || "";
    // reconstruir
    sel.innerHTML = `<option value="">Todos</option>`;

    contacts
      .slice()
      .sort((a,b)=> (a.name||"").localeCompare(b.name||"", "es"))
      .forEach(c=>{
        const opt = document.createElement("option");
        opt.value = c.id;
        opt.textContent = c.name || "Sin nombre";
        sel.appendChild(opt);
      });

    // restaurar
    sel.value = filterFriendId || cur || "";
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

  function renderCommitments(){
    updateCounts();
    fillFriendFilterOptions();

    const list = $("list");
    const empty = $("empty");
    if(!list) return;

    list.innerHTML = "";

    const items = data
      .filter(x=> view==="pending" ? !x.done : x.done)
      .filter(x=>{
        if(!filterFriendId) return true;
        return x.whoId === filterFriendId;
      })
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
    updateCounts();

    const list = $("contactsList");
    const empty = $("contactsEmpty");
    if(!list) return;

    list.innerHTML = "";

    const q = (contactsSearch || "").trim().toLowerCase();
    const filtered = contacts
      .slice()
      .sort((a,b)=> (a.name||"").localeCompare(b.name||"", "es"))
      .filter(c=>{
        if(!q) return true;
        return (c.name||"").toLowerCase().includes(q) || (c.note||"").toLowerCase().includes(q);
      });

    if(empty) empty.style.display = filtered.length ? "none" : "block";

    filtered.forEach((c)=>{
      const card = document.createElement("div");
      card.className = "card";

      // ✅ Quitamos “Amigo guardado en tu móvil.” como “píldora/desc fija”.
      // Si no hay nota, no mostramos desc (queda limpio).
      const desc = (c.note && c.note.trim()) ? esc(c.note.trim()) : "";

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

        ${desc ? `<div class="desc">${desc}</div>` : ``}

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
    ensureContactsSearchUI();
    ensureCommitmentsFilterUI();
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
     Exports / stubs (implementación real en parte 2)
  ========================= */
  function openCommitModal(){ /* parte 2 */ }
  function openContactModal(){ /* parte 2 */ }
  function deleteCommit(){ /* parte 2 */ }
  function deleteContact(){ /* parte 2 */ }

  // export para parte 2
  window.__COMP = {
    $, KEY, CONTACTS_KEY, SETTINGS_KEY, RECEIVED_KEY, A11Y_KEY,
    load, save, uid, esc, toast, fmtDate, isOverdue, qsParam,
    get data(){ return data; }, set data(v){ data=v; },
    get contacts(){ return contacts; }, set contacts(v){ contacts=v; },
    get settings(){ return settings; }, set settings(v){ settings=v; },
    get received(){ return received; }, set received(v){ received=v; },
    get pane(){ return pane; }, set pane(v){ pane=v; },
    get view(){ return view; }, set view(v){ view=v; },
    get filterFriendId(){ return filterFriendId; }, set filterFriendId(v){ filterFriendId=v; },
    renderAll, renderCommitments, renderContacts, updateCounts,
    setPane, setViewPending, setViewDone,
    setTextScale, toggleTextScale, applyA11yUI,
    setOpenCommitModal(fn){ openCommitModal = fn; },
    setOpenContactModal(fn){ openContactModal = fn; },
    setDeleteCommit(fn){ deleteCommit = fn; },
    setDeleteContact(fn){ deleteContact = fn; }
  };

  /* =========================
     Boot
  ========================= */
  // ✅ IMPORTANTE: eliminamos el CSS “inyectado” que te estaba ocultando el título.
  // El botón arriba a la derecha lo mantiene el CSS normal, sin absolutos raros.

  const a11y = load(A11Y_KEY, { big:false });
  applyA11yUI(!!a11y.big);

  bindA11yButtons();
  bindNav();
  bindFab();
  renderAll();

})();

/* compromisos.js (2/2) */
(function(){
  "use strict";

  const C = window.__COMP;
  if(!C){ console.error("Compromisos: falta __COMP (parte 1)."); return; }

  const {
    $, load, save, uid, esc, toast, fmtDate, isOverdue, qsParam,
    KEY, CONTACTS_KEY, SETTINGS_KEY, RECEIVED_KEY, A11Y_KEY,
  } = C;

  /* =========================
     DOM refs (modales)
  ========================= */
  const backdrop = $("backdrop");
  const btnClose = $("btnClose");
  const btnCancel = $("btnCancel");
  const btnSave = $("btnSave");

  const fContact = $("fContact");
  const contactHint = $("contactHint");
  const customWhoField = $("customWhoField");
  const fWho = $("fWho");
  const fWhat = $("fWhat");
  const fWhen = $("fWhen");
  const fRemind = $("fRemind");
  const fAfter = $("fAfter");

  const cBackdrop = $("cBackdrop");
  const cBtnClose = $("cBtnClose");
  const cBtnCancel = $("cBtnCancel");
  const cBtnSave = $("cBtnSave");
  const cName = $("cName");
  const cNote = $("cNote");

  const confirmBackdrop = $("confirmBackdrop");
  const confirmTitle = $("confirmTitle");
  const confirmMsg = $("confirmMsg");
  const confirmClose = $("confirmClose");
  const confirmNo = $("confirmNo");
  const confirmYes = $("confirmYes");

  const shareBackdrop = $("shareBackdrop");
  const shareClose = $("shareClose");
  const shareTitle = $("shareTitle");
  const shareTextBox = $("shareTextBox");
  const shareUrlBox = $("shareUrlBox");
  const shareShort = $("shareShort");
  const shareLong = $("shareLong");
  const shareCopyUrl = $("shareCopyUrl");
  const shareCopyAll = $("shareCopyAll");
  const shareSend = $("shareSend");
  const shareCancel = $("shareCancel");

  // Settings (PIN / NOTIF)
  const swPin = $("swPin");
  const btnChangePin = $("btnChangePin");
  const btnLockNow = $("btnLockNow");
  const selAutoLock = $("selAutoLock");
  const selRemember = $("selRemember");

  const swNotif = $("swNotif");
  const notifHint = $("notifHint");
  const btnNotifPerm = $("btnNotifPerm");
  const btnResetAll = $("btnResetAll");

  // Lock overlay
  const lockOverlay = $("lockOverlay");
  const lockClose = $("lockClose");
  const keypad = $("keypad");
  const btnLockCopyLink = $("btnLockCopyLink");
  const btnLockReset = $("btnLockReset");

  /* =========================
     Util: confirm modal
  ========================= */
  function openConfirm(title, msg, yesLabel, onYes){
    if(!confirmBackdrop) return;
    confirmTitle.textContent = title || "Confirmar";
    confirmMsg.innerHTML = esc(msg || "");
    confirmYes.textContent = yesLabel || "Sí, continuar";
    confirmBackdrop.classList.add("show");
    confirmBackdrop.setAttribute("aria-hidden","false");

    const cleanup = ()=>{
      confirmBackdrop.classList.remove("show");
      confirmBackdrop.setAttribute("aria-hidden","true");
      confirmYes.onclick = null;
      confirmNo.onclick = null;
      if(confirmClose) confirmClose.onclick = null;
    };

    confirmNo.onclick = ()=> cleanup();
    if(confirmClose) confirmClose.onclick = ()=> cleanup();
    confirmYes.onclick = ()=>{
      cleanup();
      try{ onYes && onYes(); }catch(e){ console.error(e); }
    };
  }

  /* =========================
     Helpers: contactos
  ========================= */
  function getContactById(id){
    return (C.contacts || []).find(x=>x.id===id) || null;
  }

  function ensureContactId(){
    // normaliza contactos antiguos sin id
    let changed = false;
    const list = (C.contacts || []).map(c=>{
      if(!c.id){ changed = true; return { ...c, id: uid() }; }
      return c;
    });
    if(changed){
      C.contacts = list;
      save(CONTACTS_KEY, list);
    }
  }

  function rebuildContactSelect(selectedId, customName){
    if(!fContact) return;

    const list = C.contacts || [];
    fContact.innerHTML = "";

    // opción “sin amigo”
    const opt0 = document.createElement("option");
    opt0.value = "__custom__";
    opt0.textContent = "— Sin amigo (escribir nombre) —";
    fContact.appendChild(opt0);

    list
      .slice()
      .sort((a,b)=> (a.name||"").localeCompare(b.name||"", "es"))
      .forEach(c=>{
        const opt = document.createElement("option");
        opt.value = c.id;
        opt.textContent = c.name || "Sin nombre";
        fContact.appendChild(opt);
      });

    if(selectedId){
      fContact.value = selectedId;
    }else{
      fContact.value = "__custom__";
    }

    // muestra/oculta campo nombre
    const isCustom = (fContact.value === "__custom__");
    if(customWhoField) customWhoField.style.display = isCustom ? "" : "none";
    if(contactHint) contactHint.textContent = isCustom
      ? "Escribe un nombre sin guardarlo (solo para este compromiso)."
      : "Elige un amigo guardado.";

    if(isCustom && fWho){
      fWho.value = customName || "";
      setTimeout(()=>{ try{ fWho.focus(); }catch(e){} }, 0);
    }
  }

  function bindContactSelect(){
    if(!fContact) return;
    fContact.addEventListener("change", ()=>{
      rebuildContactSelect(fContact.value === "__custom__" ? null : fContact.value, fWho ? fWho.value : "");
    });
  }

  /* =========================
     Commitments: CRUD
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

  function openCommitModal(id, presetContactId){
    editingCommitId = id || null;

    const it = id ? (C.data || []).find(x=>x.id===id) : null;

    // reconstruye select
    const whoId = it?.whoId || presetContactId || null;
    const whoName = it?.whoName || "";

    rebuildContactSelect(whoId, whoName);

    if(fWhat) fWhat.value = it?.what || "";
    if(fWhen) fWhen.value = it?.when ? toLocalInputValue(it.when) : "";
    if(fRemind) fRemind.value = String(it?.remindMin || 0);
    if(fAfter) fAfter.value = String(it?.afterMin || 0);

    const t = $("modalTitle");
    if(t) t.textContent = id ? "Editar compromiso" : "Nuevo compromiso";

    openModal(backdrop);
  }

  function closeCommitModal(){
    closeModal(backdrop);
    editingCommitId = null;
  }

  function toLocalInputValue(iso){
    try{
      if(!iso) return "";
      const d = new Date(iso);
      if(isNaN(d.getTime())) return "";
      const pad = (n)=> String(n).padStart(2,"0");
      const y = d.getFullYear();
      const m = pad(d.getMonth()+1);
      const da = pad(d.getDate());
      const hh = pad(d.getHours());
      const mm = pad(d.getMinutes());
      return `${y}-${m}-${da}T${hh}:${mm}`;
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

  function resolveWho(){
    // devuelve { whoId, whoName }
    if(!fContact) return { whoId:null, whoName:"" };

    if(fContact.value && fContact.value !== "__custom__"){
      const c = getContactById(fContact.value);
      return { whoId: c ? c.id : fContact.value, whoName: "" };
    }
    // custom
    const name = (fWho?.value || "").trim();
    return { whoId: null, whoName: name };
  }

  function saveCommitFromForm(){
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

    let list = C.data || [];
    if(editingCommitId){
      const idx = list.findIndex(x=>x.id===editingCommitId);
      if(idx >= 0){
        list[idx] = {
          ...list[idx],
          whoId: who.whoId,
          whoName: who.whoName,
          what,
          when: whenIso,
          remindMin,
          afterMin,
          updatedAt: now
        };
      }
      toast("✍️ Compromiso editado");
    }else{
      list = [{
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
      }, ...list];
      toast("✅ Compromiso creado");
    }

    C.data = list;
    save(KEY, list);

    closeCommitModal();

    // abrir compartir (siempre)
    const item = editingCommitId
      ? (C.data || []).find(x=>x.id===editingCommitId)
      : (C.data || [])[0];

    if(item) openShareModal(item);
    C.renderAll();
  }

  function deleteCommit(id){
    const it = (C.data || []).find(x=>x.id===id);
    openConfirm(
      "Eliminar compromiso",
      it ? `¿Seguro que quieres eliminar “${it.what || "compromiso"}”?` : "¿Seguro que quieres eliminar este compromiso?",
      "Sí, eliminar",
      ()=>{
        const list = (C.data || []).filter(x=>x.id!==id);
        C.data = list;
        save(KEY, list);
        toast("🗑️ Eliminado");
        C.renderAll();
      }
    );
  }

  /* =========================
     Contacts: CRUD
  ========================= */
  let editingContactId = null;

  function openContactModal(id){
    editingContactId = id || null;

    const c = id ? (C.contacts || []).find(x=>x.id===id) : null;
    if(cName) cName.value = c?.name || "";
    if(cNote) cNote.value = c?.note || "";

    const t = $("cModalTitle");
    if(t) t.textContent = id ? "Editar amigo" : "Nuevo amigo";

    openModal(cBackdrop);
    setTimeout(()=>{ try{ cName.focus(); }catch(e){} }, 0);
  }

  function closeContactModal(){
    closeModal(cBackdrop);
    editingContactId = null;
  }

  function saveContactFromForm(){
    const name = (cName?.value || "").trim();
    const note = (cNote?.value || "").trim();

    if(!name){
      toast("Escribe un nombre.");
      try{ cName.focus(); }catch(e){}
      return;
    }

    let list = C.contacts || [];
    if(editingContactId){
      const idx = list.findIndex(x=>x.id===editingContactId);
      if(idx>=0){
        list[idx] = { ...list[idx], name, note };
      }
      toast("✍️ Amigo editado");
    }else{
      list = [{ id: uid(), name, note }, ...list];
      toast("✅ Amigo creado");
    }
    C.contacts = list;
    save(CONTACTS_KEY, list);

    closeContactModal();
    C.renderAll();
  }

  function deleteContact(id){
    const c = (C.contacts || []).find(x=>x.id===id);
    openConfirm(
      "Eliminar amigo",
      c ? `¿Seguro que quieres eliminar a “${c.name}”?` : "¿Seguro que quieres eliminar este amigo?",
      "Sí, eliminar",
      ()=>{
        // eliminar amigo
        const nextContacts = (C.contacts || []).filter(x=>x.id!==id);
        C.contacts = nextContacts;
        save(CONTACTS_KEY, nextContacts);

        // en compromisos, los que tenían whoId -> pasar a whoName si es posible
        const name = c?.name || "";
        const nextData = (C.data || []).map(it=>{
          if(it.whoId === id){
            return { ...it, whoId:null, whoName: it.whoName || name || "Sin nombre", updatedAt: new Date().toISOString() };
          }
          return it;
        });
        C.data = nextData;
        save(KEY, nextData);

        toast("🗑️ Amigo eliminado");
        C.renderAll();
      }
    );
  }

  /* =========================
     Share: formato “tarjeta completa” + enlace #p=...
  ========================= */
  let shareItem = null;
  let shareMode = "short"; // short | long

  function buildPackage(item){
    // paquete importable (lo mínimo)
    const p = {
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
    return p;
  }

  function encodePackage(pkg){
    const json = JSON.stringify(pkg);
    // base64url
    const b64 = btoa(unescape(encodeURIComponent(json)))
      .replaceAll("+","-").replaceAll("/","_").replaceAll("=","");
    return b64;
  }

  function appBaseUrl(){
    // compone URL limpia al compromisos.html actual
    const u = new URL(location.href);
    // quitamos hash y query
    u.hash = "";
    u.search = "";
    return u.toString();
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

    // SHORT (el que te gustaba)
    return [
      item.updatedAt ? "✍️ Compromiso editado" : "✅ Nuevo compromiso",
      `👤 ${who}`,
      `📝 ${item.what || "—"}`,
      afterMin ? `⏳ Aviso en: ${afterMin >= 60 ? (afterMin/60)+"h" : afterMin+"m"}` : "",
      `🔗 Abre el enlace para importar. ${url}`
    ].filter(Boolean).join("\n");
  }

  function openShareModal(item){
    shareItem = item;
    shareMode = "short";

    const pkg = buildPackage(item);
    const url = buildImportUrl(pkg);

    if(shareTitle) shareTitle.textContent = "Se enviará un texto completo + enlace de importación.";
    if(shareShort) shareShort.classList.add("active");
    if(shareLong) shareLong.classList.remove("active");

    if(shareTextBox) shareTextBox.textContent = formatShareText(item, url, shareMode);
    if(shareUrlBox) shareUrlBox.textContent = url;

    openModal(shareBackdrop);
  }

  function closeShareModal(){
    closeModal(shareBackdrop);
    shareItem = null;
  }

  async function copyText(text){
    try{
      await navigator.clipboard.writeText(text);
      toast("📋 Copiado");
      return true;
    }catch(e){
      // fallback
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

  function bindShare(){
    if(!shareBackdrop) return;

    if(shareShort) shareShort.onclick = ()=>{
      shareMode = "short";
      shareShort.classList.add("active");
      shareLong.classList.remove("active");
      if(!shareItem) return;
      const url = shareUrlBox?.textContent || "";
      shareTextBox.textContent = formatShareText(shareItem, url, shareMode);
    };

    if(shareLong) shareLong.onclick = ()=>{
      shareMode = "long";
      shareLong.classList.add("active");
      shareShort.classList.remove("active");
      if(!shareItem) return;
      const url = shareUrlBox?.textContent || "";
      shareTextBox.textContent = formatShareText(shareItem, url, shareMode);
    };

    if(shareCopyUrl) shareCopyUrl.onclick = ()=> copyText(shareUrlBox?.textContent || "");
    if(shareCopyAll) shareCopyAll.onclick = ()=>{
      const txt = (shareTextBox?.textContent || "") + "\n";
      return copyText(txt);
    };

    if(shareSend) shareSend.onclick = async ()=>{
      const txt = (shareTextBox?.textContent || "");
      const ok = await shareNative(txt);
      if(!ok){
        // si no hay share, copiamos todo para que lo pegue en WhatsApp/Telegram
        await copyText(txt);
      }
    };

    if(shareCancel) shareCancel.onclick = closeShareModal;
    if(shareClose) shareClose.onclick = closeShareModal;
  }

  /* =========================
     Import desde #p=...
  ========================= */
  function decodePackage(b64url){
    try{
      const b64 = b64url.replaceAll("-","+").replaceAll("_","/");
      // rellenar '='
      const pad = "=".repeat((4 - (b64.length % 4)) % 4);
      const bin = atob(b64 + pad);
      const json = decodeURIComponent(escape(bin));
      return JSON.parse(json);
    }catch(e){
      return null;
    }
  }

  function importFromHash(){
    const p = (location.hash || "").match(/(?:^|[#&])p=([^&]+)/);
    if(!p) return false;

    const raw = p[1];
    const pkg = decodePackage(raw);
    if(!pkg || pkg.v !== 1 || !pkg.p) return false;

    const incoming = pkg.p;

    // crear compromiso
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

    // evitar duplicados simples (mismo texto + quien + fecha)
    const exists = (C.data || []).some(x=>
      (x.what||"") === item.what &&
      (x.whoId||"") === (item.whoId||"") &&
      (x.whoName||"") === (item.whoName||"") &&
      (x.when||"") === (item.when||"")
    );
    if(!exists){
      C.data = [item, ...(C.data || [])];
      save(KEY, C.data);
      toast("📥 Compromiso importado");
    }else{
      toast("📥 Ya lo tenías importado");
    }

    // sumar recibidos
    const r = C.received || { c:0, lastAt:null };
    r.c = Math.max(0, Number(r.c||0)) + 1;
    r.lastAt = now;
    C.received = r;
    save(RECEIVED_KEY, r);

    // limpiar hash (para no reimportar)
    try{
      history.replaceState(null, "", appBaseUrl());
    }catch(e){
      location.hash = "";
    }

    // ir a compromisos
    C.setPane("commitments");
    C.setViewPending();
    C.renderAll();
    return true;
  }

  /* =========================
     Settings: switches (mínimo funcional)
  ========================= */
  function setSwitch(el, on){
    if(!el) return;
    el.classList.toggle("on", !!on);
    el.setAttribute("aria-checked", !!on ? "true" : "false");
  }

  function bindSettings(){
    // A11Y ya se bindea en parte 1

    // PIN toggle (solo visual + overlay simple)
    if(swPin){
      setSwitch(swPin, !!C.settings?.pinEnabled);
      swPin.addEventListener("click", ()=>{
        C.settings = { ...(C.settings||{}), pinEnabled: !C.settings?.pinEnabled };
        save(SETTINGS_KEY, C.settings);
        setSwitch(swPin, !!C.settings.pinEnabled);
        toast(C.settings.pinEnabled ? "🔒 PIN activado" : "🔓 PIN desactivado");
      });
    }

    if(selAutoLock){
      selAutoLock.value = String(C.settings?.autoLockMin ?? 0);
      selAutoLock.addEventListener("change", ()=>{
        C.settings = { ...(C.settings||{}), autoLockMin: Number(selAutoLock.value||0) || 0 };
        save(SETTINGS_KEY, C.settings);
      });
    }

    if(selRemember){
      selRemember.value = String(C.settings?.rememberMin ?? 0);
      selRemember.addEventListener("change", ()=>{
        C.settings = { ...(C.settings||{}), rememberMin: Number(selRemember.value||0) || 0 };
        save(SETTINGS_KEY, C.settings);
      });
    }

    if(btnChangePin){
      btnChangePin.addEventListener("click", ()=>{
        toast("PIN: lo dejamos simple por ahora (si quieres lo hacemos completo luego).");
      });
    }

    if(btnLockNow){
      btnLockNow.addEventListener("click", ()=>{
        showLockOverlay();
      });
    }

    // Notifs (solo permiso)
    if(swNotif){
      setSwitch(swNotif, !!C.settings?.notifEnabled);
      swNotif.addEventListener("click", ()=>{
        C.settings = { ...(C.settings||{}), notifEnabled: !C.settings?.notifEnabled };
        save(SETTINGS_KEY, C.settings);
        setSwitch(swNotif, !!C.settings.notifEnabled);
        updateNotifHint();
      });
    }

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
            // reload estado
            C.data = [];
            C.contacts = [];
            C.settings = {
              pinEnabled:false,
              pinHash:null,
              autoLockMin:0,
              rememberMin:0,
              notifEnabled:false
            };
            C.received = { c:0, lastAt:null };
            save(KEY, C.data);
            save(CONTACTS_KEY, C.contacts);
            save(SETTINGS_KEY, C.settings);
            save(RECEIVED_KEY, C.received);
            save(A11Y_KEY, { big:false });
            C.applyA11yUI(false);
            toast("🧹 Borrado");
            C.setPane("commitments");
            C.setViewPending();
            C.renderAll();
          }
        );
      });
    }

    updateNotifHint();
  }

  function updateNotifHint(){
    if(!notifHint) return;
    if(!("Notification" in window)){
      notifHint.textContent = "ℹ️ Este navegador no soporta notificaciones.";
      return;
    }
    const perm = Notification.permission;
    if(perm === "granted") notifHint.textContent = "✅ Permiso concedido. Recordatorios listos.";
    else if(perm === "denied") notifHint.textContent = "❌ Permiso denegado. Actívalo en ajustes del navegador.";
    else notifHint.textContent = "ℹ️ Pulsa “Permitir” para recibir recordatorios.";
  }

  /* =========================
     Lock overlay (simple)
  ========================= */
  let pinBuffer = "";

  function resetPinDots(){
    ["d1","d2","d3","d4"].forEach((id, i)=>{
      const el = $(id);
      if(el) el.classList.toggle("on", i < pinBuffer.length);
    });
  }

  function showLockOverlay(){
    if(!lockOverlay) return;
    pinBuffer = "";
    resetPinDots();
    openModal(lockOverlay);
  }
  function hideLockOverlay(){
    closeModal(lockOverlay);
  }

  function bindLock(){
    if(lockClose) lockClose.onclick = hideLockOverlay;

    if(btnLockCopyLink){
      btnLockCopyLink.onclick = ()=> copyText(appBaseUrl());
    }

    if(btnLockReset){
      btnLockReset.onclick = ()=> {
        hideLockOverlay();
        if(btnResetAll) btnResetAll.click();
      };
    }

    if(!keypad) return;
    keypad.addEventListener("click", (e)=>{
      const b = e.target.closest(".key");
      if(!b) return;
      const k = b.getAttribute("data-k");
      if(!k) return;

      if(k === "del"){
        pinBuffer = pinBuffer.slice(0,-1);
        resetPinDots();
        return;
      }

      if(k === "ok"){
        // por ahora: sin PIN real -> desbloquea
        hideLockOverlay();
        toast("🔓 Desbloqueado");
        return;
      }

      if(pinBuffer.length >= 4) return;
      pinBuffer += String(k);
      resetPinDots();
    });
  }

  /* =========================
     Bind modal buttons
  ========================= */
  function bindCommitModalButtons(){
    if(btnClose) btnClose.onclick = closeCommitModal;
    if(btnCancel) btnCancel.onclick = closeCommitModal;
    if(btnSave) btnSave.onclick = saveCommitFromForm;

    // tap fuera cierra (solo si clic en backdrop, no en modal)
    if(backdrop){
      backdrop.addEventListener("click", (e)=>{
        if(e.target === backdrop) closeCommitModal();
      });
    }
  }

  function bindContactModalButtons(){
    if(cBtnClose) cBtnClose.onclick = closeContactModal;
    if(cBtnCancel) cBtnCancel.onclick = closeContactModal;
    if(cBtnSave) cBtnSave.onclick = saveContactFromForm;

    if(cBackdrop){
      cBackdrop.addEventListener("click", (e)=>{
        if(e.target === cBackdrop) closeContactModal();
      });
    }
  }

  /* =========================
     Instalación PWA banner (simple, opcional)
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

    // si no hay beforeinstallprompt, enseñamos consejo
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

    // sw
    if("serviceWorker" in navigator){
      navigator.serviceWorker.register("sw.js").catch(()=>{});
    }
  }

  /* =========================
     Exponer funciones reales a parte 1
  ========================= */
  C.setOpenCommitModal(openCommitModal);
  C.setOpenContactModal(openContactModal);
  C.setDeleteCommit(deleteCommit);
  C.setDeleteContact(deleteContact);

  /* =========================
     Boot parte 2
  ========================= */
  ensureIdsAndDefaults();
  bindCommitModalButtons();
  bindContactModalButtons();
  bindContactSelect();
  bindShare();
  bindSettings();
  bindLock();
  bindInstall();

  // Import desde hash si viene paquete
  importFromHash();

  // refresco UI final
  C.renderAll();

  /* =========================
     Init helpers
  ========================= */
  function ensureIdsAndDefaults(){
    // ids en contactos
    let changed = false;

    let cList = load(CONTACTS_KEY, []);
    cList = (cList||[]).map(c=>{
      if(!c.id){ changed = true; return { ...c, id: uid() }; }
      return c;
    });

    if(changed){
      C.contacts = cList;
      save(CONTACTS_KEY, cList);
    }else{
      C.contacts = cList;
    }

    // data
    let dList = load(KEY, []);
    if(!Array.isArray(dList)) dList = [];
    // ids en compromisos
    let changedD = false;
    dList = dList.map(it=>{
      if(!it.id){ changedD = true; return { ...it, id: uid() }; }
      return it;
    });
    if(changedD) save(KEY, dList);
    C.data = dList;

    // settings
    const s = load(SETTINGS_KEY, {
      pinEnabled:false,
      pinHash:null,
      autoLockMin:0,
      rememberMin:0,
      notifEnabled:false
    });
    C.settings = s;
    save(SETTINGS_KEY, s);

    // received
    const r = load(RECEIVED_KEY, { c:0, lastAt:null });
    C.received = r;
    save(RECEIVED_KEY, r);
  }

})();