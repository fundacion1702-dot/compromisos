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

  /* =========================
     IMPORTANTE (FIX): stubs globales seguros
     - Antes tenías openCommitModal() sin declarar en strict mode,
       eso provoca ReferenceError y “se muere” el JS.
     - Aquí SIEMPRE llamamos a window.openCommitModal, etc.
  ========================= */
  if(typeof window.openCommitModal !== "function"){
    window.openCommitModal = function(){ toast("Modal compromiso (pendiente parte 2)"); };
  }
  if(typeof window.openContactModal !== "function"){
    window.openContactModal = function(){ toast("Modal amigo (pendiente parte 2)"); };
  }
  if(typeof window.deleteCommit !== "function"){
    window.deleteCommit = function(){ toast("Eliminar compromiso (pendiente parte 2)"); };
  }
  if(typeof window.deleteContact !== "function"){
    window.deleteContact = function(){ toast("Eliminar amigo (pendiente parte 2)"); };
  }

  /* =========================
     ✅ UI FIX: botón Texto grande arriba derecha, alineado con el título
  ========================= */
  (function injectA11yTopPlacement(){
    try{
      const st = document.createElement("style");
      st.textContent = `
        .topbarInner{ position:relative !important; }
        /* Botón en la esquina superior derecha, alineado con el título */
        #btnA11yTop{
          position:absolute !important;
          top:14px !important;
          right:0 !important;
          z-index:30 !important;
          pointer-events:auto !important;
        }
        /* Deja espacio para que el título no quede debajo del botón */
        .brand{ padding-right:190px !important; }

        /* Pills debajo */
        .topActions{ width:100% !important; justify-content:flex-start !important; }
        .pills{ margin-top:10px !important; }

        @media (max-width:520px){
          .brand{ padding-right:0 !important; }
          #btnA11yTop{ top:12px !important; }
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

  /* =========================
     Accesibilidad: Texto grande (UNIFICADO + sin duplicados)
  ========================= */
  function setTextScale(big){
    const b = !!big;

    // Variables base (compat con tu CSS)
    document.documentElement.style.setProperty("--fs", b ? "18px" : "16px");
    document.documentElement.style.setProperty("--fsBig", b ? "20px" : "18px");

    document.body.classList.toggle("bigText", b);

    // Cambia label botones
    const label = b ? "🔎 Texto normal" : "🔎 Texto grande";
    const b1 = $("btnA11yTop");
    const b2 = $("btnA11y");
    if(b1) b1.textContent = label;
    if(b2) b2.textContent = label;

    save(A11Y_KEY, { big: b });
  }

  function toggleTextScale(){
    const cur = load(A11Y_KEY, { big:false });
    const next = !cur.big;
    setTextScale(next);
    toast(next ? "🔎 Texto grande: ON" : "🔎 Texto grande: OFF");
  }

  // Export global por si en algún sitio hay onclick antiguos
  window.setTextScale = setTextScale;
  window.toggleTextScale = toggleTextScale;

  function bindA11yButtons(){
    const top = $("btnA11yTop");
    const inSettings = $("btnA11y");

    const bind = (btn)=>{
      if(!btn) return;
      btn.style.pointerEvents = "auto";
      btn.addEventListener("click", (e)=>{ e.preventDefault(); toggleTextScale(); }, { passive:false });
      btn.addEventListener("touchend", (e)=>{ e.preventDefault(); toggleTextScale(); }, { passive:false });
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

    const list = $("list");
    const empty = $("empty");
    if(!list) return;

    list.innerHTML = "";

    const items = data
      .filter(x=> view==="pending" ? !x.done : x.done)
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

      // ✅ SIEMPRE vía window.* (no revienta en strict)
      card.querySelector('[data-act="edit"]').addEventListener("click", ()=> window.openCommitModal(it.id));
      card.querySelector('[data-act="del"]').addEventListener("click", ()=> window.deleteCommit(it.id));

      list.appendChild(card);
    });
  }

  function renderContacts(){
    updateCounts();

    const list = $("contactsList");
    const empty = $("contactsEmpty");
    if(!list) return;

    list.innerHTML = "";
    if(empty) empty.style.display = contacts.length ? "none" : "block";

    contacts
      .slice()
      .sort((a,b)=> (a.name||"").localeCompare(b.name||"", "es"))
      .forEach((c)=>{
        const card = document.createElement("div");
        card.className = "card";
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
          <div class="desc">${esc(c.note || "Amigo guardado en tu móvil.")}</div>
          <div class="actions">
            <button class="btn" type="button" data-act="edit">✍️ Editar</button>
            <button class="btn danger" type="button" data-act="del">🗑️ Eliminar</button>
          </div>
        `;

        // ✅ SIEMPRE vía window.*
        card.querySelector('[data-act="new"]').addEventListener("click", ()=> window.openCommitModal(null, c.id));
        card.querySelector('[data-act="edit"]').addEventListener("click", ()=> window.openContactModal(c.id));
        card.querySelector('[data-act="del"]').addEventListener("click", ()=> window.deleteContact(c.id));

        list.appendChild(card);
      });
  }

  function renderAll(){
    renderCommitments();
    renderContacts();
    updateCounts();
  }

  /* =========================
     FAB (+)
  ========================= */
  function bindFab(){
    const fab = $("fab");
    if(!fab) return;
    fab.addEventListener("click", ()=>{
      if(pane === "contacts") window.openContactModal(null);
      else window.openCommitModal(null, null);
    });
  }

  /* =========================
     Boot
  ========================= */
  (function boot(){
    const a11y = load(A11Y_KEY, { big:false });
    setTextScale(!!a11y.big);

    bindA11yButtons();
    bindNav();
    bindFab();
    renderAll();
  })();

  /* =========================
     (la PARTE 2/2 va a partir de aquí)
     - Modales reales: compromiso / amigo
     - Confirm modal real
     - Ajustes: PIN + autobloqueo + recordar + notificaciones
     - Compartir paquete
     - Borrar todo
     - etc.
  ========================= */

})();
/* compromisos.js (2/2) */
(function(){
  "use strict";

  // Esta parte asume que la 1/2 ya definió KEY/CONTACTS_KEY/SETTINGS_KEY/RECEIVED_KEY/A11Y_KEY,
  // data/contacts/settings/received, $, load/save, toast, uid, fmtDate, isOverdue, etc.
  // Para no duplicar, lo leemos desde el mismo closure global del archivo (la parte 1).
  // Como estás pegando esto DENTRO del mismo archivo (después de la parte 1),
  // aquí podemos acceder a window.* que dejó la parte 1 (openCommitModal, etc.)
  // y también a los elementos del DOM.

  // ⚠️ Importante: como la parte 1 y 2 están en el MISMO archivo, aquí NO volvemos a declarar
  // funciones/const de la parte 1. Solo añadimos la lógica completa.

  // Si por lo que sea esta parte se pega suelta (sin la 1/2), evitamos romper:
  const $ = (id)=> document.getElementById(id);
  const toast = window.toast || function(m){ console.log(m); };

  /* =========================
     Utilidades UI (backdrops)
  ========================= */
  function showBackdrop(id){
    const b = $(id);
    if(!b) return;
    b.classList.add("show");
    b.setAttribute("aria-hidden","false");
    document.body.style.overflow = "hidden";
  }
  function hideBackdrop(id){
    const b = $(id);
    if(!b) return;
    b.classList.remove("show");
    b.setAttribute("aria-hidden","true");
    document.body.style.overflow = "";
  }

  /* =========================
     Confirm modal (propio)
  ========================= */
  const Confirm = {
    _resolver:null,
    open({ title="Confirmar", msg="", yesText="Sí, continuar", danger=true }){
      const t = $("confirmTitle");
      const m = $("confirmMsg");
      const y = $("confirmYes");
      const n = $("confirmNo");

      if(t) t.textContent = title;
      if(m) m.innerHTML = msg;

      if(y){
        y.textContent = yesText;
        y.classList.toggle("danger", !!danger);
        y.classList.toggle("primary", !danger);
      }

      showBackdrop("confirmBackdrop");

      return new Promise((resolve)=>{
        Confirm._resolver = resolve;
      });
    },
    close(val){
      hideBackdrop("confirmBackdrop");
      const r = Confirm._resolver;
      Confirm._resolver = null;
      if(r) r(!!val);
    }
  };

  (function bindConfirm(){
    const c = $("confirmClose");
    const n = $("confirmNo");
    const y = $("confirmYes");
    if(c) c.onclick = ()=> Confirm.close(false);
    if(n) n.onclick = ()=> Confirm.close(false);
    if(y) y.onclick = ()=> Confirm.close(true);

    const bd = $("confirmBackdrop");
    if(bd){
      bd.addEventListener("click", (e)=>{
        if(e.target === bd) Confirm.close(false);
      });
    }
  })();

  /* =========================
     Storage keys / load helpers
  ========================= */
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

  // Estado real (recargamos por seguridad)
  let data = load(KEY, []);
  let contacts = load(CONTACTS_KEY, []);
  let settings = load(SETTINGS_KEY, {
    pinEnabled:false,
    autoLockMin:0,
    rememberMin:0,
    notifEnabled:false,
    pinHash:null,
    unlockedUntil:0
  });
  let received = load(RECEIVED_KEY, { c:0, lastAt:null });

  // Para distinguir “nuevo / editar”
  let currentEditCommitId = null;
  let currentEditContactId = null;

  /* =========================
     Helpers
  ========================= */
  function esc(s){
    return String(s ?? "")
      .replaceAll("&","&amp;")
      .replaceAll("<","&lt;")
      .replaceAll(">","&gt;")
      .replaceAll('"',"&quot;")
      .replaceAll("'","&#039;");
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

  function normalizedWho(item){
    if(item.whoId){
      const c = contacts.find(x=>x.id===item.whoId);
      if(c && c.name) return c.name;
    }
    return item.whoName || "Sin nombre";
  }

  /* =========================
     Render / contadores (conectamos con parte 1)
  ========================= */
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

    const list = $("list");
    const empty = $("empty");
    if(!list) return;

    // Determinar view desde botones active
    const view = ($("tabDone") && $("tabDone").classList.contains("active")) ? "done" : "pending";

    list.innerHTML = "";

    const items = data
      .filter(x=> view==="pending" ? !x.done : x.done)
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
          <button class="btn" type="button" data-act="share">📦 Compartir</button>
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
      card.querySelector('[data-act="share"]').addEventListener("click", ()=> shareSnapshot(it.id));

      list.appendChild(card);
    });
  }

  function renderContacts(){
    updateCounts();

    const list = $("contactsList");
    const empty = $("contactsEmpty");
    if(!list) return;

    list.innerHTML = "";
    if(empty) empty.style.display = contacts.length ? "none" : "block";

    contacts
      .slice()
      .sort((a,b)=> (a.name||"").localeCompare(b.name||"", "es"))
      .forEach((c)=>{
        const card = document.createElement("div");
        card.className = "card";
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
          <div class="desc">${esc(c.note || "Amigo guardado en tu móvil.")}</div>
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
    fillContactSelect();
    updateSettingsUI();
    renderReceivedBadge();
  }

  /* =========================
     Contact select (modal compromiso)
  ========================= */
  function fillContactSelect(selectedId){
    const sel = $("fContact");
    if(!sel) return;

    const keep = selectedId ?? sel.value ?? "";
    sel.innerHTML = "";

    const opt0 = document.createElement("option");
    opt0.value = "";
    opt0.textContent = "— Elegir amigo (o escribir nombre) —";
    sel.appendChild(opt0);

    const optCustom = document.createElement("option");
    optCustom.value = "__custom__";
    optCustom.textContent = "✍️ Escribir nombre (sin guardar)";
    sel.appendChild(optCustom);

    contacts
      .slice()
      .sort((a,b)=> (a.name||"").localeCompare(b.name||"", "es"))
      .forEach(c=>{
        const o = document.createElement("option");
        o.value = c.id;
        o.textContent = c.name || "Sin nombre";
        sel.appendChild(o);
      });

    sel.value = keep || "";
    handleContactSelectChange();
  }

  function handleContactSelectChange(){
    const sel = $("fContact");
    const customWrap = $("customWhoField");
    const fWho = $("fWho");
    if(!sel || !customWrap || !fWho) return;

    const v = sel.value;
    if(v === "__custom__"){
      customWrap.style.display = "";
      fWho.focus();
    }else{
      customWrap.style.display = "none";
    }
  }

  /* =========================
     Modal Compromiso: abrir/guardar/cerrar
  ========================= */
  function openCommitModal(id, preContactId){
    currentEditCommitId = id || null;

    const title = $("modalTitle");
    const btnSave = $("btnSave");

    if(title) title.textContent = id ? "Editar compromiso" : "Nuevo compromiso";
    if(btnSave) btnSave.textContent = id ? "Guardar cambios" : "Guardar";

    // Reset fields
    const fWhat = $("fWhat");
    const fWhen = $("fWhen");
    const fRemind = $("fRemind");
    const fAfter = $("fAfter");
    const fWho = $("fWho");
    const contactHint = $("contactHint");

    if(fWhat) fWhat.value = "";
    if(fWhen) fWhen.value = "";
    if(fRemind) fRemind.value = "0";
    if(fAfter) fAfter.value = "0";
    if(fWho) fWho.value = "";
    if(contactHint) contactHint.textContent = "Elige un amigo o escribe un nombre sin guardar.";

    // Prefill if editing
    if(id){
      const it = data.find(x=>x.id===id);
      if(it){
        if(fWhat) fWhat.value = it.what || "";
        if(fWhen){
          // datetime-local necesita "YYYY-MM-DDTHH:MM"
          if(it.when){
            const d = new Date(it.when);
            if(!isNaN(d.getTime())){
              const pad = (n)=> String(n).padStart(2,"0");
              fWhen.value = `${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
            }
          }
        }
        if(fRemind) fRemind.value = String(Number(it.remindMin||0));
        if(fAfter) fAfter.value = String(Number(it.afterMin||0));

        fillContactSelect(it.whoId || "");
        if(!it.whoId){
          // si no tiene whoId, ponemos custom
          const sel = $("fContact");
          if(sel) sel.value = "__custom__";
          handleContactSelectChange();
          if(fWho) fWho.value = it.whoName || "";
        }
      }
    } else {
      // nuevo
      fillContactSelect(preContactId || "");
      if(preContactId){
        const sel = $("fContact");
        if(sel) sel.value = preContactId;
      }
    }

    showBackdrop("backdrop");
  }

  function closeCommitModal(){
    hideBackdrop("backdrop");
    currentEditCommitId = null;
  }

  function getSelectedWho(){
    const sel = $("fContact");
    const fWho = $("fWho");
    if(!sel) return { whoId:null, whoName:"Sin nombre" };

    if(sel.value && sel.value !== "__custom__"){
      const c = contacts.find(x=>x.id===sel.value);
      return { whoId: sel.value, whoName: (c?.name || "Sin nombre") };
    }

    // custom
    const name = String(fWho?.value || "").trim();
    return { whoId:null, whoName: name || "Sin nombre" };
  }

  function parseWhenToIso(){
    const fWhen = $("fWhen");
    if(!fWhen) return null;
    const v = String(fWhen.value||"").trim();
    if(!v) return null;
    const d = new Date(v);
    if(isNaN(d.getTime())) return null;
    return d.toISOString();
  }

  async function saveCommitFromModal(){
    const fWhat = $("fWhat");
    const fRemind = $("fRemind");
    const fAfter = $("fAfter");

    const what = String(fWhat?.value || "").trim();
    const whenIso = parseWhenToIso();
    const remindMin = Number(fRemind?.value || 0) || 0;
    const afterMin = Number(fAfter?.value || 0) || 0;

    const who = getSelectedWho();
    const now = new Date().toISOString();

    if(!what){
      toast("Escribe qué se acordó ✍️");
      return;
    }

    if(currentEditCommitId){
      const it = data.find(x=>x.id===currentEditCommitId);
      if(!it){ toast("No encontrado"); closeCommitModal(); return; }

      it.whoId = who.whoId;
      it.whoName = who.whoName;
      it.what = what;
      it.when = whenIso;
      it.remindMin = remindMin;

      // "desde ahora" solo se guarda como minutos (se aplicará al compartir)
      it.afterMin = afterMin;
      it.updatedAt = now;

      save(KEY, data);
      closeCommitModal();
      renderAll();
      toast("Guardado ✅");
      // abrir compartir
      shareSnapshot(it.id);
      return;
    }

    const newItem = {
      id: uid(),
      whoId: who.whoId,
      whoName: who.whoName,
      what,
      when: whenIso,
      remindMin,
      afterMin,
      afterAt: null,
      done:false,
      createdAt: now,
      updatedAt: null,
      doneAt: null
    };
    data.push(newItem);
    save(KEY, data);

    closeCommitModal();
    renderAll();
    toast("Creado ✅");
    shareSnapshot(newItem.id);
  }

  async function deleteCommit(id){
    const it = data.find(x=>x.id===id);
    if(!it) return;

    const ok = await Confirm.open({
      title:"Eliminar compromiso",
      msg:`¿Seguro que quieres eliminar este compromiso?<br><b>${esc(it.what||"")}</b>`,
      yesText:"Sí, eliminar",
      danger:true
    });
    if(!ok) return;

    data = data.filter(x=>x.id!==id);
    save(KEY, data);
    renderAll();
    toast("Eliminado 🗑️");
  }

  /* =========================
     Modal Contacto: abrir/guardar/cerrar
  ========================= */
  function openContactModal(id){
    currentEditContactId = id || null;

    const t = $("cModalTitle");
    const btn = $("cBtnSave");
    if(t) t.textContent = id ? "Editar amigo" : "Nuevo amigo";
    if(btn) btn.textContent = id ? "Guardar cambios" : "Guardar";

    const cName = $("cName");
    const cNote = $("cNote");
    if(cName) cName.value = "";
    if(cNote) cNote.value = "";

    if(id){
      const c = contacts.find(x=>x.id===id);
      if(c){
        if(cName) cName.value = c.name || "";
        if(cNote) cNote.value = c.note || "";
      }
    }

    showBackdrop("cBackdrop");
    setTimeout(()=>{ try{ $("cName")?.focus(); }catch(e){} }, 20);
  }

  function closeContactModal(){
    hideBackdrop("cBackdrop");
    currentEditContactId = null;
  }

  async function saveContactFromModal(){
    const cName = $("cName");
    const cNote = $("cNote");
    const name = String(cName?.value || "").trim();
    const note = String(cNote?.value || "").trim();

    if(!name){
      toast("Pon un nombre 👥");
      return;
    }

    if(currentEditContactId){
      const c = contacts.find(x=>x.id===currentEditContactId);
      if(!c){ toast("No encontrado"); closeContactModal(); return; }

      c.name = name;
      c.note = note || "";
      save(CONTACTS_KEY, contacts);
      closeContactModal();
      renderAll();
      toast("Guardado ✅");
      return;
    }

    contacts.push({ id: uid(), name, note: note || "" });
    save(CONTACTS_KEY, contacts);
    closeContactModal();
    renderAll();
    toast("Amigo creado ✅");
  }

  async function deleteContact(id){
    const c = contacts.find(x=>x.id===id);
    if(!c) return;

    const used = data.some(x=>x.whoId===id);
    const ok = await Confirm.open({
      title:"Eliminar amigo",
      msg:`¿Seguro que quieres eliminar a <b>${esc(c.name||"")}</b>?${used ? "<br><span style='color:#991B1B'>⚠️ Hay compromisos asociados (se quedarán como nombre libre).</span>" : ""}`,
      yesText:"Sí, eliminar",
      danger:true
    });
    if(!ok) return;

    // Convertimos los compromisos que lo usen a “nombre libre”
    data.forEach(it=>{
      if(it.whoId===id){
        it.whoId = null;
        it.whoName = c.name || it.whoName;
        it.updatedAt = new Date().toISOString();
      }
    });

    contacts = contacts.filter(x=>x.id!==id);
    save(CONTACTS_KEY, contacts);
    save(KEY, data);
    renderAll();
    toast("Amigo eliminado 🗑️");
  }

  /* =========================
     Compartir paquete (modal share)
  ========================= */
  function buildPackageForItem(it){
    // Paquete “compromiso” simple para compartir por enlace.
    // El receptor “aplica” al abrir el link (aquí solo lo preparamos).
    const payload = {
      i: it.id,
      w: normalizedWho(it),
      s: it.what || "",
      n: it.when || null,
      r: Number(it.remindMin||0),
      af: Number(it.afterMin||0),
      // “desde ahora”: se calcula en receptor si quiere, aquí solo minutos
      ca: it.createdAt || new Date().toISOString()
    };
    return payload;
  }

  function encodePack(obj){
    const json = JSON.stringify(obj);
    // base64url
    const b64 = btoa(unescape(encodeURIComponent(json)))
      .replaceAll("+","-").replaceAll("/","_").replaceAll("=","");
    return b64;
  }

  function getBaseUrl(){
    // Usa el propio URL actual sin query/hash
    const u = new URL(location.href);
    u.hash = "";
    u.search = "";
    return u.toString();
  }

  function shareSnapshot(itemId){
    const it = data.find(x=>x.id===itemId);
    if(!it){ toast("No encontrado"); return; }

    const pack = buildPackageForItem(it);
    const code = encodePack(pack);

    const base = getBaseUrl();
    const url = `${base}?p=${code}`;

    const shortTxt =
      `📌 Compromiso\n`+
      `👤 ${normalizedWho(it)}\n`+
      `📝 ${it.what}\n`+
      `${it.when ? ("⏰ "+fmtDate(it.when)+"\n") : ""}`+
      (Number(it.remindMin||0) ? `🔔 Recordatorio: ${it.remindMin} min antes\n` : "")+
      `\n🔗 Enlace:\n${url}`;

    const longTxt =
      `📌 Compromiso (detalle)\n\n`+
      `👤 Con: ${normalizedWho(it)}\n`+
      `📝 Qué: ${it.what}\n`+
      `⏰ Para: ${it.when ? fmtDate(it.when) : "Sin fecha"}\n`+
      `🔔 Recordatorio: ${Number(it.remindMin||0) ? (it.remindMin+" min antes") : "Ninguno"}\n`+
      `⏳ Avisar “desde ahora”: ${Number(it.afterMin||0) ? (it.afterMin+" min") : "No"}\n`+
      `🕒 Creado: ${it.createdAt ? fmtDate(it.createdAt) : ""}\n\n`+
      `🔗 Enlace:\n${url}`;

    // UI
    const shareTitle = $("shareTitle");
    const box = $("shareTextBox");
    const boxUrl = $("shareUrlBox");
    const btnShort = $("shareShort");
    const btnLong = $("shareLong");

    if(shareTitle) shareTitle.innerHTML = `Vas a compartir: <b>${esc(normalizedWho(it))}</b> · <b>${esc(it.what)}</b>`;
    if(boxUrl) boxUrl.textContent = url;

    function setMode(mode){
      if(btnShort) btnShort.classList.toggle("active", mode==="short");
      if(btnLong) btnLong.classList.toggle("active", mode==="long");
      if(box) box.textContent = (mode==="short") ? shortTxt : longTxt;
    }
    setMode("short");

    if(btnShort) btnShort.onclick = ()=> setMode("short");
    if(btnLong) btnLong.onclick = ()=> setMode("long");

    // Botones
    const copyUrl = $("shareCopyUrl");
    const copyAll = $("shareCopyAll");
    const send = $("shareSend");

    if(copyUrl) copyUrl.onclick = async ()=>{
      try{
        await navigator.clipboard.writeText(url);
        toast("Enlace copiado 🔗");
      }catch(e){
        toast("No se pudo copiar");
      }
    };

    if(copyAll) copyAll.onclick = async ()=>{
      try{
        const txt = (btnLong && btnLong.classList.contains("active")) ? longTxt : shortTxt;
        await navigator.clipboard.writeText(txt);
        toast("Texto copiado 📋");
      }catch(e){
        toast("No se pudo copiar");
      }
    };

    if(send) send.onclick = async ()=>{
      const txt = (btnLong && btnLong.classList.contains("active")) ? longTxt : shortTxt;
      try{
        if(navigator.share){
          await navigator.share({ text: txt });
          toast("Compartido 📤");
        }else{
          await navigator.clipboard.writeText(txt);
          toast("Copiado (no hay share) 📋");
        }
      }catch(e){
        toast("Cancelado");
      }
    };

    showBackdrop("shareBackdrop");
  }

  function closeShare(){
    hideBackdrop("shareBackdrop");
  }

  (function bindShareModal(){
    const x = $("shareClose");
    const done = $("shareCancel");
    const bd = $("shareBackdrop");
    if(x) x.onclick = closeShare;
    if(done) done.onclick = closeShare;
    if(bd){
      bd.addEventListener("click", (e)=>{
        if(e.target === bd) closeShare();
      });
    }
  })();

  /* =========================
     Recibidos (contador)
  ========================= */
  function renderReceivedBadge(){
    const rec = Math.max(0, Number(received?.c || 0));
    if($("bReceived")) $("bReceived").textContent = String(rec);
  }

  function clearReceived(){
    received = { c:0, lastAt:null };
    save(RECEIVED_KEY, received);
    renderReceivedBadge();
  }

  /* =========================
     Aplicar paquete recibido por URL (?p=...)
  ========================= */
  function decodePack(s){
    try{
      const b64 = s.replaceAll("-","+").replaceAll("_","/");
      const pad = b64.length % 4 ? ("=".repeat(4 - (b64.length % 4))) : "";
      const json = decodeURIComponent(escape(atob(b64+pad)));
      return JSON.parse(json);
    }catch(e){ return null; }
  }

  function applyIncomingPack(){
    const u = new URL(location.href);
    const p = u.searchParams.get("p");
    if(!p) return false;

    const pack = decodePack(p);
    if(!pack || typeof pack !== "object"){
      toast("Paquete inválido");
      return false;
    }

    // Crea compromiso “recibido”
    const now = new Date().toISOString();
    const newItem = {
      id: uid(),
      whoId: null,
      whoName: String(pack.w || "Sin nombre"),
      what: String(pack.s || ""),
      when: pack.n || null,
      remindMin: Number(pack.r || 0) || 0,
      afterMin: Number(pack.af || 0) || 0,
      afterAt: null,
      done:false,
      createdAt: now,
      updatedAt: null,
      doneAt: null
    };

    data.push(newItem);
    save(KEY, data);

    // contador recibidos
    received.c = Math.max(0, Number(received.c||0)) + 1;
    received.lastAt = now;
    save(RECEIVED_KEY, received);

    // Limpia la URL para que no se reaplique al refrescar
    u.searchParams.delete("p");
    history.replaceState({}, "", u.toString());

    toast("📥 Paquete recibido ✅");
    return true;
  }

  /* =========================
     Ajustes: UI + PIN
  ========================= */
  function updateSettingsUI(){
    // Switch PIN
    const swPin = $("swPin");
    if(swPin){
      swPin.classList.toggle("on", !!settings.pinEnabled);
      swPin.setAttribute("aria-checked", settings.pinEnabled ? "true" : "false");
    }

    // Selects
    const selAuto = $("selAutoLock");
    const selRem = $("selRemember");
    if(selAuto) selAuto.value = String(Number(settings.autoLockMin||0));
    if(selRem) selRem.value = String(Number(settings.rememberMin||0));

    // Switch notif
    const swNotif = $("swNotif");
    if(swNotif){
      swNotif.classList.toggle("on", !!settings.notifEnabled);
      swNotif.setAttribute("aria-checked", settings.notifEnabled ? "true" : "false");
    }
  }

  function hashPin(pin){
    // hash “simple” (no crypto fuerte, pero suficiente para PWA local)
    let h = 0;
    for(let i=0;i<pin.length;i++){
      h = ((h<<5)-h) + pin.charCodeAt(i);
      h |= 0;
    }
    return String(h);
  }

  function isUnlockedNow(){
    const t = Number(settings.unlockedUntil||0);
    return t && Date.now() < t;
  }
  function setUnlockedForMinutes(min){
    const m = Number(min||0);
    if(m <= 0){
      settings.unlockedUntil = 0;
    }else{
      settings.unlockedUntil = Date.now() + m*60*1000;
    }
    save(SETTINGS_KEY, settings);
  }

  function showLockOverlay(){
    showBackdrop("lockOverlay");
    resetPinEntry();
  }
  function hideLockOverlay(){
    hideBackdrop("lockOverlay");
  }

  // PIN entry
  let pinEntry = "";

  function resetPinEntry(){
    pinEntry = "";
    renderPinDots();
  }
  function renderPinDots(){
    const ids = ["d1","d2","d3","d4"];
    ids.forEach((id, i)=>{
      const el = $(id);
      if(!el) return;
      el.classList.toggle("on", i < pinEntry.length);
    });
  }

  function handlePinKey(k){
    if(k === "del"){
      pinEntry = pinEntry.slice(0,-1);
      renderPinDots();
      return;
    }
    if(k === "ok"){
      verifyPinEntry();
      return;
    }
    if(/^\d$/.test(k)){
      if(pinEntry.length >= 4) return;
      pinEntry += k;
      renderPinDots();
      if(pinEntry.length === 4) verifyPinEntry();
    }
  }

  function verifyPinEntry(){
    if(!settings.pinEnabled){
      hideLockOverlay();
      return;
    }
    const entered = pinEntry;
    if(entered.length !== 4){
      toast("PIN incompleto");
      return;
    }
    const ok = (settings.pinHash && settings.pinHash === hashPin(entered));
    if(ok){
      toast("Desbloqueado ✅");
      setUnlockedForMinutes(Number(settings.rememberMin||0));
      hideLockOverlay();
      resetPinEntry();
      return;
    }
    toast("PIN incorrecto");
    resetPinEntry();
  }

  // Modal PIN (configurar/cambiar)
  let pinMode = "set"; // set | change
  function openPinModal(mode){
    pinMode = mode || "set";
    const title = $("pinTitle");
    const hint = $("pinHint");
    const oldWrap = $("pinOldWrap");

    if(title) title.textContent = (pinMode==="change") ? "Cambiar PIN" : "Configurar PIN";
    if(hint){
      hint.textContent = (pinMode==="change")
        ? "Introduce tu PIN actual y el nuevo (4 dígitos)."
        : "Elige un PIN de 4 dígitos. Se guardará solo en tu móvil.";
    }
    if(oldWrap) oldWrap.style.display = (pinMode==="change") ? "" : "none";

    // reset inputs
    const a = $("pinOld");
    const b = $("pinNew");
    const c = $("pinNew2");
    if(a) a.value = "";
    if(b) b.value = "";
    if(c) c.value = "";

    showBackdrop("pinBackdrop");
    setTimeout(()=>{ try{ (pinMode==="change" ? $("pinOld") : $("pinNew"))?.focus(); }catch(e){} }, 20);
  }

  function closePinModal(){
    hideBackdrop("pinBackdrop");
  }

  async function savePinFromModal(){
    const old = String($("pinOld")?.value || "").trim();
    const p1 = String($("pinNew")?.value || "").trim();
    const p2 = String($("pinNew2")?.value || "").trim();

    if(pinMode==="change"){
      if(old.length !== 4){ toast("PIN actual inválido"); return; }
      if(!settings.pinHash || settings.pinHash !== hashPin(old)){
        toast("PIN actual incorrecto");
        return;
      }
    }

    if(p1.length !== 4 || !/^\d{4}$/.test(p1)){ toast("El PIN debe tener 4 dígitos"); return; }
    if(p1 !== p2){ toast("Los PIN no coinciden"); return; }

    settings.pinHash = hashPin(p1);
    settings.pinEnabled = true;
    settings.unlockedUntil = 0;
    save(SETTINGS_KEY, settings);

    closePinModal();
    updateSettingsUI();
    toast("PIN guardado 🔒");
  }

  function lockNow(){
    settings.unlockedUntil = 0;
    save(SETTINGS_KEY, settings);
    showLockOverlay();
  }

  /* =========================
     Notificaciones (Permitir)
  ========================= */
  async function requestNotifPermission(){
    if(!("Notification" in window)){
      toast("Este navegador no soporta notificaciones");
      return;
    }
    try{
      const p = await Notification.requestPermission();
      const hint = $("notifHint");
      if(p === "granted"){
        settings.notifEnabled = true;
        save(SETTINGS_KEY, settings);
        updateSettingsUI();
        if(hint) hint.textContent = "✅ Permiso concedido. (Los recordatorios se activarán cuando estén implementados al 100%)";
        toast("Notificaciones activadas ✅");
      }else{
        settings.notifEnabled = false;
        save(SETTINGS_KEY, settings);
        updateSettingsUI();
        if(hint) hint.textContent = "ℹ️ Permiso no concedido. Puedes activarlo en ajustes del navegador.";
        toast("No permitido");
      }
    }catch(e){
      toast("Error pidiendo permiso");
    }
  }

  /* =========================
     Borrar todo
  ========================= */
  async function resetAll(){
    const ok = await Confirm.open({
      title:"Borrar todo",
      msg:"Esto borrará <b>compromisos</b>, <b>amigos</b> y <b>ajustes</b> de este móvil.<br>¿Continuar?",
      yesText:"Sí, borrar todo",
      danger:true
    });
    if(!ok) return;

    localStorage.removeItem(KEY);
    localStorage.removeItem(CONTACTS_KEY);
    localStorage.removeItem(SETTINGS_KEY);
    localStorage.removeItem(RECEIVED_KEY);
    // no borramos A11Y para que mantenga tu preferencia (si quieres, lo borro también)

    data = [];
    contacts = [];
    settings = {
      pinEnabled:false,
      autoLockMin:0,
      rememberMin:0,
      notifEnabled:false,
      pinHash:null,
      unlockedUntil:0
    };
    received = { c:0, lastAt:null };

    save(SETTINGS_KEY, settings);
    save(RECEIVED_KEY, received);

    renderAll();
    toast("Reiniciado 🧹");
  }

  /* =========================
     Auto-bloqueo (al salir / volver)
  ========================= */
  let lastHideAt = 0;

  function onHide(){
    lastHideAt = Date.now();
    // si autoLock=0 => inmediato
    if(settings.pinEnabled){
      const m = Number(settings.autoLockMin||0);
      if(m === 0){
        settings.unlockedUntil = 0;
        save(SETTINGS_KEY, settings);
      }
    }
  }

  function onShow(){
    if(!settings.pinEnabled) return;
    if(isUnlockedNow()) return;

    // si se quedó bloqueado
    showLockOverlay();
  }

  document.addEventListener("visibilitychange", ()=>{
    if(document.hidden) onHide();
    else onShow();
  });

  window.addEventListener("pagehide", onHide);
  window.addEventListener("pageshow", onShow);

  /* =========================
     Bindings (modales + settings)
  ========================= */
  (function bindModals(){
    // compromiso modal
    const close = $("btnClose");
    const cancel = $("btnCancel");
    const saveBtn = $("btnSave");
    const bd = $("backdrop");
    const sel = $("fContact");

    if(close) close.onclick = closeCommitModal;
    if(cancel) cancel.onclick = closeCommitModal;
    if(saveBtn) saveBtn.onclick = saveCommitFromModal;
    if(bd){
      bd.addEventListener("click", (e)=>{
        if(e.target === bd) closeCommitModal();
      });
    }
    if(sel) sel.addEventListener("change", handleContactSelectChange);

    // contacto modal
    const cClose = $("cBtnClose");
    const cCancel = $("cBtnCancel");
    const cSave = $("cBtnSave");
    const cbd = $("cBackdrop");
    if(cClose) cClose.onclick = closeContactModal;
    if(cCancel) cCancel.onclick = closeContactModal;
    if(cSave) cSave.onclick = saveContactFromModal;
    if(cbd){
      cbd.addEventListener("click", (e)=>{
        if(e.target === cbd) closeContactModal();
      });
    }

    // pin modal
    const pClose = $("pinClose");
    const pCancel = $("pinCancel");
    const pOk = $("pinOk");
    const pbd = $("pinBackdrop");
    if(pClose) pClose.onclick = closePinModal;
    if(pCancel) pCancel.onclick = closePinModal;
    if(pOk) pOk.onclick = savePinFromModal;
    if(pbd){
      pbd.addEventListener("click", (e)=>{
        if(e.target === pbd) closePinModal();
      });
    }
  })();

  (function bindSettings(){
    const swPin = $("swPin");
    const swNotif = $("swNotif");
    const btnChangePin = $("btnChangePin");
    const btnLockNow = $("btnLockNow");
    const selAuto = $("selAutoLock");
    const selRem = $("selRemember");
    const btnNotifPerm = $("btnNotifPerm");
    const btnReset = $("btnResetAll");

    if(swPin){
      const toggle = ()=>{
        settings.pinEnabled = !settings.pinEnabled;

        if(settings.pinEnabled){
          // Si no hay pin aún, pedir configurar
          if(!settings.pinHash){
            settings.pinEnabled = false;
            save(SETTINGS_KEY, settings);
            updateSettingsUI();
            openPinModal("set");
            return;
          }
          // si hay pin, bloquea (pedirá pin al volver)
          settings.unlockedUntil = 0;
        }else{
          settings.unlockedUntil = 0;
        }

        save(SETTINGS_KEY, settings);
        updateSettingsUI();
        toast(settings.pinEnabled ? "PIN activado 🔒" : "PIN desactivado");
        if(settings.pinEnabled) showLockOverlay();
        else hideLockOverlay();
      };

      swPin.addEventListener("click", toggle);
      swPin.addEventListener("keydown", (e)=>{
        if(e.key==="Enter" || e.key===" "){ e.preventDefault(); toggle(); }
      });
    }

    if(btnChangePin) btnChangePin.onclick = ()=> openPinModal(settings.pinHash ? "change" : "set");
    if(btnLockNow) btnLockNow.onclick = lockNow;

    if(selAuto){
      selAuto.onchange = ()=>{
        settings.autoLockMin = Number(selAuto.value||0) || 0;
        save(SETTINGS_KEY, settings);
        toast("Auto-bloqueo guardado");
      };
    }
    if(selRem){
      selRem.onchange = ()=>{
        settings.rememberMin = Number(selRem.value||0) || 0;
        save(SETTINGS_KEY, settings);
        toast("Recordar desbloqueo guardado");
      };
    }

    if(swNotif){
      const toggle = ()=>{
        settings.notifEnabled = !settings.notifEnabled;
        save(SETTINGS_KEY, settings);
        updateSettingsUI();
        toast(settings.notifEnabled ? "Notificaciones: ON" : "Notificaciones: OFF");
      };
      swNotif.addEventListener("click", toggle);
      swNotif.addEventListener("keydown", (e)=>{
        if(e.key==="Enter" || e.key===" "){ e.preventDefault(); toggle(); }
      });
    }

    if(btnNotifPerm) btnNotifPerm.onclick = requestNotifPermission;
    if(btnReset) btnReset.onclick = resetAll;
  })();

  /* =========================
     Lock overlay keypad
  ========================= */
  (function bindLockOverlay(){
    const bd = $("lockOverlay");
    const close = $("lockClose");
    const keypad = $("keypad");
    const btnReset = $("btnLockReset");
    const btnCopy = $("btnLockCopyLink");

    if(close) close.onclick = ()=>{
      // no cerramos si pin está activo y no está desbloqueado
      if(settings.pinEnabled && !isUnlockedNow()){
        toast("Introduce el PIN");
        return;
      }
      hideLockOverlay();
    };

    if(keypad){
      keypad.addEventListener("click", (e)=>{
        const btn = e.target.closest("button");
        if(!btn) return;
        const k = btn.getAttribute("data-k");
        if(!k) return;
        handlePinKey(k);
      });
    }

    if(bd){
      bd.addEventListener("click", (e)=>{
        if(e.target === bd){
          // igual: no cerramos si está bloqueado
          if(settings.pinEnabled && !isUnlockedNow()){
            toast("Introduce el PIN");
            return;
          }
          hideLockOverlay();
        }
      });
    }

    if(btnReset) btnReset.onclick = resetAll;

    if(btnCopy){
      btnCopy.onclick = async ()=>{
        try{
          await navigator.clipboard.writeText(location.href);
          toast("Enlace copiado 🔗");
        }catch(e){
          toast("No se pudo copiar");
        }
      };
    }
  })();

  /* =========================
     Hook “+” y navegación (reconectar por si algo cambió)
  ========================= */
  (function ensureNavAndFab(){
    const fab = $("fab");
    if(fab){
      fab.onclick = ()=>{
        // si estamos en contactos => nuevo amigo, si no => nuevo compromiso
        const contactsPaneVisible = $("contactsPane") && $("contactsPane").style.display !== "none";
        const settingsPaneVisible = $("settingsPane") && $("settingsPane").style.display !== "none";

        if(settingsPaneVisible){
          toast("En Ajustes no se crea nada");
          return;
        }

        if(contactsPaneVisible) openContactModal(null);
        else openCommitModal(null, null);
      };
    }
  })();

  /* =========================
     Exportar funciones reales (reemplaza stubs de la parte 1)
  ========================= */
  window.openCommitModal = openCommitModal;
  window.openContactModal = openContactModal;
  window.deleteCommit = deleteCommit;
  window.deleteContact = deleteContact;
  window.shareSnapshot = shareSnapshot;

  /* =========================
     Boot final (aplica pack, pinta, lock)
  ========================= */
  (function boot2(){
    // aplicar paquete si llega por enlace
    const applied = applyIncomingPack();

    // render
    renderAll();

    // si aplicó, aseguramos pestaña compromisos pendientes
    if(applied){
      // activar tab pendientes
      $("tabPending")?.classList.add("active");
      $("tabDone")?.classList.remove("active");
      // mostrar commitments pane
      const cp = $("commitmentsPane");
      const ap = $("contactsPane");
      const sp = $("settingsPane");
      if(cp) cp.style.display = "";
      if(ap) ap.style.display = "none";
      if(sp) sp.style.display = "none";
    }

    // lock
    if(settings.pinEnabled && !isUnlockedNow()){
      showLockOverlay();
    }else{
      hideLockOverlay();
    }
  })();

})();