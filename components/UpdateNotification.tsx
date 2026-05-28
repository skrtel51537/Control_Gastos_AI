import React from 'react';

interface UpdateNotificationProps {
    onRestart: () => void;
    onDismiss: () => void;
}

export const UpdateNotification: React.FC<UpdateNotificationProps> = ({ onRestart, onDismiss }) => {
    return (
        <div className="fixed bottom-4 right-4 max-w-sm w-full bg-indigo-900/95 border border-indigo-500 text-white shadow-2xl rounded-xl z-50">
            <div className="p-4">
                <div className="flex items-start justify-between">
                    <div className="flex-1">
                        <h3 className="text-base font-bold flex items-center gap-2">
                            <span className="text-xl">⬆️</span> Actualización disponible
                        </h3>
                        <p className="mt-1 text-sm text-indigo-100">
                            Hay una versión nueva lista. Reinicia la aplicación para instalarla.
                        </p>
                    </div>
                    <button
                        onClick={onDismiss}
                        className="text-indigo-200 hover:text-white transition-colors ml-2"
                        aria-label="Cerrar aviso"
                    >
                        ✕
                    </button>
                </div>

                <div className="mt-3 flex gap-2">
                    <button
                        onClick={onRestart}
                        className="text-sm font-medium bg-white text-indigo-900 hover:bg-indigo-100 px-3 py-1.5 rounded-lg transition-colors"
                    >
                        Reiniciar ahora
                    </button>
                    <button
                        onClick={onDismiss}
                        className="text-sm bg-indigo-800 hover:bg-indigo-700 text-white px-3 py-1.5 rounded-lg transition-colors"
                    >
                        Más tarde
                    </button>
                </div>
            </div>
        </div>
    );
};
