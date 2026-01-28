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