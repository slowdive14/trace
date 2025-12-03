import React, { useState } from 'react';
import { differenceInCalendarDays } from 'date-fns';

interface WorryInputProps {
    activeWorryId: string | null;
    worryStartDate: Date | null;
    onSubmit: (entry: { type: 'worry' | 'action' | 'result', content: string, week: number }) => void;
}

const WorryInput: React.FC<WorryInputProps> = ({ activeWorryId, worryStartDate, onSubmit }) => {
    const [content, setContent] = useState('');
    const [type, setType] = useState<'worry' | 'action' | 'result'>('worry');

    const calculateWeek = (startDate: Date): number => {
        const today = new Date();
        const diffDays = differenceInCalendarDays(today, startDate);
        return Math.floor(diffDays / 7) + 1;
    };

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        if (!content.trim() || !activeWorryId || !worryStartDate) return;

        const week = calculateWeek(worryStartDate);
        onSubmit({ type, content: content.trim(), week });
        setContent('');
    };

    if (!activeWorryId) {
        return (
            <div className="fixed bottom-20 left-0 right-0 bg-bg-secondary border-t border-bg-tertiary p-4 z-10">
                <div className="max-w-md mx-auto text-center text-text-secondary text-sm">
                    고민을 먼저 시작해주세요
                </div>
            </div>
        );
    }

    return (
        <div className="fixed bottom-20 left-0 right-0 bg-bg-secondary border-t border-bg-tertiary p-4 z-10">
            <div className="max-w-md mx-auto">
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

                <form onSubmit={handleSubmit} className="flex gap-2">
                    <input
                        type="text"
                        value={content}
                        onChange={(e) => setContent(e.target.value)}
                        placeholder={`${type === 'worry' ? '고민되는 점' : type === 'action' ? '실행할 계획' : '실행 결과'}을 입력하세요`}
                        className="flex-1 bg-bg-tertiary text-text-primary placeholder-text-secondary border border-bg-tertiary rounded-xl px-4 py-3 focus:outline-none focus:ring-2 focus:ring-green-500 focus:bg-bg-secondary transition-all"
                    />
                    <button
                        type="submit"
                        disabled={!content.trim()}
                        className="bg-green-600 text-white rounded-xl px-4 font-medium disabled:opacity-50 disabled:cursor-not-allowed hover:bg-green-500 transition-colors"
                    >
                        전송
                    </button>
                </form>
            </div>
        </div>
    );
};

export default WorryInput;
