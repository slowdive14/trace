import React from 'react';
import { format } from 'date-fns';
import { clockLabel, formatHM, TYPICAL_DAY_WINDOW, type TypicalDay, type TodayLoad } from '../utils/timeBudget';

interface TimeBudgetCardProps {
    typical: TypicalDay | null;
    load: TodayLoad;
    /** 논리적 0시부터 지금까지의 분 */
    nowMin: number;
    togglUpdatedAt: Date | null;
}

/**
 * 오늘 시간 카드: 평소 취침까지 남은 시간과, 남은 할 일에 드는 시간을 나란히 둔다.
 * 계획이 시간 안에 들어가는지 한눈에 보이게 해 하루를 현실적으로 잡도록 돕는다.
 */
const TimeBudgetCard: React.FC<TimeBudgetCardProps> = ({ typical, load, nowMin, togglUpdatedAt }) => {
    if (!typical && load.known === 0) return null;

    const untilBed = typical ? typical.bedMin - nowMin : null;
    const pastBed = untilBed !== null && untilBed <= 0;
    const spare = untilBed !== null && !pastBed ? untilBed - load.remaining : null;
    const over = spare !== null && spare < 0;
    const fill = untilBed && untilBed > 0 ? Math.min(100, (load.remaining / untilBed) * 100) : 0;

    return (
        <div className="mb-6 px-4 py-3.5 bg-bg-secondary rounded-xl">
            <div className="grid grid-cols-2 gap-3">
                <div>
                    <div className="text-xs text-text-secondary">
                        취침까지
                        {typical && <span className="text-text-tertiary tabular-nums"> · {clockLabel(typical.bedMin)}</span>}
                    </div>
                    <div className="mt-0.5 text-xl font-semibold text-text-primary tabular-nums">
                        {untilBed === null ? '—' : pastBed ? '지남' : formatHM(untilBed)}
                    </div>
                </div>
                <div>
                    <div className="text-xs text-text-secondary">
                        남은 할 일
                        <span className="text-text-tertiary tabular-nums"> · {load.known}개</span>
                    </div>
                    <div className={`mt-0.5 text-xl font-semibold tabular-nums ${over ? 'text-red-400' : 'text-text-primary'}`}>
                        {formatHM(load.remaining)}
                    </div>
                </div>
            </div>

            {spare !== null && (
                <>
                    <div className="relative h-1 mt-3 bg-bg-tertiary rounded-full overflow-hidden">
                        <div
                            className={`absolute inset-y-0 left-0 rounded-full transition-all duration-500 ease-out ${over ? 'bg-red-400' : 'bg-accent'}`}
                            style={{ width: `${fill}%` }}
                        />
                    </div>
                    <div className={`mt-1.5 text-[11px] tabular-nums ${over ? 'text-red-400' : 'text-text-secondary'}`}>
                        {over ? `평소 취침까지 ${formatHM(-spare)} 넘쳐요` : `여유 ${formatHM(spare)}`}
                    </div>
                </>
            )}
            {pastBed && typical && (
                <div className="mt-2 text-[11px] text-text-secondary">
                    평소 취침 시각({clockLabel(typical.bedMin)})이 지났어요
                </div>
            )}

            <div className="mt-2 text-[10px] text-text-tertiary leading-relaxed tabular-nums">
                {typical ? (
                    <>
                        최근 {TYPICAL_DAY_WINDOW}일 평균 기상 {clockLabel(typical.wakeMin)} · 취침 {clockLabel(typical.bedMin)}
                        {' · '}깨어 있는 시간 {formatHM(typical.bedMin - typical.wakeMin)}
                    </>
                ) : (
                    <>최근 {TYPICAL_DAY_WINDOW}일 안에 기상·취침 기록이 없어 남은 시간을 계산하지 못했어요</>
                )}
                {load.unknown > 0 && <> · 시간 모름 {load.unknown}개는 빠져 있어요</>}
                {togglUpdatedAt && <> · Toggl {format(togglUpdatedAt, 'M/d HH:mm')} 반영</>}
            </div>
        </div>
    );
};

export default TimeBudgetCard;
