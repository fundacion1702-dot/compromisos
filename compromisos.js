function renderCommitments(){
    ensureCommitFiltersUi();
    updateCounts();

    const list = $("list");
    const empty = $("empty");
    if(!list || !empty) return;

    let items = (data || []).filter(x=>x.status===view);
    items = items.filter(passesCommitFilters);

    // Orden: vencidos arriba en pendientes; luego por fecha (si hay), y luego por creación
    items.sort((a,b)=>{
      if(view==="pending"){
        const ao = isOverdue(a.when), bo = isOverdue(b.when);
        if(ao && !bo) return -1;
        if(!ao && bo) return 1;
      }
      const at = a.when ? new Date(a.when).getTime() : Infinity;
      const bt = b.when ? new Date(b.when).getTime() : Infinity;
      if(at !== bt) return at - bt;

      const ac = a.createdAt ? new Date(a.createdAt).getTime() : 0;
      const bc = b.createdAt ? new Date(b.createdAt).getTime() : 0;
      return bc - ac;
    });

    list.innerHTML = "";

    if(!items.length){
      empty.style.display = "block";
      return;
    }
    empty.style.display = "none";

    items.forEach(it=>{
      const who = normalizedWho(it);
      const when = it.when ? fmtDate(it.when) : "Sin fecha";
      const overdue = (it.status==="pending" && isOverdue(it.when));

      const chips = [];
      chips.push(`<span class="chip status">${esc(statusLabel(it.status))}</span>`);
      if(it.whoId) chips.push(`<span class="chip">👥 Amigo</span>`);
      else chips.push(`<span class="chip">✍️ Escrito</span>`);

      // recordatorio simple
      if(it.remindMin && Number(it.remindMin)>0 && it.when){
        chips.push(`<span class="chip">🔔 ${esc(String(it.remindMin))} min</span>`);
      }
      if(it.afterMin && Number(it.afterMin)>0){
        chips.push(`<span class="chip">⏱️ ${esc(String(it.afterMin))} min</span>`);
      }

      const dueClass = overdue ? "due bad" : "due";
      const dueText = overdue ? `${esc(when)} · Vencido` : esc(when);

      const el = document.createElement("div");
      el.className = "card";
      el.innerHTML = `
        <div class="cardTop">
          <div class="who">
            <p class="name">${esc(who)}</p>
            <p class="meta">${chips.join("")}</p>
          </div>
          <div class="${dueClass}">⏰ ${dueText}</div>
        </div>
        <div class="desc">${esc(it.what || "")}</div>
        <div class="actions" data-id="${esc(it.id)}"></div>
      `;

      const actions = el.querySelector(".actions");
      if(actions){
        // ✅ acciones rápidas
        if(it.status === "pending"){
          actions.appendChild(btn("✅ Cerrar", "good", ()=> setStatus(it.id, "closed")));
          actions.appendChild(btn("⏳ Pasar a En espera", "primary", ()=> setStatus(it.id, "waiting")));
          actions.appendChild(btn("✏️ Editar", "", ()=> openEdit(it.id)));
          actions.appendChild(btn("🗑️ Eliminar", "danger", ()=> askDelete(it.id)));
        }else if(it.status === "waiting"){
          actions.appendChild(btn("✅ Cerrar", "good", ()=> setStatus(it.id, "closed")));
          actions.appendChild(btn("🟣 Reabrir a Pendiente", "primary", ()=> setStatus(it.id, "pending")));
          actions.appendChild(btn("✏️ Editar", "", ()=> openEdit(it.id)));
          actions.appendChild(btn("🗑️ Eliminar", "danger", ()=> askDelete(it.id)));
        }else{
          actions.appendChild(btn("🟣 Reabrir a Pendiente", "primary", ()=> setStatus(it.id, "pending")));
          actions.appendChild(btn("✏️ Editar", "", ()=> openEdit(it.id)));
          actions.appendChild(btn("🗑️ Eliminar", "danger", ()=> askDelete(it.id)));
        }
      }

      list.appendChild(el);
    });
  }

  function btn(label, cls, onClick){
    const b = document.createElement("button");
    b.className = "btn" + (cls ? " " + cls : "");
    b.type = "button";
    b.textContent = label;
    b.addEventListener("click", onClick);
    return b;
  }

  function renderContacts(){
    updateCounts();

    const list = $("contactsList");
    const empty = $("contactsEmpty");
    if(!list || !empty) return;

    let items = (contacts || []).slice().sort((a,b)=> (a.name||"").localeCompare(b.name||"", "es"));

    const q = (contactsTextFilter || "").trim().toLowerCase();
    if(q){
      items = items.filter(c=>{
        const n = (c.name||"").toLowerCase();
        const note = (c.note||"").toLowerCase();
        return n.includes(q) || note.includes(q);
      });
    }

    list.innerHTML = "";
    if(!items.length){
      empty.style.display = "block";
      return;
    }
    empty.style.display = "none";

    items.forEach(c=>{
      const el = document.createElement("div");
      el.className = "card";
      el.innerHTML = `
        <div class="cardTop">
          <div class="who">
            <p class="name">${esc(c.name||"Sin nombre")}</p>
            <p class="meta">${c.note ? `<span class="chip">📝 ${esc(c.note)}</span>` : `<span class="chip">👥 Amigo</span>`}</p>
          </div>
          <div class="due">👤</div>
        </div>
        <div class="actions"></div>
      `;
      const a = el.querySelector(".actions");
      if(a){
        a.appendChild(btn("🗓️ Nuevo compromiso", "primary", ()=>{
          setPane("commitments");
          openNewWithContact(c);
        }));
        a.appendChild(btn("✏️ Editar", "", ()=> openContactEdit(c.id)));
        a.appendChild(btn("🗑️ Eliminar", "danger", ()=> askDeleteContact(c.id)));
      }
      list.appendChild(el);
    });
  }

  function renderSettings(){
    // switches (PIN / Notif) se actualizan por estado
    const swPin = $("swPin");
    const swNotif = $("swNotif");
    if(swPin){
      swPin.classList.toggle("on", !!settings.pinEnabled);
      swPin.setAttribute("aria-checked", settings.pinEnabled ? "true" : "false");
    }
    if(swNotif){
      swNotif.classList.toggle("on", !!settings.notifEnabled);
      swNotif.setAttribute("aria-checked", settings.notifEnabled ? "true" : "false");
    }
    const selAuto = $("selAutoLock");
    const selRem = $("selRemember");
    if(selAuto) selAuto.value = String(settings.autoLockMin ?? 0);
    if(selRem) selRem.value = String(settings.rememberMin ?? 0);
  }

  function renderAll(){
    ensureWaitingPill();
    fixPillsOrder();
    updateCommitmentsHeading();
    updateCounts();

    if(pane === "commitments"){
      renderCommitments();
    }else if(pane === "contacts"){
      renderContacts();
    }else{
      renderSettings();
    }
  }

  /* =========================
     Datos: CRUD compromisos
  ========================= */
  function persist(){
    save(KEY, data);
    renderAll();
  }

  function setStatus(id, status){
    const it = data.find(x=>x.id===id);
    if(!it) return;
    it.status = status;
    it.done = (status==="closed");
    if(status==="closed"){
      it.closedAt = new Date().toISOString();
      it.doneAt = it.closedAt;
    }else{
      it.closedAt = null;
      it.doneAt = null;
    }
    persist();
  }

  function askDelete(id){
    confirmModal("Eliminar compromiso", "Se eliminará de tu móvil. ¿Continuar?", ()=>{
      data = data.filter(x=>x.id!==id);
      persist();
    });
  }

  function openEdit(id){
    const it = data.find(x=>x.id===id);
    if(!it) return;
    openCommitModal(it);
  }

  function createOrUpdateCommit(payload){
    if(payload.id){
      const idx = data.findIndex(x=>x.id===payload.id);
      if(idx>=0){
        data[idx] = normalizeStatus({ ...data[idx], ...payload, updatedAt:new Date().toISOString() });
      }
    }else{
      const now = new Date().toISOString();
      data.unshift(normalizeStatus({
        id: uid(),
        createdAt: now,
        updatedAt: now,
        status: "pending",
        done: false,
        ...payload
      }));
    }
    save(KEY, data);
  }

  /* =========================
     Datos: CRUD contactos
  ========================= */
  function persistContacts(){
    save(CONTACTS_KEY, contacts);
    renderAll();
  }

  function askDeleteContact(id){
    confirmModal("Eliminar amigo", "Se eliminará el amigo de tu móvil. Los compromisos que lo usen quedarán como nombre escrito.", ()=>{
      const c = getContactById(id);
      contacts = contacts.filter(x=>x.id!==id);
      // desvincular compromisos
      data = (data||[]).map(it=>{
        if(it.whoId === id){
          return { ...it, whoId:null, whoName: (c?.name || it.whoName || "") };
        }
        return it;
      });
      save(KEY, data);
      persistContacts();
    });
  }

  function openContactEdit(id){
    const c = getContactById(id);
    if(!c) return;
    openContactModal(c);
  }

  /* =========================
     ✅ MODAL genérico confirm
  ========================= */
  function confirmModal(title, msg, onYes){
    const bd = $("confirmBackdrop");
    if(!bd) return;

    $("confirmTitle").textContent = title || "Confirmar";
    $("confirmMsg").innerHTML = esc(msg || "");

    const close = ()=>{
      bd.classList.remove("show");
      bd.setAttribute("aria-hidden","true");
      $("confirmNo").onclick = null;
      $("confirmYes").onclick = null;
      $("confirmClose").onclick = null;
    };

    $("confirmNo").onclick = ()=> close();
    $("confirmClose").onclick = ()=> close();
    $("confirmYes").onclick = ()=>{
      close();
      try{ onYes && onYes(); }catch(e){}
    };

    bd.classList.add("show");
    bd.setAttribute("aria-hidden","false");
  }

  /* =========================
     MODAL: Nuevo/Editar Compromiso
     - Campo “Nombre” con autocompletado bonito (sin datalist nativo)
     - Si no existe y guardas -> pregunta crear amigo (ya lo tenías; lo mantenemos)
  ========================= */
  let editingCommitId = null;

  function openCommitModal(existing){
    editingCommitId = existing?.id || null;

    const bd = $("backdrop");
    if(!bd) return;

    // refs
    const title = $("modalTitle");
    const who = $("fWho");
    const what = $("fWhat");
    const when = $("fWhen");
    const remind = $("fRemind");
    const after = $("fAfter");

    title.textContent = editingCommitId ? "Editar compromiso" : "Nuevo compromiso";

    // rellenar
    who.value = existing ? (normalizedWho(existing) || "") : "";
    what.value = existing ? (existing.what || "") : "";
    when.value = existing && existing.when ? toLocalInput(existing.when) : "";
    remind.value = String(existing?.remindMin || 0);
    after.value = String(existing?.afterMin || 0);

    // ✅ Atar autocompletado “Nombre”
    bindWhoAutocomplete();

    // abrir
    bd.classList.add("show");
    bd.setAttribute("aria-hidden","false");

    // focus
    setTimeout(()=>{ try{ who.focus(); }catch(e){} }, 0);
  }

  function toLocalInput(iso){
    try{
      if(!iso) return "";
      const d = new Date(iso);
      if(isNaN(d.getTime())) return "";
      const pad = (n)=> String(n).padStart(2,"0");
      return `${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
    }catch(e){ return ""; }
  }

  function closeCommitModal(){
    const bd = $("backdrop");
    if(!bd) return;
    bd.classList.remove("show");
    bd.setAttribute("aria-hidden","true");
    editingCommitId = null;
    try{ AC.hide(); }catch(_){}
  }

  function openNewWithContact(contact){
    openCommitModal({
      whoId: contact.id,
      whoName: contact.name || "",
      what: "",
      when: null,
      remindMin: 0,
      afterMin: 0,
      status: "pending",
      done: false
    });
  }

  function bindCommitModalButtons(){
    const bd = $("backdrop");
    if(!bd) return;

    const close = $("btnClose");
    const cancel = $("btnCancel");
    if(close) close.onclick = closeCommitModal;
    if(cancel) cancel.onclick = closeCommitModal;

    const saveBtn = $("btnSave");
    if(saveBtn){
      saveBtn.onclick = ()=>{
        const whoVal = AC.normalize($("fWho").value);
        const whatVal = AC.normalize($("fWhat").value);
        const whenVal = $("fWhen").value ? new Date($("fWhen").value).toISOString() : null;

        const remindMin = Number($("fRemind").value || 0);
        const afterMin = Number($("fAfter").value || 0);

        if(!whoVal){
          toast("Escribe un nombre");
          return;
        }
        if(!whatVal){
          toast("Escribe qué se acordó");
          return;
        }

        // ✅ si coincide exacto con amigo -> vincula
        const c = findContactByName(whoVal);
        const whoId = c ? c.id : null;
        const whoName = c ? (c.name || whoVal) : whoVal;

        const payload = {
          id: editingCommitId || undefined,
          whoId,
          whoName,
          what: whatVal,
          when: whenVal,
          remindMin,
          afterMin
        };

        // si editaba: mantener status actual
        if(editingCommitId){
          const it = data.find(x=>x.id===editingCommitId);
          if(it) payload.status = it.status;
        }

        // ✅ si no coincide con amigo -> preguntar si guardar nuevo amigo (ya funcionaba; lo mantenemos)
        if(!c){
          confirmModal(
            "¿Guardar nuevo amigo?",
            `No existe “${whoVal}” en tus amigos. ¿Quieres guardarlo para que aparezca en la lista?`,
            ()=>{
              addContactFromName(whoVal);
              const cc = findContactByName(whoVal);
              if(cc) payload.whoId = cc.id;
              createOrUpdateCommit(payload);
              closeCommitModal();
              openShare(payload);
            }
          );
        }else{
          createOrUpdateCommit(payload);
          closeCommitModal();
          openShare(payload);
        }
      };
    }
  }

  function addContactFromName(name){
    const n = AC.normalize(name);
    if(!n) return;
    if(findContactByName(n)) return;
    contacts.unshift({ id: uid(), name: n, note: "" });
    persistContacts();
  }

  /* =========================
     ✅ Autocompletado para “Nombre” (fWho)
     - Sin flechitas raras
     - Lista solo cuando escribes
     - Letra más grande + “uno debajo de otro”
  ========================= */
  function buildWhoSuggestions(query){
    const q = AC.normalize(query).toLowerCase();
    if(!q) return [];
    const out = [];
    const seen = new Set();

    // Prioridad: amigos guardados
    contacts
      .slice()
      .sort((a,b)=> (a.name||"").localeCompare(b.name||"", "es"))
      .forEach(c=>{
        const n = c?.name || "";
        if(!n) return;
        if(n.toLowerCase().includes(q)){
          const k = n.toLowerCase();
          if(seen.has(k)) return;
          seen.add(k);
          out.push({ value:n, icon:"👤", kind:"friend", id:c.id });
        }
      });

    // También sugerimos nombres ya usados como texto (por si no están guardados)
    (data||[]).forEach(it=>{
      if(it.whoId) return;
      const n = AC.normalize(it.whoName);
      if(!n) return;
      if(n.toLowerCase().includes(q)){
        const k = n.toLowerCase();
        if(seen.has(k)) return;
        seen.add(k);
        out.push({ value:n, icon:"✍️", kind:"typed" });
      }
    });

    return out.slice(0, 8);
  }

  function bindWhoAutocomplete(){
    const inp = $("fWho");
    if(!inp) return;
    if(inp.dataset.acWho === "1") return;
    inp.dataset.acWho = "1";

    // ✅ IMPORTANTE: quitamos el datalist nativo para evitar iconitos/flechas raras
    try{
      inp.removeAttribute("list");
      const dl = $("friendsDatalist");
      if(dl) dl.innerHTML = "";
    }catch(e){}

    AC.attach(
      inp,
      (q)=> buildWhoSuggestions(q),
      (picked)=>{
        // ✅ al elegir, solo rellenamos el input; la vinculación se hace al guardar (como ya tienes)
      }
    );
  }

  /* =========================
     MODAL: Contactos (Nuevo/Editar)
  ========================= */
  let editingContactId = null;

  function openContactModal(existing){
    editingContactId = existing?.id || null;
    const bd = $("cBackdrop");
    if(!bd) return;

    $("cModalTitle").textContent = editingContactId ? "Editar amigo" : "Nuevo amigo";
    $("cName").value = existing?.name || "";
    $("cNote").value = existing?.note || "";

    bd.classList.add("show");
    bd.setAttribute("aria-hidden","false");
    setTimeout(()=>{ try{ $("cName").focus(); }catch(e){} }, 0);
  }

  function closeContactModal(){
    const bd = $("cBackdrop");
    if(!bd) return;
    bd.classList.remove("show");
    bd.setAttribute("aria-hidden","true");
    editingContactId = null;
  }

  function bindContactModalButtons(){
    const bd = $("cBackdrop");
    if(!bd) return;

    const close = $("cBtnClose");
    const cancel = $("cBtnCancel");
    if(close) close.onclick = closeContactModal;
    if(cancel) cancel.onclick = closeContactModal;

    const saveBtn = $("cBtnSave");
    if(saveBtn){
      saveBtn.onclick = ()=>{
        const name = AC.normalize($("cName").value);
        const note = AC.normalize($("cNote").value);

        if(!name){
          toast("Escribe un nombre");
          return;
        }

        const existingByName = findContactByName(name);
        if(existingByName && existingByName.id !== editingContactId){
          toast("Ya existe un amigo con ese nombre");
          return;
        }

        if(editingContactId){
          const idx = contacts.findIndex(x=>x.id===editingContactId);
          if(idx>=0){
            contacts[idx] = { ...contacts[idx], name, note };
          }
        }else{
          contacts.unshift({ id: uid(), name, note });
        }
        persistContacts();
        closeContactModal();
      };
    }
  }

  /* =========================
     Share (paquete por enlace)
     (continúa en PARTE 3/3)
  ========================= */

/* =========================
     Share (paquete por enlace)
  ========================= */
  function openShare(payload){
    // payload puede ser el objeto recién creado/actualizado (sin id quizá)
    const bd = $("shareBackdrop");
    if(!bd) return;

    const isEdit = !!payload?.id;
    const whoVal = AC.normalize(payload?.whoName || $("fWho")?.value || "");
    const whatVal = AC.normalize(payload?.what || $("fWhat")?.value || "");
    const whenIso = payload?.when || ($("fWhen")?.value ? new Date($("fWhen").value).toISOString() : null);

    const remindMin = Number(payload?.remindMin ?? $("fRemind")?.value ?? 0);
    const afterMin = Number(payload?.afterMin ?? $("fAfter")?.value ?? 0);

    // Paquete sencillo (fase 1: solo local)
    const pack = {
      v: 1,
      type: "commitment",
      whoName: whoVal,
      what: whatVal,
      when: whenIso,
      remindMin,
      afterMin
    };

    const shortTxt = [
      `📌 Compromiso`,
      `👤 ${whoVal}`,
      `📝 ${whatVal}`,
      whenIso ? `⏰ ${fmtDate(whenIso)}` : `⏰ Sin fecha`,
      remindMin && whenIso ? `🔔 Recordatorio: ${remindMin} min antes` : "",
      afterMin ? `⏱️ Avisar desde ahora: ${afterMin} min` : "",
    ].filter(Boolean).join("\n");

    const longTxt = [
      `📌 Compromiso (Compromisos)`,
      ``,
      `Nombre: ${whoVal}`,
      `Qué: ${whatVal}`,
      `Para cuándo: ${whenIso ? fmtDate(whenIso) : "Sin fecha"}`,
      `Recordatorio por fecha: ${remindMin && whenIso ? `${remindMin} min antes` : "Ninguno"}`,
      `Avisar “desde ahora”: ${afterMin ? `${afterMin} min` : "No"}`,
      ``,
      `👉 Abre el enlace para importarlo en tu móvil:`
    ].join("\n");

    const url = buildShareUrl(pack);

    const title = $("shareTitle");
    const textBox = $("shareTextBox");
    const urlBox = $("shareUrlBox");
    if(title) title.textContent = isEdit ? "Paquete para compartir (editado)" : "Paquete para compartir";
    if(textBox) textBox.textContent = shortTxt;
    if(urlBox) urlBox.textContent = url;

    // selector corto/largo
    const bShort = $("shareShort");
    const bLong = $("shareLong");

    const setMode = (mode)=>{
      if(bShort) bShort.classList.toggle("active", mode==="short");
      if(bLong) bLong.classList.toggle("active", mode==="long");
      if(textBox) textBox.textContent = (mode==="long" ? longTxt : shortTxt);
    };
    if(bShort) bShort.onclick = ()=> setMode("short");
    if(bLong) bLong.onclick = ()=> setMode("long");
    setMode("short");

    // botones
    const close = ()=> {
      bd.classList.remove("show");
      bd.setAttribute("aria-hidden","true");
    };
    $("shareClose").onclick = close;
    $("shareCancel").onclick = close;

    $("shareCopyUrl").onclick = ()=> copyToClipboard(url, "Enlace copiado");
    $("shareCopyAll").onclick = ()=> copyToClipboard((textBox?.textContent || "") + "\n\n" + url, "Texto+enlace copiado");

    $("shareSend").onclick = async ()=>{
      const txt = (textBox?.textContent || "") + "\n\n" + url;
      try{
        if(navigator.share){
          await navigator.share({ text: txt });
        }else{
          copyToClipboard(txt, "Copiado (no hay compartir)");
        }
      }catch(e){
        // cancelado o fallo
      }
    };

    bd.classList.add("show");
    bd.setAttribute("aria-hidden","false");
  }

  function buildShareUrl(pack){
    const base = location.origin + location.pathname;
    const encoded = encodeURIComponent(btoa(unescape(encodeURIComponent(JSON.stringify(pack)))));
    const u = new URL(base, location.origin);
    u.searchParams.set("p", encoded);
    return u.toString();
  }

  function tryImportFromUrl(){
    try{
      const u = new URL(location.href);
      const p = u.searchParams.get("p");
      if(!p) return;

      let raw = decodeURIComponent(p);
      let json = decodeURIComponent(escape(atob(raw)));
      const pack = JSON.parse(json);

      if(pack?.type !== "commitment") return;

      // Importar como nuevo compromiso (pendiente)
      const whoVal = AC.normalize(pack.whoName);
      const whatVal = AC.normalize(pack.what);

      if(!whoVal || !whatVal){
        toast("Paquete inválido");
        return;
      }

      const c = findContactByName(whoVal);
      const whoId = c ? c.id : null;
      const whoName = c ? c.name : whoVal;

      const now = new Date().toISOString();
      data.unshift(normalizeStatus({
        id: uid(),
        createdAt: now,
        updatedAt: now,
        status: "pending",
        done: false,
        whoId,
        whoName,
        what: whatVal,
        when: pack.when || null,
        remindMin: Number(pack.remindMin || 0),
        afterMin: Number(pack.afterMin || 0),
      }));
      save(KEY, data);

      // limpiar URL para que no reimporte al recargar
      u.searchParams.delete("p");
      history.replaceState({}, "", u.toString());

      toast("Compromiso importado");
      renderAll();
    }catch(e){
      // silencioso
    }
  }

  /* =========================
     A11y: Texto grande (persistente)
  ========================= */
  function applyBigText(){
    document.body.classList.toggle("bigText", !!settings.bigText);
    document.documentElement.classList.toggle("bigText", !!settings.bigText);
  }

  function toggleBigText(){
    settings.bigText = !settings.bigText;
    save(SETTINGS_KEY, settings);
    applyBigText();
    renderAll();
    toast(settings.bigText ? "Texto grande activado" : "Texto grande desactivado");
  }

  /* =========================
     PIN lock
  ========================= */
  function bindPin(){
    const swPin = $("swPin");
    const btnChange = $("btnChangePin");
    const btnLockNow = $("btnLockNow");
    const selAuto = $("selAutoLock");
    const selRem = $("selRemember");

    if(swPin){
      swPin.onclick = ()=>{
        settings.pinEnabled = !settings.pinEnabled;
        save(SETTINGS_KEY, settings);
        renderSettings();
        toast(settings.pinEnabled ? "PIN activado" : "PIN desactivado");
        if(settings.pinEnabled && !settings.pinHash){
          openPinSetup();
        }
      };
      swPin.onkeydown = (e)=>{ if(e.key==="Enter" || e.key===" "){ e.preventDefault(); swPin.click(); } };
    }

    if(btnChange) btnChange.onclick = ()=> openPinSetup(true);
    if(btnLockNow) btnLockNow.onclick = ()=> lockNow();

    if(selAuto){
      selAuto.onchange = ()=>{
        settings.autoLockMin = Number(selAuto.value || 0);
        save(SETTINGS_KEY, settings);
        toast("Auto-bloqueo actualizado");
      };
    }
    if(selRem){
      selRem.onchange = ()=>{
        settings.rememberMin = Number(selRem.value || 0);
        save(SETTINGS_KEY, settings);
        toast("Recordar desbloqueo actualizado");
      };
    }
  }

  function lockNow(){
    locked = true;
    showLock(true);
  }

  function showLock(show){
    const bd = $("lockOverlay");
    if(!bd) return;
    if(show){
      bd.classList.add("show");
      bd.setAttribute("aria-hidden","false");
      pinBuf = "";
      paintDots();
    }else{
      bd.classList.remove("show");
      bd.setAttribute("aria-hidden","true");
    }
  }

  function paintDots(){
    for(let i=1;i<=4;i++){
      const d = $("d"+i);
      if(!d) continue;
      d.classList.toggle("on", pinBuf.length >= i);
    }
  }

  function bindKeypad(){
    const pad = $("keypad");
    if(!pad) return;
    pad.addEventListener("click",(e)=>{
      const b = e.target.closest(".key");
      if(!b) return;
      const k = b.getAttribute("data-k");
      if(!k) return;

      if(k==="del"){
        pinBuf = pinBuf.slice(0,-1);
        paintDots();
        return;
      }
      if(k==="ok"){
        verifyPin();
        return;
      }
      if(pinBuf.length>=4) return;
      pinBuf += k;
      paintDots();
      if(pinBuf.length===4) verifyPin();
    });

    const c = $("lockClose");
    if(c) c.onclick = ()=> { /* no cerrar si está bloqueado */ };

    const copy = $("btnLockCopyLink");
    if(copy) copy.onclick = ()=> copyToClipboard(location.href, "Enlace copiado");

    const reset = $("btnLockReset");
    if(reset) reset.onclick = ()=>{
      confirmModal("Borrar todo", "Se borrarán compromisos, amigos y ajustes de este móvil. ¿Continuar?", ()=>{
        localStorage.clear();
        location.reload();
      });
    };
  }

  function verifyPin(){
    if(!settings.pinEnabled) { locked=false; showLock(false); return; }
    const ok = (hash(pinBuf) === settings.pinHash);
    if(ok){
      locked = false;
      lastUnlockAt = Date.now();
      showLock(false);
      toast("Desbloqueado");
    }else{
      toast("PIN incorrecto");
      pinBuf = "";
      paintDots();
    }
  }

  function openPinSetup(requireOld=false){
    const bd = $("pinBackdrop");
    if(!bd) return;

    const hasPin = !!settings.pinHash;
    const needOld = requireOld && hasPin;

    $("pinTitle").textContent = hasPin ? "Cambiar PIN" : "Configurar PIN";
    $("pinHint").textContent = hasPin ? (needOld ? "Introduce tu PIN actual y el nuevo." : "Define tu nuevo PIN.") : "Crea un PIN para bloquear la app.";

    $("pinOldWrap").style.display = needOld ? "block" : "none";
    $("pinOld").value = "";
    $("pinNew").value = "";
    $("pinNew2").value = "";

    const close = ()=> {
      bd.classList.remove("show");
      bd.setAttribute("aria-hidden","true");
    };
    $("pinClose").onclick = close;
    $("pinCancel").onclick = close;

    $("pinOk").onclick = ()=>{
      const oldV = $("pinOld").value.trim();
      const n1 = $("pinNew").value.trim();
      const n2 = $("pinNew2").value.trim();

      if(needOld){
        if(hash(oldV) !== settings.pinHash){
          toast("PIN actual incorrecto");
          return;
        }
      }
      if(!/^\d{4}$/.test(n1) || !/^\d{4}$/.test(n2)){
        toast("El PIN debe tener 4 dígitos");
        return;
      }
      if(n1 !== n2){
        toast("Los PIN no coinciden");
        return;
      }

      settings.pinHash = hash(n1);
      settings.pinEnabled = true;
      save(SETTINGS_KEY, settings);
      renderSettings();
      close();
      toast("PIN guardado");
    };

    bd.classList.add("show");
    bd.setAttribute("aria-hidden","false");
  }

  /* =========================
     Notificaciones (permiso básico)
  ========================= */
  function bindNotif(){
    const sw = $("swNotif");
    const btn = $("btnNotifPerm");
    const hint = $("notifHint");

    function update(){
      if(!hint) return;
      const p = (Notification && Notification.permission) ? Notification.permission : "default";
      if(p === "granted") hint.textContent = "✅ Permiso concedido. Los recordatorios se podrán mostrar si están programados.";
      else if(p === "denied") hint.textContent = "⛔ Permiso denegado. Actívalo desde Ajustes del navegador.";
      else hint.textContent = "ℹ️ Pulsa “Permitir” para recibir recordatorios.";
    }

    if(sw){
      sw.onclick = ()=>{
        settings.notifEnabled = !settings.notifEnabled;
        save(SETTINGS_KEY, settings);
        renderSettings();
        toast(settings.notifEnabled ? "Notificaciones activadas" : "Notificaciones desactivadas");
      };
      sw.onkeydown = (e)=>{ if(e.key==="Enter" || e.key===" "){ e.preventDefault(); sw.click(); } };
    }

    if(btn){
      btn.onclick = async ()=>{
        try{
          if(!("Notification" in window)){
            toast("Tu navegador no soporta notificaciones");
            return;
          }
          const p = await Notification.requestPermission();
          update();
          if(p==="granted") toast("Permiso concedido");
        }catch(e){
          toast("No se pudo pedir permiso");
        }
      };
    }

    update();
  }

  /* =========================
     Navegación panes + botones
  ========================= */
  function bindNav(){
    const tabC = $("tabCommitments");
    const tabA = $("tabContacts");
    const fab = $("fab");
    const btnA11yTop = $("btnA11yTop");
    const btnA11y = $("btnA11y");
    const gear = $("btnSettingsGear");

    if(tabC) tabC.onclick = ()=> setPane("commitments");
    if(tabA) tabA.onclick = ()=> setPane("contacts");

    if(fab) fab.onclick = ()=> openCommitModal(null);

    if(btnA11yTop) btnA11yTop.onclick = toggleBigText;
    if(btnA11y) btnA11y.onclick = toggleBigText;

    if(gear) gear.onclick = ()=> setPane("settings");

    // tiles menú
    const tPend = $("tilePending");
    const tWait = $("tileWaiting");
    const tDone = $("tileDone");
    const tCon = $("tileContacts");

    if(tPend) tPend.onclick = ()=>{ setPane("commitments"); setView("pending"); };
    if(tWait) tWait.onclick = ()=>{ setPane("commitments"); setView("waiting"); };
    if(tDone) tDone.onclick = ()=>{ setPane("commitments"); setView("closed"); };
    if(tCon) tCon.onclick = ()=>{ setPane("contacts"); };

    // seg tabs compromisos
    $("tabPending").onclick = ()=> setView("pending");
    $("tabWaiting").onclick = ()=> setView("waiting");
    $("tabDone").onclick = ()=> setView("closed");
  }

  function setPane(which){
    pane = which;

    // panes
    const pC = $("commitmentsPane");
    const pA = $("contactsPane");
    const pS = $("settingsPane");
    if(pC) pC.style.display = (pane==="commitments") ? "" : "none";
    if(pA) pA.style.display = (pane==="contacts") ? "" : "none";
    if(pS) pS.style.display = (pane==="settings") ? "" : "none";

    // bottom nav active
    const tabC = $("tabCommitments");
    const tabA = $("tabContacts");
    if(tabC) tabC.classList.toggle("active", pane==="commitments");
    if(tabA) tabA.classList.toggle("active", pane==="contacts");

    renderAll();
  }

  function setView(v){
    view = v;
    $("tabPending").classList.toggle("active", view==="pending");
    $("tabWaiting").classList.toggle("active", view==="waiting");
    $("tabDone").classList.toggle("active", view==="closed");
    renderCommitments();
  }

  /* =========================
     Misc: sticky/topbar bug guard
  ========================= */
  function mitigateStickyBug(){
    // En algunos móviles/Chrome, el position:sticky con blur puede “quedarse fijo” raro.
    // Forzamos repaint en scroll/resize, y desactivamos backdrop-filter si detectamos glitch.
    let t = null;
    window.addEventListener("scroll", ()=>{
      if(t) cancelAnimationFrame(t);
      t = requestAnimationFrame(()=>{
        const tb = document.querySelector(".topbar");
        if(!tb) return;
        // reflow
        tb.style.transform = "translateZ(0)";
        setTimeout(()=>{ tb.style.transform = ""; }, 0);
      });
    }, { passive:true });

    window.addEventListener("resize", ()=>{
      const tb = document.querySelector(".topbar");
      if(!tb) return;
      tb.style.transform = "translateZ(0)";
      setTimeout(()=>{ tb.style.transform = ""; }, 0);
    }, { passive:true });
  }

  /* =========================
     INIT
  ========================= */
  function init(){
    // cargar datos
    data = load(KEY, []);
    contacts = load(CONTACTS_KEY, []);
    settings = load(SETTINGS_KEY, settings);

    // normalizar por si venían de versiones antiguas
    data = (data||[]).map(normalizeStatus);
    save(KEY, data);

    applyBigText();

    // binds
    bindNav();
    bindCommitModalButtons();
    bindContactModalButtons();
    bindPin();
    bindKeypad();
    bindNotif();

    // importar paquete desde URL (si lo hay)
    tryImportFromUrl();

    // render
    renderAll();

    // guard sticky bug
    mitigateStickyBug();

    // auto-lock cuando se oculta la página (si pin)
    document.addEventListener("visibilitychange", ()=>{
      if(document.hidden){
        if(settings.pinEnabled && Number(settings.autoLockMin||0)===0){
          lockNow();
        }else if(settings.pinEnabled){
          const mins = Number(settings.autoLockMin||0);
          if(mins>0){
            setTimeout(()=>{
              if(document.hidden) lockNow();
            }, mins*60*1000);
          }
        }
      }else{
        // si volver y está bloqueado, mantener
      }
    });

    // recordar desbloqueo
    window.addEventListener("focus", ()=>{
      if(settings.pinEnabled){
        const rem = Number(settings.rememberMin||0);
        if(rem>0 && lastUnlockAt){
          const okUntil = lastUnlockAt + rem*60*1000;
          if(Date.now() < okUntil){
            locked = false;
            showLock(false);
            return;
          }
        }
        if(locked) showLock(true);
      }
    });
  }

  // Arranque
  if(document.readyState === "loading"){
    document.addEventListener("DOMContentLoaded", init);
  }else{
    init();
  }

})();