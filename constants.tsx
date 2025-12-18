import React from 'react';
import { SuggestionCard } from './types';

// Icons as SVG components
export const Icons = {
  Layout: () => (
    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-6 h-6">
      <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 6A2.25 2.25 0 016 3.75h2.25A2.25 2.25 0 0110.5 6v2.25a2.25 2.25 0 01-2.25 2.25H6a2.25 2.25 0 01-2.25-2.25V6zM3.75 15.75A2.25 2.25 0 016 13.5h2.25a2.25 2.25 0 012.25 2.25V18a2.25 2.25 0 01-2.25 2.25H6A2.25 2.25 0 013.75 18v-2.25zM13.5 6a2.25 2.25 0 012.25-2.25H18A2.25 2.25 0 0120.25 6v2.25A2.25 2.25 0 0118 10.5h-2.25a2.25 2.25 0 01-2.25-2.25V6zM13.5 15.75a2.25 2.25 0 012.25-2.25H18a2.25 2.25 0 012.25 2.25V18A2.25 2.25 0 0118 20.25h-2.25A2.25 2.25 0 0113.5 18v-2.25z" />
    </svg>
  ),
  Code: () => (
    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-6 h-6">
      <path strokeLinecap="round" strokeLinejoin="round" d="M17.25 6.75L22.5 12l-5.25 5.25m-10.5 0L1.5 12l5.25-5.25m7.5-3l-4.5 16.5" />
    </svg>
  ),
  Chart: () => (
    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-6 h-6">
      <path strokeLinecap="round" strokeLinejoin="round" d="M3 13.125C3 12.504 3.504 12 4.125 12h2.25c.621 0 1.125.504 1.125 1.125v6.75C7.5 20.496 6.996 21 6.375 21h-2.25A1.125 1.125 0 013 19.875v-6.75zM9.75 8.625c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125v11.25c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V8.625zM16.5 4.125c0-.621.504-1.125 1.125-1.125h2.25C20.496 3 21 3.504 21 4.125v15.75c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V4.125z" />
    </svg>
  ),
  Sparkles: () => (
    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-6 h-6">
      <path strokeLinecap="round" strokeLinejoin="round" d="M9.813 15.904L9 18.75l-.813-2.846a4.5 4.5 0 00-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 003.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 003.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 00-3.09 3.09zM18.259 8.715L18 9.75l-.259-1.035a3.375 3.375 0 00-2.455-2.456L14.25 6l1.036-.259a3.375 3.375 0 002.455-2.456L18 2.25l.259 1.035a3.375 3.375 0 002.456 2.456L21.75 6l-1.035.259a3.375 3.375 0 00-2.456 2.456zM16.894 20.567L16.5 21.75l-.394-1.183a2.25 2.25 0 00-1.423-1.423L13.5 18.75l1.183-.394a2.25 2.25 0 001.423-1.423l.394-1.183.394 1.183a2.25 2.25 0 001.423 1.423l1.183.394-1.183.394a2.25 2.25 0 00-1.423 1.423z" />
    </svg>
  ),
  Speed: () => (
    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-6 h-6">
      <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 13.5l10.5-11.25L12 10.5h8.25L9.75 21.75 12 13.5H3.75z" />
    </svg>
  )
};

export const SUGGESTIONS: SuggestionCard[] = [
  {
    id: '1',
    title: 'Arquitectura SPA Moderna',
    category: 'Arquitectura',
    description: 'Migrar de Streamlit a una aplicación web React (TypeScript) + Vite.',
    icon: <Icons.Code />,
    impact: 'Alto',
    details: [
      'Elimina la recarga de página completa en cada interacción (típico de Streamlit).',
      'Permite procesamiento del Excel en el navegador (Client-Side) para mayor privacidad y velocidad inmediata.',
      'Separación limpia entre la lógica de datos y la interfaz visual.',
      'Código más mantenible y escalable a largo plazo.'
    ]
  },
  {
    id: '2',
    title: 'Diseño "Bento Grid" & Tailwind',
    category: 'UI/UX',
    description: 'Abandonar la estructura lineal por un dashboard modular estilo "Grid".',
    icon: <Icons.Layout />,
    impact: 'Alto',
    details: [
      'Uso de Tailwind CSS para un diseño 100% personalizado (no el look estándar de Streamlit).',
      'Layout adaptable: Resumen y métricas clave (KPIs) siempre visibles arriba.',
      'Soporte nativo para Modo Oscuro/Claro elegante.',
      'Cards interactivas con sombras suaves y bordes redondeados (estética moderna).'
    ]
  },
  {
    id: '3',
    title: 'Asistente IA con Gemini',
    category: 'AI Integration',
    description: 'Integrar un chat inteligente para consultar tus finanzas con lenguaje natural.',
    icon: <Icons.Sparkles />,
    impact: 'Medio',
    details: [
      'Pregunta: "¿En qué gasté más dinero en marzo comparado con febrero?"',
      'Análisis de anomalías: Que la IA te avise: "Tu gasto en comida subió un 20% este mes".',
      'Categorización automática: Sugerir categorías para nuevos gastos.'
    ]
  },
  {
    id: '4',
    title: 'Gráficas Interactivas (Recharts)',
    category: 'UI/UX',
    description: 'Reemplazar gráficas estáticas por visualizaciones fluidas y animadas.',
    icon: <Icons.Chart />,
    impact: 'Medio',
    details: [
      'Gráficos con tooltips personalizados (hover instantáneo).',
      'Animaciones de entrada al cargar datos.',
      'Drill-down: Clicar en una barra de "Comida" para ver el desglose por subcategorías.',
      'Gráficos de área para ver la acumulación de ahorro visualmente.'
    ]
  },
  {
    id: '5',
    title: 'Persistencia Local',
    category: 'Funcionalidad',
    description: 'Mejorar la experiencia de carga de datos repetitiva.',
    icon: <Icons.Speed />,
    impact: 'Bajo',
    details: [
      'Guardar los datos procesados en LocalStorage o IndexedDB del navegador.',
      'No necesitas subir el Excel cada vez que recargas la página.',
      'Modo "Demo" instantáneo para probar la app sin archivos.'
    ]
  }
];
