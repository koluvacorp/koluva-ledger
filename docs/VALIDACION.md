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
