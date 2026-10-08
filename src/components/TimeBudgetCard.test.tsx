import { describe, it, expect } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import TimeBudgetCard from './TimeBudgetCard';
import { formatHM, type TodayLoad, type TypicalDay } from '../utils/timeBudget';
import type { ReasonSummary } from '../utils/missReasons';

/** 태그를 걷어 낸 화면 글자 */
const text = (el: React.ReactElement) => renderToStaticMarkup(el).replace(/<[^>]+>/g, '').replace(/\s+/g, ' ');

// 최근 7일 평균: 기상 09:23, 취침 01:41 (=25:41)
const typical: TypicalDay = { wakeMin: 563, bedMin: 1541, wakeCount: 7, bedCount: 7 };
const at1540 = 15 * 60 + 40;
const noop = () => {};

/** 남은 몫 (high를 안 주면 범위 없이 중간값 그대로) */
const ld = (remaining: number, known: number, estimated = 0, unknown = 0, high = remaining): TodayLoad =>
    ({ remaining, remainingHigh: high, known, estimated, unknown, perRoot: new Map() });

const card = (over: {
    typical?: TypicalDay | null;
    load?: TodayLoad;
    nowMin?: number;
    togglUpdatedAt?: Date | null;
    plannedBedtime?: string | null;
    overReasons?: ReasonSummary | null;
    underReasons?: ReasonSummary | null;
}) => (
    <TimeBudgetCard
        typical={over.typical === undefined ? typical : over.typical}
        load={over.load ?? ld(270, 5, 3, 1)}
        nowMin={over.nowMin ?? at1540}
        togglUpdatedAt={over.togglUpdatedAt ?? null}
        plannedBedtime={over.plannedBedtime ?? null}
        onBedtimeChange={noop}
        overReasons={over.overReasons ?? null}
        underReasons={over.underReasons ?? null}
    />
);

describe('formatHM', () => {
    it('시간과 분으로 적는다', () => {
        expect(formatHM(530)).toBe('8시간 50분');
        expect(formatHM(45)).toBe('45분');
        expect(formatHM(120)).toBe('2시간');
        expect(formatHM(-5)).toBe('0분');
    });
});

describe('오늘 시간 카드', () => {
    it('취침까지 남은 시간, 남은 할 일, 여유를 보여 준다', () => {
        const t = text(card({}));
        expect(t).toMatch(/취침까지\s*·\s*01:41/);   // 머리글은 글자 대신 flex 간격으로 띄운다
        expect(t).toContain('10시간 1분');            // 15:40 → 01:41
        expect(t).toContain('남은 할 일 · 5개');
        expect(t).toContain('4시간 30분');
        expect(t).toContain('여유 5시간 31분');
        expect(t).toContain('최근 7일 평균 기상 09:23 · 취침 01:41 · 깨어 있는 시간 16시간 18분');
        expect(t).toContain('시간 모름 1개는 빠져 있어요');
    });

    it('계획이 취침 시각을 넘기면 얼마나 넘치는지 알린다', () => {
        const t = text(card({ load: ld(700, 8, 2) }));
        expect(t).toContain('취침까지 1시간 39분 넘쳐요');
    });

    it('평소 취침 시각이 지나면 그렇게 알린다', () => {
        const t = text(card({ load: ld(60, 1), nowMin: 1560 }));
        expect(t).toContain('지남');
        expect(t).toContain('평소 취침 시각(01:41)이 지났어요');
        expect(t).not.toContain('여유');
    });

    it('수면 기록이 없으면 남은 할 일만 보이고, 취침 시각을 정하라고 안내한다', () => {
        const t = text(card({ typical: null, load: ld(90, 2, 1) }));
        expect(t).toContain('1시간 30분');
        expect(t).toContain('시각 정하기');
        expect(t).toContain('기상·취침 기록이 없어요');
    });

    it('수면 기록도, 정한 시각도, 시간 아는 항목도 없으면 그리지 않는다', () => {
        expect(renderToStaticMarkup(card({ typical: null, load: ld(0, 0, 0, 3) }))).toBe('');
    });

    it('Toggl을 언제 반영했는지 적는다', () => {
        const t = text(card({ togglUpdatedAt: new Date(2026, 9, 7, 5, 30) }));
        expect(t).toContain('Toggl 10/7 05:30 반영');
    });
});

