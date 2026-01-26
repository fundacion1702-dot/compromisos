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
