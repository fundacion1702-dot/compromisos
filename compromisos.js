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