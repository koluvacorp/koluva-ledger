# Validación de Koluva Ledger 1.3.5 (28-11-2026)

**Verificado automáticamente**
- `npm test`: 23/23; incluye movimiento de dona, barras, línea, minigráfica y gráfico diario; modo de animación desactivado/reducido; escape de etiquetas SVG.
- `node --check` en los JavaScript editados.
- Windows NSIS x64 compilado. `app.asar/package.json` y el ASAR extraído del EXE dicen 1.3.5. Los archivos `www/js/charts.js`, `www/js/plus.js`, `www/css/app.css` y `www/js/config.js` del ASAR coinciden byte a byte con la fuente.
- Android `assembleRelease` compiló; `output-metadata.json` indica `versionCode 10305` y `versionName 1.3.5`; APK firmado y verificado con la misma huella de certificado RSA que 1.3.4.
- El APK contiene `charts.js`, `plus.js` y `app.css` vigentes byte a byte desde `android/app/src/main/assets/public`.

**Pendiente hasta la publicación**
- Manifiesto ECDSA firmado, archivos en GitHub, comparación de tamaño/hash, enlaces HTTP 200 y retención de cinco releases.
- Inspección visual y actualización real desde Ledger instalado; no se usó la pantalla del propietario ni se probó un dispositivo físico.
- Windows no cuenta con firma Authenticode; SmartScreen puede mostrar un aviso.

# Validación de Koluva Ledger 1.0.0 (18-11-2026)

**Verificado automáticamente**
- `npm test`: 16 pruebas (saldos, transferencias multimoneda, presupuesto con arrastre, recurrencias, pronóstico, gasto diario seguro, deudas, compartidos, salud, suscripciones, CSV, copia cifrada, firma del actualizador, textos es/en/pt/fr completos).
- Interfaz en navegador (Chromium): las 10 páginas y las 4 pestañas de Pronóstico renderizan sin errores; formulario de movimiento (gasto, transferencia con moneda distinta), borrado con deshacer, aportes a metas, pago de deuda, gasto compartido, PIN (error + acierto), cambio de idioma, copia cifrada ida y vuelta, apertura animada, móvil 375 px y escritorio.
- Windows (Electron): arranca con sandbox/contextIsolation, puente `ledgerHost` expuesto, escritura de datos, comprobación de canal (404 → «sin versiones»), `openExternal` rechaza dominios no permitidos.
- Android: compila `assembleRelease` firmado.

**No comprobado (requiere dispositivo o cuenta)**
- Instalación y uso en un Android físico: permisos de notificaciones, alarmas, instalación de APK desde la app, selector de archivos, compartir.
- Instalación limpia del instalador en otra PC y comportamiento de SmartScreen (sin firma Authenticode).
- Accesibilidad con Narrador/TalkBack, impresión.
- Actualización de punta a punta (necesita una versión posterior publicada).
