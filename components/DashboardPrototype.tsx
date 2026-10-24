import React, { useState, useEffect, useMemo, Suspense, lazy } from 'react';
import { DashboardData, DataSource, Tab } from '../types';
import { processExcelFile } from '../utils/excelParser';
import { loadJSON, saveJSON, saveEncryptedJSON, removeKey, hasKey } from '../utils/storage';
import { buildBackup, parseBackup, backupFilename } from '../utils/backup';
import { FinanceSettings, DEFAULT_SETTINGS } from '../utils/finance';
import { BotConfig, BotLoadError, isBotAvailable, loadFromBot, sanitizeBotConfig } from '../utils/botApi';
import { Sidebar } from './ui/Sidebar';
import { Header } from './ui/Header';
import { UploadView } from './ui/UploadView';
import { AboutPanel } from './ui/AboutPanel';
import { BotSettingsPanel } from './ui/BotSettingsPanel';
import { BotStatusBar } from './ui/BotStatusBar';

// Las pestañas (y con ellas la librería de gráficas) se cargan bajo demanda:
// acelera el arranque y la pantalla inicial de carga de Excel.
const OverviewTab = lazy(() => import('./tabs/OverviewTab').then((m) => ({ default: m.OverviewTab })));
const MonthlyTab = lazy(() => import('./tabs/MonthlyTab').then((m) => ({ default: m.MonthlyTab })));
const CategoriesTab = lazy(() => import('./tabs/CategoriesTab').then((m) => ({ default: m.CategoriesTab })));
const TrendsTab = lazy(() => import('./tabs/TrendsTab').then((m) => ({ default: m.TrendsTab })));
const ComparatorTab = lazy(() => import('./tabs/ComparatorTab').then((m) => ({ default: m.ComparatorTab })));
const GoalsTab = lazy(() => import('./tabs/GoalsTab').then((m) => ({ default: m.GoalsTab })));

const DATA_KEY = 'finance_data_v3';
const SETTINGS_KEY = 'finance_settings_v1';
const BOT_CONFIG_KEY = 'bot_config_v1'; // dirección y token del bot (siempre cifrado)
const SOURCE_KEY = 'data_source_v1';

const REPLACE_WITH_BOT_MSG =
  'Los datos del bot sustituirán a los que tienes cargados ahora (Excel o copia de seguridad). ' +
  'Tus objetivos y presupuestos no cambian.\n\n¿Continuar?';


const hydrateData = (parsed: any): DashboardData => {
  if (parsed?.monthlyData) {
    parsed.monthlyData = parsed.monthlyData.map((m: any) => ({
      ...m,
      dateObj: new Date(m.dateObj),
    }));
  }
  return parsed;
};

