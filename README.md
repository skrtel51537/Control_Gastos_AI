# Dashboard Gastos

Aplicación de escritorio (Electron + React) para visualizar y analizar gastos
mensuales a partir de un fichero Excel. De uso personal y completamente local:
los datos financieros **se quedan en tu equipo** y no se envían a ningún servidor.

## Funcionalidades

- Carga de un Excel de gastos (con plantilla de ejemplo descargable desde la app).
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

Los datos guardados (incluidos objetivos y presupuestos) se **cifran en local**
con el almacén seguro del sistema operativo en la app de escritorio.

## Requisitos

- [Node.js](https://nodejs.org/) (versión 18 o superior).

## Desarrollo

```bash
npm install        # Instalar dependencias
npm run electron:dev   # App de escritorio en modo desarrollo (recarga en caliente)
```

`npm run dev` levanta solo la web en el navegador (sin las funciones de Electron).

## Compilar el instalador (Windows)

```bash
npm run electron:build:win
```

El instalador se genera en la carpeta `dist-electron/`.

## Calidad y seguridad de dependencias

Comprobación de tipos y tests automáticos:

```bash
npm run typecheck   # Verifica los tipos de TypeScript
npm test            # Ejecuta los tests (cálculos financieros y lector de Excel)
```

La compilación (`npm run build`) ya ejecuta la comprobación de tipos antes de generar
los archivos, así que un error de tipos detiene la build.

Antes de publicar una versión nueva, revisar vulnerabilidades de dependencias:

```bash
npm audit --omit=dev   # Solo lo que viaja dentro de la app (lo importante)
npm audit              # Incluye herramientas de desarrollo (no se distribuyen)
```

Lo relevante para la seguridad de los equipos es `--omit=dev`: son las dependencias
que se empaquetan en la app. Las alertas que aparecen sin ese filtro suelen estar en
herramientas que solo se usan al desarrollar/compilar y **no** llegan al usuario final.

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
