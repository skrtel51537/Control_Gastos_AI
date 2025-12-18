import React from 'react';

interface Vulnerability {
    id: string;
    summary: string;
    details: string;
}

interface SecurityNotificationProps {
    vulnerabilities: Vulnerability[];
    onDismiss: () => void;
}

export const SecurityNotification: React.FC<SecurityNotificationProps> = ({ vulnerabilities, onDismiss }) => {
    if (vulnerabilities.length === 0) return null;

    return (
        <div className="fixed bottom-4 right-4 max-w-sm w-full bg-red-900/90 border border-red-500 text-white shadow-lg rounded-lg pointer-events-auto flex flex-col animate-in slide-in-from-bottom-2 fade-in duration-300 z-50">
            <div className="p-4">
                <div className="flex items-start justify-between">
                    <div className="flex-1">
                        <h3 className="text-lg font-bold flex items-center gap-2">
                            <span className="text-2xl">⚠️</span> Security Alert
                        </h3>
                        <p className="mt-1 text-sm text-red-100">
                            {vulnerabilities.length} vulnerability(ies) detected in React.
                        </p>
                    </div>
                    <button
                        onClick={onDismiss}
                        className="text-red-200 hover:text-white transition-colors"
                    >
                        ✕
                    </button>
                </div>

                <div className="mt-3 max-h-40 overflow-y-auto pr-1 custom-scrollbar">
                    {vulnerabilities.map((vuln) => (
                        <div key={vuln.id} className="mb-2 last:mb-0 bg-black/20 p-2 rounded text-xs">
                            <div className="font-semibold text-red-300">{vuln.id}</div>
                            <div className="line-clamp-2">{vuln.summary || 'No summary available'}</div>
                        </div>
                    ))}
                </div>

                <div className="mt-3 flex gap-2">
                    <a
                        href="https://github.com/facebook/react/security/advisories"
                        target="_blank"
                        rel="noreferrer"
                        className="text-xs bg-red-800 hover:bg-red-700 text-white px-3 py-1.5 rounded transition-colors"
                    >
                        View Advisories
                    </a>
                </div>
            </div>
        </div>
    );
};