describe('취침 시각을 직접 정했을 때', () => {
    it('정한 시각으로 남은 시간을 계산한다', () => {
        const t = text(card({ plannedBedtime: '23:30' }));
        expect(t).toMatch(/취침까지\s*·\s*23:30/);
        expect(t).toContain('7시간 50분');            // 15:40 → 23:30
        expect(t).toContain('여유 3시간 20분');        // 7h50m − 4h30m
        expect(t).toContain('오늘 취침 23:30 (직접 정함)');
        expect(t).toContain('깨어 있는 시간 14시간 7분');   // 09:23 → 23:30
    });

    it('자정을 넘긴 시각도 그날 밤으로 본다', () => {
        const t = text(card({ plannedBedtime: '00:30' }));
        expect(t).toContain('8시간 50분');            // 15:40 → 00:30
    });

    it('평균으로 되돌리는 버튼이 있다', () => {
        expect(text(card({ plannedBedtime: '23:30' }))).toContain('평균으로');
        expect(text(card({}))).not.toContain('평균으로');
    });

    it('수면 기록이 없어도 정한 시각으로 계산한다', () => {
        const t = text(card({ typical: null, plannedBedtime: '23:00' }));
        expect(t).toContain('7시간 20분');
        expect(t).not.toContain('기상·취침 기록이 없어요');
    });

    it('정한 시각이 지나면 그렇게 알린다', () => {
        const t = text(card({ plannedBedtime: '22:00', nowMin: 22 * 60 + 30 }));
        expect(t).toContain('정한 취침 시각(22:00)이 지났어요');
    });
});

describe('끝나는 시각', () => {
    it('지금 시작하면 언제 끝나는지 적는다', () => {
        expect(text(card({ load: ld(225, 3) }))).toContain('지금 시작하면 19:25쯤 끝나요');
    });

    it('범위가 있으면 늦을 때의 시각도 함께 적는다', () => {
        const t = text(card({ load: ld(225, 3, 3, 0, 270) }));
        expect(t).toContain('지금 시작하면 19:25쯤 끝나요 · 늦으면 20:10');
    });

    it('범위가 없으면 "늦으면"을 적지 않는다', () => {
        expect(text(card({ load: ld(225, 3) }))).not.toContain('늦으면');
    });

    it('보통은 들어가도 늦어지면 취침을 넘기는 날은 "늦으면"을 눈에 띄게 둔다', () => {
        // 23:00 취침, 15:40부터 7시간(22:40) / 늦으면 8시간(23:40)
        const html = renderToStaticMarkup(card({ plannedBedtime: '23:00', load: ld(420, 3, 3, 0, 480) }));
        expect(html).toMatch(/text-amber-400[^>]*>\s*·\s*(<!-- -->)?늦으면/);
    });

    it('남은 할 일이 없으면 끝나는 시각을 적지 않는다', () => {
        expect(text(card({ load: ld(0, 0, 0, 2) }))).not.toContain('지금 시작하면');
    });
});

describe('크게 어긋난 이유', () => {
    it('쌓인 이유를 많은 순으로 보여 준다', () => {
        const t = text(card({
            overReasons: { total: 7, reasons: [{ id: 'interrupted', label: '방해받음', count: 4 }, { id: 'scope', label: '범위가 커짐', count: 3 }] },
            underReasons: { total: 3, reasons: [{ id: 'easy', label: '생각보다 쉬움', count: 3 }] },
        }));
        expect(t).toContain('크게 넘친 7번 · 방해받음 4 · 범위가 커짐 3');
        expect(t).toContain('크게 덜 걸린 3번 · 생각보다 쉬움 3');
    });

    it('쌓인 게 없으면 그 줄을 그리지 않는다', () => {
        expect(text(card({}))).not.toContain('크게 넘친');
    });
});
