import React, { useEffect, useState } from 'react';
import { DashboardPrototype } from './components/DashboardPrototype';
import { UpdateNotification } from './components/UpdateNotification';

const App: React.FC = () => {
  const [updateReady, setUpdateReady] = useState(false);

  useEffect(() => {
    window.electronAPI?.onUpdateDownloaded(() => setUpdateReady(true));
  }, []);

  return (
    <div className="h-screen bg-slate-950 text-slate-100 relative">
      <DashboardPrototype />
      {updateReady && (
        <UpdateNotification
          onRestart={() => window.electronAPI?.restartApp()}
          onDismiss={() => setUpdateReady(false)}
        />
      )}
    </div>
  );
};

export default App;