export const DashboardPrototype: React.FC = () => {
  const [rawData, setRawData] = useState<DashboardData | null>(null);
  const [settings, setSettings] = useState<FinanceSettings>(DEFAULT_SETTINGS);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // Avisos de almacenamiento (guardado fallido, etc.) visibles dentro del dashboard.
  const [storageWarning, setStorageWarning] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<Tab>('RESUMEN');
  const [showAbout, setShowAbout] = useState(false);

  // Bot de gastos (solo en la app de escritorio)
  const botAvailable = isBotAvailable();
  const [botConfig, setBotConfig] = useState<BotConfig | null>(null);
  const [source, setSource] = useState<DataSource | null>(null);
  const [botLoading, setBotLoading] = useState(false);
  const [botError, setBotError] = useState<string | null>(null);
  const [showBotSettings, setShowBotSettings] = useState(false);

  // Year Filter State
  const [selectedYear, setSelectedYear] = useState<string>('TOTAL');

  useEffect(() => {
    (async () => {
      // Primero lo guardado (la app abre con datos aunque el bot esté apagado);
      // después, si los datos vienen del bot, se actualizan en segundo plano.
      const [parsed, savedSource, savedConfig] = await Promise.all([
        loadJSON<any>(DATA_KEY),
        loadJSON<DataSource>(SOURCE_KEY),
        botAvailable ? loadJSON<unknown>(BOT_CONFIG_KEY) : Promise.resolve(null),
      ]);
      if (parsed) {
        setRawData(hydrateData(parsed));
      } else if (hasKey(DATA_KEY)) {
        // Hay algo guardado pero no se pudo leer (p. ej. descifrado fallido
        // tras reinstalar el sistema): avisar en vez de aparecer "vacío".
        setError(
          'Hay datos guardados de una sesión anterior, pero no se han podido leer. ' +
          'Esto puede ocurrir tras reinstalar el sistema o cambiar de cuenta de usuario. ' +
          'Vuelve a cargar tu Excel o restaura una copia de seguridad.'
        );
      }
      if (savedSource) setSource(savedSource);

      const config = sanitizeBotConfig(savedConfig);
      setBotConfig(config);
      // Si los datos actuales vienen de un Excel o de una copia, no se pisan solos.
      if (config && (!savedSource || savedSource.type === 'bot')) {
        setBotError(await loadBot(config));
      }
    })().catch((e) => console.error(e));

    loadJSON<FinanceSettings>(SETTINGS_KEY)
      .then((saved) => {
        if (saved) setSettings({ ...DEFAULT_SETTINGS, ...saved });
      })
      .catch((e) => console.error(e));
  }, []);

  const updateSettings = (next: FinanceSettings) => {
    setSettings(next);
    saveJSON(SETTINGS_KEY, next).catch(() => {
      setStorageWarning(
        'No se ha podido guardar la configuración en este equipo. Tus cambios se perderán al cerrar la aplicación.'
      );
    });
  };

  // Calculate available years from raw data
  const availableYears = useMemo(() => {
    if (!rawData) return [];
    const years = new Set(rawData.monthlyData.map(m => new Date(m.dateObj).getFullYear().toString()));
    return Array.from(years).sort((a: string, b: string) => b.localeCompare(a));
  }, [rawData]);

  // Derive Filtered Data based on Year Selection
  const filteredData = useMemo((): DashboardData | null => {
    if (!rawData) return null;
    if (selectedYear === 'TOTAL') return rawData;

    const filteredMonths = rawData.monthlyData.filter(m => 
      new Date(m.dateObj).getFullYear().toString() === selectedYear
    );

    const filteredTxs = rawData.allTransactions.filter(t => 
      new Date(t.date).getFullYear().toString() === selectedYear
    );

    // Re-calculate Global KPIs for the specific year
    const totalIncome = filteredMonths.reduce((sum, m) => sum + m.income, 0);
    const totalExpense = filteredMonths.reduce((sum, m) => sum + m.expense, 0);
    const totalBalance = totalIncome - totalExpense;
    const avgSavings = filteredMonths.length > 0 
      ? filteredMonths.reduce((sum, m) => sum + m.savingsRate, 0) / filteredMonths.length 
      : 0;

    return {
      ...rawData,
      allTransactions: filteredTxs,
      monthlyData: filteredMonths,
      globalKPIs: {
        totalIncome,
        totalExpense,
        totalBalance,
        averageSavingsRate: avgSavings
      }
    };
  }, [rawData, selectedYear]);

  const updateSource = (next: DataSource | null) => {
    setSource(next);
    if (next) saveJSON(SOURCE_KEY, next).catch(() => {});
    else removeKey(SOURCE_KEY);
  };

  // --- Bot de gastos ---

  // Carga los movimientos del bot. Devuelve el mensaje de error, o null si ha ido bien.
  const loadBot = async (config: BotConfig): Promise<string | null> => {
    setBotLoading(true);
    try {
      const load = await loadFromBot(config);
      setRawData(load.data);
      setError(null);
      setBotError(null);
      updateSource({ type: 'bot', generatedAt: load.generatedAt, loadedAt: new Date().toISOString() });
      if (load.skipped > 0) {
        setStorageWarning(`Se han descartado ${load.skipped} movimientos del bot porque no tenían el formato esperado.`);
      }
      try {
        await saveJSON(DATA_KEY, load.data);
      } catch {
        setStorageWarning(
          'Los datos del bot se han cargado, pero no se han podido guardar en este equipo: si el bot está apagado la próxima vez, no habrá datos.'
        );
      }
      return null;
    } catch (err) {
      // Solo los errores propios llevan un mensaje pensado para el usuario.
      return err instanceof BotLoadError ? err.message : 'No se han podido cargar los datos del bot.';
    } finally {
      setBotLoading(false);
    }
  };

  // Desde el panel de conexión: solo se guarda la configuración si la carga funciona.
  const connectBot = async (config: BotConfig): Promise<string | null> => {
    const wasBot = source?.type === 'bot';
    const failure = await loadBot(config);
    if (failure) return failure;
    setBotConfig(config);
    if (!wasBot) setSelectedYear('TOTAL');
    try {
      await saveEncryptedJSON(BOT_CONFIG_KEY, config);
    } catch {
      setStorageWarning(
        'Datos cargados, pero el token no se ha podido guardar cifrado en este equipo: tendrás que volver a escribirlo la próxima vez.'
      );
    }
    return null;
  };

  // Botón "Cargar / Recargar desde el bot".
  const handleBotButton = async () => {
    if (!botConfig) return setShowBotSettings(true);
    const wasBot = source?.type === 'bot';
    if (rawData && !wasBot && !window.confirm(REPLACE_WITH_BOT_MSG)) return;
    const failure = await loadBot(botConfig);
    setBotError(failure);
    if (!failure && !wasBot) setSelectedYear('TOTAL');
  };

  const forgetBot = () => {
    removeKey(BOT_CONFIG_KEY);
    setBotConfig(null);
    setBotError(null);
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setIsLoading(true); setError(null);
    try {
      const processed = await processExcelFile(file);
      setRawData(processed);
      setBotError(null);
      // Con un Excel cargado, la app deja de cargar del bot al abrirse.
      updateSource({ type: 'excel', loadedAt: new Date().toISOString() });
      setSelectedYear('TOTAL'); // Reset filter on new upload
      try {
        await saveJSON(DATA_KEY, processed);
      } catch {
        setStorageWarning(
          'Los datos se han cargado, pero no se han podido guardar en este equipo: la próxima vez tendrás que volver a cargar el Excel.'
        );
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error desconocido.");
    } finally {
      setIsLoading(false);
    }
  };

  const clearData = () => { removeKey(DATA_KEY); updateSource(null); setBotError(null); setRawData(null); };

  // --- Copia de seguridad (exportar / restaurar) ---

  const exportBackup = () => {
    const ok = window.confirm(
      'Se descargará un archivo con tus datos y configuración SIN cifrar, para poder ' +
      'restaurarlo en cualquier equipo. Guárdalo en un lugar seguro.\n\n¿Continuar?'
    );
    if (!ok) return;
    const blob = new Blob([JSON.stringify(buildBackup(rawData, settings), null, 2)], {
      type: 'application/json',
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = backupFilename();
    a.click();
    URL.revokeObjectURL(url);
  };

  const restoreBackup = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = ''; // permite volver a elegir el mismo archivo más tarde
    if (!file) return;
    if (rawData) {
      const ok = window.confirm(
        'Restaurar la copia sustituirá los datos y la configuración actuales de este equipo.\n\n¿Continuar?'
      );
      if (!ok) return;
    }
    try {
      const restored = parseBackup(await file.text());
      if (restored.settings) setSettings({ ...DEFAULT_SETTINGS, ...restored.settings });
      if (restored.data) {
        setRawData(restored.data);
        setBotError(null);
        // Como con un Excel: los datos restaurados no se pisan con los del bot al abrir.
        updateSource({ type: 'backup', loadedAt: new Date().toISOString() });
        setSelectedYear('TOTAL');
      }
      setError(null);
      try {
        if (restored.data) await saveJSON(DATA_KEY, restored.data);
        if (restored.settings) await saveJSON(SETTINGS_KEY, restored.settings);
      } catch {
        setStorageWarning('La copia se ha restaurado, pero no se ha podido guardar en este equipo.');
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'No se pudo restaurar la copia de seguridad.';
      // Si el dashboard está abierto el error se muestra como aviso; si no, en la pantalla de carga.
      if (rawData) setStorageWarning(msg);
      else setError(msg);
    }
  };

  const botPanel = showBotSettings && (
    <BotSettingsPanel
      config={botConfig}
      willReplaceData={!!rawData && source?.type !== 'bot'}
      onConnect={connectBot}
      onForget={forgetBot}
      onClose={() => setShowBotSettings(false)}
    />
  );

  if (!filteredData) {
    return (
      <>
        <UploadView
          isLoading={isLoading || botLoading}
          error={error ?? botError}
          onUpload={handleFileUpload}
          onRestore={restoreBackup}
          onBot={botAvailable ? handleBotButton : undefined}
        />
        {botPanel}
      </>
    );
  }

  return (
    <div className="flex h-screen bg-slate-950 overflow-hidden text-slate-200 font-sans">
      <Sidebar
        activeTab={activeTab}
        onTabChange={setActiveTab}
        onClear={clearData}
        onExport={exportBackup}
        onRestore={restoreBackup}
        onAbout={() => setShowAbout(true)}
        bot={botAvailable ? {
          onLoad: handleBotButton,
          onSettings: () => setShowBotSettings(true),
          loading: botLoading,
          isSource: source?.type === 'bot',
        } : undefined}
      />
      {showAbout && <AboutPanel onClose={() => setShowAbout(false)} />}
      {botPanel}

      <main className="flex-1 flex flex-col overflow-hidden relative">
        <Header 
          activeTab={activeTab} 
          years={availableYears} 
          selectedYear={selectedYear} 
          onYearChange={setSelectedYear} 
        />
        <div className="flex-1 overflow-y-auto p-4 sm:p-8 scroll-smooth">
          <div className="max-w-7xl mx-auto space-y-6">
            {botAvailable && (
              <BotStatusBar
                source={source}
                loading={botLoading}
                error={botError}
                onReload={handleBotButton}
                onDismissError={() => setBotError(null)}
              />
            )}
            {storageWarning && (
              <div className="flex items-start justify-between gap-3 p-4 bg-amber-500/10 border border-amber-500/20 rounded-xl text-amber-300 text-sm">
                <span>⚠️ {storageWarning}</span>
                <button
                  onClick={() => setStorageWarning(null)}
                  className="text-amber-400 hover:text-amber-200 font-bold px-1 shrink-0"
                  title="Cerrar aviso"
                >
                  ✕
                </button>
              </div>
            )}
            <Suspense fallback={<div className="p-8 text-center text-slate-500 animate-pulse">Cargando…</div>}>
              {activeTab === 'RESUMEN' && <OverviewTab data={filteredData} selectedYear={selectedYear} />}
              {activeTab === 'MENSUAL' && <MonthlyTab data={filteredData} settings={settings} />}
              {activeTab === 'CATEGORIAS' && <CategoriesTab data={filteredData} />}
              {activeTab === 'TENDENCIAS' && <TrendsTab data={filteredData} />}
              {activeTab === 'COMPARAR' && <ComparatorTab data={rawData!} />}
              {activeTab === 'OBJETIVOS' && <GoalsTab data={filteredData} settings={settings} onChange={updateSettings} />}
            </Suspense>
          </div>
        </div>
      </main>
    </div>
  );
};
