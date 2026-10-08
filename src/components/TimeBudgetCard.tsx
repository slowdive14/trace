import React from 'react';
import { format } from 'date-fns';
import {
    bedClockToMinutes, clockLabel, formatHM, TYPICAL_DAY_WINDOW,
    type TypicalDay, type TodayLoad,
} from '../utils/timeBudget';

interface TimeBudgetCardProps {
    typical: TypicalDay | null;
    load: TodayLoad;
    /** 논리적 0시부터 지금까지의 분 */
    nowMin: number;
    togglUpdatedAt: Date | null;
    /** 오늘 직접 정한 취침 시각 ('HH:mm'). 없으면 최근 7일 평균 */
    plannedBedtime: string | null;
    /** 취침 시각을 정하거나(HH:mm) 평균으로 되돌린다(null) */
    onBedtimeChange: (bedtime: string | null) => void;
}

/**
 * 오늘 시간 카드: 취침까지 남은 시간과, 남은 할 일에 드는 시간을 나란히 둔다.
 * 계획이 시간 안에 들어가는지 한눈에 보이게 해 하루를 현실적으로 잡도록 돕는다.
 *
 * 취침 시각은 최근 7일 평균이 기본이고, 오늘 따로 정할 수 있다
 * (오늘은 일찍 자려 한다거나, 평균이 오늘과 맞지 않을 때).
 */
const TimeBudgetCard: React.FC<TimeBudgetCardProps> = ({
    typical, load, nowMin, togglUpdatedAt, plannedBedtime, onBedtimeChange,
}) => {
    const plannedMin = plannedBedtime ? bedClockToMinutes(plannedBedtime) : null;
    const bedMin = plannedMin ?? typical?.bedMin ?? null;
    if (bedMin === null && load.known === 0) return null;

    const untilBed = bedMin !== null ? bedMin - nowMin : null;
    const pastBed = untilBed !== null && untilBed <= 0;
    const spare = untilBed !== null && !pastBed ? untilBed - load.remaining : null;
    const over = spare !== null && spare < 0;
    const fill = untilBed && untilBed > 0 ? Math.min(100, (load.remaining / untilBed) * 100) : 0;

    // 시간 선택기에 보여 줄 값 (직접 정한 값, 없으면 평균)
    const pickerValue = plannedBedtime ?? (typical ? clockLabel(typical.bedMin) : '');

    return (
        <div className="mb-6 px-4 py-3.5 bg-bg-secondary rounded-xl">
            <div className="grid grid-cols-2 gap-3">
                <div>
                    <div className="flex items-baseline flex-wrap gap-x-1 text-xs text-text-secondary">
                        취침까지
                        <span className="text-text-tertiary">·</span>
                        {/* 시각을 누르면 시간 선택기가 열린다. 글자처럼 보이게 입력창은 투명하게 덮는다.
                            글자만큼만 누를 수 있으면 손가락으로 맞히기 어려워 위아래로 여백을 넓힌다(배치는 그대로) */}
                        <label
                            className={`relative inline-flex items-center px-1 -mx-1 py-2 -my-2 cursor-pointer tabular-nums underline decoration-dotted underline-offset-2 ${plannedBedtime ? 'text-accent' : 'text-text-tertiary hover:text-text-secondary'}`}
                            title="오늘 취침 시각 정하기"
                        >
                            {pickerValue || '시각 정하기'}
                            <input
                                type="time"
                                value={pickerValue}
                                onChange={e => onBedtimeChange(e.target.value || null)}
                                onClick={e => { try { e.currentTarget.showPicker?.(); } catch { /* 무시 */ } }}
                                className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                                aria-label="오늘 취침 시각"
                            />
                        </label>
                        {plannedBedtime && typical && (
                            <button
                                onClick={() => onBedtimeChange(null)}
                                className="ml-1 px-1.5 py-2 -my-2 text-[10px] text-text-tertiary hover:text-text-secondary"
                                title={`최근 ${TYPICAL_DAY_WINDOW}일 평균(${clockLabel(typical.bedMin)})으로 되돌리기`}
                            >
                                평균으로
                            </button>
                        )}
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
                        {over ? `취침까지 ${formatHM(-spare)} 넘쳐요` : `여유 ${formatHM(spare)}`}
                    </div>
                </>
            )}
            {pastBed && bedMin !== null && (
                <div className="mt-2 text-[11px] text-text-secondary">
                    {plannedBedtime ? '정한' : '평소'} 취침 시각({clockLabel(bedMin)})이 지났어요
                </div>
            )}

            <div className="mt-2 text-[10px] text-text-tertiary leading-relaxed tabular-nums">
                {plannedBedtime && <>오늘 취침 {plannedBedtime} (직접 정함) · </>}
                {typical ? (
                    <>
                        최근 {TYPICAL_DAY_WINDOW}일 평균 기상 {clockLabel(typical.wakeMin)} · 취침 {clockLabel(typical.bedMin)}
                        {bedMin !== null && <>{' · '}깨어 있는 시간 {formatHM(bedMin - typical.wakeMin)}</>}
                    </>
                ) : !plannedBedtime ? (
                    <>최근 {TYPICAL_DAY_WINDOW}일 안에 기상·취침 기록이 없어요. 위에서 취침 시각을 정하면 남은 시간을 계산해요</>
                ) : null}
                {load.unknown > 0 && <> · 시간 모름 {load.unknown}개는 빠져 있어요</>}
                {togglUpdatedAt && <> · Toggl {format(togglUpdatedAt, 'M/d HH:mm')} 반영</>}
            </div>
        </div>
    );
};

export default TimeBudgetCard;
