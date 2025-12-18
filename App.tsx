import React, { useEffect, useState } from 'react';
import { DashboardPrototype } from './components/DashboardPrototype';
import { SecurityNotification } from './components/SecurityNotification';

const ipcRenderer = window.require('electron').ipcRenderer;

const App: React.FC = () => {
  const [vulnerabilities, setVulnerabilities] = useState<any[]>([]);
  const [showNotification, setShowNotification] = useState(false);

  useEffect(() => {
    console.log('[Renderer] Requesting vulnerability check...');
    ipcRenderer.invoke('check-react-vulnerabilities').then((vulns: any[]) => {
      console.log('[Renderer] Received vulnerabilities:', vulns);
      if (vulns && vulns.length > 0) {
        setVulnerabilities(vulns);
        setShowNotification(true);
      } else {
        console.log('[Renderer] No vulnerabilities found or empty list.');
      }
    }).catch((err: any) => {
      console.error('[Renderer] IPC invoke error:', err);
    });
  }, []);

  return (
    <div className="h-screen bg-slate-950 text-slate-100 relative">
      <DashboardPrototype />
      {showNotification && (
        <SecurityNotification
          vulnerabilities={vulnerabilities}
          onDismiss={() => setShowNotification(false)}
        />
      )}
    </div>
  );
};

export default App;