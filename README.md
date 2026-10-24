# Dashboard Gastos

Aplicación de escritorio (Electron + React) para visualizar y analizar gastos
mensuales a partir de un fichero Excel o del bot de gastos de Telegram. De uso
personal: los datos financieros **se quedan en tu equipo** y no se envían a ningún
servidor (la app solo *lee* del bot propio, nunca le envía datos).

## Funcionalidades

- Carga desde el **bot de gastos** (Telegram) o desde un Excel (con plantilla de
  ejemplo descargable desde la app). Ver [Cargar desde el bot](#cargar-desde-el-bot).
- Resumen global: ingresos, gastos, ahorro y tasa de ahorro.
- Análisis mensual con desglose interactivo por categoría y subcategoría.
- Desglose por categorías y evolución de tendencias.
- Alertas de meses con gasto elevado (umbral configurable).
- Objetivos de ahorro mensual (en € o en % de ingresos) con seguimiento por mes.
- Presupuestos por categoría con semáforo (verde/ámbar/rojo) y % consumido.
- Detección de gastos atípicos respecto a la media histórica.
- Comparativa con el mes anterior (variación de ahorro y categorías que más suben/bajan).
- Proyección de ahorro y gasto a 12 meses.
- Filtro por año.
- Copia de seguridad: exporta tus datos y configuración a un archivo y
  restáuralos en cualquier equipo (útil al cambiar de ordenador o reinstalar).
- Panel **Acerca de** (barra lateral): versión instalada, botón para buscar
  actualizaciones y resultado de la última comprobación, con los errores
  explicados.

Los datos guardados (incluidos objetivos y presupuestos) se **cifran en local**
con el almacén seguro del sistema operativo en la app de escritorio.

## Requisitos

- [Node.js](https://nodejs.org/) 24 (la misma rama que usa Electron por dentro).

## Desarrollo

```bash
npm install        # Instalar dependencias
npm run electron:dev   # App de escritorio en modo desarrollo (recarga en caliente)
```

`npm run dev` levanta solo la web en el navegador (sin las funciones de Electron,
como el cifrado o la carga desde el bot).

En modo desarrollo la app guarda sus datos en una carpeta propia
(`%APPDATA%\dashboard-gastos-mensuales-dev`), así las pruebas nunca tocan los datos
de la app instalada.

## Cargar desde el bot

El bot de gastos (proyecto aparte, `Bot_gastos`) guarda los movimientos en
SQLite y ofrece una API HTTP de solo lectura (`GET /api/movimientos`). Para usarla:

1. Arranca el bot (su API arranca con él).
2. En la app, pulsa **🤖 Cargar desde el bot** (o **⚙️ Conexión con el bot** en la
   barra lateral), deja la dirección `http://127.0.0.1:8765` si el bot está en el
   mismo ordenador y pega tu token (línea `API_TOKENS=nombre:token` del `.env` del
   bot, solo la parte de después de los dos puntos).
3. **Conectar y cargar** prueba la conexión; la configuración solo se guarda si
   funciona, y el token **siempre cifrado** (si el cifrado no está disponible, no se
   guarda).

Al abrir la app se muestran al momento los últimos datos guardados y después se
actualizan desde el bot. Si el bot está apagado, se avisa y se siguen viendo los
datos de la última carga (con su fecha). Si cargas un Excel o restauras una copia,
la app deja de cargar del bot al abrirse hasta que vuelvas a pulsar «Cargar desde
el bot». El token no se incluye en la copia de seguridad.

La petición la hace el proceso principal de Electron (`electron/botClient.js`), no
la ventana: así la CSP sigue sin permitir conexiones externas. Solo acepta
direcciones `http(s)`, no sigue redirecciones, corta a los 10 s, limita el tamaño
de la respuesta y nunca escribe el token en los logs. La respuesta se valida y se
convierte con la misma lógica que el Excel (`utils/botApi.ts`): mismas claves de
mes y misma normalización de categorías, para que objetivos y presupuestos sigan
coincidiendo.

## Compilar el instalador (Windows)

```bash
npm run electron:build:win
```

El instalador se genera en la carpeta `dist-electron/`.

## Publicar una versión nueva (release)

La publicación está automatizada con GitHub Actions:

1. Subir el número de versión en `package.json` y `package-lock.json`.
2. Hacer commit y push a `main` (tras validar los cambios).
3. Crear y subir la etiqueta de versión:

   ```bash
   git tag v1.1.0
   git push origin v1.1.0
   ```

4. GitHub crea la release en borrador, compila el instalador, comprueba que
   estén los 3 archivos (`.exe`, `.blockmap` y `latest.yml`) y **la publica**
   (pestaña *Actions* para seguir el progreso). Si falta algún archivo, la
   release se queda en borrador y no llega a nadie. El auto-updater de las
   apps instaladas hace el resto.

Además, en cada push y **cada lunes** (aunque no haya cambios) se ejecutan
automáticamente los tests, la comprobación de tipos, la auditoría de
dependencias y la comprobación de soporte de Electron (workflow de CI). Si
algo falla, GitHub avisa por email.

## Calidad y seguridad de dependencias

Comprobación de tipos y tests automáticos:

```bash
npm run typecheck   # Verifica los tipos de TypeScript
npm test            # Ejecuta los tests (cálculos financieros, lector de Excel y bot)
```

La compilación (`npm run build`) ya ejecuta la comprobación de tipos antes de generar
los archivos, así que un error de tipos detiene la build.

Antes de publicar una versión nueva, revisar vulnerabilidades de dependencias:

```bash
npm audit --omit=dev   # Solo lo que viaja dentro de la app (lo importante)
npm audit              # Incluye herramientas de desarrollo (no se distribuyen)
```

`--omit=dev` revisa las librerías que se empaquetan en la app. Las alertas que
aparecen sin ese filtro suelen estar en herramientas que solo se usan al
desarrollar o compilar y **no** llegan al usuario final.

**Excepción importante: Electron.** Figura como dependencia de desarrollo, pero su
motor (Chromium + Node.js) **sí va dentro del instalador**, y `npm audit --omit=dev`
no lo revisa. Por eso hay una comprobación aparte, que también ejecuta el CI:

```bash
node scripts/check-electron-support.mjs
```

Falla si la versión de Electron ya no recibe parches de seguridad (Electron solo
mantiene sus 3 últimas versiones mayores) y avisa cuando le queda poco o hay una
versión más nueva de su rama.

**Avisos automáticos:** Dependabot (`.github/dependabot.yml`) propone cada mes las
actualizaciones de dependencias y de las acciones de GitHub como pull requests,
que pasan el CI antes de fusionarse. Las alertas de seguridad urgentes llegan por
email desde la pestaña *Security* del repositorio.

## Medidas de seguridad de la app

- Ventana aislada (`contextIsolation`, `sandbox`, sin Node en la interfaz) y política
  de contenido (CSP) sin recursos remotos.
- Navegación, ventanas nuevas y permisos (cámara, micrófono…) bloqueados.
- Los mensajes entre la interfaz y el proceso principal solo se aceptan desde la
  propia ventana de la app.
- Datos cifrados en local con el almacén seguro del sistema (`safeStorage`).
- Token del bot guardado solo cifrado y enviado solo en la cabecera `Authorization`
  desde el proceso principal (ver [Cargar desde el bot](#cargar-desde-el-bot)).
- **Electron Fuses** en el instalador: el `.exe` no puede usarse como intérprete de
  Node (`ELECTRON_RUN_AS_NODE`, `NODE_OPTIONS` y `--inspect` desactivados) y se
  exige la integridad del código empaquetado (`app.asar`). Para comprobarlas:

  ```bash
  npx @electron/fuses read --app "dist-electron/win-unpacked/Dashboard Gastos.exe"
  ```

## Actualizaciones automáticas (sin firma de código)

La app se actualiza sola desde las *releases* de GitHub mediante `electron-updater`.
Actualmente **los instaladores no están firmados con un certificado de código**.
Esto tiene dos consecuencias que conviene conocer:

- Al instalar o actualizar, Windows puede mostrar un aviso de "editor desconocido"
  (SmartScreen). Es normal y se puede continuar de forma manual.
- Sin firma, la confianza recae en que las *releases* se publiquen únicamente desde
  el repositorio oficial. Por eso es importante **no** distribuir el instalador por
  otros canales y mantener la cuenta de GitHub del proyecto bien protegida.

Si en el futuro se quiere eliminar el aviso de Windows y reforzar la cadena de
confianza, habría que adquirir un **certificado de firma de código** (tiene un coste
anual) y configurarlo en `electron-builder`.

## Formato del Excel

- Celda **B1**: fecha del mes (ej. `Noviembre 2025`).
- Celda **B4**: ingresos del mes.
- A partir de la **fila 5**: columna **F** importe, **G** categoría, **H** subcategoría.

Descarga la plantilla desde la propia aplicación para ver un ejemplo.
