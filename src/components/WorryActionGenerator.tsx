import React, { useState } from 'react';
import { generateWorryActions } from '../services/gemini';
import { Wand2, Loader2, X } from 'lucide-react';

interface WorryActionGeneratorProps {
    worryContent: string;
    onSelectAction: (actionContent: string) => void;
    onClose: () => void;
}

const WorryActionGenerator: React.FC<WorryActionGeneratorProps> = ({ worryContent, onSelectAction, onClose }) => {
    const [loading, setLoading] = useState(false);
    const [actions, setActions] = useState<string[]>([]);
    const [error, setError] = useState<string | null>(null);

    const handleGenerate = async () => {
        setLoading(true);
        setError(null);
        try {
            const generatedActions = await generateWorryActions(worryContent);
            setActions(generatedActions);
        } catch (err) {
            setError("AI 제안을 불러오는데 실패했습니다. API 키를 확인해주세요.");
            console.error(err);
        } finally {
            setLoading(false);
        }
    };

    // Auto-generate on mount
    React.useEffect(() => {
        handleGenerate();
    }, []);

    return (
        <div className="bg-bg-secondary border border-bg-tertiary rounded-lg p-4 mb-4 relative animate-fade-in">
            <button
                onClick={onClose}
                className="absolute top-2 right-2 text-text-secondary hover:text-text-primary"
            >
                <X size={16} />
            </button>

            <div className="flex items-center gap-2 mb-3 text-purple-400 font-medium text-sm">
                <Wand2 size={16} />
                <span>AI가 제안하는 액션 아이템</span>
            </div>

            {loading ? (
                <div className="flex flex-col items-center justify-center py-8 text-text-secondary">
                    <Loader2 size={24} className="animate-spin mb-2" />
                    <span className="text-xs">고민을 분석하고 있어요...</span>
                </div>
            ) : error ? (
                <div className="text-red-400 text-sm py-4 text-center">
                    {error}
                    <button
                        onClick={handleGenerate}
                        className="block mx-auto mt-2 text-xs underline hover:text-red-300"
                    >
                        다시 시도
                    </button>
                </div>
            ) : (
                <div className="space-y-2">
                    {actions.map((action, index) => (
                        <button
                            key={index}
                            onClick={() => onSelectAction(action.replace(/\*\*/g, ''))} // Remove markdown when selecting
                            className="w-full text-left p-3 rounded-lg bg-bg-tertiary hover:bg-purple-900/20 hover:border-purple-500/30 border border-transparent transition-all text-sm text-text-primary group"
                        >
                            <span className="opacity-80 group-hover:opacity-100">
                                {action.split(/(\*\*.*?\*\*)/).map((part, i) =>
                                    part.startsWith('**') && part.endsWith('**') ? (
                                        <strong key={i} className="text-purple-300 font-semibold">
                                            {part.slice(2, -2)}
                                        </strong>
                                    ) : (
                                        part
                                    )
                                )}
                            </span>
                        </button>
                    ))}
                </div>
            )}
        </div>
    );
};

export default WorryActionGenerator;
