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
- Filtro por año.

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

## Seguridad de dependencias

Antes de publicar una versión nueva, revisar vulnerabilidades de dependencias:

```bash
npm audit
```

## Formato del Excel

- Celda **B1**: fecha del mes (ej. `Noviembre 2025`).
- Celda **B4**: ingresos del mes.
- A partir de la **fila 5**: columna **F** importe, **G** categoría, **H** subcategoría.

Descarga la plantilla desde la propia aplicación para ver un ejemplo.
