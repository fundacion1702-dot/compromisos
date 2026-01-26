/* compromisos.js */
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
    toast._tm = setTimeout(()=> t.classList.remove("show"), 2000);
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
     ✅ UI FIX: Botón Texto grande SIEMPRE arriba a la derecha
     (sin importar el modo texto grande)
  ========================= */
  (function injectA11yTopPlacement(){
    try{
      const st = document.createElement("style");
      st.textContent = `
        .topbarInner{ position:relative !important; }
        #btnA11yTop{
          position:absolute !important;
          top:12px !important;
          right:12px !important;
          z-index:50 !important;
          pointer-events:auto !important;
          white-space:nowrap !important;
        }
        .brand{
          padding-right:220px !important;
        }
        .titleBox{
          max-width:calc(100% - 220px) !important;
        }
        .bigText .brand{ padding-right:250px !important; }
        .bigText .titleBox{ max-width:calc(100% - 250px) !important; }
        @media (max-width:520px){
          .brand{ padding-right:0 !important; }
          .titleBox{ max-width:100% !important; }
          #btnA11yTop{ right:10px !important; top:10px !important; }
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
    pin:null,
    autoLockMin:0,
    rememberMin:0,
    notifEnabled:false
  });
  let received = load(RECEIVED_KEY, { c:0, lastAt:null });

  let pane = "commitments"; // commitments | contacts | settings
  let view = "pending";     // pending | done

  // UI state
  let contactsQuery = "";
  let friendFilterId = "";

  /* =========================
     Accesibilidad: Texto grande (toggle)
  ========================= */
  function setTextScale(big){
    const root = document.documentElement;
    root.style.setProperty("--fs", big ? "18px" : "16px");
    document.body.classList.toggle("bigText", !!big);

    const label = big ? "🔎 Texto normal" : "🔎 Texto grande";
    const b1 = $("btnA11yTop");
    const b2 = $("btnA11y");
    if(b1) b1.textContent = label;
    if(b2) b2.textContent = label;

    save(A11Y_KEY, { big: !!big });
  }

  function toggleTextScale(){
    const cur = load(A11Y_KEY, { big:false });
    const next = !cur.big;
    setTextScale(next);
    toast(next ? "🔎 Texto grande: activado" : "🔎 Texto grande: desactivado");
  }

  function bindA11yButtons(){
    const top = $("btnA11yTop");
    const inSettings = $("btnA11y");

    const bindOne = (el)=>{
      if(!el) return;
      el.addEventListener("click", (e)=>{ e.preventDefault(); toggleTextScale(); }, { passive:false });
      el.addEventListener("touchend", (e)=>{ e.preventDefault(); toggleTextScale(); }, { passive:false });
    };

    bindOne(top);
    bindOne(inSettings);
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
     Filtro compromisos por amigo (select)
  ========================= */
  function bindFriendFilter(){
    const sel = $("selFriendFilter");
    if(!sel) return;

    sel.addEventListener("change", ()=>{
      friendFilterId = sel.value || "";
      renderCommitments();
    });
  }

  function fillFriendFilterOptions(){
    const sel = $("selFriendFilter");
    if(!sel) return;

    const cur = sel.value || friendFilterId || "";
    sel.innerHTML = `<option value="">Todos</option>` +
      contacts
        .slice()
        .sort((a,b)=> (a.name||"").localeCompare(b.name||"", "es"))
        .map(c=> `<option value="${esc(c.id)}">${esc(c.name||"Sin nombre")}</option>`)
        .join("");

    // restaura
    sel.value = cur;
    friendFilterId = sel.value || "";
  }

  /* =========================
     Buscador amigos (input)
  ========================= */
  function bindContactsSearch(){
    const inp = $("contactsSearch");
    if(!inp) return;

    inp.addEventListener("input", ()=>{
      contactsQuery = String(inp.value || "").trim().toLowerCase();
      renderContacts();
    });
  }

  /* =========================
     Render
  ========================= */
  function normalizedWho(item){
    // Si tiene whoId y sigue existiendo el contacto, usamos su nombre actual
    if(item.whoId){
      const c = contacts.find(x=>x.id===item.whoId);
      if(c && c.name) return c.name;
    }
    // Si guardamos whoName (para “sin amigo”), se usa
    if(item.whoName) return item.whoName;
    return "Sin nombre";
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

    let items = data.filter(x=> view==="pending" ? !x.done : x.done);

    // ✅ filtro por amigo (solo si el compromiso está ligado a un amigo guardado)
    if(friendFilterId){
      items = items.filter(x=> x.whoId === friendFilterId);
    }

    items = items
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

      card.querySelector('[data-act="edit"]').addEventListener("click", ()=> openCommitModal(it.id, null));
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

    let items = contacts.slice().sort((a,b)=> (a.name||"").localeCompare(b.name||"", "es"));

    // ✅ buscador
    if(contactsQuery){
      items = items.filter(c=>{
        const n = (c.name||"").toLowerCase();
        const note = (c.note||"").toLowerCase();
        return n.includes(contactsQuery) || note.includes(contactsQuery);
      });
    }

    if(empty) empty.style.display = items.length ? "none" : "block";

    items.forEach((c)=>{
      const card = document.createElement("div");
      card.className = "card";

      // ✅ Quitado “Amigo guardado en tu móvil.” (si no hay nota, no mostramos nada)
      const descHtml = c.note ? `<div class="desc">${esc(c.note)}</div>` : ``;

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
        ${descHtml}
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
     MODALES base
  ========================= */
  function lockBodyScroll(lock){
    try{
      document.body.style.overflow = lock ? "hidden" : "";
    }catch(e){}
  }

  function openBackdrop(id){
    const bd = $(id);
    if(!bd) return;
    bd.setAttribute("aria-hidden","false");
    bd.classList.add("show");
    lockBodyScroll(true);
  }

  function closeBackdrop(id){
    const bd = $(id);
    if(!bd) return;
    bd.setAttribute("aria-hidden","true");
    bd.classList.remove("show");
    lockBodyScroll(false);
  }

  /* =========================
     Confirm modal (sin alert)
  ========================= */
  function confirmModal(title, msg, yesText, noText){
    return new Promise((resolve)=>{
      const bd = $("confirmBackdrop");
      if(!bd) return resolve(false);

      const t = $("confirmTitle");
      const m = $("confirmMsg");
      const yes = $("confirmYes");
      const no = $("confirmNo");
      const x = $("confirmClose");

      if(t) t.textContent = title || "Confirmar";
      if(m) m.textContent = msg || "";
      if(yes) yes.textContent = yesText || "Sí, continuar";
      if(no) no.textContent = noText || "Cancelar";

      const cleanup = ()=>{
        if(yes) yes.onclick = null;
        if(no) no.onclick = null;
        if(x) x.onclick = null;
        closeBackdrop("confirmBackdrop");
      };

      if(yes) yes.onclick = ()=>{ cleanup(); resolve(true); };
      if(no) no.onclick = ()=>{ cleanup(); resolve(false); };
      if(x) x.onclick = ()=>{ cleanup(); resolve(false); };

      openBackdrop("confirmBackdrop");
    });
  }

  /* =========================
     CONTACTOS: modal
  ========================= */
  function openContactModal(contactId){
    const bd = $("cBackdrop");
    if(!bd) return;

    const title = $("cModalTitle");
    const name = $("cName");
    const note = $("cNote");

    let existing = null;
    if(contactId){
      existing = contacts.find(x=>x.id===contactId) || null;
    }

    if(title) title.textContent = existing ? "Editar amigo" : "Nuevo amigo";
    if(name) name.value = existing?.name || "";
    if(note) note.value = existing?.note || "";

    openBackdrop("cBackdrop");

    setTimeout(()=>{ try{ name && name.focus(); }catch(e){} }, 60);

    const close = ()=> closeBackdrop("cBackdrop");

    const btnX = $("cBtnClose");
    const btnC = $("cBtnCancel");
    const btnS = $("cBtnSave");

    if(btnX) btnX.onclick = close;
    if(btnC) btnC.onclick = close;

    if(btnS){
      btnS.onclick = async ()=>{
        const n = (name?.value || "").trim();
        const nt = (note?.value || "").trim();

        if(!n){
          toast("Escribe un nombre.");
          try{ name && name.focus(); }catch(e){}
          return;
        }

        if(existing){
          existing.name = n;
          existing.note = nt || "";
        }else{
          contacts.push({ id: uid(), name:n, note: nt || "" });
        }

        save(CONTACTS_KEY, contacts);
        // refresca filtros / selects
        fillFriendFilterOptions();
        renderContacts();
        renderCommitments();

        close();
        toast(existing ? "✅ Amigo actualizado" : "✅ Amigo creado");
      };
    }
  }

  async function deleteContact(contactId){
    const c = contacts.find(x=>x.id===contactId);
    if(!c) return;

    const ok = await confirmModal(
      "Eliminar amigo",
      `¿Seguro que quieres eliminar a "${c.name}"?`,
      "Sí, eliminar",
      "Cancelar"
    );
    if(!ok) return;

    // Si hay compromisos ligados a ese amigo, no los borramos: se quedarán con whoName si existe.
    // Para que no se queden en blanco, guardamos whoName si no existe ya.
    data.forEach(it=>{
      if(it.whoId === contactId){
        if(!it.whoName) it.whoName = c.name || "Sin nombre";
      }
    });
    save(KEY, data);

    contacts = contacts.filter(x=>x.id!==contactId);
    save(CONTACTS_KEY, contacts);

    // si el filtro estaba puesto en ese amigo, lo limpiamos
    if(friendFilterId === contactId){
      friendFilterId = "";
      const sel = $("selFriendFilter");
      if(sel) sel.value = "";
    }

    renderAll();
    toast("🗑️ Amigo eliminado");
  }

  /* =========================
     COMPROMISOS: modal
  ========================= */
  function fillContactSelect(selectedId){
    const sel = $("fContact");
    if(!sel) return;

    const opts = [];
    opts.push(`<option value="">— Sin amigo (escribir nombre) —</option>`);
    contacts
      .slice()
      .sort((a,b)=> (a.name||"").localeCompare(b.name||"", "es"))
      .forEach(c=>{
        opts.push(`<option value="${esc(c.id)}">${esc(c.name||"Sin nombre")}</option>`);
      });

    sel.innerHTML = opts.join("");
    sel.value = selectedId || "";
  }

  function syncCustomWho(){
    const sel = $("fContact");
    const wrap = $("customWhoField");
    const who = $("fWho");
    const v = sel ? sel.value : "";
    const show = !v;
    if(wrap) wrap.style.display = show ? "" : "none";
    if(who){
      if(!show) who.value = "";
    }
  }

  function openCommitModal(commitId, presetFriendId){
    const bd = $("backdrop");
    if(!bd) return;

    const title = $("modalTitle");
    const sel = $("fContact");
    const who = $("fWho");
    const what = $("fWhat");
    const when = $("fWhen");
    const remind = $("fRemind");
    const after = $("fAfter");

    let existing = null;
    if(commitId){
      existing = data.find(x=>x.id===commitId) || null;
    }

    if(title) title.textContent = existing ? "Editar compromiso" : "Nuevo compromiso";

    // Carga select
    const selected = existing?.whoId || presetFriendId || "";
    fillContactSelect(selected);

    // Si no hay amigo seleccionado, usa whoName (si existe)
    if(who) who.value = (!selected && existing?.whoName) ? existing.whoName : "";

    if(what) what.value = existing?.what || "";
    if(when) when.value = existing?.when ? String(existing.when).slice(0,16) : ""; // datetime-local
    if(remind) remind.value = String(existing?.remindMin ?? 0);
    if(after) after.value = String(existing?.afterMin ?? 0);

    syncCustomWho();

    if(sel){
      sel.onchange = ()=>{
        syncCustomWho();
      };
    }

    openBackdrop("backdrop");
    setTimeout(()=>{ try{ what && what.focus(); }catch(e){} }, 70);

    const close = ()=> closeBackdrop("backdrop");

    const btnX = $("btnClose");
    const btnC = $("btnCancel");
    const btnS = $("btnSave");

    if(btnX) btnX.onclick = close;
    if(btnC) btnC.onclick = close;

    if(btnS){
      btnS.onclick = ()=>{
        const whoId = sel ? (sel.value || "") : "";
        const whoName = who ? (who.value || "").trim() : "";
        const text = what ? (what.value || "").trim() : "";
        const whenVal = when ? (when.value || "") : "";
        const remindMin = remind ? Number(remind.value || 0) : 0;
        const afterMin = after ? Number(after.value || 0) : 0;

        if(!whoId && !whoName){
          toast("Elige un amigo o escribe un nombre.");
          try{ who && who.focus(); }catch(e){}
          return;
        }
        if(!text){
          toast("Escribe qué se acordó.");
          try{ what && what.focus(); }catch(e){}
          return;
        }

        const isoWhen = whenVal ? new Date(whenVal).toISOString() : null;

        if(existing){
          existing.whoId = whoId || null;
          existing.whoName = whoId ? (existing.whoName || null) : whoName || null;
          existing.what = text;
          existing.when = isoWhen;
          existing.remindMin = remindMin;
          existing.afterMin = afterMin;
          existing.updatedAt = new Date().toISOString();
        }else{
          data.push({
            id: uid(),
            whoId: whoId || null,
            whoName: whoId ? null : (whoName || null),
            what: text,
            when: isoWhen,
            remindMin,
            afterMin,
            done:false,
            createdAt: new Date().toISOString(),
            updatedAt:null,
            doneAt:null
          });
        }

        save(KEY, data);
        close();
        renderCommitments();
        toast(existing ? "✅ Compromiso actualizado" : "✅ Compromiso guardado");

        // abrir compartir (opcional)
        try{
          openShareModal(existing ? existing.id : data[data.length-1].id);
        }catch(e){}
      };
    }
  }

  async function deleteCommit(commitId){
    const it = data.find(x=>x.id===commitId);
    if(!it) return;

    const who = normalizedWho(it);
    const ok = await confirmModal(
      "Eliminar compromiso",
      `¿Eliminar el compromiso con "${who}"?`,
      "Sí, eliminar",
      "Cancelar"
    );
    if(!ok) return;

    data = data.filter(x=>x.id!==commitId);
    save(KEY, data);
    renderCommitments();
    toast("🗑️ Compromiso eliminado");
  }

  /* =========================
     SHARE modal (simple)
  ========================= */
  function openShareModal(commitId){
    const bd = $("shareBackdrop");
    if(!bd) return;

    const it = data.find(x=>x.id===commitId);
    if(!it) return;

    const who = normalizedWho(it);
    const due = it.when ? fmtDate(it.when) : "Sin fecha";
    const text = `📌 Compromiso\n\n👤 Con: ${who}\n📝 Qué: ${it.what || "—"}\n⏰ Para: ${due}\n\n(Hecho con Compromisos)`;

    const box = $("shareTextBox");
    const urlBox = $("shareUrlBox");
    const title = $("shareTitle");

    if(title) title.textContent = `Paquete listo para compartir (${who})`;

    // Link simple (no rompemos nada): página actual sin parámetros
    const baseUrl = location.href.split("#")[0].split("?")[0];

    if(box) box.textContent = text;
    if(urlBox) urlBox.textContent = baseUrl;

    const close = ()=> closeBackdrop("shareBackdrop");

    const x = $("shareClose");
    const done = $("shareCancel");
    const copyUrl = $("shareCopyUrl");
    const copyAll = $("shareCopyAll");
    const send = $("shareSend");

    if(x) x.onclick = close;
    if(done) done.onclick = close;

    const doCopy = async (str)=>{
      try{
        await navigator.clipboard.writeText(str);
        toast("📋 Copiado");
      }catch(e){
        toast("No se pudo copiar (tu móvil lo bloqueó).");
      }
    };

    if(copyUrl) copyUrl.onclick = ()=> doCopy(baseUrl);
    if(copyAll) copyAll.onclick = ()=> doCopy(text + "\n\n" + baseUrl);

    if(send){
      send.onclick = async ()=>{
        try{
          if(navigator.share){
            await navigator.share({ text: text, url: baseUrl });
          }else{
            await doCopy(text + "\n\n" + baseUrl);
          }
        }catch(e){
          // si cancela, no hacemos nada
        }
      };
    }

    openBackdrop("shareBackdrop");
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
     Ajustes: PIN / Notifs (básico para no romper UI)
  ========================= */
  function bindSettings(){
    const swPin = $("swPin");
    const btnChangePin = $("btnChangePin");
    const btnLockNow = $("btnLockNow");
    const selAutoLock = $("selAutoLock");
    const selRemember = $("selRemember");

    const swNotif = $("swNotif");
    const btnNotifPerm = $("btnNotifPerm");

    // Init selects
    if(selAutoLock) selAutoLock.value = String(settings.autoLockMin ?? 0);
    if(selRemember) selRemember.value = String(settings.rememberMin ?? 0);

    const setSwitch = (el, on)=>{
      if(!el) return;
      el.setAttribute("aria-checked", on ? "true" : "false");
      el.classList.toggle("on", !!on);
    };

    setSwitch(swPin, !!settings.pinEnabled);
    setSwitch(swNotif, !!settings.notifEnabled);

    const togglePin = async ()=>{
      if(!settings.pinEnabled){
        // activar -> configurar pin
        await openPinModal(true);
      }else{
        const ok = await confirmModal(
          "Desactivar PIN",
          "¿Quieres desactivar el bloqueo con PIN?",
          "Sí, desactivar",
          "Cancelar"
        );
        if(!ok) return;
        settings.pinEnabled = false;
        settings.pin = null;
        save(SETTINGS_KEY, settings);
        setSwitch(swPin, false);
        toast("🔓 PIN desactivado");
      }
    };

    if(swPin){
      swPin.addEventListener("click", togglePin);
      swPin.addEventListener("keydown", (e)=>{
        if(e.key==="Enter" || e.key===" "){ e.preventDefault(); togglePin(); }
      });
    }

    if(btnChangePin) btnChangePin.onclick = ()=> openPinModal(false);
    if(btnLockNow) btnLockNow.onclick = ()=> lockAppNow();

    if(selAutoLock){
      selAutoLock.addEventListener("change", ()=>{
        settings.autoLockMin = Number(selAutoLock.value || 0);
        save(SETTINGS_KEY, settings);
        toast("✅ Auto-bloqueo guardado");
      });
    }

    if(selRemember){
      selRemember.addEventListener("change", ()=>{
        settings.rememberMin = Number(selRemember.value || 0);
        save(SETTINGS_KEY, settings);
        toast("✅ Recordatorio guardado");
      });
    }

    if(btnNotifPerm){
      btnNotifPerm.onclick = async ()=>{
        try{
          if(!("Notification" in window)){
            toast("Este navegador no soporta notificaciones.");
            return;
          }
          const perm = await Notification.requestPermission();
          if(perm === "granted"){
            settings.notifEnabled = true;
            save(SETTINGS_KEY, settings);
            setSwitch(swNotif, true);
            toast("🔔 Notificaciones activadas");
          }else{
            toast("No permitido.");
          }
        }catch(e){
          toast("No se pudo pedir permiso.");
        }
      };
    }

    if(swNotif){
      const toggleNotif = async ()=>{
        settings.notifEnabled = !settings.notifEnabled;
        save(SETTINGS_KEY, settings);
        setSwitch(swNotif, !!settings.notifEnabled);
        toast(settings.notifEnabled ? "🔔 Notificaciones ON" : "🔕 Notificaciones OFF");
      };
      swNotif.addEventListener("click", toggleNotif);
      swNotif.addEventListener("keydown", (e)=>{
        if(e.key==="Enter" || e.key===" "){ e.preventDefault(); toggleNotif(); }
      });
    }

    // Reset all
    const btnResetAll = $("btnResetAll");
    if(btnResetAll){
      btnResetAll.onclick = async ()=>{
        const ok = await confirmModal(
          "Borrar todo",
          "Esto borrará compromisos, amigos y ajustes del móvil. ¿Continuar?",
          "Sí, borrar",
          "Cancelar"
        );
        if(!ok) return;
        localStorage.removeItem(KEY);
        localStorage.removeItem(CONTACTS_KEY);
        localStorage.removeItem(SETTINGS_KEY);
        localStorage.removeItem(RECEIVED_KEY);
        localStorage.removeItem(A11Y_KEY);

        data = [];
        contacts = [];
        settings = {
          pinEnabled:false, pin:null,
          autoLockMin:0, rememberMin:0,
          notifEnabled:false
        };
        received = { c:0, lastAt:null };
        friendFilterId = "";
        contactsQuery = "";

        // limpiar inputs UI
        const inp = $("contactsSearch");
        if(inp) inp.value = "";
        const sel = $("selFriendFilter");
        if(sel) sel.value = "";

        renderAll();
        toast("🧹 Todo borrado");
      };
    }
  }

  /* =========================
     PIN modal + Lock overlay (simple)
  ========================= */
  let _lastUnlockAt = 0;
  let _hiddenAt = 0;

  function lockAppNow(){
    if(!settings.pinEnabled || !settings.pin) return;
    _lastUnlockAt = 0;
    showLockOverlay(true);
  }

  function showLockOverlay(show){
    const ov = $("lockOverlay");
    if(!ov) return;
    ov.setAttribute("aria-hidden", show ? "false" : "true");
    ov.classList.toggle("show", !!show);
    lockBodyScroll(show);
    if(show){
      resetPinDots();
    }
  }

  function resetPinDots(){
    ["d1","d2","d3","d4"].forEach(id=>{
      const el = $(id);
      if(el) el.classList.remove("on");
    });
  }

  function setPinDots(n){
    ["d1","d2","d3","d4"].forEach((id, idx)=>{
      const el = $(id);
      if(el) el.classList.toggle("on", idx < n);
    });
  }

  async function openPinModal(firstTime){
    const bd = $("pinBackdrop");
    if(!bd) return;

    const title = $("pinTitle");
    const hint = $("pinHint");
    const oldWrap = $("pinOldWrap");
    const old = $("pinOld");
    const nw = $("pinNew");
    const nw2 = $("pinNew2");

    const hasPin = !!settings.pin;

    if(title) title.textContent = firstTime ? "Configurar PIN" : "Cambiar PIN";

    if(hint){
      hint.textContent = firstTime
        ? "Crea un PIN de 4 dígitos para bloquear la app."
        : (hasPin ? "Introduce tu PIN actual y luego el nuevo." : "Crea tu PIN de 4 dígitos.");
    }

    if(oldWrap) oldWrap.style.display = (!firstTime && hasPin) ? "" : "none";
    if(old) old.value = "";
    if(nw) nw.value = "";
    if(nw2) nw2.value = "";

    openBackdrop("pinBackdrop");
    setTimeout(()=>{ try{ (oldWrap && oldWrap.style.display!=="none" ? old : nw)?.focus(); }catch(e){} }, 70);

    const close = ()=> closeBackdrop("pinBackdrop");

    const x = $("pinClose");
    const c = $("pinCancel");
    const ok = $("pinOk");

    if(x) x.onclick = close;
    if(c) c.onclick = close;

    if(ok){
      ok.onclick = ()=>{
        const oldVal = (old?.value || "").trim();
        const p1 = (nw?.value || "").trim();
        const p2 = (nw2?.value || "").trim();

        if(!/^\d{4}$/.test(p1) || !/^\d{4}$/.test(p2)){
          toast("El PIN debe tener 4 dígitos.");
          return;
        }
        if(p1 !== p2){
          toast("Los PIN no coinciden.");
          return;
        }

        if(!firstTime && hasPin){
          if(oldVal !== String(settings.pin)){
            toast("PIN actual incorrecto.");
            return;
          }
        }

        settings.pinEnabled = true;
        settings.pin = p1;
        save(SETTINGS_KEY, settings);

        close();
        toast("✅ PIN guardado");
        // refresca switch
        const swPin = $("swPin");
        if(swPin){
          swPin.setAttribute("aria-checked","true");
          swPin.classList.add("on");
        }
      };
    }
  }

  function bindLockOverlay(){
    const close = $("lockClose");
    if(close) close.onclick = ()=> showLockOverlay(false);

    const btnCopy = $("btnLockCopyLink");
    if(btnCopy){
      btnCopy.onclick = async ()=>{
        try{
          await navigator.clipboard.writeText(location.href.split("#")[0]);
          toast("🔗 Enlace copiado");
        }catch(e){
          toast("No se pudo copiar.");
        }
      };
    }

    const btnReset = $("btnLockReset");
    if(btnReset){
      btnReset.onclick = async ()=>{
        const ok = await confirmModal(
          "Borrar todo",
          "Esto borrará todos los datos del móvil. ¿Continuar?",
          "Sí, borrar",
          "Cancelar"
        );
        if(!ok) return;
        localStorage.clear();
        location.reload();
      };
    }

    // keypad
    const keypad = $("keypad");
    if(!keypad) return;

    let buf = "";

    keypad.addEventListener("click", (e)=>{
      const b = e.target.closest("button");
      if(!b) return;
      const k = b.getAttribute("data-k");
      if(!k) return;

      if(k === "del"){
        buf = buf.slice(0,-1);
        setPinDots(buf.length);
        return;
      }

      if(k === "ok"){
        if(buf.length !== 4){
          toast("PIN incompleto");
          return;
        }
        if(String(settings.pin||"") === buf){
          _lastUnlockAt = Date.now();
          showLockOverlay(false);
          toast("✅ Desbloqueado");
        }else{
          toast("PIN incorrecto");
          buf = "";
          setPinDots(0);
        }
        return;
      }

      if(/^\d$/.test(k)){
        if(buf.length >= 4) return;
        buf += k;
        setPinDots(buf.length);
      }
    });
  }

  function bindAutoLockWatcher(){
    document.addEventListener("visibilitychange", ()=>{
      if(document.hidden){
        _hiddenAt = Date.now();
      }else{
        if(!settings.pinEnabled || !settings.pin) return;

        // remember window
        const rememberMs = (Number(settings.rememberMin||0) * 60 * 1000);
        if(rememberMs > 0 && _lastUnlockAt && (Date.now() - _lastUnlockAt) <= rememberMs){
          return; // no lock
        }

        // auto-lock on leaving
        const lockMs = (Number(settings.autoLockMin||0) * 60 * 1000);
        if(lockMs === 0){
          showLockOverlay(true);
          return;
        }
        if(_hiddenAt && (Date.now() - _hiddenAt) >= lockMs){
          showLockOverlay(true);
        }
      }
    });
  }

  /* =========================
     Install banner (no-op seguro)
  ========================= */
  function bindInstallBanner(){
    const hide = $("btnHideBanner");
    if(hide){
      hide.onclick = ()=>{
        const b = $("installBanner");
        if(b){
          b.setAttribute("aria-hidden","true");
          b.classList.remove("show");
        }
      };
    }
  }

  /* =========================
     Boot
  ========================= */
  function boot(){
    // aplica a11y al arrancar
    const a11y = load(A11Y_KEY, { big:false });
    setTextScale(!!a11y.big);

    bindA11yButtons();
    bindNav();
    bindFab();

    bindContactsSearch();
    bindFriendFilter();

    bindSettings();
    bindLockOverlay();
    bindAutoLockWatcher();
    bindInstallBanner();

    // Botón cerrar en otros modales
    const btnClose = $("btnClose");
    if(btnClose) btnClose.onclick = ()=> closeBackdrop("backdrop");
    const cBtnClose = $("cBtnClose");
    if(cBtnClose) cBtnClose.onclick = ()=> closeBackdrop("cBackdrop");
    const pinClose = $("pinClose");
    if(pinClose) pinClose.onclick = ()=> closeBackdrop("pinBackdrop");
    const shareClose = $("shareClose");
    if(shareClose) shareClose.onclick = ()=> closeBackdrop("shareBackdrop");

    renderAll();

    // Si hay PIN activo, al arrancar bloqueamos (por seguridad)
    if(settings.pinEnabled && settings.pin){
      showLockOverlay(true);
    }
  }

  if(document.readyState === "loading") document.addEventListener("DOMContentLoaded", boot);
  else boot();

})();