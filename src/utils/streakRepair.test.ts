import { describe, it, expect } from 'vitest';
import { calculateStreak, STREAK_THRESHOLD, MAX_STREAK_REPAIRS } from './todoUtils';

/** 최근 날짜부터 역순으로 완료율을 주면 날짜 맵을 만든다 (오늘이 첫 값) */
const ratesFromToday = (today: string, ratesNewestFirst: number[]) => {
    const map: Record<string, number> = {};
    const [y, m, d] = today.split('-').map(Number);
    ratesNewestFirst.forEach((rate, i) => {
        const dt = new Date(y, m - 1, d - i);
        const key = `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, '0')}-${String(dt.getDate()).padStart(2, '0')}`;
        map[key] = rate;
    });
    return map;
};

const TODAY = '2026-08-22';

describe('메꾸기 없이 (기존 동작 유지)', () => {
    it('연달아 달성하면 그만큼 센다', () => {
        const s = calculateStreak(ratesFromToday(TODAY, [80, 85, 90, 75]), TODAY);
        expect(s.current).toBe(4);
        expect(s.repairedDates).toEqual([]);
    });

    it('미달을 만나면 거기서 끊긴다', () => {
        const s = calculateStreak(ratesFromToday(TODAY, [80, 85, 59, 90, 90]), TODAY);
        expect(s.current).toBe(2);
    });

    it('오늘이 미달이어도 어제까지의 연속은 유지해서 보여준다', () => {
        const s = calculateStreak(ratesFromToday(TODAY, [30, 85, 90]), TODAY);
        expect(s.todayMet).toBe(false);
        expect(s.current).toBe(2);
    });

    it('기록이 없으면 0', () => {
        const s = calculateStreak({}, TODAY);
        expect(s).toEqual({ current: 0, longest: 0, todayMet: false, repairsAvailable: 0, repairedDates: [] });
    });
});

describe('100% 달성이 앞선 미달을 메꾼다', () => {
    it('실제 상황: 오늘 100%, 어제 59% → 어제를 메꿔 연속이 이어진다', () => {
        // 8/22 100% · 8/21 59% · 8/20~8/12 달성 · 8/11 61%(끊김)
        const s = calculateStreak(
            ratesFromToday(TODAY, [100, 59, 83, 72, 70, 77, 96, 86, 80, 88, 94, 61]),
            TODAY,
        );
        expect(s.current).toBe(11);              // 오늘 + 메꾼 어제 + 8/20~8/12 9일
        expect(s.repairedDates).toEqual(['2026-08-21']);
        expect(s.repairsAvailable).toBe(0);      // 하나 벌어 하나 썼다
    });

    it('메꾸기가 없으면 그대로 끊긴다', () => {
        // 오늘이 99%라 적립이 없다
        const s = calculateStreak(ratesFromToday(TODAY, [99, 59, 83, 90]), TODAY);
        expect(s.current).toBe(1);
        expect(s.repairedDates).toEqual([]);
    });

    it('100%가 미달보다 앞(더 과거)에 있으면 쓰지 못한다', () => {
        // 어제 미달, 그저께 100% → 100%는 미달보다 과거라 소급 대상이 아니다
        const s = calculateStreak(ratesFromToday(TODAY, [80, 59, 100, 90]), TODAY);
        expect(s.current).toBe(1);
        expect(s.repairedDates).toEqual([]);
    });

    it('벌어둔 메꾸기는 다음 미달까지 남아 있다', () => {
        const s = calculateStreak(ratesFromToday(TODAY, [100, 80, 80]), TODAY);
        expect(s.current).toBe(3);
        expect(s.repairsAvailable).toBe(1);      // 아직 안 썼다
    });

    it('100% 두 번이면 미달 두 번을 메꾼다', () => {
        const s = calculateStreak(ratesFromToday(TODAY, [100, 50, 100, 40, 90, 90]), TODAY);
        expect(s.current).toBe(6);
        expect(s.repairedDates).toEqual(['2026-08-21', '2026-08-19']);
    });

    it('메꾸기 상한을 넘겨 쌓이지 않는다', () => {
        // 100%를 상한보다 많이 벌어도 그 이상은 적립되지 않는다
        const perfect = Array(MAX_STREAK_REPAIRS + 2).fill(100);
        const s = calculateStreak(ratesFromToday(TODAY, [...perfect, 10, 10, 10, 10]), TODAY);
        expect(s.repairedDates.length).toBe(MAX_STREAK_REPAIRS);
        expect(s.current).toBe(perfect.length + MAX_STREAK_REPAIRS);
    });

    it('기록이 아예 없는 날도 메꿀 수 있다', () => {
        const rates = ratesFromToday(TODAY, [100, 80, 80]);
        delete rates['2026-08-21'];              // 어제 기록 자체가 없음
        const s = calculateStreak(rates, TODAY);
        expect(s.repairedDates).toEqual(['2026-08-21']);
        expect(s.current).toBe(3);
    });
});

describe('최장 기록', () => {
    it('메꾸기를 반영해 최장을 계산한다', () => {
        // 과거 구간: 100%로 미달을 메꾼 5일 / 현재 구간: 2일
        const s = calculateStreak(
            ratesFromToday(TODAY, [80, 80, 10, 90, 100, 40, 90, 90]),
            TODAY,
        );
        expect(s.current).toBe(2);
        expect(s.longest).toBe(5);
    });

    it('최장은 현재보다 작을 수 없다', () => {
        const s = calculateStreak(ratesFromToday(TODAY, [90, 90, 90]), TODAY);
        expect(s.longest).toBeGreaterThanOrEqual(s.current);
    });
});

describe('경계', () => {
    it('기준값(70%)은 달성으로 친다', () => {
        expect(calculateStreak(ratesFromToday(TODAY, [STREAK_THRESHOLD]), TODAY).current).toBe(1);
        expect(calculateStreak(ratesFromToday(TODAY, [STREAK_THRESHOLD - 1]), TODAY).current).toBe(0);
    });

    it('기록 시작일 이전으로 무한히 거슬러 가지 않는다', () => {
        const s = calculateStreak(ratesFromToday(TODAY, [90, 90]), TODAY);
        expect(s.current).toBe(2);
    });

    it('월 경계를 넘어도 이어진다', () => {
        const s = calculateStreak(ratesFromToday('2026-09-01', [100, 50, 90]), '2026-09-01');
        expect(s.repairedDates).toEqual(['2026-08-31']);
        expect(s.current).toBe(3);
    });
});
