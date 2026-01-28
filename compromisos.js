/* =========================
     ✅ CSS de soporte (layout + lupa + fixes)
  ========================= */
  (function injectMiniToolsCss(){
    try{
      const st = document.createElement("style");
      st.textContent = `
        /* ✅ Topbar NO fija (que se mueva con scroll) */
        .topbar{ position: static !important; top:auto !important; }
        .topbarInner{ position: static !important; }

        /* ✅ Recolocar topActions: Texto grande arriba derecha, pills centradas al eje, ⚙️ debajo */
        .topActions{
          display:grid !important;
          grid-template-columns: 1fr auto;
          grid-template-rows: auto auto auto; /* ✅ 3 filas */
          column-gap: 12px;
          row-gap: 6px;
          align-items: center;
        }
        #btnA11yTop{ grid-column: 2; grid-row: 1; justify-self:end; }

        /* ✅ MUY IMPORTANTE: pills ocupan TODAS las columnas para centrar respecto al eje de la página */
        .pills{
          grid-column: 1 / -1 !important; /* ✅ ocupa todo el ancho del grid */
          grid-row: 2 !important;
          justify-self: center !important;
          width: 100% !important;
          margin-top: 0 !important;

          /* ✅ centrado real de los botones */
          display: flex !important;
          flex-wrap: wrap !important;
          justify-content: center !important;
          align-items: center !important;
          gap: 12px !important;
        }

        #btnSettingsGear{
          grid-column: 2 !important;
          grid-row: 3 !important;  /* ✅ debajo de las pills */
          justify-self: end !important;
          align-self: end !important;
        }

        /* ✅ Evitar que la barra de estados “se coma” el último botón (Cerrados) */
        .sectionHead{ flex-wrap: wrap !important; gap: 10px !important; }
        .segTabs{ flex-wrap: wrap !important; gap: 8px !important; justify-content:flex-end !important; }
        .segBtn{ white-space: nowrap !important; }

        /* ✅ Botón buscar/filtrar “como al principio” (debajo del header, a la derecha) */
        .miniTools{
          padding:10px 14px 0;
          display:flex;
          justify-content:flex-end;
        }
        .miniBtn{
          height:36px;
          padding:0 12px;
          border-radius:999px;
          border:1px solid var(--border);
          background:var(--surface2);
          box-shadow:var(--shadow2);
          font-weight:900;
          cursor:pointer;
          display:inline-flex;
          align-items:center;
          gap:8px;
          -webkit-tap-highlight-color:transparent;
        }
        .miniBtn:active{ transform:translateY(1px); }
        .miniPanel{
          display:none;
          padding:10px 14px 12px;
          border-top:1px dashed rgba(229,231,235,.95);
          background:linear-gradient(180deg,#fff,#fbfbfc);
        }
        .miniPanel.show{ display:block; }
        .miniRow{
          display:flex;
          gap:10px;
          flex-wrap:wrap;
          align-items:flex-end;
        }
        .miniRow .field{ margin-top:0; flex:1; min-width:160px; }
        .miniHint{
          margin-top:8px;
          color:var(--muted);
          font-size:12.5px;
          line-height:1.35;
        }
        .chip.status{ font-weight:900; }

        /* =========================================================
           ✅ AUTOCOMPLETE PROPIO para #fWho (sustituye datalist)
           - Sin flechitas nativas
           - Nombres uno debajo del otro
           - Tipografía un poco mayor
           - Solo nombre (sin "Amigo")
           ========================================================= */

        /* el field del Nombre actúa como ancla del desplegable */
        #backdrop .modalBody .field{ position:relative; }

        .acPanel{
          position:absolute;
          left:0;
          right:0;
          top: calc(100% + 6px);
          background: var(--surface);
          border: 1px solid rgba(229,231,235,.95);
          border-radius: 18px;
          box-shadow: 0 18px 50px rgba(17,24,39,.12);
          z-index: 9999;
          overflow:hidden;
          display:none;
        }
        .acPanel.show{ display:block; }

        .acItem{
          display:flex;
          align-items:center;
          justify-content:flex-start;
          gap:10px;
          padding:12px 14px;
          cursor:pointer;
          -webkit-tap-highlight-color:transparent;
          border-bottom:1px solid rgba(229,231,235,.75);
          font-weight:950;
          font-size:16px; /* ✅ un poco más grande */
          color:var(--text);
          background: var(--surface);
        }
        .acItem:last-child{ border-bottom:none; }
        .acItem:active{ background: linear-gradient(180deg,#fff, #f6f7fb); }

        .acEmpty{
          padding:10px 14px;
          font-size:13px;
          color:var(--muted);
          background:linear-gradient(180deg,#fff,#fbfbfc);
        }

        /* si hay texto grande, acompasamos un pelín */
        body.bigText .acItem{ font-size:17px; padding:13px 14px; }
      `;
      document.head.appendChild(st);
    }catch(e){}
  })();