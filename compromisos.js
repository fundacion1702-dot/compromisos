/* compromisos.js — PARTE 1/2
   ⚠️ No probar hasta pegar también PARTE 2/2 (cierra la IIFE y arranca la app)
*/
(function(){
  "use strict";

  /* =========================
     Utils
     ========================= */
  const $ = (id)=> document.getElementById(id);

  function nowIso(){ return new Date().toISOString(); }

  function uid(){
    return "id_" + Math.random().toString(16).slice(2) + "_" + Date.now().toString(16);
  }

  function clamp(n, a, b){ n = Number(n||0); return Math.max(a, Math.min(b, n)); }

  function escapeHtml(s){
    return String(s ?? "")
      .replaceAll("&","&amp;")
      .replaceAll("<","&lt;")
      .replaceAll(">","&gt;")
      .replaceAll('"',"&quot;")
      .replaceAll("'","&#039;");
  }

  function toast(msg, ms=1900){
    const el = $("toast");
    if(!el) return;
    el.textContent = String(msg||"");
    el.classList.add("show");
    clearTimeout(toast._t);
    toast._t = setTimeout(()=> el.classList.remove("show"), ms);
  }

  function fmtDate(iso){
    if(!iso) return "";
    const d = (iso instanceof Date) ? iso : new Date(iso);
    if(!isFinite(d.getTime())) return "";
    const pad = (x)=> String(x).padStart(2,"0");
    return `${pad(d.getDate())}/${pad(d.getMonth()+1)}/${d.getFullYear()} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
  }

  function isOverdue(iso){
    if(!iso) return false;
    const t = new Date(iso).getTime();
    if(!isFinite(t)) return false;
    return Date.now() > t;
  }

  /* =========================
     Storage
     ========================= */
  function load(key, fallback){
    try{
      const raw = localStorage.getItem(key);
      if(raw == null) return fallback;
      return JSON.parse(raw);
    }catch(e){
      return fallback;
    }
  }

  function save(key, value){
    try{
      localStorage.setItem(key, JSON.stringify(value));
    }catch(e){}
  }

  /* =========================
     Keys / state
     ========================= */
  const KEY = "compromisos.items.v1";
  const CONTACTS_KEY = "compromisos.contacts.v1";
  const EVENTS_KEY = "compromisos.events.v1";

  const SETTINGS_KEY = "compromisos.settings.v1";
  const A11Y_KEY = "compromisos.a11y.v1";

  const RECEIVED_KEY = "compromisos.received.v1";

  const REMIND_FIRED_KEY = "compromisos.remindFired.v1";
  const AFTER_FIRED_KEY  = "compromisos.afterFired.v1";

  // Tipos de eventos (para paquetes)
  const T = {
    CREATE: "C",
    EDIT:   "E",
    DONE:   "D",
    REOPEN: "R",
    DELETE: "X"
  };

  // Datos
  let data = Array.isArray(load(KEY, [])) ? load(KEY, []) : [];
  let contacts = Array.isArray(load(CONTACTS_KEY, [])) ? load(CONTACTS_KEY, []) : [];
  let events = Array.isArray(load(EVENTS_KEY, [])) ? load(EVENTS_KEY, []) : [];

  // Recibidos
  let received = load(RECEIVED_KEY, { c:0, last:null });
  if(!received || typeof received !== "object") received = { c:0, last:null };

  // Fired maps (anti-duplicados notificación)
  let firedMap  = load(REMIND_FIRED_KEY, {});
  let afterFired = load(AFTER_FIRED_KEY, {});
  if(!firedMap || typeof firedMap !== "object") firedMap = {};
  if(!afterFired || typeof afterFired !== "object") afterFired = {};

  // Settings
  const settingsDefault = {
    pinEnabled: false,
    pinHash: "",        // hash simple (no criptográfico fuerte; suficiente para app local)
    autoLockMin: 0,     // 0 inmediato
    rememberMin: 0,     // 0 no recordar
    notifEnabled: false,
    unlockedUntil: 0    // epoch ms
  };
  let settings = Object.assign({}, settingsDefault, load(SETTINGS_KEY, settingsDefault) || {});
  settings.autoLockMin = clamp(settings.autoLockMin, 0, 10);
  settings.rememberMin = clamp(settings.rememberMin, 0, 60);

  /* =========================
     Accesibilidad (Texto grande)
     ========================= */
  function setTextScale(big){
    const v = !!big;
    const root = document.documentElement;
    root.style.setProperty("--fs", v ? "18px" : "16px");
    root.style.setProperty("--fsBig", v ? "20px" : "18px");
    save(A11Y_KEY, { big: v });
  }

  function toggleTextScale(){
    const a11y = load(A11Y_KEY, { big:false }) || { big:false };
    const next = !a11y.big;
    setTextScale(next);
    toast(next ? "🔎 Texto grande: activado" : "🔎 Texto grande: normal");
  }

  /* =========================
     Confirm modal (propio)
     ========================= */
  const Confirm = {
    _resolver: null,
    async open({ title="Confirmar", msg="", yesText="Sí, continuar", noText="Cancelar", danger=false } = {}){
      const bd = $("confirmBackdrop");
      const t  = $("confirmTitle");
      const m  = $("confirmMsg");
      const y  = $("confirmYes");
      const n  = $("confirmNo");
      const c  = $("confirmClose");

      if(!bd || !y || !n) return false;

      if(t) t.textContent = title;
      if(m) m.innerHTML = String(msg||"");
      y.textContent = yesText;
      n.textContent = noText;

      y.classList.toggle("danger", !!danger);

      bd.classList.add("show");
      bd.setAttribute("aria-hidden","false");

      return new Promise((resolve)=>{
        Confirm._resolver = resolve;

        const close = (val)=>{
          bd.classList.remove("show");
          bd.setAttribute("aria-hidden","true");
          Confirm._resolver = null;
          cleanup();
          resolve(!!val);
        };

        const onYes = ()=> close(true);
        const onNo  = ()=> close(false);
        const onEsc = (e)=>{ if(e.key === "Escape") close(false); };

        const cleanup = ()=>{
          y.removeEventListener("click", onYes);
          n.removeEventListener("click", onNo);
          c && c.removeEventListener("click", onNo);
          bd.removeEventListener("click", onBackdrop);
          document.removeEventListener("keydown", onEsc);
        };

        const onBackdrop = (e)=>{
          if(e.target === bd) close(false);
        };

        y.addEventListener("click", onYes);
        n.addEventListener("click", onNo);
        c && c.addEventListener("click", onNo);
        bd.addEventListener("click", onBackdrop);
        document.addEventListener("keydown", onEsc);
      });
    }
  };

  /* =========================
     Backdrops / modales base
     ========================= */
  function showBackdrop(id){
    const bd = $(id);
    if(!bd) return;
    bd.classList.add("show");
    bd.setAttribute("aria-hidden","false");
  }

  function hideBackdrop(id){
    const bd = $(id);
    if(!bd) return;
    bd.classList.remove("show");
    bd.setAttribute("aria-hidden","true");
  }

  /* =========================
     Hash PIN simple (local)
     ========================= */
  function pinHash4(pin){
    // hash simple suficiente para almacenamiento local (evita guardar el PIN plano)
    const s = String(pin||"");
    let h = 2166136261;
    for(let i=0;i<s.length;i++){
      h ^= s.charCodeAt(i);
      h = Math.imul(h, 16777619);
    }
    return "h" + (h >>> 0).toString(16);
  }

  /* =========================
     (PARTE 2/2) continúa abajo
     ========================= */

  // NO cierres la IIFE aquí. La PARTE 2/2 la cierra y arranca la app.

/* =========================
     UI helpers / panes
     ========================= */
  let pane = "commitments";  // commitments | contacts | settings
  let view = "pending";      // pending | done
  let editingId = null;
  let editingContactId = null;

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
    const a = $("tabPending");
    const b = $("tabDone");
    if(a) a.classList.add("active");
    if(b) b.classList.remove("active");
    renderCommitments();
  }
  function setViewDone(){
    view = "done";
    const a = $("tabDone");
    const b = $("tabPending");
    if(a) a.classList.add("active");
    if(b) b.classList.remove("active");
    renderCommitments();
  }

  /* =========================
     Contacts helpers
     ========================= */
  function contactById(id){ return contacts.find(c => c.id === id) || null; }

  function normalizedWho(item){
    if(item.whoId){
      const c = contactById(item.whoId);
      if(c && c.name) return c.name;
    }
    return item.whoName || "Sin nombre";
  }

  /* =========================
     Received badge / alerts
     ========================= */
  function renderReceivedBadge(){
    const el = $("bReceived");
    if(!el) return;
    const c = Math.max(0, Number(received?.c || 0));
    el.textContent = String(c);
  }

  function clearReceived(){
    received = { c:0, last: nowIso() };
    save(RECEIVED_KEY, received);
  }

  // en este proyecto “alerts” == vencidos (badge top ya está), pero dejamos hook por si luego
  function renderNotifAlertsBadge(){
    // ahora mismo no hay badge extra, lo dejamos para futuras mejoras
  }

  /* =========================
     Fired map cleanup
     ========================= */
  function firedKey(it){
    return `${it.id}|${it.when||""}|${Number(it.remindMin||0)}|${it.done?"1":"0"}`;
  }
  function afterKey(it){
    return `${it.id}|${it.afterAt||""}|${Number(it.afterMin||0)}|${it.done?"1":"0"}`;
  }

  function cleanupFiredMaps(){
    const liveA = new Set();
    const liveB = new Set();

    for(const it of data){
      if(it.done) continue;

      if(it.when && Number(it.remindMin||0) > 0){
        liveA.add(firedKey(it));
      }
      if(it.afterAt && Number(it.afterMin||0) > 0){
        liveB.add(afterKey(it));
      }
    }

    const nextA = {};
    for(const k of Object.keys(firedMap||{})){
      if(liveA.has(k)) nextA[k] = firedMap[k];
    }
    firedMap = nextA;
    save(REMIND_FIRED_KEY, firedMap);

    const nextB = {};
    for(const k of Object.keys(afterFired||{})){
      if(liveB.has(k)) nextB[k] = afterFired[k];
    }
    afterFired = nextB;
    save(AFTER_FIRED_KEY, afterFired);
  }

  /* =========================
     Events (paquetes)
     ========================= */
  function applyEvent(ev){
    if(!ev || ev.type == null) return false;
    if(events.some(x => x.id === ev.id)) return false;

    let changed = false;

    if(ev.type === T.CREATE){
      const p = ev.payload || {};
      const itemId = p.i || uid();

      const afterMin = Number(p.af || 0);
      const afterAt = p.aa || null;

      if(!data.some(x => x.id === itemId)){
        data.push({
          id: itemId,
          whoId: p.c || null,
          whoName: p.w || "Sin nombre",
          what: p.s || "",
          when: p.n || null,
          remindMin: Number(p.r || 0),

          afterMin: afterMin,
          afterAt: afterAt,

          done: false,
          createdAt: p.ca || ev.at,
          doneAt: null,
          updatedAt: null
        });
        changed = true;
      }else{
        const it = data.find(x => x.id === itemId);
        if(it){
          const before = JSON.stringify(it);
          it.whoId = p.c || null;
          it.whoName = p.w || it.whoName;
          it.what = p.s ?? it.what;
          it.when = (p.n ?? it.when) || null;
          it.remindMin = Number(p.r ?? it.remindMin ?? 0);

          if(p.af != null) it.afterMin = afterMin;
          if(p.aa != null) it.afterAt = afterAt;

          it.updatedAt = ev.at;
          changed = (JSON.stringify(it) !== before);
        }
      }
    }
    else if(ev.type === T.DONE){
      const p = ev.payload || {};
      const it = data.find(x => x.id === p.i);
      if(it && !it.done){
        it.done = true;
        it.doneAt = ev.at;
        it.updatedAt = ev.at;
        changed = true;
      }
    }
    else if(ev.type === T.REOPEN){
      const p = ev.payload || {};
      const it = data.find(x => x.id === p.i);
      if(it && it.done){
        it.done = false;
        it.doneAt = null;
        it.updatedAt = ev.at;
        changed = true;
      }
    }
    else if(ev.type === T.DELETE){
      const p = ev.payload || {};
      const before = data.length;
      data = data.filter(x => x.id !== p.i);
      changed = (data.length !== before);
    }
    else if(ev.type === T.EDIT){
      const p = ev.payload || {};
      const it = data.find(x => x.id === p.i);
      if(it){
        const before = JSON.stringify(it);
        if(p.w != null) it.whoName = p.w;
        if(p.c != null) it.whoId = p.c || null;
        if(p.s != null) it.what = p.s;
        if(p.n != null) it.when = p.n || null;
        if(p.r != null) it.remindMin = Number(p.r || 0);

        if(p.af != null) it.afterMin = Number(p.af || 0);
        if(p.aa != null) it.afterAt = p.aa || null;

        it.updatedAt = ev.at;
        changed = (JSON.stringify(it) !== before);
      }
    }

    events.push(ev);
    save(EVENTS_KEY, events);
    save(KEY, data);

    cleanupFiredMaps();
    return changed;
  }

  /* =========================
     Share (paquetes por enlace)
     ========================= */
  function encodeEvent(ev){
    const json = JSON.stringify(ev);
    const b64 = btoa(unescape(encodeURIComponent(json)));
    return b64.replaceAll("+","-").replaceAll("/","_").replaceAll("=","");
  }
  function decodeEvent(str){
    try{
      const b64 = str.replaceAll("-","+").replaceAll("_","/");
      const pad = b64 + "===".slice((b64.length + 3) % 4);
      const json = decodeURIComponent(escape(atob(pad)));
      return JSON.parse(json);
    }catch(e){
      return null;
    }
  }

  function currentBaseUrl(){
    const u = new URL(location.href);
    u.hash = "";
    u.searchParams.delete("p");
    return u.toString();
  }

  function makeShareUrl(eventB64){
    const u = new URL(currentBaseUrl());
    u.searchParams.set("p", eventB64);
    return u.toString();
  }

  async function copyText(txt){
    try{
      await navigator.clipboard.writeText(String(txt||""));
      return true;
    }catch(e){
      try{
        const ta = document.createElement("textarea");
        ta.value = String(txt||"");
        ta.style.position="fixed";
        ta.style.left="-9999px";
        document.body.appendChild(ta);
        ta.select();
        document.execCommand("copy");
        ta.remove();
        return true;
      }catch(_e){
        return false;
      }
    }
  }

  function openShareModal(eventObj){
    const bd = $("shareBackdrop");
    if(!bd) return;

    const shortBtn = $("shareShort");
    const longBtn  = $("shareLong");
    const textBox  = $("shareTextBox");
    const urlBox   = $("shareUrlBox");

    const evB64 = encodeEvent(eventObj);
    const url = makeShareUrl(evB64);

    let mode = "short";

    const render = ()=>{
      const p = eventObj.payload || {};
      const who = p.w || "Sin nombre";
      const what = p.s || "";
      const when = p.n ? fmtDate(p.n) : "Sin fecha";

      const shortTxt =
`📦 Compromiso
👤 ${who}
📝 ${what}
⏰ ${when}
🔗 ${url}`;

      const longTxt =
`📦 Compromiso (detallado)
• Con: ${who}
• Qué: ${what}
• Cuándo: ${when}
• Recordatorio: ${p.r ? (p.r+" min antes") : "Ninguno"}
• Aviso “desde ahora”: ${p.af ? (p.af+" min") : "No"}

Enlace:
${url}`;

      if(textBox) textBox.textContent = (mode === "short" ? shortTxt : longTxt);
      if(urlBox) urlBox.textContent = url;

      if(shortBtn) shortBtn.classList.toggle("active", mode==="short");
      if(longBtn)  longBtn.classList.toggle("active", mode==="long");
    };

    if(shortBtn) shortBtn.onclick = ()=>{ mode="short"; render(); };
    if(longBtn)  longBtn.onclick  = ()=>{ mode="long"; render(); };

    const title = $("shareTitle");
    if(title){
      const p = eventObj.payload || {};
      title.innerHTML = `Vas a compartir un paquete para <b>${escapeHtml(p.w||"Sin nombre")}</b>.`;
    }

    const close = ()=> hideBackdrop("shareBackdrop");
    if($("shareClose")) $("shareClose").onclick = close;
    if($("shareCancel")) $("shareCancel").onclick = close;

    if($("shareCopyUrl")) $("shareCopyUrl").onclick = async ()=>{
      const ok = await copyText(url);
      toast(ok ? "🔗 Enlace copiado" : "No se pudo copiar");
    };
    if($("shareCopyAll")) $("shareCopyAll").onclick = async ()=>{
      const ok = await copyText(textBox ? textBox.textContent : url);
      toast(ok ? "📋 Copiado" : "No se pudo copiar");
    };
    if($("shareSend")) $("shareSend").onclick = async ()=>{
      const txt = (textBox ? textBox.textContent : url);
      if(navigator.share){
        try{
          await navigator.share({ text: txt });
          toast("📤 Compartido");
        }catch(e){
          // usuario canceló o no disponible
        }
      }else{
        const ok = await copyText(txt);
        toast(ok ? "📋 Copiado (no hay compartir)" : "No se pudo copiar");
      }
    };

    render();
    showBackdrop("shareBackdrop");
  }

  /* =========================
     Apply package from URL
     ========================= */
  function checkIncomingPackage(){
    const u = new URL(location.href);
    const p = u.searchParams.get("p");
    if(!p) return;

    const ev = decodeEvent(p);
    if(!ev || !ev.type || !ev.id){
      toast("Paquete inválido");
      u.searchParams.delete("p");
      history.replaceState({}, "", u.toString());
      return;
    }

    const changed = applyEvent(ev);
    if(changed){
      received.c = Math.max(0, Number(received.c||0)) + 1;
      received.last = nowIso();
      save(RECEIVED_KEY, received);
      renderReceivedBadge();
      toast("📥 Paquete recibido");
      renderAll();
    }else{
      toast("📥 Ya lo tenías");
    }

    u.searchParams.delete("p");
    history.replaceState({}, "", u.toString());
  }

  /* =========================
     Render counts
     ========================= */
  function updateTileCounts(){
    const pending = data.filter(x => !x.done);
    const done = data.filter(x => x.done);

    if($("tilePendingCount")) $("tilePendingCount").textContent = String(pending.length);
    if($("tileDoneCount")) $("tileDoneCount").textContent = String(done.length);
    if($("tileContactsCount")) $("tileContactsCount").textContent = String(contacts.length);
    if($("bContacts")) $("bContacts").textContent = String(contacts.length);
  }

  function updateTopBadges(){
    const pending = data.filter(x => !x.done);
    const overdueCount = pending.filter(x => isOverdue(x.when)).length;

    if($("bOverdue")) $("bOverdue").textContent = String(overdueCount);
    renderReceivedBadge();
    updateTileCounts();
  }

  /* =========================
     Render commitments
     ========================= */
  function remindLabel(min){
    const m = Number(min||0);
    if(!m) return "";
    if(m === 5) return "🔔 5m";
    if(m === 15) return "🔔 15m";
    if(m === 60) return "🔔 1h";
    if(m === 1440) return "🔔 1d";
    return "🔔";
  }

  function renderCommitments(){
    updateTopBadges();

    const list = $("list");
    const empty = $("empty");
    if(!list) return;

    list.innerHTML = "";

    const pending = data.filter(x => !x.done);
    const done = data.filter(x => x.done);
    const items = (view === "pending") ? pending : done;

    if(empty) empty.style.display = items.length ? "none" : "block";

    items
      .slice()
      .sort((a,b)=>{
        if(view === "pending"){
          const ao = isOverdue(a.when) ? 1 : 0;
          const bo = isOverdue(b.when) ? 1 : 0;
          if(ao !== bo) return bo - ao;
          const ta = a.when ? new Date(a.when).getTime() : Number.POSITIVE_INFINITY;
          const tb = b.when ? new Date(b.when).getTime() : Number.POSITIVE_INFINITY;
          if(ta !== tb) return ta - tb;
          const ua = new Date(a.updatedAt || a.createdAt || 0).getTime();
          const ub = new Date(b.updatedAt || b.createdAt || 0).getTime();
          return ub - ua;
        }
        return (new Date(b.doneAt||0).getTime()) - (new Date(a.doneAt||0).getTime());
      })
      .forEach((it, idx)=> list.appendChild(renderCommitmentCard(it, idx)));
  }

  function renderCommitmentCard(item, idx){
    const card = document.createElement("div");
    card.className = "card";

    card.style.background = (idx % 2)
      ? "linear-gradient(180deg, rgba(255,255,255,.92), rgba(255,255,255,.86))"
      : "linear-gradient(180deg, rgba(255,255,255,.96), rgba(255,255,255,.90))";

    const who = normalizedWho(item);
    const dueText = item.when ? fmtDate(item.when) : "Sin fecha";
    const overdue = !item.done && isOverdue(item.when);

    const chips = [
      `<span class="chip">📝 ${escapeHtml(fmtDate(item.createdAt))}</span>`,
      item.updatedAt ? `<span class="chip">✍️ ${escapeHtml(fmtDate(item.updatedAt))}</span>` : "",
      item.done ? `<span class="chip">✅ ${escapeHtml(fmtDate(item.doneAt))}</span>` : "",
      item.when && Number(item.remindMin||0) > 0 ? `<span class="chip">${escapeHtml(remindLabel(item.remindMin))}</span>` : "",
      item.afterAt && Number(item.afterMin||0) > 0 ? `<span class="chip">⏳ ${escapeHtml(item.afterMin>=60 ? (item.afterMin/60)+"h" : item.afterMin+"m")}</span>` : ""
    ].filter(Boolean).join("");

    card.innerHTML = `
      <div class="cardTop" style="align-items:flex-start;">
        <div class="who" style="min-width:0;">
          <p class="name" title="${escapeHtml(who)}">${escapeHtml(who)}</p>
          <p class="meta">${chips}</p>
        </div>
        <div class="due ${overdue ? "bad" : ""}" style="white-space:nowrap;">
          ⏰ ${escapeHtml(dueText)}${overdue ? " · Vencido" : ""}
        </div>
      </div>

      <div class="desc">${escapeHtml(item.what || "—")}</div>

      <div class="actions">
        <button class="btn" type="button" data-act="cal">📅 Calendario</button>
        <button class="btn primary" type="button" data-act="share">📦 Compartir</button>
        ${item.done
          ? `<button class="btn" type="button" data-act="reopen">↩️ Reabrir</button>`
          : `<button class="btn good" type="button" data-act="done">✅ Hecho</button>`
        }
        <button class="btn" type="button" data-act="edit">✍️ Editar</button>
        <button class="btn danger" type="button" data-act="del">🗑️ Eliminar</button>
      </div>
    `;

    card.querySelector('[data-act="cal"]').addEventListener("click", ()=> addToCalendar(item.id));
    card.querySelector('[data-act="share"]').addEventListener("click", ()=> shareSnapshot(item.id));
    card.querySelector('[data-act="edit"]').addEventListener("click", ()=> openEditModal(item.id));
    card.querySelector('[data-act="del"]').addEventListener("click", ()=> deleteItem(item.id));
    if(item.done) card.querySelector('[data-act="reopen"]').addEventListener("click", ()=> reopen(item.id));
    else card.querySelector('[data-act="done"]').addEventListener("click", ()=> markDone(item.id));

    return card;
  }

  /* =========================
     Render contacts
     ========================= */
  function renderContacts(){
    const list = $("contactsList");
    const empty = $("contactsEmpty");
    if(!list) return;

    list.innerHTML = "";
    if(empty) empty.style.display = contacts.length ? "none" : "block";

    contacts
      .slice()
      .sort((a,b) => (a.name||"").localeCompare(b.name||"", "es"))
      .forEach((c, idx)=> list.appendChild(renderContactCard(c, idx)));
  }

  function renderContactCard(c, idx){
    const card = document.createElement("div");
    card.className = "card";
    card.style.background = (idx % 2)
      ? "linear-gradient(180deg, rgba(255,255,255,.96), rgba(255,255,255,.90))"
      : "linear-gradient(180deg, rgba(255,255,255,.93), rgba(255,255,255,.86))";

    const note = c.note ? `<span class="chip">🛈 ${escapeHtml(c.note)}</span>` : "";

    card.innerHTML = `
      <div class="cardTop">
        <div class="who" style="min-width:0;">
          <p class="name">${escapeHtml(c.name || "Sin nombre")}</p>
          <p class="meta">
            <span class="chip">👥 Amigo</span>
            ${note}
          </p>
        </div>
        <button class="btn primary" type="button" data-act="new" style="flex:0 0 auto;">➕ Compromiso</button>
      </div>
      <div class="desc">${escapeHtml(c.note || "Amigo guardado en tu móvil.")}</div>
      <div class="actions">
        <button class="btn" type="button" data-act="edit">✍️ Editar</button>
        <button class="btn danger" type="button" data-act="del">🗑️ Eliminar</button>
      </div>
    `;

    const openCommitWithFriend = () => openNewCommitmentForContact(c.id);

    card.addEventListener("click", (e)=>{
      const inBtn = e.target.closest("button");
      if(inBtn) return;
      openCommitWithFriend();
    });
    card.style.cursor = "pointer";
    card.setAttribute("role","button");
    card.setAttribute("tabindex","0");
    card.addEventListener("keydown",(e)=>{
      if(e.key==="Enter" || e.key===" "){
        e.preventDefault();
        openCommitWithFriend();
      }
    });

    card.querySelector('[data-act="new"]').addEventListener("click", openCommitWithFriend);
    card.querySelector('[data-act="edit"]').addEventListener("click", ()=> openContactEdit(c.id));
    card.querySelector('[data-act="del"]').addEventListener("click", ()=> deleteContact(c.id));

    return card;
  }

  function renderAll(){
    renderCommitments();
    renderContacts();
    fillContactSelect();
    updateSettingsUI();
    renderReceivedBadge();
    updateTileCounts();
  }

  /* =========================
     Modals: commitment
     ========================= */
  function fillContactSelect(selectedId){
    const sel = $("fContact");
    if(!sel) return;
    sel.innerHTML = "";

    const opt0 = document.createElement("option");
    opt0.value = "";
    opt0.textContent = "— Sin amigo (escribir nombre) —";
    sel.appendChild(opt0);

    contacts
      .slice()
      .sort((a,b)=>(a.name||"").localeCompare(b.name||"","es"))
      .forEach(c=>{
        const o = document.createElement("option");
        o.value = c.id;
        o.textContent = c.name || "Sin nombre";
        sel.appendChild(o);
      });

    sel.value = selectedId || "";
    handleContactSelectChange();
  }

  function handleContactSelectChange(){
    const sel = $("fContact");
    const wrap = $("customWhoField");
    const hint = $("contactHint");
    if(!sel) return;

    const v = sel.value || "";
    const showCustom = !v;

    if(wrap) wrap.style.display = showCustom ? "" : "none";
    if(hint){
      hint.textContent = showCustom
        ? "Escribe un nombre sin guardarlo (solo para este compromiso)."
        : "Se usará el nombre del amigo seleccionado.";
    }
  }

  function openNewCommitment(){
    editingId = null;
    if($("modalTitle")) $("modalTitle").textContent = "Nuevo compromiso";

    fillContactSelect("");

    if($("fWho")) $("fWho").value = "";
    if($("fWhat")) $("fWhat").value = "";
    if($("fWhen")) $("fWhen").value = "";
    if($("fRemind")) $("fRemind").value = "0";
    if($("fAfter")) $("fAfter").value = "0";

    showBackdrop("backdrop");
  }

  function openNewCommitmentForContact(contactId){
    editingId = null;
    if($("modalTitle")) $("modalTitle").textContent = "Nuevo compromiso";

    fillContactSelect(contactId);

    const c = contactById(contactId);
    if($("fWho")) $("fWho").value = c?.name || "";
    if($("fWhat")) $("fWhat").value = "";
    if($("fWhen")) $("fWhen").value = "";
    if($("fRemind")) $("fRemind").value = "0";
    if($("fAfter")) $("fAfter").value = "0";

    showBackdrop("backdrop");
  }

  function openEditModal(itemId){
    const it = data.find(x => x.id === itemId);
    if(!it) return;

    editingId = itemId;
    if($("modalTitle")) $("modalTitle").textContent = "Editar compromiso";

    fillContactSelect(it.whoId || "");

    if($("fWho")) $("fWho").value = it.whoName || "";
    if($("fWhat")) $("fWhat").value = it.what || "";

    // datetime-local necesita formato local "YYYY-MM-DDTHH:MM"
    if($("fWhen")){
      if(it.when){
        const d = new Date(it.when);
        if(isFinite(d.getTime())){
          const pad = (x)=> String(x).padStart(2,"0");
          const v = `${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
          $("fWhen").value = v;
        }else $("fWhen").value = "";
      }else $("fWhen").value = "";
    }

    if($("fRemind")) $("fRemind").value = String(Number(it.remindMin||0));
    if($("fAfter")) $("fAfter").value = String(Number(it.afterMin||0));

    showBackdrop("backdrop");
  }

  function closeCommitmentModal(){
    hideBackdrop("backdrop");
  }

  function parseWhenFromInput(){
    const v = $("fWhen") ? $("fWhen").value : "";
    if(!v) return null;
    const d = new Date(v);
    if(!isFinite(d.getTime())) return null;
    return d.toISOString();
  }

  function saveCommitmentFromModal(){
    const selId = $("fContact") ? ($("fContact").value || "") : "";
    const useContact = !!selId;

    const whoName = useContact
      ? (contactById(selId)?.name || "Sin nombre")
      : (String($("fWho")?.value || "").trim() || "Sin nombre");

    const what = String($("fWhat")?.value || "").trim();
    const whenIso = parseWhenFromInput();

    const remindMin = Number($("fRemind")?.value || 0) || 0;

    const afterMin = Number($("fAfter")?.value || 0) || 0;
    const afterAt = afterMin > 0 ? new Date(Date.now() + afterMin*60*1000).toISOString() : null;

    const at = nowIso();

    if(!what){
      toast("Escribe qué se acordó");
      return;
    }

    if(editingId){
      const ev = {
        id: uid(),
        type: T.EDIT,
        at,
        payload: {
          i: editingId,
          c: useContact ? selId : null,
          w: whoName,
          s: what,
          n: whenIso,
          r: remindMin,
          af: afterMin,
          aa: afterAt
        }
      };
      applyEvent(ev);
      toast("Guardado ✅");
    }else{
      const idItem = uid();
      const ev = {
        id: uid(),
        type: T.CREATE,
        at,
        payload: {
          i: idItem,
          c: useContact ? selId : null,
          w: whoName,
          s: what,
          n: whenIso,
          r: remindMin,
          af: afterMin,
          aa: afterAt,
          ca: at
        }
      };
      applyEvent(ev);
      toast("Creado ✅");
      // abrir modal compartir
      openShareModal(ev);
    }

    save(KEY, data);
    closeCommitmentModal();
    renderAll();
  }

  function deleteItem(itemId){
    const it = data.find(x=>x.id===itemId);
    if(!it) return;

    Confirm.open({
      title: "Eliminar",
      msg: `¿Eliminar este compromiso con <b>${escapeHtml(normalizedWho(it))}</b>?`,
      yesText: "Sí, eliminar",
      danger: true
    }).then(ok=>{
      if(!ok) return;
      const ev = { id: uid(), type: T.DELETE, at: nowIso(), payload: { i: itemId } };
      applyEvent(ev);
      save(KEY, data);
      toast("Eliminado");
      renderAll();
    });
  }

  function markDone(itemId){
    const it = data.find(x=>x.id===itemId);
    if(!it || it.done) return;

    const ev = { id: uid(), type: T.DONE, at: nowIso(), payload: { i: itemId } };
    applyEvent(ev);
    save(KEY, data);
    toast("Marcado como hecho ✅");
    renderAll();
  }

  function reopen(itemId){
    const it = data.find(x=>x.id===itemId);
    if(!it || !it.done) return;

    const ev = { id: uid(), type: T.REOPEN, at: nowIso(), payload: { i: itemId } };
    applyEvent(ev);
    save(KEY, data);
    toast("Reabierto ↩️");
    renderAll();
  }

  /* =========================
     Calendar
     ========================= */
  function addToCalendar(itemId){
    const it = data.find(x=>x.id===itemId);
    if(!it) return;

    const who = normalizedWho(it);
    const title = `Compromiso: ${who}`;
    const details = it.what || "";

    if(!it.when){
      toast("Pon una fecha para usar Calendario");
      openEditModal(itemId);
      return;
    }

    const start = new Date(it.when);
    if(!isFinite(start.getTime())){ toast("Fecha inválida"); return; }

    const end = new Date(start.getTime() + 30*60*1000);
    const fmtIcs = (d)=>{
      const pad=(x)=>String(x).padStart(2,"0");
      return `${d.getUTCFullYear()}${pad(d.getUTCMonth()+1)}${pad(d.getUTCDate())}T${pad(d.getUTCHours())}${pad(d.getUTCMinutes())}${pad(d.getUTCSeconds())}Z`;
    };

    const ics =
`BEGIN:VCALENDAR
VERSION:2.0
PRODID:-//Compromisos//ES
BEGIN:VEVENT
UID:${uid()}
DTSTAMP:${fmtIcs(new Date())}
DTSTART:${fmtIcs(start)}
DTEND:${fmtIcs(end)}
SUMMARY:${title.replaceAll("\n"," ")}
DESCRIPTION:${details.replaceAll("\n"," ").slice(0,900)}
END:VEVENT
END:VCALENDAR`;

    const blob = new Blob([ics], { type:"text/calendar;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "compromiso.ics";
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(()=> URL.revokeObjectURL(url), 1500);

    toast("📅 Archivo calendario listo");
  }

  /* =========================
     Snapshot share (por id)
     ========================= */
  function shareSnapshot(itemId){
    const it = data.find(x=>x.id===itemId);
    if(!it) return;

    const at = nowIso();
    const ev = {
      id: uid(),
      type: T.CREATE,
      at,
      payload: {
        i: it.id,     // mismo id del item
        c: it.whoId || null,
        w: normalizedWho(it),
        s: it.what || "",
        n: it.when || null,
        r: Number(it.remindMin||0),
        af: Number(it.afterMin||0),
        aa: it.afterAt || null,
        ca: it.createdAt || at
      }
    };

    openShareModal(ev);
  }

  /* =========================
     Contacts modals
     ========================= */
  function openNewContact(){
    editingContactId = null;
    if($("cModalTitle")) $("cModalTitle").textContent = "Nuevo amigo";
    if($("cName")) $("cName").value = "";
    if($("cNote")) $("cNote").value = "";
    showBackdrop("cBackdrop");
  }

  function openContactEdit(contactId){
    const c = contacts.find(x=>x.id===contactId);
    if(!c) return;
    editingContactId = contactId;
    if($("cModalTitle")) $("cModalTitle").textContent = "Editar amigo";
    if($("cName")) $("cName").value = c.name || "";
    if($("cNote")) $("cNote").value = c.note || "";
    showBackdrop("cBackdrop");
  }

  function closeContactModal(){ hideBackdrop("cBackdrop"); }

  function saveContactFromModal(){
    const name = String($("cName")?.value || "").trim();
    const note = String($("cNote")?.value || "").trim();

    if(!name){
      toast("Escribe el nombre");
      return;
    }

    if(editingContactId){
      const c = contacts.find(x=>x.id===editingContactId);
      if(c){
        c.name = name;
        c.note = note;
      }
      toast("Amigo actualizado ✅");
    }else{
      contacts.push({ id: uid(), name, note });
      toast("Amigo creado ✅");
    }

    save(CONTACTS_KEY, contacts);
    closeContactModal();
    renderAll();
  }

  function deleteContact(contactId){
    const c = contacts.find(x=>x.id===contactId);
    if(!c) return;

    Confirm.open({
      title: "Eliminar amigo",
      msg: `¿Eliminar a <b>${escapeHtml(c.name||"Sin nombre")}</b>?<br><span style="color:#6B7280">No borra compromisos existentes (solo quita el vínculo).</span>`,
      yesText: "Sí, eliminar",
      danger: true
    }).then(ok=>{
      if(!ok) return;

      contacts = contacts.filter(x=>x.id!==contactId);
      // desvincular compromisos que usaban ese id
      data.forEach(it=>{
        if(it.whoId === contactId){
          it.whoId = null;
          // mantenemos whoName como “backup”
          if(!it.whoName) it.whoName = c.name || "Sin nombre";
        }
      });

      save(CONTACTS_KEY, contacts);
      save(KEY, data);
      toast("Amigo eliminado");
      renderAll();
    });
  }

  /* =========================
     Settings UI
     ========================= */
  function updateSettingsUI(){
    // switches
    const swPin = $("swPin");
    const swN = $("swNotif");
    if(swPin){
      swPin.classList.toggle("on", !!settings.pinEnabled);
      swPin.setAttribute("aria-checked", settings.pinEnabled ? "true" : "false");
    }
    if(swN){
      swN.classList.toggle("on", !!settings.notifEnabled);
      swN.setAttribute("aria-checked", settings.notifEnabled ? "true" : "false");
    }

    // selects
    if($("selAutoLock")) $("selAutoLock").value = String(settings.autoLockMin || 0);
    if($("selRemember")) $("selRemember").value = String(settings.rememberMin || 0);

    const hint = $("notifHint");
    if(hint){
      hint.textContent = settings.notifEnabled
        ? "✅ Notificaciones activadas. (En algunos móviles debes permitirlas en el sistema.)"
        : "ℹ️ Pulsa “Permitir” para recibir recordatorios.";
    }
  }

  function saveSettings(){
    save(SETTINGS_KEY, settings);
    updateSettingsUI();
  }

  function toggleSwitch(id, key){
    const el = $(id);
    if(!el) return;
    const next = !settings[key];
    settings[key] = next;
    saveSettings();
    toast(next ? "Activado ✅" : "Desactivado");
  }

  /* =========================
     Notifications (simple)
     ========================= */
  async function requestNotifPermission(){
    if(!("Notification" in window)){
      toast("Este navegador no soporta notificaciones");
      return false;
    }
    try{
      const res = await Notification.requestPermission();
      return res === "granted";
    }catch(e){
      return false;
    }
  }

  function notify(title, body){
    if(!settings.notifEnabled) return;
    if(!("Notification" in window)) return;
    if(Notification.permission !== "granted") return;

    try{
      new Notification(title, { body });
    }catch(e){}
  }

  /* =========================
     Reminders
     ========================= */
  function checkReminders(){
    const now = Date.now();

    for(const it of data){
      if(it.done) continue;

      // por fecha + recordatorio
      if(it.when && Number(it.remindMin||0) > 0){
        const due = new Date(it.when).getTime();
        if(isFinite(due)){
          const fireAt = due - Number(it.remindMin||0)*60*1000;
          const k = firedKey(it);

          if(now >= fireAt && now <= (fireAt + 60*1000)){ // ventana 1 min
            if(!firedMap[k]){
              firedMap[k] = nowIso();
              save(REMIND_FIRED_KEY, firedMap);
              notify("⏰ Recordatorio", `${normalizedWho(it)}: ${it.what}`);
            }
          }
        }
      }

      // “desde ahora” (afterAt)
      if(it.afterAt && Number(it.afterMin||0) > 0){
        const t = new Date(it.afterAt).getTime();
        if(isFinite(t)){
          const k = afterKey(it);
          if(now >= t && now <= (t + 60*1000)){
            if(!afterFired[k]){
              afterFired[k] = nowIso();
              save(AFTER_FIRED_KEY, afterFired);
              notify("⏳ Aviso", `${normalizedWho(it)}: ${it.what}`);
            }
          }
        }
      }
    }
  }

  /* =========================
     Lock overlay (PIN)
     ========================= */
  let pinBuf = "";

  function isUnlockedNow(){
    const until = Number(settings.unlockedUntil || 0);
    return until && Date.now() < until;
  }

  function setUnlocked(){
    const rememberMin = Number(settings.rememberMin || 0);
    settings.unlockedUntil = rememberMin > 0 ? (Date.now() + rememberMin*60*1000) : 0;
    saveSettings();
  }

  function showLockOverlay(){
    pinBuf = "";
    updatePinDots();
    showBackdrop("lockOverlay");
  }

  function hideLockOverlay(){
    hideBackdrop("lockOverlay");
  }

  function updatePinDots(){
    const n = pinBuf.length;
    const ids = ["d1","d2","d3","d4"];
    ids.forEach((id, idx)=>{
      const el = $(id);
      if(el) el.classList.toggle("on", idx < n);
    });
  }

  function handlePinKey(k){
    if(k === "del"){
      pinBuf = pinBuf.slice(0,-1);
      updatePinDots();
      return;
    }
    if(k === "ok"){
      if(pinBuf.length !== 4){
        toast("PIN incompleto");
        return;
      }
      const h = pinHash4(pinBuf);
      if(h === settings.pinHash){
        hideLockOverlay();
        setUnlocked();
        toast("Desbloqueado ✅");
      }else{
        pinBuf = "";
        updatePinDots();
        toast("PIN incorrecto");
      }
      return;
    }
    if(/^\d$/.test(String(k)) && pinBuf.length < 4){
      pinBuf += String(k);
      updatePinDots();
    }
  }

  /* Modal configurar/cambiar PIN */
  function openPinModal(mode){
    // mode: "new" | "change"
    const has = !!settings.pinHash;
    if($("pinTitle")) $("pinTitle").textContent = has ? "Cambiar PIN" : "Configurar PIN";

    const oldWrap = $("pinOldWrap");
    const hint = $("pinHint");
    if(hint){
      hint.textContent = has ? "Introduce tu PIN actual y el nuevo." : "Crea un PIN de 4 dígitos.";
    }

    if(oldWrap) oldWrap.style.display = has ? "" : "none";
    if($("pinOld")) $("pinOld").value = "";
    if($("pinNew")) $("pinNew").value = "";
    if($("pinNew2")) $("pinNew2").value = "";

    showBackdrop("pinBackdrop");
  }

  function closePinModal(){
    hideBackdrop("pinBackdrop");
  }

  function savePinFromModal(){
    const has = !!settings.pinHash;
    const old = String($("pinOld")?.value || "").trim();
    const p1  = String($("pinNew")?.value || "").trim();
    const p2  = String($("pinNew2")?.value || "").trim();

    if(has){
      if(old.length !== 4) { toast("PIN actual inválido"); return; }
      if(pinHash4(old) !== settings.pinHash){ toast("PIN actual incorrecto"); return; }
    }

    if(p1.length !== 4 || !/^\d{4}$/.test(p1)){ toast("Nuevo PIN inválido"); return; }
    if(p1 !== p2){ toast("No coincide"); return; }

    settings.pinHash = pinHash4(p1);
    settings.pinEnabled = true;
    saveSettings();
    toast("PIN guardado ✅");
    closePinModal();
  }

  /* =========================
     Reset all
     ========================= */
  function resetAll(){
    Confirm.open({
      title: "Borrar todo",
      msg: "Esto borrará <b>compromisos</b>, <b>amigos</b> y <b>ajustes</b> de este móvil.<br><br>¿Continuar?",
      yesText: "Sí, borrar todo",
      danger: true
    }).then(ok=>{
      if(!ok) return;
      localStorage.removeItem(KEY);
      localStorage.removeItem(CONTACTS_KEY);
      localStorage.removeItem(EVENTS_KEY);
      localStorage.removeItem(SETTINGS_KEY);
      localStorage.removeItem(A11Y_KEY);
      localStorage.removeItem(RECEIVED_KEY);
      localStorage.removeItem(REMIND_FIRED_KEY);
      localStorage.removeItem(AFTER_FIRED_KEY);

      data = [];
      contacts = [];
      events = [];
      received = { c:0, last:null };
      firedMap = {};
      afterFired = {};
      settings = Object.assign({}, settingsDefault);

      toast("Borrado ✅");
      renderAll();
      setPane("commitments");
    });
  }

  /* =========================
     Install banner (simple)
     ========================= */
  let deferredPrompt = null;

  function isChromeOnAndroid(){
    const ua = navigator.userAgent || "";
    return /Android/i.test(ua) && /Chrome\//i.test(ua) && !/EdgA|SamsungBrowser|OPR|UCBrowser/i.test(ua);
  }

  function showInstallBanner(){
    const el = $("installBanner");
    if(!el) return;
    el.classList.add("show");
    el.setAttribute("aria-hidden","false");
  }
  function hideInstallBanner(){
    const el = $("installBanner");
    if(!el) return;
    el.classList.remove("show");
    el.setAttribute("aria-hidden","true");
  }

  function setupInstall(){
    const btnHide = $("btnHideBanner");
    const btnInstall = $("btnInstallBanner");
    const btnOpenChrome = $("btnOpenChrome");
    const btnCopy = $("btnCopyLink");

    if(btnHide) btnHide.onclick = hideInstallBanner;

    window.addEventListener("beforeinstallprompt", (e)=>{
      e.preventDefault();
      deferredPrompt = e;
      if(btnInstall) btnInstall.style.display = "";
      if(btnOpenChrome) btnOpenChrome.style.display = "none";
      if(btnCopy) btnCopy.style.display = "";
      showInstallBanner();
    });

    window.addEventListener("appinstalled", ()=>{
      deferredPrompt = null;
      hideInstallBanner();
      toast("Instalada ✅");
    });

    if(btnInstall){
      btnInstall.onclick = async ()=>{
        if(!deferredPrompt) return;
        deferredPrompt.prompt();
        try{ await deferredPrompt.userChoice; }catch(e){}
        deferredPrompt = null;
        hideInstallBanner();
      };
    }

    if(btnOpenChrome){
      btnOpenChrome.onclick = ()=>{
        toast("Abre este enlace en Chrome para instalar");
      };
    }

    if(btnCopy){
      btnCopy.onclick = async ()=>{
        const ok = await copyText(currentBaseUrl());
        toast(ok ? "🔗 Enlace copiado" : "No se pudo copiar");
      };
    }

    // si no hay beforeinstallprompt, mostramos consejo en Android fuera de Chrome
    if(isChromeOnAndroid()){
      // en Chrome muchas veces aparecerá el evento; si no, no molestamos
    }else{
      if(btnInstall) btnInstall.style.display = "none";
      if(btnOpenChrome) btnOpenChrome.style.display = isChromeOnAndroid() ? "none" : "";
      if(btnCopy) btnCopy.style.display = "";
      showInstallBanner();
    }
  }

  /* =========================
     Tiles navigation (menuGrid)
     ========================= */
  function bindTileNav(){
    const bind = (id, fn) => {
      const el = $(id);
      if(!el) return;
      el.addEventListener("click", fn);
      el.addEventListener("keydown", (e)=>{
        if(e.key==="Enter" || e.key===" "){ e.preventDefault(); fn(); }
      });
    };

    bind("tilePending", () => { setPane("commitments"); setViewPending(); toast("📝 Pendientes"); });
    bind("tileDone",    () => { setPane("commitments"); setViewDone();    toast("✅ Hechos"); });
    bind("tileContacts",() => { setPane("contacts");                   toast("👥 Amigos"); });
    bind("tileSettings",() => { setPane("settings");                   toast("⚙️ Ajustes"); });
  }

  /* =========================
     Pills actions
     ========================= */
  function goToCommitmentsPending(){
    setPane("commitments");
    setViewPending();
    try{ window.scrollTo({ top: 0, behavior: "smooth" }); }catch(e){ window.scrollTo(0,0); }
  }

  function scrollToFirstOverdue(){
    const list = $("list");
    if(!list) return;
    const first = list.querySelector(".due.bad");
    if(first){
      const card = first.closest(".card");
      if(card){
        try{ card.scrollIntoView({ behavior:"smooth", block:"start" }); }catch(e){}
      }
    }
  }

  function bindPills(){
    const o = $("btnOverdue");
    const r = $("btnReceived");

    if(o){
      o.onclick = ()=>{
        goToCommitmentsPending();
        const overdueCount = data.filter(x => !x.done && isOverdue(x.when)).length;
        if(overdueCount > 0){
          toast(`⏰ ${overdueCount} vencido(s)`);
          setTimeout(scrollToFirstOverdue, 250);
        }else toast("Sin vencidos ✅");
      };
    }

    if(r){
      r.onclick = async ()=>{
        const c = Math.max(0, Number(received?.c || 0));
        goToCommitmentsPending();
        if(c <= 0){ toast("Sin recibidos"); return; }

        const ok = await Confirm.open({
          title: "Recibidos",
          msg: `Has recibido <b>${c}</b> paquete(s).<br>¿Marcar como vistos y poner el contador a 0?`,
          yesText: "Sí, marcar vistos",
          danger: false
        });
        if(ok){
          clearReceived();
          renderReceivedBadge();
          toast("Recibidos marcados ✅");
        }
      };
    }
  }

  /* =========================
     Bind core buttons
     ========================= */
  function bindCore(){
    // bottom tabs
    if($("tabCommitments")) $("tabCommitments").onclick = ()=> setPane("commitments");
    if($("tabContacts")) $("tabContacts").onclick = ()=> setPane("contacts");

    // subtabs
    if($("tabPending")) $("tabPending").onclick = setViewPending;
    if($("tabDone")) $("tabDone").onclick = setViewDone;

    // top a11y + settings a11y
    if($("btnA11yTop")) $("btnA11yTop").onclick = toggleTextScale;
    if($("btnA11y")) $("btnA11y").onclick = toggleTextScale;

    // select contact change
    if($("fContact")) $("fContact").onchange = handleContactSelectChange;

    // commitment modal buttons
    if($("btnClose")) $("btnClose").onclick = closeCommitmentModal;
    if($("btnCancel")) $("btnCancel").onclick = closeCommitmentModal;
    if($("btnSave")) $("btnSave").onclick = saveCommitmentFromModal;

    // contact modal buttons
    if($("cBtnClose")) $("cBtnClose").onclick = closeContactModal;
    if($("cBtnCancel")) $("cBtnCancel").onclick = closeContactModal;
    if($("cBtnSave")) $("cBtnSave").onclick = saveContactFromModal;

    // fab
    if($("fab")){
      $("fab").onclick = ()=>{
        if(pane === "contacts") openNewContact();
        else openNewCommitment();
      };
    }

    // settings: switches + buttons
    if($("swPin")){
      $("swPin").onclick = ()=>{
        if(!settings.pinHash){
          openPinModal("new");
          return;
        }
        toggleSwitch("swPin","pinEnabled");
        if(settings.pinEnabled && !isUnlockedNow()){
          showLockOverlay();
        }
      };
      $("swPin").addEventListener("keydown",(e)=>{
        if(e.key==="Enter" || e.key===" "){ e.preventDefault(); $("swPin").click(); }
      });
    }

    if($("btnChangePin")) $("btnChangePin").onclick = ()=> openPinModal("change");
    if($("btnLockNow")) $("btnLockNow").onclick = ()=>{
      if(settings.pinEnabled){
        settings.unlockedUntil = 0;
        saveSettings();
        showLockOverlay();
      }else toast("Activa el PIN primero");
    };

    if($("selAutoLock")){
      $("selAutoLock").onchange = ()=>{
        settings.autoLockMin = clamp(Number($("selAutoLock").value||0), 0, 10);
        saveSettings();
      };
    }
    if($("selRemember")){
      $("selRemember").onchange = ()=>{
        settings.rememberMin = clamp(Number($("selRemember").value||0), 0, 60);
        saveSettings();
      };
    }

    if($("swNotif")){
      $("swNotif").onclick = ()=> toggleSwitch("swNotif","notifEnabled");
      $("swNotif").addEventListener("keydown",(e)=>{
        if(e.key==="Enter" || e.key===" "){ e.preventDefault(); $("swNotif").click(); }
      });
    }

    if($("btnNotifPerm")){
      $("btnNotifPerm").onclick = async ()=>{
        const ok = await requestNotifPermission();
        if(ok){
          toast("Permiso concedido ✅");
        }else{
          toast("Permiso no concedido");
        }
      };
    }

    if($("btnResetAll")) $("btnResetAll").onclick = resetAll;

    // pin modal buttons
    if($("pinClose")) $("pinClose").onclick = closePinModal;
    if($("pinCancel")) $("pinCancel").onclick = closePinModal;
    if($("pinOk")) $("pinOk").onclick = savePinFromModal;

    // lock overlay
    if($("lockClose")) $("lockClose").onclick = ()=>{
      // si hay pin, no dejamos cerrar sin desbloquear (para seguridad)
      toast("Introduce tu PIN");
    };

    const keypad = $("keypad");
    if(keypad){
      keypad.addEventListener("click",(e)=>{
        const b = e.target.closest("button");
        if(!b) return;
        const k = b.getAttribute("data-k");
        handlePinKey(k);
      });
    }

    if($("btnLockCopyLink")){
      $("btnLockCopyLink").onclick = async ()=>{
        const ok = await copyText(location.href);
        toast(ok ? "🔗 Enlace copiado" : "No se pudo copiar");
      };
    }

    if($("btnLockReset")) $("btnLockReset").onclick = resetAll;

    // clicks fuera de modal para cerrar (solo en modales normales)
    const closableBackdrops = [
      ["backdrop", closeCommitmentModal],
      ["cBackdrop", closeContactModal],
      ["pinBackdrop", closePinModal],
      ["shareBackdrop", ()=> hideBackdrop("shareBackdrop")],
    ];
    closableBackdrops.forEach(([id, fn])=>{
      const bd = $(id);
      if(!bd) return;
      bd.addEventListener("click",(e)=>{
        if(e.target === bd) fn();
      });
    });
  }

  /* =========================
     Autolock: al perder foco / ocultar
     ========================= */
  function setupAutoLock(){
    const lockIfNeeded = ()=>{
      if(!settings.pinEnabled) return;
      if(isUnlockedNow()) return;

      const min = Number(settings.autoLockMin||0);
      if(min === 0){
        showLockOverlay();
      }else{
        setTimeout(()=>{
          if(document.hidden && settings.pinEnabled && !isUnlockedNow()){
            showLockOverlay();
          }
        }, min*60*1000);
      }
    };

    document.addEventListener("visibilitychange", ()=>{
      if(document.hidden) lockIfNeeded();
    });

    window.addEventListener("blur", ()=>{
      lockIfNeeded();
    });
  }

  /* =========================
     UI FIX: evitar “código pegado” por error (si alguien metió CSS en HTML)
     ========================= */
  function removeAccidentalCodeBlocks(){
    // Si por error alguien pegó texto tipo "/* compromisos.css" en el body, lo borramos.
    const bodyText = document.body ? document.body.innerText : "";
    if(!bodyText) return;

    // si detectamos que existe como texto visible "/* compromisos.css", intentamos eliminar nodos textuales grandes
    if(bodyText.includes("/* compromisos.css") || bodyText.includes("compromisos.css (2/3)")){
      const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
      const toRemove = [];
      while(walker.nextNode()){
        const n = walker.currentNode;
        const t = n.nodeValue || "";
        if(t.includes("/* compromisos.css") || t.includes("compromisos.css (2/3)") || t.includes(":root{ --bg")){
          toRemove.push(n);
        }
      }
      toRemove.forEach(n=>{
        if(n.parentNode) n.parentNode.removeChild(n);
      });
    }
  }

  /* =========================
     Boot
     ========================= */
  // aplicar tamaño letra
  const a11y = load(A11Y_KEY, { big:false });
  setTextScale(!!a11y.big);

  updateSettingsUI();

  bindTileNav();
  bindPills();
  bindCore();
  setupInstall();
  setupAutoLock();

  // limpiar “texto de código” si se coló en HTML
  removeAccidentalCodeBlocks();

  // aplicar paquete entrante si viene en URL
  checkIncomingPackage();

  // Demo inicial si está vacío
  if(data.length === 0){
    const now = nowIso();
    const ev = {
      id: uid(),
      type: T.CREATE,
      at: now,
      payload: {
        i: uid(),
        c: null,
        w: "Ejemplo: Laura",
        s: "Te paso el PDF del seguro",
        n: new Date(Date.now() + 3*60*60*1000).toISOString(),
        r: 15,
        af: 60,
        aa: new Date(Date.now() + 60*60*1000).toISOString(),
        ca: now
      }
    };
    applyEvent(ev);
  }

  cleanupFiredMaps();
  renderAll();

  // si PIN activado y no está desbloqueado
  if(settings.pinEnabled && !isUnlockedNow()){
    showLockOverlay();
  }else{
    hideLockOverlay();
  }

  // recordatorios
  setInterval(() => {
    if(settings.pinEnabled && !isUnlockedNow()) return;
    checkReminders();
  }, 20000);

  setTimeout(() => {
    if(settings.pinEnabled && !isUnlockedNow()) return;
    checkReminders();
  }, 1200);

})(); // ✅ cierre IIFE
