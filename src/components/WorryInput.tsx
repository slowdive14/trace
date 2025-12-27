import React, { useState } from 'react';
import { differenceInWeeks, startOfDay } from 'date-fns';
import { Maximize2, Minimize2 } from 'lucide-react';

interface WorryInputProps {
    activeWorryId: string | null;
    worryStartDate: Date | null;
    worryTitle?: string;
    replyingToId: string | null;
    replyType?: 'action' | 'result';
    onCancelReply: () => void;
    onSubmit: (entry: { type: 'worry' | 'action' | 'result', content: string, week: number, parentId?: string }) => void;
    isEmbedded?: boolean;
}

const WorryInput: React.FC<WorryInputProps> = ({ activeWorryId, worryStartDate, worryTitle, replyingToId, replyType, onCancelReply, onSubmit, isEmbedded = false }) => {
    const [content, setContent] = useState('');
    const [type, setType] = useState<'worry' | 'action' | 'result'>('worry');
    const [isExpanded, setIsExpanded] = useState(false);

    // Automatically switch to 'action' or 'result' when replying
    React.useEffect(() => {
        if (replyingToId && replyType) {
            setType(replyType);
        }
    }, [replyingToId, replyType]);

    const calculateWeek = (startDate: Date): number => {
        const today = startOfDay(new Date());
        const start = startOfDay(startDate);
        const diffWeeks = differenceInWeeks(today, start);
        return diffWeeks + 1;
    };

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        if (!content.trim() || !activeWorryId || !worryStartDate) return;

        const week = calculateWeek(worryStartDate);
        onSubmit({
            type,
            content: content.trim(),
            week,
            parentId: replyingToId || undefined
        });
        setContent('');
        if (replyingToId) {
            onCancelReply();
        }
    };

    if (!activeWorryId) {
        if (isEmbedded) return null;
        return (
            <div className="fixed bottom-[52px] left-0 right-0 bg-bg-secondary border-t border-bg-tertiary p-4 z-40">
                <div className="max-w-md mx-auto text-center text-text-secondary text-sm">
                    고민을 먼저 시작해주세요
                </div>
            </div>
        );
    }

    const containerClasses = isEmbedded
        ? "mt-4 bg-bg-secondary border border-bg-tertiary rounded-xl p-4"
        : "fixed bottom-[52px] left-0 right-0 bg-bg-secondary border-t border-bg-tertiary p-4 z-40";

    return (
        <div className={containerClasses}>
            <div className={isEmbedded ? "w-full" : "max-w-md mx-auto"}>
                {!isEmbedded && worryTitle && (
                    <div className="text-center text-xs text-purple-400 mb-2">
                        💭 "{worryTitle}" 에 기록 중
                    </div>
                )}
                {replyingToId && (
                    <div className="flex items-center justify-between bg-bg-tertiary px-3 py-2 rounded-lg mb-3 text-sm">
                        <span className="text-text-secondary">
                            <span className={`${replyType === 'action' ? 'text-amber-400' : 'text-green-400'} mr-1`}>
                                {replyType === 'action' ? '⚡' : '✅'}
                            </span>
                            이전 기록에 {replyType === 'action' ? '액션' : '결과'} 추가 중...
                        </span>
                        <button
                            onClick={onCancelReply}
                            className="text-text-secondary hover:text-text-primary"
                        >
                            취소
                        </button>
                    </div>
                )}

                <div className="flex gap-2 mb-3">
                    <button
                        type="button"
                        onClick={() => setType('worry')}
                        className={`flex-1 py-1.5 rounded-lg text-sm font-medium transition-colors ${type === 'worry'
                            ? 'bg-purple-900/30 text-purple-300 border border-purple-800/50'
                            : 'bg-bg-tertiary text-text-secondary border border-transparent hover:bg-bg-tertiary/80'
                            }`}
                    >
                        💭 고민
                    </button>
                    <button
                        type="button"
                        onClick={() => setType('action')}
                        className={`flex-1 py-1.5 rounded-lg text-sm font-medium transition-colors ${type === 'action'
                            ? 'bg-amber-900/30 text-amber-300 border border-amber-800/50'
                            : 'bg-bg-tertiary text-text-secondary border border-transparent hover:bg-bg-tertiary/80'
                            }`}
                    >
                        ⚡ 액션
                    </button>
                    <button
                        type="button"
                        onClick={() => setType('result')}
                        className={`flex-1 py-1.5 rounded-lg text-sm font-medium transition-colors ${type === 'result'
                            ? 'bg-green-900/30 text-green-300 border border-green-800/50'
                            : 'bg-bg-tertiary text-text-secondary border border-transparent hover:bg-bg-tertiary/80'
                            }`}
                    >
                        ✅ 결과
                    </button>
                </div>

                <form onSubmit={handleSubmit} className="flex flex-col gap-2">
                    <div className="flex gap-2">
                        <textarea
                            value={content}
                            onChange={(e) => setContent(e.target.value)}
                            placeholder={`${type === 'worry' ? '고민되는 점' : type === 'action' ? '실행할 계획' : '실행 결과'}을 입력하세요`}
                            className={`flex-1 bg-bg-tertiary text-text-primary placeholder-text-secondary border border-bg-tertiary rounded-xl px-4 py-3 focus:outline-none focus:ring-2 focus:ring-green-500 focus:bg-bg-secondary transition-all resize-none ${isExpanded ? 'min-h-[120px]' : 'min-h-[48px] max-h-[48px]'}`}
                            autoFocus={!!replyingToId}
                            rows={isExpanded ? 4 : 1}
                            onKeyDown={(e) => {
                                if (e.key === 'Enter' && !e.shiftKey && !isExpanded) {
                                    e.preventDefault();
                                    if (content.trim()) {
                                        handleSubmit(e);
                                    }
                                }
                            }}
                        />
                        <div className="flex flex-col gap-2">
                            <button
                                type="button"
                                onClick={() => setIsExpanded(!isExpanded)}
                                className="p-3 bg-bg-tertiary text-text-secondary hover:text-text-primary rounded-xl transition-colors"
                                title={isExpanded ? '축소' : '확장'}
                            >
                                {isExpanded ? <Minimize2 size={18} /> : <Maximize2 size={18} />}
                            </button>
                            <button
                                type="submit"
                                disabled={!content.trim()}
                                className="bg-green-600 text-white rounded-xl px-4 py-3 font-medium disabled:opacity-50 disabled:cursor-not-allowed hover:bg-green-500 transition-colors flex-1"
                            >
                                전송
                            </button>
                        </div>
                    </div>
                </form>
            </div>
        </div>
    );
};

export default WorryInput;
