import React, { useState } from 'react';
import { X, Key } from 'lucide-react';

interface SettingsModalProps {
    onClose: () => void;
}

const SettingsModal: React.FC<SettingsModalProps> = ({ onClose }) => {
    const [apiKey, setApiKey] = useState(localStorage.getItem('gemini_api_key') || '');
    const [saved, setSaved] = useState(false);

    const handleSave = () => {
        if (apiKey.trim()) {
            localStorage.setItem('gemini_api_key', apiKey.trim());
        } else {
            localStorage.removeItem('gemini_api_key');
        }
        setSaved(true);
        setTimeout(() => {
            setSaved(false);
            onClose();
        }, 1500);
    };

    return (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4" onClick={onClose}>
            <div className="bg-bg-secondary rounded-2xl p-6 max-w-md w-full" onClick={(e) => e.stopPropagation()}>
                <div className="flex justify-between items-center mb-6">
                    <h2 className="text-xl font-bold text-text-primary">설정</h2>
                    <button onClick={onClose} className="text-text-secondary hover:text-text-primary">
                        <X size={24} />
                    </button>
                </div>

                <div className="space-y-4">
                    <div>
                        <label className="flex items-center gap-2 text-sm font-medium text-text-primary mb-2">
                            <Key size={16} />
                            Gemini API 키 (선택사항)
                        </label>
                        <input
                            type="password"
                            value={apiKey}
                            onChange={(e) => setApiKey(e.target.value)}
                            placeholder="AIza..."
                            className="w-full bg-bg-tertiary text-text-primary rounded-lg p-3 focus:outline-none focus:ring-2 focus:ring-accent font-mono text-sm"
                        />
                        <p className="text-xs text-text-secondary mt-2">
                            키워드로 분류되지 않는 항목에 AI 분류를 사용합니다.
                            <br />
                            <a
                                href="https://aistudio.google.com/apikey"
                                target="_blank"
                                rel="noopener noreferrer"
                                className="text-accent hover:underline"
                            >
                                무료 API 키 발급받기 →
                            </a>
                        </p>
                    </div>

                    <button
                        onClick={handleSave}
                        className={`w-full py-3 rounded-lg font-medium transition-all ${saved
                                ? 'bg-green-500 text-white'
                                : 'bg-accent text-white hover:bg-opacity-90'
                            }`}
                    >
                        {saved ? '✓ 저장됨' : '저장'}
                    </button>
                </div>
            </div>
        </div>
    );
};

export default SettingsModal;
