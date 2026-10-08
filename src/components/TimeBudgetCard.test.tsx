import { describe, it, expect } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import TimeBudgetCard from './TimeBudgetCard';
import { formatHM, type TodayLoad, type TypicalDay } from '../utils/timeBudget';

/** 태그를 걷어 낸 화면 글자 */
const text = (el: React.ReactElement) => renderToStaticMarkup(el).replace(/<[^>]+>/g, '').replace(/\s+/g, ' ');

// 최근 7일 평균: 기상 09:23, 취침 01:41 (=25:41)
const typical: TypicalDay = { wakeMin: 563, bedMin: 1541, wakeCount: 7, bedCount: 7 };
const at1540 = 15 * 60 + 40;
const noop = () => {};

const card = (over: {
    typical?: TypicalDay | null;
    load?: TodayLoad;
    nowMin?: number;
    togglUpdatedAt?: Date | null;
    plannedBedtime?: string | null;
}) => (
    <TimeBudgetCard
        typical={over.typical === undefined ? typical : over.typical}
        load={over.load ?? { remaining: 270, known: 5, estimated: 3, unknown: 1 }}
        nowMin={over.nowMin ?? at1540}
        togglUpdatedAt={over.togglUpdatedAt ?? null}
        plannedBedtime={over.plannedBedtime ?? null}
        onBedtimeChange={noop}
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
        const t = text(card({ load: { remaining: 700, known: 8, estimated: 2, unknown: 0 } }));
        expect(t).toContain('취침까지 1시간 39분 넘쳐요');
    });

    it('평소 취침 시각이 지나면 그렇게 알린다', () => {
        const t = text(card({ load: { remaining: 60, known: 1, estimated: 0, unknown: 0 }, nowMin: 1560 }));
        expect(t).toContain('지남');
        expect(t).toContain('평소 취침 시각(01:41)이 지났어요');
        expect(t).not.toContain('여유');
    });

    it('수면 기록이 없으면 남은 할 일만 보이고, 취침 시각을 정하라고 안내한다', () => {
        const t = text(card({ typical: null, load: { remaining: 90, known: 2, estimated: 1, unknown: 0 } }));
        expect(t).toContain('1시간 30분');
        expect(t).toContain('시각 정하기');
        expect(t).toContain('기상·취침 기록이 없어요');
    });

    it('수면 기록도, 정한 시각도, 시간 아는 항목도 없으면 그리지 않는다', () => {
        expect(renderToStaticMarkup(card({ typical: null, load: { remaining: 0, known: 0, estimated: 0, unknown: 3 } }))).toBe('');
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
