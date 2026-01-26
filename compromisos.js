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
     ✅ UI FIX: botón Texto grande arriba derecha, alineado con el título
     (lo ponemos en el hueco del recuadro rojo)
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
        /* Pills debajo, sin mover su sitio */
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
     Accesibilidad: Texto grande (FUNCIONA SIEMPRE)
  ========================= */
  function setTextScale(big){
    // Ajuste simple y robusto: tocamos variable CSS y clase
    const root = document.documentElement;
    root.style.setProperty("--fs", big ? "18px" : "16px");
    root.classList.toggle("bigText", !!big);
    save(A11Y_KEY, { big: !!big });
  }
  function toggleTextScale(){
    const cur = load(A11Y_KEY, { big:false });
    const next = !cur.big;
    setTextScale(next);
    toast(next ? "🔎 Texto grande: ON" : "🔎 Texto grande: OFF");
  }

  // ✅ Enganche fuerte: aunque algo falle, el click siempre llama a toggleTextScale()
  function bindA11yButtons(){
    const top = $("btnA11yTop");
    const inSettings = $("btnA11y");
    if(top){
      top.addEventListener("click", (e)=>{ e.preventDefault(); toggleTextScale(); }, { passive:false });
      top.addEventListener("touchend", (e)=>{ e.preventDefault(); toggleTextScale(); }, { passive:false });
    }
    if(inSettings){
      inSettings.addEventListener("click", (e)=>{ e.preventDefault(); toggleTextScale(); }, { passive:false });
      inSettings.addEventListener("touchend", (e)=>{ e.preventDefault(); toggleTextScale(); }, { passive:false });
    }
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

    items.forEach((it, idx)=>{
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

      card.querySelector('[data-act="edit"]').addEventListener("click", ()=> openCommitModal(it.id)); // (def en parte 2)
      card.querySelector('[data-act="del"]').addEventListener("click", ()=> deleteCommit(it.id));     // (def en parte 2)

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

        card.querySelector('[data-act="new"]').addEventListener("click", ()=> openCommitModal(null, c.id)); // parte 2
        card.querySelector('[data-act="edit"]').addEventListener("click", ()=> openContactModal(c.id));    // parte 2
        card.querySelector('[data-act="del"]').addEventListener("click", ()=> deleteContact(c.id));       // parte 2

        list.appendChild(card);
      });
  }

  function renderAll(){
    renderCommitments();
    renderContacts();
    updateCounts();
  }

  /* =========================
     FAB + binds base (parte 2 completa la lógica de modales)
  ========================= */
  function bindFab(){
    const fab = $("fab");
    if(!fab) return;
    fab.addEventListener("click", ()=>{
      if(pane === "contacts") openContactModal(null);    // parte 2
      else openCommitModal(null, null);                  // parte 2
    });
  }

  /* =========================
     Boot
  ========================= */
  const a11y = load(A11Y_KEY, { big:false });
  setTextScale(!!a11y.big);

  bindA11yButtons();
  bindNav();
  bindFab();
  renderAll();

  // Exponemos “stubs” para que no reviente si algo llama antes de la parte 2
  // (en la parte 2 se reemplazan por funciones reales)
  window.openCommitModal = window.openCommitModal || function(){ toast("Abre modal compromiso (pendiente parte 2)"); };
  window.openContactModal = window.openContactModal || function(){ toast("Abre modal amigo (pendiente parte 2)"); };
  window.deleteCommit = window.deleteCommit || function(){ toast("Eliminar compromiso (pendiente parte 2)"); };
  window.deleteContact = window.deleteContact || function(){ toast("Eliminar amigo (pendiente parte 2)"); };

})();