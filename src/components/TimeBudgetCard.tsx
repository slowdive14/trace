import React from 'react';
import { format } from 'date-fns';
import {
    bedClockToMinutes, clockLabel, formatHM, comparePlanToTypical, weekdayName, TYPICAL_DAY_WINDOW,
    type TypicalDay, type TodayLoad, type TypicalDone,
} from '../utils/timeBudget';
import type { ReasonSummary } from '../utils/missReasons';

const reasonLine = (s: ReasonSummary): string => s.reasons.map(r => `${r.label} ${r.count}`).join(' · ');

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
    /** 크게 넘친 / 크게 덜 걸린 이유 (쌓인 게 적으면 null) */
    overReasons?: ReasonSummary | null;
    underReasons?: ReasonSummary | null;
    /** 오늘 계획량(끝낸 것 + 남은 것)과 평소 하루에 끝내는 양 */
    dayPlan?: { planned: number; typical: TypicalDone } | null;
}

/**
 * 오늘 시간 카드: 취침까지 남은 시간과, 남은 할 일에 드는 시간을 나란히 둔다.
 * 계획이 시간 안에 들어가는지 한눈에 보이게 해 하루를 현실적으로 잡도록 돕는다.
 *
 * 취침 시각은 최근 7일 평균이 기본이고, 오늘 따로 정할 수 있다
 * (오늘은 일찍 자려 한다거나, 평균이 오늘과 맞지 않을 때).
 */
const TimeBudgetCard: React.FC<TimeBudgetCardProps> = ({
    typical, load, nowMin, togglUpdatedAt, plannedBedtime, onBedtimeChange, overReasons, underReasons, dayPlan,
}) => {
    const plannedMin = plannedBedtime ? bedClockToMinutes(plannedBedtime) : null;
    const bedMin = plannedMin ?? typical?.bedMin ?? null;
    if (bedMin === null && load.known === 0) return null;

    const untilBed = bedMin !== null ? bedMin - nowMin : null;
    const pastBed = untilBed !== null && untilBed <= 0;
    const spare = untilBed !== null && !pastBed ? untilBed - load.remaining : null;
    const over = spare !== null && spare < 0;
    const fill = untilBed && untilBed > 0 ? Math.min(100, (load.remaining / untilBed) * 100) : 0;

    // 지금부터 이어서 하면 끝나는 시각 (중간값 기준 / 범위 위쪽 기준)
    const endMin = nowMin + load.remaining;
    const endHighMin = nowMin + load.remainingHigh;
    // 보통은 들어가는데 늦어지면 취침을 넘기는 날은 '늦으면'을 눈에 띄게 둔다
    const lateCrossesBed = bedMin !== null && endMin <= bedMin && endHighMin > bedMin;

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
                <div className="relative h-1 mt-3 bg-bg-tertiary rounded-full overflow-hidden">
                    <div
                        className={`absolute inset-y-0 left-0 rounded-full transition-all duration-500 ease-out ${over ? 'bg-red-400' : 'bg-accent'}`}
                        style={{ width: `${fill}%` }}
                    />
                </div>
            )}
            {(load.remaining > 0 || spare !== null) && (
                <div className="mt-1.5 flex flex-wrap items-baseline justify-between gap-x-3 gap-y-0.5 text-[11px] tabular-nums">
                    {load.remaining > 0 && (
                        <span className="text-text-secondary">
                            지금 시작하면 {clockLabel(endMin)}쯤 끝나요
                            {endHighMin > endMin && (
                                <span className={lateCrossesBed ? 'text-amber-400' : 'text-text-tertiary'}>
                                    {' · '}늦으면 {clockLabel(endHighMin)}
                                </span>
                            )}
                        </span>
                    )}
                    {spare !== null && (
                        <span className={over ? 'text-red-400' : 'text-text-secondary'}>
                            {over ? `취침까지 ${formatHM(-spare)} 넘쳐요` : `여유 ${formatHM(spare)}`}
                        </span>
                    )}
                </div>
            )}

            {/* 하루 단위: 오늘 계획이 평소 하루에 끝내는 양에 비해 어떤지 */}
            {dayPlan && dayPlan.planned > 0 && (() => {
                const { planned, typical: done } = dayPlan;
                const { tone, diff } = comparePlanToTypical(planned, done.minutes);
                const basis = done.weekday !== null ? `평소 ${weekdayName(done.weekday)}엔` : '평소 하루';
                const basisNote = done.weekday !== null
                    ? `최근 ${done.days}번의 ${weekdayName(done.weekday)}`
                    : `최근 ${done.days}일`;
                return (
                    <div
                        className="mt-2.5 pt-2.5 border-t border-bg-tertiary text-[11px] tabular-nums"
                        title={`${basisNote}에 끝낸 할 일 시간의 중간값. 그날들 계획한 것의 ${done.doneRatioPct}%를 끝냈어요`}
                    >
                        <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-0.5">
                            <span className="text-text-secondary">
                                오늘 계획 {formatHM(planned)} · {basis} {formatHM(done.minutes)} 끝내요
                            </span>
                            <span className={tone === 'over' ? 'text-amber-400' : 'text-text-secondary'}>
                                {tone === 'over' ? `${formatHM(diff)} 많아요` : tone === 'under' ? '평소보다 적어요' : '평소만큼이에요'}
                            </span>
                        </div>
                        {/* 많이 잡은 날에만, 평소 계획을 얼마나 끝내는지 덧붙인다 */}
                        {tone === 'over' && (
                            <div className="mt-0.5 text-text-tertiary">
                                {basis} 계획한 것의 {done.doneRatioPct}%를 끝냈어요
                            </div>
                        )}
                    </div>
                );
            })()}

            {/* 크게 어긋났던 날의 이유 — 숫자보다 손쓸 곳이 분명하다 */}
            {(overReasons || underReasons) && (
                <div className="mt-2 text-[11px] text-text-secondary leading-relaxed tabular-nums">
                    {overReasons && <div>크게 넘친 {overReasons.total}번 · {reasonLine(overReasons)}</div>}
                    {underReasons && <div>크게 덜 걸린 {underReasons.total}번 · {reasonLine(underReasons)}</div>}
                </div>
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
