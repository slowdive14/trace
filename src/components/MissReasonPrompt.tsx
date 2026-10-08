import React, { useEffect } from 'react';
import { describeGap, MISS_REASONS, type MissDirection } from '../utils/missReasons';

/** 이유 묻기 창에 필요한 것 */
export interface MissPromptData {
    text: string;
    expected: number;
    actual: number;
    direction: MissDirection;
}

interface MissReasonPromptProps {
    prompt: MissPromptData;
    onPick: (reasonId: string) => void;
    onDismiss: () => void;
}

/** 저절로 닫히기까지 (ms). 답하지 않아도 그만이다 */
const AUTO_DISMISS_MS = 20_000;

/**
 * 걸린 시간이 예상과 크게 어긋났을 때 이유를 한 번 누르게 한다.
 * 쓰지 않아도 되는 가벼운 질문이라 저절로 닫히고, '건너뛰기'도 둔다.
 */
const MissReasonPrompt: React.FC<MissReasonPromptProps> = ({ prompt, onPick, onDismiss }) => {
    useEffect(() => {
        const t = setTimeout(onDismiss, AUTO_DISMISS_MS);
        return () => clearTimeout(t);
    }, [prompt, onDismiss]);

    return (
        <div
            className="fixed top-20 left-1/2 -translate-x-1/2 lg:ml-[calc(var(--rail-w)/2)] lg:top-8 z-[70] w-[calc(100%-32px)] max-w-sm p-3.5 bg-bg-secondary border border-bg-tertiary rounded-xl shadow-lg"
            role="dialog"
            aria-label="예상과 크게 어긋난 이유"
        >
            <div className="text-sm text-text-primary truncate">{prompt.text}</div>
            <div className="mt-0.5 text-[11px] text-text-secondary tabular-nums">
                {describeGap(prompt.expected, prompt.actual)}
            </div>
            <div className="mt-2.5 text-xs text-text-secondary">왜 달랐나요?</div>
            <div className="mt-1.5 flex flex-wrap gap-1.5">
                {MISS_REASONS[prompt.direction].map(r => (
                    <button
                        key={r.id}
                        onClick={() => onPick(r.id)}
                        className="px-2.5 py-1.5 text-xs rounded-lg bg-bg-tertiary text-text-primary hover:bg-accent/20 transition-colors"
                    >
                        {r.label}
                    </button>
                ))}
                <button
                    onClick={onDismiss}
                    className="px-2 py-1.5 text-xs text-text-tertiary hover:text-text-secondary"
                >
                    건너뛰기
                </button>
            </div>
        </div>
    );
};

export default MissReasonPrompt;
