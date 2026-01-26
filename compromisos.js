/* compromisos.js (PARTE 1/2) */
(() => {
  "use strict";

  /* =========================
     Helpers DOM / Storage
     ========================= */
  const $ = (id) => document.getElementById(id);

  const KEY = "compromisos_data_v1";
  const CONTACTS_KEY = "compromisos_contacts_v1";
  const EVENTS_KEY = "compromisos_events_v1";
  const SETTINGS_KEY = "compromisos_settings_v1";
  const RECEIVED_KEY = "compromisos_received_v1";
  const REMIND_FIRED_KEY = "compromisos_remind_fired_v1";
  const AFTER_FIRED_KEY = "compromisos_after_fired_v1";
  const A11Y_KEY = "compromisos_a11y_v1";
  const PIN_KEY = "compromisos_pin_v1";
  const UNLOCK_KEY = "compromisos_unlock_v1";

  function load(k, fallback) {
    try {
      const raw = localStorage.getItem(k);
      if (raw == null) return fallback;
      return JSON.parse(raw);
    } catch (e) {
      return fallback;
    }
  }
  function save(k, v) {
    try {
      localStorage.setItem(k, JSON.stringify(v));
    } catch (e) {}
  }

  function uid() {
    // estable y corto
    return (
      Date.now().toString(36) +
      Math.random().toString(36).slice(2, 8) +
      Math.random().toString(36).slice(2, 6)
    );
  }

  function escapeHtml(s) {
    return String(s ?? "")
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;")
      .replaceAll("'", "&#039;");
  }

  function fmtDate(iso) {
    try {
      if (!iso) return "";
      const d = new Date(iso);
      if (Number.isNaN(d.getTime())) return "";
      return d.toLocaleString("es-ES", {
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
        hour: "2-digit",
        minute: "2-digit",
      });
    } catch (e) {
      return "";
    }
  }

  function isOverdue(iso) {
    if (!iso) return false;
    const t = new Date(iso).getTime();
    if (Number.isNaN(t)) return false;
    return t < Date.now();
  }

  function toast(msg) {
    const t = $("toast");
    if (!t) return;
    t.textContent = msg;
    t.classList.add("show");
    clearTimeout(toast._tm);
    toast._tm = setTimeout(() => t.classList.remove("show"), 2200);
  }

  /* =========================
     Estado principal
     ========================= */
  let data = load(KEY, []);
  let contacts = load(CONTACTS_KEY, []);
  let events = load(EVENTS_KEY, []);
  let settings = load(SETTINGS_KEY, {
    pinEnabled: false,
    autoLockMin: 0,      // al salir / minimizar (0 = inmediato)
    rememberMin: 0,      // recordar desbloqueo
    notifEnabled: false, // solo si usuario permite
  });

  let received = load(RECEIVED_KEY, { c: 0, lastAt: null });

  let firedMap = load(REMIND_FIRED_KEY, {}); // recordatorios por fecha
  let afterFired = load(AFTER_FIRED_KEY, {}); // recordatorios "desde ahora"

  /* =========================
     Tipos de eventos (paquetes)
     ========================= */
  const T = {
    CREATE: 1,
    DONE: 2,
    REOPEN: 3,
    DELETE: 4,
    EDIT: 5,
  };

  /* =========================
     Texto grande (Accesibilidad)
     ========================= */
  function setTextScale(big) {
    document.documentElement.style.setProperty("--fs", big ? "18px" : "16px");
    document.documentElement.style.setProperty("--fsBig", big ? "20px" : "18px");
  }
  function toggleTextScale() {
    const a11y = load(A11Y_KEY, { big: false });
    a11y.big = !a11y.big;
    save(A11Y_KEY, a11y);
    setTextScale(!!a11y.big);
    toast(a11y.big ? "🔎 Texto grande activado" : "🔎 Texto grande normal");
  }

  /* =========================
     Modal confirm (propio)
     ========================= */
  const Confirm = {
    _resolver: null,
    open({ title, msg, yesText, danger }) {
      return new Promise((resolve) => {
        this._resolver = resolve;

        if ($("confirmTitle")) $("confirmTitle").textContent = title || "Confirmar";
        if ($("confirmMsg")) $("confirmMsg").innerHTML = msg || "";
        if ($("confirmYes")) {
          $("confirmYes").textContent = yesText || "Sí, continuar";
          $("confirmYes").classList.toggle("danger", !!danger);
        }

        const b = $("confirmBackdrop");
        if (b) {
          b.classList.add("show");
          b.setAttribute("aria-hidden", "false");
        }
      });
    },
    close(val) {
      const b = $("confirmBackdrop");
      if (b) {
        b.classList.remove("show");
        b.setAttribute("aria-hidden", "true");
      }
      const r = this._resolver;
      this._resolver = null;
      if (r) r(!!val);
    },
  };

  function bindConfirm() {
    if ($("confirmClose")) $("confirmClose").onclick = () => Confirm.close(false);
    if ($("confirmNo")) $("confirmNo").onclick = () => Confirm.close(false);
    if ($("confirmYes")) $("confirmYes").onclick = () => Confirm.close(true);

    const b = $("confirmBackdrop");
    if (b) {
      b.addEventListener("click", (e) => {
        if (e.target === b) Confirm.close(false);
      });
    }
  }

  /* =========================
     Install banner (PWA)
     ========================= */
  let deferredInstallPrompt = null;

  function showInstallBanner(title, text) {
    const b = $("installBanner");
    if (!b) return;

    if ($("installTitle")) $("installTitle").textContent = title || "Instálala";
    if ($("installText")) $("installText").textContent = text || "Consejo";

    b.classList.add("show");
    b.setAttribute("aria-hidden", "false");
  }
  function hideInstallBanner() {
    const b = $("installBanner");
    if (!b) return;
    b.classList.remove("show");
    b.setAttribute("aria-hidden", "true");
  }

  async function copyText(txt) {
    try {
      await navigator.clipboard.writeText(txt);
      toast("Copiado ✅");
      return true;
    } catch (e) {
      // fallback
      try {
        const ta = document.createElement("textarea");
        ta.value = txt;
        ta.style.position = "fixed";
        ta.style.left = "-9999px";
        document.body.appendChild(ta);
        ta.select();
        document.execCommand("copy");
        document.body.removeChild(ta);
        toast("Copiado ✅");
        return true;
      } catch (e2) {
        toast("No se pudo copiar");
        return false;
      }
    }
  }

  function bindInstall() {
    if ($("btnHideBanner")) $("btnHideBanner").onclick = hideInstallBanner;

    if ($("btnInstallBanner")) {
      $("btnInstallBanner").onclick = async () => {
        try {
          if (!deferredInstallPrompt) return;
          deferredInstallPrompt.prompt();
          await deferredInstallPrompt.userChoice;
          deferredInstallPrompt = null;
          hideInstallBanner();
        } catch (e) {}
      };
    }

    if ($("btnOpenChrome")) {
      $("btnOpenChrome").onclick = () => {
        toast("Abriendo…");
        window.open(location.href, "_blank");
      };
    }

    if ($("btnCopyLink")) {
      $("btnCopyLink").onclick = () => copyText(location.href);
    }

    window.addEventListener("beforeinstallprompt", (e) => {
      e.preventDefault();
      deferredInstallPrompt = e;

      // si hay soporte de install prompt, mostramos botón instalar
      if ($("btnInstallBanner")) $("btnInstallBanner").style.display = "";
      if ($("btnOpenChrome")) $("btnOpenChrome").style.display = "none";
      if ($("btnCopyLink")) $("btnCopyLink").style.display = "";

      showInstallBanner("Instálala", "Añádela a la pantalla de inicio para usarla como app.");
    });

    // Si NO existe beforeinstallprompt (iOS/Safari), mostramos tips
    setTimeout(() => {
      if (deferredInstallPrompt) return;
      // si está en standalone ya, no molestamos
      const isStandalone =
        window.matchMedia("(display-mode: standalone)").matches ||
        window.navigator.standalone === true;

      if (isStandalone) return;

      if ($("btnInstallBanner")) $("btnInstallBanner").style.display = "none";
      if ($("btnOpenChrome")) $("btnOpenChrome").style.display = "";
      if ($("btnCopyLink")) $("btnCopyLink").style.display = "";

      showInstallBanner(
        "Instálala",
        "Consejo: en Android abre en Chrome y usa “Añadir a pantalla de inicio”."
      );
    }, 1200);
  }

  /* =========================
     Notificaciones (solo local)
     ========================= */
  async function ensureNotifPermission() {
    if (!("Notification" in window)) {
      toast("Este móvil no soporta notificaciones");
      return false;
    }
    if (Notification.permission === "granted") return true;
    if (Notification.permission === "denied") return false;

    const p = await Notification.requestPermission();
    return p === "granted";
  }

  async function showLocalNotification(title, body) {
    try {
      if (!("Notification" in window)) return false;
      if (Notification.permission !== "granted") return false;

      // si hay SW, mejor por showNotification (más consistente)
      if ("serviceWorker" in navigator) {
        const reg = await navigator.serviceWorker.getRegistration();
        if (reg && reg.showNotification) {
          await reg.showNotification(title, {
            body,
            icon: "icon-192.png",
            badge: "icon-192.png",
          });
          return true;
        }
      }
      new Notification(title, { body, icon: "icon-192.png" });
      return true;
    } catch (e) {
      return false;
    }
  }

  function updateSettingsUI() {
    // switches
    const swPin = $("swPin");
    const swNotif = $("swNotif");

    if (swPin) {
      swPin.classList.toggle("on", !!settings.pinEnabled);
      swPin.setAttribute("aria-checked", settings.pinEnabled ? "true" : "false");
    }
    if (swNotif) {
      swNotif.classList.toggle("on", !!settings.notifEnabled);
      swNotif.setAttribute("aria-checked", settings.notifEnabled ? "true" : "false");
    }

    // selects
    const selAutoLock = $("selAutoLock");
    const selRemember = $("selRemember");
    if (selAutoLock) selAutoLock.value = String(settings.autoLockMin ?? 0);
    if (selRemember) selRemember.value = String(settings.rememberMin ?? 0);

    const hint = $("notifHint");
    if (hint) {
      const perm = ("Notification" in window) ? Notification.permission : "unsupported";
      if (perm === "unsupported") hint.textContent = "ℹ️ Este dispositivo no soporta notificaciones.";
      else if (perm === "granted") hint.textContent = "✅ Notificaciones permitidas en el móvil.";
      else if (perm === "denied") hint.textContent = "⚠️ Bloqueadas en el móvil. Actívalas en ajustes del navegador.";
      else hint.textContent = "ℹ️ Pulsa “Permitir” para recibir recordatorios.";
    }
  }

  /* =========================
     Recibidos (contador)
     ========================= */
  function renderReceivedBadge() {
    const c = Math.max(0, Number(received?.c || 0));
    if ($("bReceived")) $("bReceived").textContent = String(c);
  }
  function clearReceived() {
    received = { c: 0, lastAt: null };
    save(RECEIVED_KEY, received);
  }

  /* =========================
     Badge notificaciones pendientes (compat)
     - En tu UI actual no hay numerito extra, así que lo dejamos como no-op.
     ========================= */
  function renderNotifAlertsBadge() {
    // reservado por si quieres un contador futuro
    // (mantengo la función porque tu parte 2/2 la llama)
  }

  /* =========================
     Contact select (modal compromiso)
     ========================= */
  function fillContactSelect() {
    const sel = $("fContact");
    if (!sel) return;

    sel.innerHTML = "";
    // opción "escribir sin guardar"
    const opt0 = document.createElement("option");
    opt0.value = "";
    opt0.textContent = "— Escribir sin guardar —";
    sel.appendChild(opt0);

    contacts
      .slice()
      .sort((a, b) => (a.name || "").localeCompare(b.name || "", "es"))
      .forEach((c) => {
        const o = document.createElement("option");
        o.value = c.id;
        o.textContent = c.name || "Sin nombre";
        sel.appendChild(o);
      });

    // actualizar campo customWho
    const customWrap = $("customWhoField");
    const hint = $("contactHint");
    if (!customWrap) return;

    const update = () => {
      const v = sel.value;
      const isCustom = !v;
      customWrap.style.display = isCustom ? "" : "none";
      if (hint) hint.textContent = isCustom
        ? "Escribe un nombre sin guardarlo (solo para este compromiso)."
        : "Elegiste un amigo guardado.";
    };
    sel.onchange = update;
    update();
  }

  /* =========================
     Modal compromiso (nuevo/editar)
     ========================= */
  let editingId = null;

  function openCommitModal({ mode, itemId, contactId }) {
    editingId = (mode === "edit") ? itemId : null;

    if ($("modalTitle")) $("modalTitle").textContent =
      (mode === "edit") ? "Editar compromiso" : "Nuevo compromiso";

    // reset
    if ($("fWhat")) $("fWhat").value = "";
    if ($("fWhen")) $("fWhen").value = "";
    if ($("fRemind")) $("fRemind").value = "0";
    if ($("fAfter")) $("fAfter").value = "0";
    if ($("fWho")) $("fWho").value = "";

    fillContactSelect();

    if ($("fContact")) $("fContact").value = contactId || "";

    // si editar, precargar
    if (mode === "edit" && itemId) {
      const it = data.find((x) => x.id === itemId);
      if (it) {
        if ($("fContact")) $("fContact").value = it.whoId || "";
        if ($("fWho")) $("fWho").value = it.whoName || "";
        if ($("fWhat")) $("fWhat").value = it.what || "";

        // datetime-local necesita formato local "YYYY-MM-DDTHH:MM"
        if ($("fWhen")) {
          $("fWhen").value = it.when ? toLocalInputValue(it.when) : "";
        }
        if ($("fRemind")) $("fRemind").value = String(Number(it.remindMin || 0));
        if ($("fAfter")) $("fAfter").value = String(Number(it.afterMin || 0));
      }
    }

    // refrescar custom field
    if ($("fContact") && $("fContact").onchange) $("fContact").onchange();

    showBackdrop("backdrop");
  }

  function showBackdrop(id) {
    const b = $(id);
    if (!b) return;
    b.classList.add("show");
    b.setAttribute("aria-hidden", "false");
  }
  function hideBackdrop(id) {
    const b = $(id);
    if (!b) return;
    b.classList.remove("show");
    b.setAttribute("aria-hidden", "true");
  }

  function toLocalInputValue(iso) {
    try {
      const d = new Date(iso);
      if (Number.isNaN(d.getTime())) return "";
      const pad = (n) => String(n).padStart(2, "0");
      const y = d.getFullYear();
      const m = pad(d.getMonth() + 1);
      const day = pad(d.getDate());
      const hh = pad(d.getHours());
      const mm = pad(d.getMinutes());
      return `${y}-${m}-${day}T${hh}:${mm}`;
    } catch (e) {
      return "";
    }
  }

  function fromLocalInputValue(v) {
    try {
      if (!v) return null;
      const d = new Date(v);
      if (Number.isNaN(d.getTime())) return null;
      return d.toISOString();
    } catch (e) {
      return null;
    }
  }

  /* =========================
     CRUD - contactos
     ========================= */
  function openContactModal({ mode, contactId }) {
    if ($("cModalTitle")) $("cModalTitle").textContent = (mode === "edit") ? "Editar amigo" : "Nuevo amigo";
    const c = (mode === "edit") ? contacts.find(x => x.id === contactId) : null;

    if ($("cName")) $("cName").value = c?.name || "";
    if ($("cNote")) $("cNote").value = c?.note || "";
    openContactModal._editingId = (mode === "edit") ? contactId : null;

    showBackdrop("cBackdrop");
  }

  function openContactEdit(id) {
    openContactModal({ mode: "edit", contactId: id });
  }

  function deleteContact(id) {
    (async () => {
      const ok = await Confirm.open({
        title: "Eliminar amigo",
        msg: "¿Seguro que quieres eliminar este amigo?<br><b>No</b> borra compromisos ya creados, solo lo desvincula.",
        yesText: "Sí, eliminar",
        danger: true
      });
      if (!ok) return;

      const before = contacts.length;
      contacts = contacts.filter(x => x.id !== id);
      save(CONTACTS_KEY, contacts);

      // desvincular en compromisos
      let changed = false;
      data.forEach(it => {
        if (it.whoId === id) {
          it.whoId = null;
          changed = true;
        }
      });
      if (changed) save(KEY, data);

      toast(before !== contacts.length ? "Amigo eliminado" : "No encontrado");
      fillContactSelect();
      renderAll(); // existe en parte 2/2
    })();
  }

  /* =========================
     Acciones: compromisos
     ========================= */
  function openNewCommitmentForContact(contactId) {
    setPane("commitments"); // existe en parte 2/2
    setViewPending();       // existe en parte 2/2
    openCommitModal({ mode: "new", itemId: null, contactId });
  }

  function markDone(id) {
    const it = data.find(x => x.id === id);
    if (!it) return;
    const ev = { id: uid(), type: T.DONE, at: new Date().toISOString(), payload: { i: id } };
    if (applyEvent(ev)) renderAll(); // applyEvent/renderAll en parte 2/2
  }

  function reopen(id) {
    const it = data.find(x => x.id === id);
    if (!it) return;
    const ev = { id: uid(), type: T.REOPEN, at: new Date().toISOString(), payload: { i: id } };
    if (applyEvent(ev)) renderAll();
  }

  function deleteItem(id) {
    (async () => {
      const ok = await Confirm.open({
        title: "Eliminar compromiso",
        msg: "¿Seguro que quieres eliminar este compromiso?",
        yesText: "Sí, eliminar",
        danger: true
      });
      if (!ok) return;

      const ev = { id: uid(), type: T.DELETE, at: new Date().toISOString(), payload: { i: id } };
      if (applyEvent(ev)) renderAll();
    })();
  }

  function openEditModal(id) {
    openCommitModal({ mode: "edit", itemId: id, contactId: null });
  }

  function addToCalendar(id) {
    const it = data.find(x => x.id === id);
    if (!it) return;

    const title = normalizedWho(it) + " — Compromiso";
    const details = it.what || "";
    const start = it.when ? new Date(it.when) : null;

    if (!start) {
      toast("Este compromiso no tiene fecha");
      return;
    }

    const end = new Date(start.getTime() + 30 * 60000);

    const ics =
      "BEGIN:VCALENDAR\nVERSION:2.0\nPRODID:-//Compromisos//ES\nBEGIN:VEVENT\n" +
      "UID:" + uid() + "\n" +
      "DTSTAMP:" + toICS(new Date()) + "\n" +
      "DTSTART:" + toICS(start) + "\n" +
      "DTEND:" + toICS(end) + "\n" +
      "SUMMARY:" + escapeICS(title) + "\n" +
      "DESCRIPTION:" + escapeICS(details) + "\n" +
      "END:VEVENT\nEND:VCALENDAR";

    const blob = new Blob([ics], { type: "text/calendar;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "compromiso.ics";
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1500);
    toast("Descargando calendario…");
  }

  function toICS(d) {
    const pad = (n) => String(n).padStart(2, "0");
    return (
      d.getUTCFullYear() +
      pad(d.getUTCMonth() + 1) +
      pad(d.getUTCDate()) +
      "T" +
      pad(d.getUTCHours()) +
      pad(d.getUTCMinutes()) +
      pad(d.getUTCSeconds()) +
      "Z"
    );
  }
  function escapeICS(s) {
    return String(s || "")
      .replaceAll("\\", "\\\\")
      .replaceAll("\n", "\\n")
      .replaceAll(",", "\\,")
      .replaceAll(";", "\\;");
  }

  /* =========================
     Compartir paquete (snapshot)
     ========================= */
  let shareMode = "short"; // short | long
  let shareItemId = null;

  function packItem(it) {
    // versión compacta de item
    return {
      i: it.id,
      c: it.whoId || null,
      w: it.whoName || normalizedWho(it),
      s: it.what || "",
      n: it.when || null,
      r: Number(it.remindMin || 0),
      af: Number(it.afterMin || 0),
      aa: it.afterAt || null,
      ca: it.createdAt || new Date().toISOString(),
    };
  }

  function buildEventCreateFromItem(it) {
    return {
      id: uid(),
      type: T.CREATE,
      at: new Date().toISOString(),
      payload: packItem(it),
    };
  }

  function encodeEvent(ev) {
    // base64url
    const json = JSON.stringify(ev);
    const b64 = btoa(unescape(encodeURIComponent(json)))
      .replaceAll("+", "-")
      .replaceAll("/", "_")
      .replaceAll("=", "");
    return b64;
  }

  function decodeEvent(str) {
    try {
      const b64 = str.replaceAll("-", "+").replaceAll("_", "/") + "===".slice((str.length + 3) % 4);
      const json = decodeURIComponent(escape(atob(b64)));
      return JSON.parse(json);
    } catch (e) {
      return null;
    }
  }

  function shareSnapshot(id) {
    const it = data.find(x => x.id === id);
    if (!it) return;

    shareItemId = id;
    const ev = buildEventCreateFromItem(it);
    const token = encodeEvent(ev);

    const url = new URL(location.href);
    url.searchParams.set("p", token);

    // contador recibidos (solo para demo local)
    // (no suma aquí; suma al recibirlo)
    renderShareModal(it, url.toString());
  }

  function renderShareModal(it, shareUrl) {
    if ($("shareTitle")) {
      $("shareTitle").innerHTML =
        `📦 <b>Paquete listo</b> para <b>${escapeHtml(normalizedWho(it))}</b>.`;
    }

    const shortText =
      `Compromiso:\n` +
      `• Con: ${normalizedWho(it)}\n` +
      `• Qué: ${it.what || "—"}\n` +
      (it.when ? `• Para: ${fmtDate(it.when)}\n` : "") +
      (Number(it.afterMin || 0) > 0 ? `• Avisar en: ${it.afterMin} min\n` : "");

    const longText =
      `Compromisos — paquete\n\n` +
      `Con: ${normalizedWho(it)}\n` +
      `Qué: ${it.what || "—"}\n` +
      `Creado: ${fmtDate(it.createdAt)}\n` +
      (it.updatedAt ? `Editado: ${fmtDate(it.updatedAt)}\n` : "") +
      (it.when ? `Para: ${fmtDate(it.when)}\n` : "Para: (sin fecha)\n") +
      (Number(it.remindMin || 0) > 0 ? `Recordatorio: ${it.remindMin} min antes\n` : "Recordatorio: (no)\n") +
      (Number(it.afterMin || 0) > 0 ? `Avisar “desde ahora”: ${it.afterMin} min\n` : "");

    const text = (shareMode === "long") ? longText : shortText;

    if ($("shareTextBox")) $("shareTextBox").textContent = text;
    if ($("shareUrlBox")) $("shareUrlBox").textContent = shareUrl;

    // botones modo
    if ($("shareShort")) $("shareShort").classList.toggle("active", shareMode === "short");
    if ($("shareLong")) $("shareLong").classList.toggle("active", shareMode === "long");

    showBackdrop("shareBackdrop");
  }

  async function nativeShare(text, url) {
    try {
      if (navigator.share) {
        await navigator.share({ text, url });
        return true;
      }
      return false;
    } catch (e) {
      return false;
    }
  }

  function bindShareModal() {
    if ($("shareClose")) $("shareClose").onclick = () => hideBackdrop("shareBackdrop");
    if ($("shareCancel")) $("shareCancel").onclick = () => hideBackdrop("shareBackdrop");

    if ($("shareShort")) {
      $("shareShort").onclick = () => {
        shareMode = "short";
        if (shareItemId) shareSnapshot(shareItemId);
      };
    }
    if ($("shareLong")) {
      $("shareLong").onclick = () => {
        shareMode = "long";
        if (shareItemId) shareSnapshot(shareItemId);
      };
    }

    if ($("shareCopyUrl")) {
      $("shareCopyUrl").onclick = () => {
        const u = $("shareUrlBox")?.textContent || "";
        copyText(u);
      };
    }
    if ($("shareCopyAll")) {
      $("shareCopyAll").onclick = () => {
        const txt = $("shareTextBox")?.textContent || "";
        const u = $("shareUrlBox")?.textContent || "";
        copyText(txt + "\n\n" + u);
      };
    }
    if ($("shareSend")) {
      $("shareSend").onclick = async () => {
        const txt = $("shareTextBox")?.textContent || "";
        const u = $("shareUrlBox")?.textContent || "";
        const ok = await nativeShare(txt, u);
        if (!ok) toast("Tu móvil no permite compartir directo. Usa copiar.");
      };
    }

    const b = $("shareBackdrop");
    if (b) {
      b.addEventListener("click", (e) => {
        if (e.target === b) hideBackdrop("shareBackdrop");
      });
    }
  }

  /* =========================
     Recibir paquete desde URL ?p=
     ========================= */
  function maybeReceivePackage() {
    const url = new URL(location.href);
    const token = url.searchParams.get("p");
    if (!token) return false;

    const ev = decodeEvent(token);
    if (!ev || !ev.type || !ev.payload) {
      toast("Paquete inválido");
      url.searchParams.delete("p");
      history.replaceState({}, "", url.toString());
      return false;
    }

    const changed = applyEvent(ev); // en parte 2/2
    if (changed) {
      received.c = Math.max(0, Number(received.c || 0)) + 1;
      received.lastAt = new Date().toISOString();
      save(RECEIVED_KEY, received);
      renderReceivedBadge();
      toast("📥 Paquete recibido");
    } else {
      toast("📥 Paquete ya aplicado");
    }

    url.searchParams.delete("p");
    history.replaceState({}, "", url.toString());
    return true;
  }

  /* =========================
     PIN / bloqueo
     ========================= */
  function getPin() {
    return load(PIN_KEY, { pin: null })?.pin || null;
  }
  function setPin(pin) {
    save(PIN_KEY, { pin: String(pin || "") });
  }

  function setUnlockedUntil(ts) {
    save(UNLOCK_KEY, { until: ts || 0 });
  }
  function isUnlockedNow() {
    const u = load(UNLOCK_KEY, { until: 0 });
    const until = Number(u?.until || 0);
    return until > Date.now();
  }

  let pinBuffer = "";

  function showLockOverlay() {
    const b = $("lockOverlay");
    if (!b) return;
    pinBuffer = "";
    updatePinDots();
    b.classList.add("show");
    b.setAttribute("aria-hidden", "false");
  }

  function hideLockOverlay() {
    const b = $("lockOverlay");
    if (!b) return;
    b.classList.remove("show");
    b.setAttribute("aria-hidden", "true");
  }

  function updatePinDots() {
    const dots = [$("d1"), $("d2"), $("d3"), $("d4")];
    dots.forEach((d, i) => {
      if (!d) return;
      d.classList.toggle("on", i < pinBuffer.length);
    });
  }

  function bindLockOverlay() {
    if ($("lockClose")) $("lockClose").onclick = () => {
      // no cerramos si pin está activado
      if (settings.pinEnabled) {
        toast("Introduce el PIN");
        return;
      }
      hideLockOverlay();
    };

    const keypad = $("keypad");
    if (keypad) {
      keypad.addEventListener("click", (e) => {
        const btn = e.target.closest("button");
        if (!btn) return;
        const k = btn.getAttribute("data-k");
        if (!k) return;

        if (k === "del") {
          pinBuffer = pinBuffer.slice(0, -1);
          updatePinDots();
          return;
        }

        if (k === "ok") {
          const pin = getPin();
          if (!pin) {
            toast("No hay PIN configurado");
            return;
          }
          if (pinBuffer === pin) {
            const remember = Number(settings.rememberMin || 0);
            const until = Date.now() + remember * 60000;
            setUnlockedUntil(remember > 0 ? until : Date.now() + 30 * 1000);
            hideLockOverlay();
            toast("Desbloqueado ✅");
          } else {
            toast("PIN incorrecto");
          }
          pinBuffer = "";
          updatePinDots();
          return;
        }

        // dígito
        if (/^\d$/.test(k)) {
          if (pinBuffer.length >= 4) return;
          pinBuffer += k;
          updatePinDots();
        }
      });
    }

    if ($("btnLockCopyLink")) {
      $("btnLockCopyLink").onclick = () => copyText(location.href);
    }
    if ($("btnLockReset")) {
      $("btnLockReset").onclick = () => {
        (async () => {
          const ok = await Confirm.open({
            title: "Borrar todo",
            msg: "Esto borrará compromisos, amigos y ajustes del móvil.<br><b>No se puede deshacer.</b>",
            yesText: "Sí, borrar",
            danger: true
          });
          if (!ok) return;
          localStorage.clear();
          location.reload();
        })();
      };
    }
  }

  /* =========================
     Ajustes: PIN / Notif / selects
     ========================= */
  function bindSettings() {
    const swPin = $("swPin");
    if (swPin) {
      const toggle = async () => {
        if (!settings.pinEnabled) {
          // activar => pedir configurar si no existe
          const pin = getPin();
          if (!pin) {
            openPinModal({ mode: "set" });
          } else {
            settings.pinEnabled = true;
            save(SETTINGS_KEY, settings);
            updateSettingsUI();
            toast("🔒 PIN activado");
            showLockOverlay();
          }
        } else {
          // desactivar
          const ok = await Confirm.open({
            title: "Desactivar PIN",
            msg: "Si desactivas el PIN, cualquiera podrá abrir la app.",
            yesText: "Desactivar",
            danger: true
          });
          if (!ok) return;
          settings.pinEnabled = false;
          save(SETTINGS_KEY, settings);
          updateSettingsUI();
          toast("PIN desactivado");
          hideLockOverlay();
        }
      };

      swPin.onclick = toggle;
      swPin.onkeydown = (e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          toggle();
        }
      };
    }

    const swNotif = $("swNotif");
    if (swNotif) {
      const toggle = async () => {
        if (!settings.notifEnabled) {
          const ok = await ensureNotifPermission();
          if (!ok) {
            toast("No permitido");
            settings.notifEnabled = false;
          } else {
            settings.notifEnabled = true;
            toast("Notificaciones activadas ✅");
          }
        } else {
          settings.notifEnabled = false;
          toast("Notificaciones desactivadas");
        }
        save(SETTINGS_KEY, settings);
        updateSettingsUI();
      };

      swNotif.onclick = toggle;
      swNotif.onkeydown = (e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          toggle();
        }
      };
    }

    if ($("btnNotifPerm")) {
      $("btnNotifPerm").onclick = async () => {
        const ok = await ensureNotifPermission();
        if (ok) {
          settings.notifEnabled = true;
          save(SETTINGS_KEY, settings);
          updateSettingsUI();
          toast("✅ Permiso concedido");
        } else {
          toast("Permiso no concedido");
        }
      };
    }

    if ($("selAutoLock")) {
      $("selAutoLock").onchange = () => {
        settings.autoLockMin = Number($("selAutoLock").value || 0);
        save(SETTINGS_KEY, settings);
        toast("Auto-bloqueo actualizado");
      };
    }
    if ($("selRemember")) {
      $("selRemember").onchange = () => {
        settings.rememberMin = Number($("selRemember").value || 0);
        save(SETTINGS_KEY, settings);
        toast("Recordar desbloqueo actualizado");
      };
    }

    if ($("btnChangePin")) $("btnChangePin").onclick = () => openPinModal({ mode: "change" });
    if ($("btnLockNow")) $("btnLockNow").onclick = () => showLockOverlay();

    if ($("btnResetAll")) {
      $("btnResetAll").onclick = () => {
        (async () => {
          const ok = await Confirm.open({
            title: "Borrar todo",
            msg: "Esto borrará compromisos, amigos y ajustes del móvil.<br><b>No se puede deshacer.</b>",
            yesText: "Sí, borrar",
            danger: true
          });
          if (!ok) return;
          localStorage.clear();
          location.reload();
        })();
      };
    }

    if ($("btnA11y")) $("btnA11y").onclick = toggleTextScale;
  }

  /* =========================
     Modal PIN (configurar/cambiar)
     ========================= */
  let pinMode = "set"; // set | change
  function openPinModal({ mode }) {
    pinMode = mode || "set";

    if ($("pinOld")) $("pinOld").value = "";
    if ($("pinNew")) $("pinNew").value = "";
    if ($("pinNew2")) $("pinNew2").value = "";

    const hasPin = !!getPin();
    const oldWrap = $("pinOldWrap");

    if ($("pinTitle")) $("pinTitle").textContent =
      (pinMode === "change") ? "Cambiar PIN" : "Configurar PIN";

    if ($("pinHint")) {
      $("pinHint").innerHTML =
        (pinMode === "change" && hasPin)
          ? "Introduce tu PIN actual y el nuevo."
          : "Elige un PIN de <b>4 dígitos</b> para proteger la app.";
    }

    if (oldWrap) oldWrap.style.display = (pinMode === "change" && hasPin) ? "" : "none";

    showBackdrop("pinBackdrop");
  }

  function bindPinModal() {
    if ($("pinClose")) $("pinClose").onclick = () => hideBackdrop("pinBackdrop");
    if ($("pinCancel")) $("pinCancel").onclick = () => hideBackdrop("pinBackdrop");

    if ($("pinOk")) {
      $("pinOk").onclick = () => {
        const hasPin = !!getPin();
        const old = String($("pinOld")?.value || "").trim();
        const a = String($("pinNew")?.value || "").trim();
        const b = String($("pinNew2")?.value || "").trim();

        if ((pinMode === "change") && hasPin) {
          if (old.length !== 4) return toast("PIN actual inválido");
          if (old !== getPin()) return toast("PIN actual incorrecto");
        }

        if (!/^\d{4}$/.test(a)) return toast("El nuevo PIN debe tener 4 dígitos");
        if (a !== b) return toast("Los PIN no coinciden");

        setPin(a);
        settings.pinEnabled = true;
        save(SETTINGS_KEY, settings);
        updateSettingsUI();
        hideBackdrop("pinBackdrop");
        toast("PIN guardado ✅");
        showLockOverlay();
      };
    }

    const b = $("pinBackdrop");
    if (b) {
      b.addEventListener("click", (e) => {
        if (e.target === b) hideBackdrop("pinBackdrop");
      });
    }
  }

  /* =========================
     Modal contacto
     ========================= */
  function bindContactModal() {
    if ($("cBtnClose")) $("cBtnClose").onclick = () => hideBackdrop("cBackdrop");
    if ($("cBtnCancel")) $("cBtnCancel").onclick = () => hideBackdrop("cBackdrop");

    if ($("cBtnSave")) {
      $("cBtnSave").onclick = () => {
        const name = String($("cName")?.value || "").trim();
        const note = String($("cNote")?.value || "").trim();

        if (!name) return toast("Escribe un nombre");

        const editId = openContactModal._editingId;
        if (editId) {
          const c = contacts.find(x => x.id === editId);
          if (c) {
            c.name = name;
            c.note = note || "";
          }
        } else {
          contacts.push({ id: uid(), name, note: note || "" });
        }
        save(CONTACTS_KEY, contacts);
        hideBackdrop("cBackdrop");
        toast(editId ? "Amigo actualizado" : "Amigo guardado");

        fillContactSelect();
        renderAll(); // parte 2/2
      };
    }

    const b = $("cBackdrop");
    if (b) {
      b.addEventListener("click", (e) => {
        if (e.target === b) hideBackdrop("cBackdrop");
      });
    }
  }

  /* =========================
     Modal compromiso (guardar)
     ========================= */
  function bindCommitModal() {
    if ($("btnClose")) $("btnClose").onclick = () => hideBackdrop("backdrop");
    if ($("btnCancel")) $("btnCancel").onclick = () => hideBackdrop("backdrop");

    if ($("btnSave")) {
      $("btnSave").onclick = () => {
        const whoId = String($("fContact")?.value || "").trim() || null;
        const whoName = String($("fWho")?.value || "").trim() || "Sin nombre";
        const what = String($("fWhat")?.value || "").trim();
        const whenIso = fromLocalInputValue($("fWhen")?.value || "");
        const remindMin = Number($("fRemind")?.value || 0);
        const afterMin = Number($("fAfter")?.value || 0);

        if (!what) return toast("Escribe qué se acordó");

        const now = new Date().toISOString();
        const itemId = editingId || uid();

        // si afterMin>0 => afterAt ahora
        const afterAt = afterMin > 0 ? now : null;

        const payload = {
          i: itemId,
          c: whoId,
          w: whoId ? (contacts.find(x => x.id === whoId)?.name || whoName) : whoName,
          s: what,
          n: whenIso,
          r: remindMin,
          af: afterMin,
          aa: afterAt,
          ca: now
        };

        const ev = {
          id: uid(),
          type: editingId ? T.EDIT : T.CREATE,
          at: now,
          payload
        };

        const changed = applyEvent(ev); // parte 2/2
        hideBackdrop("backdrop");

        if (changed) {
          renderAll(); // parte 2/2
          // abrir modal compartir
          const it = data.find(x => x.id === itemId);
          if (it) shareSnapshot(it.id);
        } else {
          toast("Sin cambios");
        }

        editingId = null;
      };
    }

    const b = $("backdrop");
    if (b) {
      b.addEventListener("click", (e) => {
        if (e.target === b) hideBackdrop("backdrop");
      });
    }
  }

  /* =========================
     FAB + bottom tabs + botones top
     ========================= */
  function bindNavBase() {
    // FAB
    if ($("fab")) {
      $("fab").onclick = () => {
        if (pane === "contacts") openContactModal({ mode: "new" });
        else openCommitModal({ mode: "new", itemId: null, contactId: null });
      };
    }

    // Texto grande arriba derecha
    if ($("btnA11yTop")) $("btnA11yTop").onclick = toggleTextScale;

    // Tab bottom (se reasegura también en parte 2/2)
    if ($("tabCommitments")) $("tabCommitments").onclick = () => setPane("commitments");
    if ($("tabContacts")) $("tabContacts").onclick = () => setPane("contacts");
  }

  /* =========================
     Recordatorios (se ejecuta en intervalos)
     ========================= */
  async function checkReminders() {
    if (!settings.notifEnabled) return;
    if (!("Notification" in window) || Notification.permission !== "granted") return;

    const now = Date.now();

    // por fecha
    for (const it of data) {
      if (it.done) continue;
      if (!it.when) continue;
      const rm = Number(it.remindMin || 0);
      if (!rm) continue;

      const whenT = new Date(it.when).getTime();
      if (Number.isNaN(whenT)) continue;

      const fireAt = whenT - rm * 60000;
      if (fireAt > now) continue;

      const k = firedKey(it); // parte 2/2
      if (firedMap[k]) continue;

      firedMap[k] = now;
      save(REMIND_FIRED_KEY, firedMap);

      await showLocalNotification(
        "⏰ Recordatorio",
        `${normalizedWho(it)} · ${shortPreview(it.what, 70)}`
      );
    }

    // "desde ahora" (after)
    for (const it of data) {
      if (it.done) continue;
      const am = Number(it.afterMin || 0);
      if (!am) continue;
      if (!it.afterAt) continue;

      const baseT = new Date(it.afterAt).getTime();
      if (Number.isNaN(baseT)) continue;

      const fireAt = baseT + am * 60000;
      if (fireAt > now) continue;

      const k = afterKey(it); // parte 2/2
      if (afterFired[k]) continue;

      afterFired[k] = now;
      save(AFTER_FIRED_KEY, afterFired);

      await showLocalNotification(
        "⏳ Aviso",
        `${normalizedWho(it)} · ${shortPreview(it.what, 70)}`
      );
    }
  }

  /* =========================
     Auto-bloqueo al salir
     ========================= */
  function bindAutoLock() {
    document.addEventListener("visibilitychange", () => {
      if (!settings.pinEnabled) return;

      if (document.visibilityState === "hidden") {
        const mins = Number(settings.autoLockMin || 0);
        const ts = Date.now() + mins * 60000;
        // si inmediato, expire ya
        setUnlockedUntil(mins === 0 ? 0 : ts);
      }
      if (document.visibilityState === "visible") {
        if (!isUnlockedNow()) showLockOverlay();
      }
    });
  }

  /* =========================
     Bindings iniciales (solo los que NO dependen del render final)
     ========================= */
  bindConfirm();
  bindInstall();
  bindShareModal();
  bindPinModal();
  bindLockOverlay();
  bindContactModal();
  bindCommitModal();
  bindSettings();
  bindNavBase();
  bindAutoLock();

  // aplicar preferencia texto grande al cargar
  const a11y = load(A11Y_KEY, { big: false });
  setTextScale(!!a11y.big);

  // recarga UI settings
  updateSettingsUI();

  // si entra un paquete por URL, se aplica (sin render aún)
  // el render final se hace en la parte 2/2
  // (no borres esto)
  // eslint-disable-next-line no-unused-vars
  const _received = maybeReceivePackage();

  /* =========================
     >>> CONTINÚA EN PARTE 2/2 <<<
     - applyEvent, cleanup maps, render, navegación tiles, pills, boot final.
     ========================= */

/* =========================
     FIX UI (sin scroll en pills + “Texto grande” fijo arriba derecha)
     + evita descuadres en móvil
     ========================= */
  (function injectUiFixes() {
    try {
      const st = document.createElement("style");
      st.textContent = `
        /* Pills NO deslizantes (quedan fijas en su ubicación) */
        .pills{ overflow-x: visible !important; flex-wrap: nowrap !important; scrollbar-width:none !important; }
        .pills::-webkit-scrollbar{ display:none !important; }

        /* Botón “Texto grande” SIEMPRE esquina superior derecha */
        .topbarInner{ position: relative !important; }
        .topActions{ position: static !important; }
        #btnA11yTop{
          position: absolute !important;
          top: 12px !important;
          right: 0 !important;
          z-index: 11 !important;
        }
        /* Dejamos hueco para que el botón no tape el brand */
        .brand{ padding-right: 170px !important; }

        /* En pantallas estrechas, dejamos que la topbar haga wrap sin romper */
        @media (max-width:520px){
          .brand{ padding-right: 0 !important; }
          #btnA11yTop{ top: 12px !important; right: 0 !important; }
        }
      `;
      document.head.appendChild(st);
    } catch (e) {}
  })();

  /* =========================
     applyEvent + limpieza firedMaps
     ========================= */
  function firedKey(it) {
    return `${it.id}|${it.when || ""}|${Number(it.remindMin || 0)}|${it.done ? "1" : "0"}`;
  }
  function afterKey(it) {
    return `${it.id}|${it.afterAt || ""}|${Number(it.afterMin || 0)}|${it.done ? "1" : "0"}`;
  }

  function cleanupFiredMaps() {
    const liveA = new Set();
    const liveB = new Set();

    for (const it of data) {
      if (it.done) continue;

      if (it.when && Number(it.remindMin || 0) > 0) {
        liveA.add(firedKey(it));
      }
      if (it.afterAt && Number(it.afterMin || 0) > 0) {
        liveB.add(afterKey(it));
      }
    }

    const nextA = {};
    for (const k of Object.keys(firedMap || {})) {
      if (liveA.has(k)) nextA[k] = firedMap[k];
    }
    firedMap = nextA;
    save(REMIND_FIRED_KEY, firedMap);

    const nextB = {};
    for (const k of Object.keys(afterFired || {})) {
      if (liveB.has(k)) nextB[k] = afterFired[k];
    }
    afterFired = nextB;
    save(AFTER_FIRED_KEY, afterFired);
  }

  function applyEvent(ev) {
    if (!ev || ev.type == null) return false;
    if (events.some((x) => x.id === ev.id)) return false;

    let changed = false;

    if (ev.type === T.CREATE) {
      const p = ev.payload || {};
      const itemId = p.i || uid();

      const afterMin = Number(p.af || 0);
      const afterAt = p.aa || null;

      if (!data.some((x) => x.id === itemId)) {
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
          updatedAt: null,
        });
        changed = true;
      } else {
        const it = data.find((x) => x.id === itemId);
        if (it) {
          const before = JSON.stringify(it);
          it.whoId = p.c || null;
          it.whoName = p.w || it.whoName;
          it.what = p.s ?? it.what;
          it.when = (p.n ?? it.when) || null;
          it.remindMin = Number(p.r ?? it.remindMin ?? 0);

          if (p.af != null) it.afterMin = afterMin;
          if (p.aa != null) it.afterAt = afterAt;

          it.updatedAt = ev.at;
          changed = JSON.stringify(it) !== before;
        }
      }
    } else if (ev.type === T.DONE) {
      const p = ev.payload || {};
      const it = data.find((x) => x.id === p.i);
      if (it && !it.done) {
        it.done = true;
        it.doneAt = ev.at;
        it.updatedAt = ev.at;
        changed = true;
      }
    } else if (ev.type === T.REOPEN) {
      const p = ev.payload || {};
      const it = data.find((x) => x.id === p.i);
      if (it && it.done) {
        it.done = false;
        it.doneAt = null;
        it.updatedAt = ev.at;
        changed = true;
      }
    } else if (ev.type === T.DELETE) {
      const p = ev.payload || {};
      const before = data.length;
      data = data.filter((x) => x.id !== p.i);
      changed = data.length !== before;
    } else if (ev.type === T.EDIT) {
      const p = ev.payload || {};
      const it = data.find((x) => x.id === p.i);
      if (it) {
        const before = JSON.stringify(it);
        if (p.w != null) it.whoName = p.w;
        if (p.c != null) it.whoId = p.c || null;
        if (p.s != null) it.what = p.s;
        if (p.n != null) it.when = p.n || null;
        if (p.r != null) it.remindMin = Number(p.r || 0);

        if (p.af != null) it.afterMin = Number(p.af || 0);
        if (p.aa != null) it.afterAt = p.aa || null;

        it.updatedAt = ev.at;
        changed = JSON.stringify(it) !== before;
      }
    }

    events.push(ev);
    save(EVENTS_KEY, events);
    save(KEY, data);

    cleanupFiredMaps();
    return changed;
  }

  /* =========================
     Helpers (compromisos / contactos)
     ========================= */
  function contactById(id) {
    return contacts.find((c) => c.id === id) || null;
  }

  function normalizedWho(item) {
    if (item.whoId) {
      const c = contactById(item.whoId);
      if (c && c.name) return c.name;
    }
    return item.whoName || "Sin nombre";
  }

  function shortPreview(text, n) {
    const s = String(text || "").trim();
    if (s.length <= n) return s;
    return s.slice(0, n - 1) + "…";
  }

  function remindLabel(min) {
    const m = Number(min || 0);
    if (!m) return "";
    if (m === 5) return "🔔 5m";
    if (m === 15) return "🔔 15m";
    if (m === 60) return "🔔 1h";
    if (m === 1440) return "🔔 1d";
    return "🔔";
  }

  /* =========================
     UI state / pestañas
     ========================= */
  let pane = "commitments"; // commitments | contacts | settings
  let view = "pending"; // pending | done

  function safeShow(el, show) {
    if (!el) return;
    el.style.display = show ? "" : "none";
  }

  function setPane(newPane) {
    pane = newPane;

    const tC = $("tabCommitments");
    const tA = $("tabContacts");

    if (tC) tC.classList.toggle("active", pane === "commitments");
    if (tA) tA.classList.toggle("active", pane === "contacts");

    safeShow($("commitmentsPane"), pane === "commitments");
    safeShow($("contactsPane"), pane === "contacts");
    safeShow($("settingsPane"), pane === "settings");

    const fab = $("fab");
    if (fab) {
      if (pane === "settings") fab.style.display = "none";
      else {
        fab.style.display = "grid";
        fab.setAttribute(
          "aria-label",
          pane === "contacts" ? "Nuevo amigo" : "Nuevo compromiso"
        );
      }
    }

    renderAll();
    try {
      window.scrollTo({ top: 0, behavior: "smooth" });
    } catch (e) {
      window.scrollTo(0, 0);
    }
  }

  function setViewPending() {
    view = "pending";
    const a = $("tabPending");
    const b = $("tabDone");
    if (a) a.classList.add("active");
    if (b) b.classList.remove("active");
    renderCommitments();
  }
  function setViewDone() {
    view = "done";
    const a = $("tabDone");
    const b = $("tabPending");
    if (a) a.classList.add("active");
    if (b) b.classList.remove("active");
    renderCommitments();
  }

  /* =========================
     Render (contadores + listas)
     ========================= */
  function updateTileCounts() {
    const pending = data.filter((x) => !x.done);
    const done = data.filter((x) => x.done);

    if ($("tilePendingCount")) $("tilePendingCount").textContent = String(pending.length);
    if ($("tileDoneCount")) $("tileDoneCount").textContent = String(done.length);
    if ($("tileContactsCount")) $("tileContactsCount").textContent = String(contacts.length);

    if ($("bContacts")) $("bContacts").textContent = String(contacts.length);
  }

  function updateTopBadges() {
    const pending = data.filter((x) => !x.done);
    const overdueCount = pending.filter((x) => isOverdue(x.when)).length;

    if ($("bOverdue")) $("bOverdue").textContent = String(overdueCount);

    renderNotifAlertsBadge();
    renderReceivedBadge();
    updateTileCounts();
  }

  function renderCommitments() {
    updateTopBadges();

    const list = $("list");
    const empty = $("empty");
    if (!list) return;

    list.innerHTML = "";

    const pending = data.filter((x) => !x.done);
    const done = data.filter((x) => x.done);
    const items = view === "pending" ? pending : done;

    if (empty) empty.style.display = items.length ? "none" : "block";

    items
      .slice()
      .sort((a, b) => {
        if (view === "pending") {
          const ao = isOverdue(a.when) ? 1 : 0;
          const bo = isOverdue(b.when) ? 1 : 0;
          if (ao !== bo) return bo - ao;
          const ta = a.when ? new Date(a.when).getTime() : Number.POSITIVE_INFINITY;
          const tb = b.when ? new Date(b.when).getTime() : Number.POSITIVE_INFINITY;
          if (ta !== tb) return ta - tb;
          const ua = new Date(a.updatedAt || a.createdAt || 0).getTime();
          const ub = new Date(b.updatedAt || b.createdAt || 0).getTime();
          return ub - ua;
        }
        return new Date(b.doneAt || 0).getTime() - new Date(a.doneAt || 0).getTime();
      })
      .forEach((it, idx) => list.appendChild(renderCommitmentCard(it, idx)));
  }

  function renderCommitmentCard(item, idx) {
    const card = document.createElement("div");
    card.className = "card";

    card.style.background =
      idx % 2
        ? "linear-gradient(180deg, rgba(255,255,255,.92), rgba(255,255,255,.86))"
        : "linear-gradient(180deg, rgba(255,255,255,.96), rgba(255,255,255,.90))";

    const who = normalizedWho(item);
    const dueText = item.when ? fmtDate(item.when) : "Sin fecha";
    const overdue = !item.done && isOverdue(item.when);

    const chips = [
      `<span class="chip">📝 ${escapeHtml(fmtDate(item.createdAt))}</span>`,
      item.updatedAt ? `<span class="chip">✍️ ${escapeHtml(fmtDate(item.updatedAt))}</span>` : "",
      item.done ? `<span class="chip">✅ ${escapeHtml(fmtDate(item.doneAt))}</span>` : "",
      item.when && Number(item.remindMin || 0) > 0
        ? `<span class="chip">${escapeHtml(remindLabel(item.remindMin))}</span>`
        : "",
      item.afterAt && Number(item.afterMin || 0) > 0
        ? `<span class="chip">⏳ ${escapeHtml(
            item.afterMin >= 60 ? item.afterMin / 60 + "h" : item.afterMin + "m"
          )}</span>`
        : "",
    ]
      .filter(Boolean)
      .join("");

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
        ${
          item.done
            ? `<button class="btn" type="button" data-act="reopen">↩️ Reabrir</button>`
            : `<button class="btn good" type="button" data-act="done">✅ Hecho</button>`
        }
        <button class="btn" type="button" data-act="edit">✍️ Editar</button>
        <button class="btn danger" type="button" data-act="del">🗑️ Eliminar</button>
      </div>
    `;

    card.querySelector('[data-act="cal"]').addEventListener("click", () => addToCalendar(item.id));
    card.querySelector('[data-act="share"]').addEventListener("click", () => shareSnapshot(item.id));
    card.querySelector('[data-act="edit"]').addEventListener("click", () => openEditModal(item.id));
    card.querySelector('[data-act="del"]').addEventListener("click", () => deleteItem(item.id));
    if (item.done) card.querySelector('[data-act="reopen"]').addEventListener("click", () => reopen(item.id));
    else card.querySelector('[data-act="done"]').addEventListener("click", () => markDone(item.id));

    return card;
  }

  function renderContacts() {
    const list = $("contactsList");
    const empty = $("contactsEmpty");
    if (!list) return;

    list.innerHTML = "";
    if (empty) empty.style.display = contacts.length ? "none" : "block";

    contacts
      .slice()
      .sort((a, b) => (a.name || "").localeCompare(b.name || "", "es"))
      .forEach((c, idx) => list.appendChild(renderContactCard(c, idx)));
  }

  function renderContactCard(c, idx) {
    const card = document.createElement("div");
    card.className = "card";
    card.style.background =
      idx % 2
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

    card.addEventListener("click", (e) => {
      const inBtn = e.target.closest("button");
      if (inBtn) return;
      openCommitWithFriend();
    });

    card.style.cursor = "pointer";
    card.setAttribute("role", "button");
    card.setAttribute("tabindex", "0");
    card.addEventListener("keydown", (e) => {
      if (e.key === "Enter" || e.key === " ") {
        e.preventDefault();
        openCommitWithFriend();
      }
    });

    card.querySelector('[data-act="new"]').addEventListener("click", openCommitWithFriend);
    card.querySelector('[data-act="edit"]').addEventListener("click", () => openContactEdit(c.id));
    card.querySelector('[data-act="del"]').addEventListener("click", () => deleteContact(c.id));

    return card;
  }

  function renderAll() {
    renderCommitments();
    renderContacts();
    fillContactSelect();
    updateSettingsUI();
    renderNotifAlertsBadge();
    renderReceivedBadge();
    updateTileCounts();
  }

  /* =========================
     NAVEGACIÓN: Tiles (Pendiente/Hecho/Amigos/Ajustes)
     ========================= */
  function bindTileNav() {
    const bind = (id, fn) => {
      const el = $(id);
      if (!el) return;
      el.addEventListener("click", fn);
      el.addEventListener("keydown", (e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          fn();
        }
      });
    };

    bind("tilePending", () => {
      setPane("commitments");
      setViewPending();
      toast("📝 Pendientes");
    });
    bind("tileDone", () => {
      setPane("commitments");
      setViewDone();
      toast("✅ Hechos");
    });
    bind("tileContacts", () => {
      setPane("contacts");
      toast("👥 Amigos");
    });
    bind("tileSettings", () => {
      setPane("settings");
      toast("⚙️ Ajustes");
    });
  }

  /* =========================
     Pills (Vencidos/Recibidos)
     ========================= */
  function goToCommitmentsPending() {
    setPane("commitments");
    setViewPending();
    try {
      window.scrollTo({ top: 0, behavior: "smooth" });
    } catch (e) {
      window.scrollTo(0, 0);
    }
  }
  function scrollToFirstOverdue() {
    const list = $("list");
    if (!list) return;
    const first = list.querySelector(".due.bad");
    if (first) {
      const card = first.closest(".card");
      if (card) {
        try {
          card.scrollIntoView({ behavior: "smooth", block: "start" });
        } catch (e) {}
      }
    }
  }

  if ($("btnOverdue")) {
    $("btnOverdue").addEventListener("click", () => {
      goToCommitmentsPending();
      const overdueCount = data.filter((x) => !x.done && isOverdue(x.when)).length;
      if (overdueCount > 0) {
        toast(`⏰ ${overdueCount} vencido(s)`);
        setTimeout(scrollToFirstOverdue, 250);
      } else toast("Sin vencidos ✅");
    });
  }

  if ($("btnReceived")) {
    $("btnReceived").addEventListener("click", async () => {
      const c = Math.max(0, Number(received?.c || 0));
      const alreadyThere = pane === "commitments" && view === "pending";
      if (!alreadyThere) {
        goToCommitmentsPending();
        toast(c > 0 ? "📥 Paquetes recibidos" : "Sin recibidos");
        return;
      }
      if (c <= 0) {
        toast("Sin recibidos");
        return;
      }

      const ok = await Confirm.open({
        title: "Recibidos",
        msg: `Has recibido <b>${c}</b> paquete(s).<br>¿Marcar como vistos y poner el contador a 0?`,
        yesText: "Sí, marcar vistos",
        danger: false,
      });
      if (ok) {
        clearReceived();
        renderReceivedBadge();
        toast("Recibidos marcados ✅");
      }
    });
  }

  /* =========================
     Re-enganche de handlers core (por si Android pierde listeners)
     ========================= */
  (function ensureCoreHandlers() {
    if ($("tabCommitments")) $("tabCommitments").onclick = () => setPane("commitments");
    if ($("tabContacts")) $("tabContacts").onclick = () => setPane("contacts");

    if ($("tabPending")) $("tabPending").onclick = setViewPending;
    if ($("tabDone")) $("tabDone").onclick = setViewDone;

    if ($("btnA11yTop")) $("btnA11yTop").onclick = toggleTextScale;

    bindTileNav();
  })();

  /* =========================
     BOOT (final)
     ========================= */
  // preferencia texto grande ya aplicada en parte 1, pero reaseguramos
  const a11y2 = load(A11Y_KEY, { big: false });
  setTextScale(!!a11y2.big);

  updateSettingsUI();
  renderAll();
  bindTileNav();

  // demo inicial
  if (data.length === 0) {
    const now = new Date().toISOString();
    const ev = {
      id: uid(),
      type: T.CREATE,
      at: now,
      payload: {
        i: uid(),
        c: null,
        w: "Ejemplo: Laura",
        s: "Te paso el PDF del seguro",
        n: new Date(Date.now() + 3 * 60 * 60 * 1000).toISOString(),
        r: 15,
        af: 60,
        aa: new Date(Date.now() + 60 * 60 * 1000).toISOString(),
        ca: now,
      },
    };
    applyEvent(ev);
    renderAll();
  }

  cleanupFiredMaps();

  if (settings.pinEnabled && !isUnlockedNow()) {
    showLockOverlay();
  } else {
    hideLockOverlay();
  }

  setInterval(() => {
    if (settings.pinEnabled && !isUnlockedNow()) return;
    checkReminders();
  }, 20000);

  setTimeout(() => {
    if (settings.pinEnabled && !isUnlockedNow()) return;
    checkReminders();
  }, 1200);

})(); // 🔚 FIN