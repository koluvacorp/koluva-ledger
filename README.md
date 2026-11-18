# Koluva Ledger

Autogestión financiera local para **Windows** y **Android**. Sin cuenta, sin nube, sin anuncios. Marca Koluva (hexágono-escalera); isotipo propio de Ledger: tres pilares isométricos a 30° que suben como peldaños.

## Descarga directa

| Plataforma | Enlace |
|---|---|
| Windows x64 | https://github.com/koluvacorp/koluva-ledger/releases/download/ledger-v1.1.1/KoluvaLedger-1.1.1-Windows-x64-Setup.exe |
| Android (APK) | https://github.com/koluvacorp/koluva-ledger/releases/download/ledger-v1.1.1/KoluvaLedger-1.1.1-Android.apk |
| Todas las versiones | https://github.com/koluvacorp/koluva-ledger/releases |

Windows: el instalador no tiene firma Authenticode; SmartScreen puede avisar. Android: permití «instalar apps desconocidas» para tu navegador la primera vez.

## Qué trae

- **Podés gastar hoy**: dinero libre del mes (tras pagos programados y metas) ÷ días restantes, con el cálculo a la vista.
- **Pronóstico de caja** 30/60/90 días con punto más bajo y aviso de saldo negativo.
- **Presupuesto en sobres** con arrastre opcional.
- **Detector de suscripciones**, total mensual y anual.
- **Plan de deudas**: avalancha vs bola de nieve con intereses y fecha de salida.
- **Gastos compartidos** con saldos y liquidación.
- Metas con plazo, simulador «¿y si recortás?», calculadora de crecimiento, puntaje de salud financiera, patrimonio neto histórico, reportes.
- Multimoneda (tipos de cambio que cargás vos), importación/exportación CSV, copia JSON y **copia cifrada AES-256-GCM (PBKDF2 250 000)**, PIN, recordatorios.
- Español, inglés, portugués, francés · claro / oscuro / sistema · movimiento activado / seguir sistema / desactivado · apertura propia + recorrido repetible.
- Escritorio: barra lateral tipo Dock (solo puntero preciso). Móvil: barra inferior.

## Actualizaciones (mismo sistema que Koluva Ops)

Canal `ledger-stable` → `latest.json` firmado con **ECDSA P-256/SHA-256**. La app (Ajustes → Actualizaciones) descarga solo desde `github.com`/`githubusercontent.com`, exige que la URL coincida con el repositorio y la versión, verifica **tamaño y SHA-256** y recién entonces ofrece instalar. La clave pública va en `www/assets/update-public.json`; la privada vive fuera del repositorio. Android usa el mismo APK firmado con la misma llave en cada versión, así que se actualiza encima.

## Datos

Todo queda en el dispositivo (`ledger-data.json` en Windows; almacenamiento privado de la app en Android, con copia `.bak` y escritura atómica). Koluva no recibe nada. `allowBackup` está desactivado en Android. Los tickets, proyecciones y puntajes son orientativos, no asesoramiento financiero.

## Desarrollo

```
npm install
npm test                 # núcleo, i18n y actualizador
npm start                # Windows (Electron)
npm run dist:win         # instalador en release/
npm run android:sync && node tools/android-setup.cjs
cd android && gradlew assembleRelease
npm run release:manifest # firma latest.json (clave en la bóveda)
npm run release:publish  # sube a GitHub Releases
```

Estructura: `www/` (app web compartida) · `electron/` (Windows) · `android/` + `android-src/` (Capacitor y plugin nativo `LedgerNative`) · `tools/` · `test/` · `docs/listing.md` (textos de la ficha en 4 idiomas).

Licencia: ver [LICENSE](LICENSE).
