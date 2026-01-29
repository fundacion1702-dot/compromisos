/* =========================
     ✅ Ajustes / PIN / Notificaciones / PWA (mínimo estable)
     (para que NO se rompa nada aunque algún bloque no lo uses aún)
  ========================= */

  function setSwitchVisual(swEl, on){
    if(!swEl) return;
    swEl.setAttribute("aria-checked", on ? "true" : "false");
    swEl.classList.toggle("on", !!on);
  }

  function bindSettings(){
    // Switch PIN
    const swPin = $("swPin");
    if(swPin && swPin.dataset.bound !== "1"){
      swPin.dataset.bound = "1";
      const toggle = ()=>{
        settings.pinEnabled = !settings.pinEnabled;
        save(SETTINGS_KEY, settings);
        setSwitchVisual(swPin, settings.pinEnabled);
        toast(settings.pinEnabled ? "🔒 PIN activado" : "🔓 PIN desactivado");
      };
      swPin.addEventListener("click", toggle);
      swPin.addEventListener("keydown", (e)=>{
        if(e.key==="Enter" || e.key===" "){ e.preventDefault(); toggle(); }
      });
    }
    setSwitchVisual(swPin, !!settings.pinEnabled);

    // Cambiar PIN / Bloquear ahora (si más adelante metes lógica real, aquí ya está el enganche)
    const btnChangePin = $("btnChangePin");
    if(btnChangePin && btnChangePin.dataset.bound !== "1"){
      btnChangePin.dataset.bound = "1";
      btnChangePin.addEventListener("click", ()=>{
        toast("🔁 Cambiar PIN (pendiente de lógica)");
        // Si quieres, aquí abrimos pinBackdrop en el futuro
        // showBackdrop("pinBackdrop");
      });
    }

    const btnLockNow = $("btnLockNow");
    if(btnLockNow && btnLockNow.dataset.bound !== "1"){
      btnLockNow.dataset.bound = "1";
      btnLockNow.addEventListener("click", ()=>{
        toast("🔒 Bloqueo (pendiente de lógica)");
        // showBackdrop("lockOverlay"); // si lo activas más adelante
      });
    }

    // Autolock / recordar (guardado sin romper)
    const selAuto = $("selAutoLock");
    if(selAuto && selAuto.dataset.bound !== "1"){
      selAuto.dataset.bound = "1";
      selAuto.value = String(settings.autoLockMin || 0);
      selAuto.addEventListener("change", ()=>{
        settings.autoLockMin = Number(selAuto.value || 0);
        save(SETTINGS_KEY, settings);
        toast("✅ Ajuste guardado");
      });
    } else if(selAuto){
      selAuto.value = String(settings.autoLockMin || 0);
    }

    const selRemember = $("selRemember");
    if(selRemember && selRemember.dataset.bound !== "1"){
      selRemember.dataset.bound = "1";
      selRemember.value = String(settings.rememberMin || 0);
      selRemember.addEventListener("change", ()=>{
        settings.rememberMin = Number(selRemember.value || 0);
        save(SETTINGS_KEY, settings);
        toast("✅ Ajuste guardado");
      });
    } else if(selRemember){
      selRemember.value = String(settings.rememberMin || 0);
    }

    // Switch notificaciones (solo guardado)
    const swNotif = $("swNotif");
    if(swNotif && swNotif.dataset.bound !== "1"){
      swNotif.dataset.bound = "1";
      const toggle = ()=>{
        settings.notifEnabled = !settings.notifEnabled;
        save(SETTINGS_KEY, settings);
        setSwitchVisual(swNotif, settings.notifEnabled);
        toast(settings.notifEnabled ? "🔔 Notificaciones ON" : "🔕 Notificaciones OFF");
      };
      swNotif.addEventListener("click", toggle);
      swNotif.addEventListener("keydown", (e)=>{
        if(e.key==="Enter" || e.key===" "){ e.preventDefault(); toggle(); }
      });
    }
    setSwitchVisual(swNotif, !!settings.notifEnabled);

    const btnNotifPerm = $("btnNotifPerm");
    if(btnNotifPerm && btnNotifPerm.dataset.bound !== "1"){
      btnNotifPerm.dataset.bound = "1";
      btnNotifPerm.addEventListener("click", async ()=>{
        // Pedir permiso si existe Notification API (sin romper si no)
        if(!("Notification" in window)){
          toast("Tu navegador no soporta notificaciones.");
          return;
        }
        try{
          const p = await Notification.requestPermission();
          if(p === "granted") toast("✅ Permiso concedido");
          else toast("Permiso no concedido");
        }catch(e){
          toast("No se pudo pedir permiso.");
        }
      });
    }

    // Reset
    const btnResetAll = $("btnResetAll");
    if(btnResetAll && btnResetAll.dataset.bound !== "1"){
      btnResetAll.dataset.bound = "1";
      btnResetAll.addEventListener("click", async ()=>{
        const ok = await askConfirm({
          title:"Borrar todo",
          msg:"Vas a borrar compromisos, amigos y ajustes de este móvil. ¿Continuar?",
          yes:"Sí, borrar",
          no:"Cancelar"
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
          notifEnabled:false
        };
        received = { c:0, lastAt:null };

        save(SETTINGS_KEY, settings);
        save(RECEIVED_KEY, received);

        fillCommitFriendSelect();
        renderAll();
        toast("🧹 Borrado completo");
        setPane("commitments");
        setView("pending");
      });
    }
  }

  // Stubs “seguros” para que NO pete si no están implementados todavía
  function bindCommitModal(){ /* ya lo controlamos desde openCommitModal + botones */ }
  function bindContactModal(){ /* idem */ }
  function bindShare(){ /* openShareModalForLast lo hace */ }
  function bindInstall(){
    // Si hay algo de instalación, lo dejamos sin romper:
    const btnInstall = $("btnInstall");
    const btnInstallBanner = $("btnInstallBanner");
    const btnHideBanner = $("btnHideBanner");
    const banner = $("installBanner");

    if(btnHideBanner && btnHideBanner.dataset.bound !== "1"){
      btnHideBanner.dataset.bound = "1";
      btnHideBanner.addEventListener("click", ()=>{
        if(banner) banner.style.display = "none";
      });
    }

    // ocultamos botones si no se usan
    if(btnInstall) btnInstall.style.display = "none";
    if(btnInstallBanner) btnInstallBanner.style.display = "none";
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

    // ✅ Autocompletado propio (SIN datalist nativo y SIN flechitas)
    bindWhoAutocomplete();

    // Ajustes / etc (en modo estable)
    bindCommitModal();
    bindContactModal();
    bindShare();
    bindSettings();
    bindInstall();

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