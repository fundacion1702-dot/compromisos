/* compromisos.js — FULL (A11Y big text + reflow + app logic) */
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
    try{ localStorage.setItem(key, JSON.stringify(val)); }catch(e){}
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
    toast._tm = setTimeout(()=> t.classList.remove("show"), 1800);
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
     ✅ A11Y: TEXTO GRANDE REAL + REORGANIZACIÓN (sin solapes)
     FIX: botón "Texto grande" SIEMPRE arriba derecha (también en bigText)
  ========================= */
  (function injectA11yCssOnce(){
    if(document.getElementById("a11yBigTextCSS")) return;
    const st = document.createElement("style");
    st.id = "a11yBigTextCSS";
    st.textContent = `
      /* Colocación del botón arriba derecha (alineado con el título) */
      .topbarInner{ position:relative !important; }
      #btnA11yTop{
        position:absolute !important;
        top:12px !important;
        right:0 !important;
        z-index:30 !important;
        pointer-events:auto !important;
      }
      .brand{ padding-right:200px !important; } /* hueco para que el título no se meta debajo */

      /* Pills: permite 2 líneas si hace falta (evita solapes cuando el texto crece) */
      .pills{
        flex-wrap:wrap !important;
        gap:10px !important;
        overflow:visible !important;
      }

      /* ========= BIG TEXT MODE ========= */
      html.bigText body{ font-size:18px !important; }

      html.bigText .title{ font-size:20px !important; line-height:1.15 !important; }
      html.bigText .subtitle{ font-size:14px !important; }

      html.bigText .tileTitle{ font-size:18px !important; }
      html.bigText .tileMeta{ font-size:14px !important; }
      html.bigText .badge{ height:26px !important; font-size:13.5px !important; }

      html.bigText .sectionHead h2{ font-size:18px !important; }
      html.bigText .sectionHead p{ font-size:14px !important; }

      html.bigText .chip{ font-size:13.5px !important; padding:7px 11px !important; }
      html.bigText .due{ font-size:13.5px !important; padding:9px 11px !important; }

      html.bigText .desc{ font-size:16px !important; }
      html.bigText .label{ font-size:13.5px !important; }

      html.bigText input,
      html.bigText select,
      html.bigText textarea{
        font-size:16px !important;
        padding:13px 13px !important;
      }

      html.bigText .btn,
      html.bigText .segBtn,
      html.bigText .pillBtn,
      html.bigText .a11yBtn{
        font-size:14.5px !important;
        height:44px !important;
      }
      html.bigText .pillCount{
        height:24px !important;
        min-width:24px !important;
        font-size:13px !important;
      }

      /* En bigText mantenemos el botón arriba derecha, pero damos un pelín más de hueco */
      html.bigText #btnA11yTop{ top:10px !important; }
      html.bigText .brand{ padding-right:210px !important; }

      /* TopActions: deja que las cosas bajen si es necesario */
      html.bigText .topActions{
        width:100% !important;
        justify-content:flex-start !important;
        flex-wrap:wrap !important;
        gap:10px !important;
      }

      @media (max-width:520px){
        /* En móviles estrechos: seguimos arriba derecha pero con menos padding */
        .brand{ padding-right:0 !important; }
        #btnA11yTop{ top:10px !important; }
      }
    `;
    document.head.appendChild(st);
  })();

  function applyA11yUi(big){
    const html = document.documentElement;
    html.classList.toggle("bigText", !!big);

    const label = big ? "🔎 Texto normal" : "🔎 Texto grande";
    const bTop = $("btnA11yTop");
    const bSet = $("btnA11y");
    if(bTop) bTop.textContent = label;
    if(bSet) bSet.textContent = label;
  }

  function setTextBig(big){
    save(A11Y_KEY, { big: !!big });
    applyA11yUi(!!big);
  }

  function toggleTextBig(){
    const st = load(A11Y_KEY, { big:false });
    const next = !st.big;
    setTextBig(next);
    toast(next ? "🔎 Texto grande activado" : "🔎 Texto normal");
  }

  // Evita doble disparo en móvil (touchend + click)
  let _lastA11yTap = 0;
  function bindA11yButtons(){
    const bind = (el)=>{
      if(!el) return;
      const handler = (e)=>{
        const now = Date.now();
        if(now - _lastA11yTap < 350) return;
        _lastA11yTap = now;
        try{ e.preventDefault(); }catch(_){}
        toggleTextBig();
      };
      el.addEventListener("click", handler, { passive:false });
      el.style.pointerEvents = "auto";
    };
    bind($("btnA11yTop"));
    bind($("btnA11y"));
  }

  /* =========================
     Estado / datos
  ========================= */
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

  let pane = "commitments"; // commitments | contacts | settings

  /* =========================
     Backdrops
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
      if($("confirmTitle")) $("confirmTitle").textContent = title;
      if($("confirmMsg")) $("confirmMsg").innerHTML = msg;
      if($("confirmYes")){
        $("confirmYes").textContent = yesText;
        $("confirmYes").classList.toggle("danger", !!danger);
        $("confirmYes").classList.toggle("primary", !danger);
      }
      showBackdrop("confirmBackdrop");
      return new Promise((resolve)=>{ Confirm._resolver = resolve; });
    },
    close(val){
      hideBackdrop("confirmBackdrop");
      const r = Confirm._resolver;
      Confirm._resolver = null;
      if(r) r(!!val);
    }
  };

  (function bindConfirm(){
    const x = $("confirmClose");
    const n = $("confirmNo");
    const y = $("confirmYes");
    if(x) x.onclick = ()=> Confirm.close(false);
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
     Helpers (render)
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

  function currentView(){
    return ($("tabDone") && $("tabDone").classList.contains("active")) ? "done" : "pending";
  }

  function renderCommitments(){
    updateCounts();

    const list = $("list");
    const empty = $("empty");
    if(!list) return;

    const view = currentView();
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

  function renderReceivedBadge(){
    const rec = Math.max(0, Number(received?.c || 0));
    if($("bReceived")) $("bReceived").textContent = String(rec);
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
    const a = $("tabPending"), b = $("tabDone");
    if(a) a.classList.add("active");
    if(b) b.classList.remove("active");
    renderCommitments();
  }
  function setViewDone(){
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
    bindTile("tilePending", ()=>{ setPane("commitments"); setViewPending(); toast("📝 Pendientes"); });
    bindTile("tileDone", ()=>{ setPane("commitments"); setViewDone(); toast("✅ Hechos"); });
    bindTile("tileContacts", ()=>{ setPane("contacts"); toast("👥 Amigos"); });
    bindTile("tileSettings", ()=>{ setPane("settings"); toast("⚙️ Ajustes"); });

    if($("btnOverdue")){
      $("btnOverdue").addEventListener("click", ()=>{
        setPane("commitments");
        setViewPending();
        const overdue = data.filter(x=> !x.done && isOverdue(x.when)).length;
        toast(overdue ? `⏰ ${overdue} vencido(s)` : "Sin vencidos ✅");
      });
    }
    if($("btnReceived")){
      $("btnReceived").addEventListener("click", async ()=>{
        setPane("commitments");
        setViewPending();
        const c = Math.max(0, Number(received?.c || 0));
        if(!c){ toast("Sin recibidos"); return; }

        const ok = await Confirm.open({
          title:"Recibidos",
          msg:`Has recibido <b>${c}</b> paquete(s).<br>¿Marcar como vistos y poner el contador a 0?`,
          yesText:"Sí, marcar vistos",
          danger:false
        });
        if(ok){
          received = { c:0, lastAt:null };
          save(RECEIVED_KEY, received);
          renderAll();
          toast("Recibidos marcados ✅");
        }
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

    if(sel.value === "__custom__"){
      customWrap.style.display = "";
      try{ fWho.focus(); }catch(e){}
    }else{
      customWrap.style.display = "none";
    }
  }

  /* =========================
     Modal Compromiso
  ========================= */
  let currentEditCommitId = null;

  function openCommitModal(id, preContactId){
    currentEditCommitId = id || null;

    if($("modalTitle")) $("modalTitle").textContent = id ? "Editar compromiso" : "Nuevo compromiso";
    if($("btnSave")) $("btnSave").textContent = id ? "Guardar cambios" : "Guardar";

    if($("fWhat")) $("fWhat").value = "";
    if($("fWhen")) $("fWhen").value = "";
    if($("fRemind")) $("fRemind").value = "0";
    if($("fAfter")) $("fAfter").value = "0";
    if($("fWho")) $("fWho").value = "";

    if(id){
      const it = data.find(x=>x.id===id);
      if(it){
        if($("fWhat")) $("fWhat").value = it.what || "";
        if($("fRemind")) $("fRemind").value = String(Number(it.remindMin||0));
        if($("fAfter")) $("fAfter").value = String(Number(it.afterMin||0));

        if($("fWhen")){
          if(it.when){
            const d = new Date(it.when);
            if(!isNaN(d.getTime())){
              const pad = (n)=> String(n).padStart(2,"0");
              $("fWhen").value = `${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
            }
          }
        }

        fillContactSelect(it.whoId || "");
        if(!it.whoId){
          const sel = $("fContact");
          if(sel) sel.value = "__custom__";
          handleContactSelectChange();
          if($("fWho")) $("fWho").value = it.whoName || "";
        }
      }
    }else{
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

  function parseWhenToIso(){
    const v = String($("fWhen")?.value || "").trim();
    if(!v) return null;
    const d = new Date(v);
    if(isNaN(d.getTime())) return null;
    return d.toISOString();
  }

  function getSelectedWho(){
    const sel = $("fContact");
    if(!sel) return { whoId:null, whoName:"Sin nombre" };

    if(sel.value && sel.value !== "__custom__"){
      const c = contacts.find(x=>x.id===sel.value);
      return { whoId: sel.value, whoName: (c?.name || "Sin nombre") };
    }
    const name = String($("fWho")?.value || "").trim();
    return { whoId:null, whoName: name || "Sin nombre" };
  }

  async function saveCommitFromModal(){
    const what = String($("fWhat")?.value || "").trim();
    if(!what){ toast("Escribe qué se acordó ✍️"); return; }

    const whenIso = parseWhenToIso();
    const remindMin = Number($("fRemind")?.value || 0) || 0;
    const afterMin = Number($("fAfter")?.value || 0) || 0;
    const who = getSelectedWho();
    const now = new Date().toISOString();

    if(currentEditCommitId){
      const it = data.find(x=>x.id===currentEditCommitId);
      if(!it){ toast("No encontrado"); closeCommitModal(); return; }

      it.whoId = who.whoId;
      it.whoName = who.whoName;
      it.what = what;
      it.when = whenIso;
      it.remindMin = remindMin;
      it.afterMin = afterMin;
      it.updatedAt = now;

      save(KEY, data);
      closeCommitModal();
      renderAll();
      toast("Guardado ✅");
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
     Modal Contacto
  ========================= */
  let currentEditContactId = null;

  function openContactModal(id){
    currentEditContactId = id || null;

    if($("cModalTitle")) $("cModalTitle").textContent = id ? "Editar amigo" : "Nuevo amigo";
    if($("cBtnSave")) $("cBtnSave").textContent = id ? "Guardar cambios" : "Guardar";

    if($("cName")) $("cName").value = "";
    if($("cNote")) $("cNote").value = "";

    if(id){
      const c = contacts.find(x=>x.id===id);
      if(c){
        if($("cName")) $("cName").value = c.name || "";
        if($("cNote")) $("cNote").value = c.note || "";
      }
    }

    showBackdrop("cBackdrop");
    setTimeout(()=>{ try{ $("cName")?.focus(); }catch(e){} }, 30);
  }

  function closeContactModal(){
    hideBackdrop("cBackdrop");
    currentEditContactId = null;
  }

  async function saveContactFromModal(){
    const name = String($("cName")?.value || "").trim();
    const note = String($("cNote")?.value || "").trim();
    if(!name){ toast("Pon un nombre 👥"); return; }

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
     Compartir paquete
  ========================= */
  function encodePack(obj){
    const json = JSON.stringify(obj);
    const b64 = btoa(unescape(encodeURIComponent(json)))
      .replaceAll("+","-").replaceAll("/","_").replaceAll("=","");
    return b64;
  }

  function decodePack(s){
    try{
      const b64 = s.replaceAll("-","+").replaceAll("_","/");
      const pad = b64.length % 4 ? ("=".repeat(4 - (b64.length % 4))) : "";
      const json = decodeURIComponent(escape(atob(b64+pad)));
      return JSON.parse(json);
    }catch(e){ return null; }
  }

  function getBaseUrl(){
    const u = new URL(location.href);
    u.hash = "";
    u.search = "";
    return u.toString();
  }

  function buildPackageForItem(it){
    return {
      w: normalizedWho(it),
      s: it.what || "",
      n: it.when || null,
      r: Number(it.remindMin||0) || 0,
      af: Number(it.afterMin||0) || 0,
      ca: it.createdAt || new Date().toISOString()
    };
  }

  function shareSnapshot(itemId){
    const it = data.find(x=>x.id===itemId);
    if(!it){ toast("No encontrado"); return; }

    const pack = buildPackageForItem(it);
    const code = encodePack(pack);
    const url = `${getBaseUrl()}?p=${code}`;

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
      `⏳ Avisar “desde ahora”: ${Number(it.afterMin||0) ? (it.afterMin+" min") : "No"}\n\n`+
      `🔗 Enlace:\n${url}`;

    if($("shareTitle")) $("shareTitle").innerHTML = `Vas a compartir: <b>${esc(normalizedWho(it))}</b> · <b>${esc(it.what)}</b>`;
    if($("shareUrlBox")) $("shareUrlBox").textContent = url;

    const btnShort = $("shareShort");
    const btnLong = $("shareLong");
    const box = $("shareTextBox");

    function setMode(mode){
      if(btnShort) btnShort.classList.toggle("active", mode==="short");
      if(btnLong) btnLong.classList.toggle("active", mode==="long");
      if(box) box.textContent = (mode==="short") ? shortTxt : longTxt;
    }
    setMode("short");

    if(btnShort) btnShort.onclick = ()=> setMode("short");
    if(btnLong) btnLong.onclick = ()=> setMode("long");

    if($("shareCopyUrl")){
      $("shareCopyUrl").onclick = async ()=>{
        try{ await navigator.clipboard.writeText(url); toast("Enlace copiado 🔗"); }
        catch(e){ toast("No se pudo copiar"); }
      };
    }

    if($("shareCopyAll")){
      $("shareCopyAll").onclick = async ()=>{
        try{
          const txt = (btnLong && btnLong.classList.contains("active")) ? longTxt : shortTxt;
          await navigator.clipboard.writeText(txt);
          toast("Texto copiado 📋");
        }catch(e){ toast("No se pudo copiar"); }
      };
    }

    if($("shareSend")){
      $("shareSend").onclick = async ()=>{
        const txt = (btnLong && btnLong.classList.contains("active")) ? longTxt : shortTxt;
        try{
          if(navigator.share){
            await navigator.share({ text: txt });
            toast("Compartido 📤");
          }else{
            await navigator.clipboard.writeText(txt);
            toast("Copiado (sin share) 📋");
          }
        }catch(e){
          toast("Cancelado");
        }
      };
    }

    showBackdrop("shareBackdrop");
  }

  function closeShare(){ hideBackdrop("shareBackdrop"); }

  (function bindShareModal(){
    if($("shareClose")) $("shareClose").onclick = closeShare;
    if($("shareCancel")) $("shareCancel").onclick = closeShare;
    const bd = $("shareBackdrop");
    if(bd){
      bd.addEventListener("click", (e)=>{
        if(e.target === bd) closeShare();
      });
    }
  })();

  function applyIncomingPack(){
    const u = new URL(location.href);
    const p = u.searchParams.get("p");
    if(!p) return false;

    const pack = decodePack(p);
    if(!pack || typeof pack !== "object"){ toast("Paquete inválido"); return false; }

    const now = new Date().toISOString();
    const newItem = {
      id: uid(),
      whoId: null,
      whoName: String(pack.w || "Sin nombre"),
      what: String(pack.s || ""),
      when: pack.n || null,
      remindMin: Number(pack.r || 0) || 0,
      afterMin: Number(pack.af || 0) || 0,
      done:false,
      createdAt: now,
      updatedAt: null,
      doneAt: null
    };

    data.push(newItem);
    save(KEY, data);

    received.c = Math.max(0, Number(received.c||0)) + 1;
    received.lastAt = now;
    save(RECEIVED_KEY, received);

    u.searchParams.delete("p");
    history.replaceState({}, "", u.toString());

    toast("📥 Paquete recibido ✅");
    return true;
  }

  /* =========================
     Ajustes: PIN
  ========================= */
  function updateSettingsUI(){
    const swPin = $("swPin");
    if(swPin){
      swPin.classList.toggle("on", !!settings.pinEnabled);
      swPin.setAttribute("aria-checked", settings.pinEnabled ? "true" : "false");
    }

    const selAuto = $("selAutoLock");
    const selRem = $("selRemember");
    if(selAuto) selAuto.value = String(Number(settings.autoLockMin||0));
    if(selRem) selRem.value = String(Number(settings.rememberMin||0));

    const swNotif = $("swNotif");
    if(swNotif){
      swNotif.classList.toggle("on", !!settings.notifEnabled);
      swNotif.setAttribute("aria-checked", settings.notifEnabled ? "true" : "false");
    }
  }

  function hashPin(pin){
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
    if(m <= 0) settings.unlockedUntil = 0;
    else settings.unlockedUntil = Date.now() + m*60*1000;
    save(SETTINGS_KEY, settings);
  }

  function showLockOverlay(){
    showBackdrop("lockOverlay");
    resetPinEntry();
  }
  function hideLockOverlay(){
    hideBackdrop("lockOverlay");
  }

  let pinEntry = "";
  function resetPinEntry(){
    pinEntry = "";
    renderPinDots();
  }
  function renderPinDots(){
    ["d1","d2","d3","d4"].forEach((id, i)=>{
      const el = $(id);
      if(el) el.classList.toggle("on", i < pinEntry.length);
    });
  }

  function verifyPinEntry(){
    if(!settings.pinEnabled){ hideLockOverlay(); return; }
    if(pinEntry.length !== 4){ toast("PIN incompleto"); return; }
    const ok = (settings.pinHash && settings.pinHash === hashPin(pinEntry));
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

  function handlePinKey(k){
    if(k === "del"){ pinEntry = pinEntry.slice(0,-1); renderPinDots(); return; }
    if(k === "ok"){ verifyPinEntry(); return; }
    if(/^\d$/.test(k)){
      if(pinEntry.length >= 4) return;
      pinEntry += k;
      renderPinDots();
      if(pinEntry.length === 4) verifyPinEntry();
    }
  }

  let pinMode = "set"; // set | change
  function openPinModal(mode){
    pinMode = mode || "set";

    if($("pinTitle")) $("pinTitle").textContent = (pinMode==="change") ? "Cambiar PIN" : "Configurar PIN";
    if($("pinHint")){
      $("pinHint").textContent = (pinMode==="change")
        ? "Introduce tu PIN actual y el nuevo (4 dígitos)."
        : "Elige un PIN de 4 dígitos. Se guardará solo en tu móvil.";
    }
    if($("pinOldWrap")) $("pinOldWrap").style.display = (pinMode==="change") ? "" : "none";

    if($("pinOld")) $("pinOld").value = "";
    if($("pinNew")) $("pinNew").value = "";
    if($("pinNew2")) $("pinNew2").value = "";

    showBackdrop("pinBackdrop");
    setTimeout(()=>{ try{ (pinMode==="change" ? $("pinOld") : $("pinNew"))?.focus(); }catch(e){} }, 30);
  }

  function closePinModal(){ hideBackdrop("pinBackdrop"); }

  async function savePinFromModal(){
    const old = String($("pinOld")?.value || "").trim();
    const p1 = String($("pinNew")?.value || "").trim();
    const p2 = String($("pinNew2")?.value || "").trim();

    if(pinMode==="change"){
      if(old.length !== 4){ toast("PIN actual inválido"); return; }
      if(!settings.pinHash || settings.pinHash !== hashPin(old)){
        toast("PIN actual incorrecto"); return;
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
    showLockOverlay();
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
      if(p === "granted"){
        settings.notifEnabled = true;
        save(SETTINGS_KEY, settings);
        updateSettingsUI();
        if($("notifHint")) $("notifHint").textContent = "✅ Permiso concedido.";
        toast("Notificaciones activadas ✅");
      }else{
        settings.notifEnabled = false;
        save(SETTINGS_KEY, settings);
        updateSettingsUI();
        if($("notifHint")) $("notifHint").textContent = "ℹ️ Permiso no concedido. Puedes activarlo en ajustes del navegador.";
        toast("No permitido");
      }
    }catch(e){
      toast("Error pidiendo permiso");
    }
  }

  /* =========================
     Reset total
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
     Auto-bloqueo básico
  ========================= */
  function onHide(){
    if(settings.pinEnabled){
      const m = Number(settings.autoLockMin||0);
      if(m === 0){
        settings.unlockedUntil = 0;
        save(SETTINGS_KEY, settings);
      }
    }
  }
  function onShow(){
    if(settings.pinEnabled && !isUnlockedNow()){
      showLockOverlay();
    }
  }
  document.addEventListener("visibilitychange", ()=>{
    if(document.hidden) onHide();
    else onShow();
  });
  window.addEventListener("pagehide", onHide);
  window.addEventListener("pageshow", onShow);

  /* =========================
     Binds modales
  ========================= */
  (function bindModals(){
    if($("btnClose")) $("btnClose").onclick = closeCommitModal;
    if($("btnCancel")) $("btnCancel").onclick = closeCommitModal;
    if($("btnSave")) $("btnSave").onclick = saveCommitFromModal;
    const bd = $("backdrop");
    if(bd){
      bd.addEventListener("click", (e)=>{
        if(e.target === bd) closeCommitModal();
      });
    }
    if($("fContact")) $("fContact").addEventListener("change", handleContactSelectChange);

    if($("cBtnClose")) $("cBtnClose").onclick = closeContactModal;
    if($("cBtnCancel")) $("cBtnCancel").onclick = closeContactModal;
    if($("cBtnSave")) $("cBtnSave").onclick = saveContactFromModal;
    const cbd = $("cBackdrop");
    if(cbd){
      cbd.addEventListener("click", (e)=>{
        if(e.target === cbd) closeContactModal();
      });
    }

    if($("pinClose")) $("pinClose").onclick = closePinModal;
    if($("pinCancel")) $("pinCancel").onclick = closePinModal;
    if($("pinOk")) $("pinOk").onclick = savePinFromModal;
    const pbd = $("pinBackdrop");
    if(pbd){
      pbd.addEventListener("click", (e)=>{
        if(e.target === pbd) closePinModal();
      });
    }

    const keypad = $("keypad");
    if(keypad){
      keypad.addEventListener("click", (e)=>{
        const btn = e.target.closest("button");
        if(!btn) return;
        const k = btn.getAttribute("data-k");
        if(!k) return;
        handlePinKey(k);
      });
    }

    if($("lockClose")){
      $("lockClose").onclick = ()=>{
        if(settings.pinEnabled && !isUnlockedNow()){
          toast("Introduce el PIN");
          return;
        }
        hideLockOverlay();
      };
    }

    const lockBd = $("lockOverlay");
    if(lockBd){
      lockBd.addEventListener("click", (e)=>{
        if(e.target === lockBd){
          if(settings.pinEnabled && !isUnlockedNow()){
            toast("Introduce el PIN");
            return;
          }
          hideLockOverlay();
        }
      });
    }

    if($("btnLockReset")) $("btnLockReset").onclick = resetAll;
    if($("btnLockCopyLink")){
      $("btnLockCopyLink").onclick = async ()=>{
        try{ await navigator.clipboard.writeText(location.href); toast("Enlace copiado 🔗"); }
        catch(e){ toast("No se pudo copiar"); }
      };
    }
  })();

  /* =========================
     Binds settings
  ========================= */
  (function bindSettings(){
    const swPin = $("swPin");
    const swNotif = $("swNotif");

    if(swPin){
      const toggle = ()=>{
        settings.pinEnabled = !settings.pinEnabled;

        if(settings.pinEnabled){
          if(!settings.pinHash){
            settings.pinEnabled = false;
            save(SETTINGS_KEY, settings);
            updateSettingsUI();
            openPinModal("set");
            return;
          }
          settings.unlockedUntil = 0;
          save(SETTINGS_KEY, settings);
          updateSettingsUI();
          toast("PIN activado 🔒");
          showLockOverlay();
          return;
        }

        settings.unlockedUntil = 0;
        save(SETTINGS_KEY, settings);
        updateSettingsUI();
        toast("PIN desactivado");
        hideLockOverlay();
      };

      swPin.addEventListener("click", toggle);
      swPin.addEventListener("keydown", (e)=>{
        if(e.key==="Enter" || e.key===" "){ e.preventDefault(); toggle(); }
      });
    }

    if($("btnChangePin")) $("btnChangePin").onclick = ()=> openPinModal(settings.pinHash ? "change" : "set");
    if($("btnLockNow")) $("btnLockNow").onclick = lockNow;

    if($("selAutoLock")){
      $("selAutoLock").onchange = ()=>{
        settings.autoLockMin = Number($("selAutoLock").value||0) || 0;
        save(SETTINGS_KEY, settings);
        toast("Auto-bloqueo guardado");
      };
    }
    if($("selRemember")){
      $("selRemember").onchange = ()=>{
        settings.rememberMin = Number($("selRemember").value||0) || 0;
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

    if($("btnNotifPerm")) $("btnNotifPerm").onclick = requestNotifPermission;
    if($("btnResetAll")) $("btnResetAll").onclick = resetAll;
  })();

  /* =========================
     Boot
  ========================= */
  (function boot(){
    const a11y = load(A11Y_KEY, { big:false });
    applyA11yUi(!!a11y.big);
    bindA11yButtons();

    bindNav();
    bindFab();

    const applied = applyIncomingPack();
    if(applied){
      setPane("commitments");
      setViewPending();
    }

    updateSettingsUI();
    renderAll();

    if(settings.pinEnabled && !isUnlockedNow()) showLockOverlay();
    else hideLockOverlay();
  })();

  window.toggleTextBig = toggleTextBig;
  window.openCommitModal = openCommitModal;
  window.openContactModal = openContactModal;
  window.deleteCommit = deleteCommit;
  window.deleteContact = deleteContact;
  window.shareSnapshot = shareSnapshot;

})();