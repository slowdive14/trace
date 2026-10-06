import { describe, it, expect } from 'vitest';
import { getWeeklyTarget, TARGET_DEFAULT, TARGET_LOOKBACK_WEEKS } from './todoUtils';

// 2026-10-05는 월요일 (이번 주 시작)
const WEEK_START = '2026-10-05';

/** 지금 주 기준 n주 전 월요일부터 7일을 같은 달성률로 채운다 */
const fillWeek = (rates: Record<string, number>, weeksAgo: number, rate: number | number[]) => {
    const monday = new Date(2026, 9, 5 - weeksAgo * 7, 12);
    for (let i = 0; i < 7; i++) {
        const d = new Date(monday);
        d.setDate(monday.getDate() + i);
        const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
        rates[key] = Array.isArray(rate) ? rate[i] : rate;
    }
    return rates;
};

describe('getWeeklyTarget — 최근 여러 주로 정한다', () => {
    it('기록이 없으면 기본 목표', () => {
        expect(getWeeklyTarget({}, WEEK_START)).toEqual({ target: TARGET_DEFAULT, baseline: 0, days: 0 });
    });

    it('늘 같은 수준이면 그보다 2 높게', () => {
        const rates: Record<string, number> = {};
        for (let w = 1; w <= 8; w++) fillWeek(rates, w, 80);
        expect(getWeeklyTarget(rates, WEEK_START)).toEqual({ target: 82, baseline: 80, days: 56 });
    });

    it('나쁜 한 주에 목표가 끌려 내려가지 않는다 (스크린샷 상황)', () => {
        const rates: Record<string, number> = {};
        for (let w = 2; w <= 8; w++) fillWeek(rates, w, 80);
        // 지난주: 4%, 44%인 날이 낀 주 (평균 65)
        fillWeek(rates, 1, [80, 75, 82, 67, 44, 4, 100]);

        const { target } = getWeeklyTarget(rates, WEEK_START);
        // 예전 방식이면 65 + 2 = 67
        expect(target).toBeGreaterThanOrEqual(78);
        expect(target).toBeLessThan(82);   // 그래도 조금은 반영된다
    });

    it('몇 주에 걸쳐 오르면 목표도 따라 오른다', () => {
        const flat: Record<string, number> = {};
        const rising: Record<string, number> = {};
        for (let w = 1; w <= 8; w++) {
            fillWeek(flat, w, 70);
            fillWeek(rising, w, w <= 3 ? 85 : 70);
        }
        expect(getWeeklyTarget(rising, WEEK_START).target)
            .toBeGreaterThan(getWeeklyTarget(flat, WEEK_START).target);
    });

    it('가까운 주를 더 크게 반영한다', () => {
        const recentGood = fillWeek(fillWeek({}, 1, 90), 8, 50);
        const oldGood = fillWeek(fillWeek({}, 1, 50), 8, 90);
        expect(getWeeklyTarget(recentGood, WEEK_START).baseline)
            .toBeGreaterThan(getWeeklyTarget(oldGood, WEEK_START).baseline);
    });

    it('이번 주 기록은 쓰지 않는다 (아직 진행 중)', () => {
        const rates = fillWeek({}, 1, 70);
        rates['2026-10-05'] = 100;
        rates['2026-10-06'] = 100;
        expect(getWeeklyTarget(rates, WEEK_START)).toEqual({ target: 72, baseline: 70, days: 7 });
    });

    it(`${TARGET_LOOKBACK_WEEKS}주보다 오래된 기록은 쓰지 않는다`, () => {
        const rates = fillWeek(fillWeek({}, 1, 70), TARGET_LOOKBACK_WEEKS + 1, 10);
        expect(getWeeklyTarget(rates, WEEK_START).baseline).toBe(70);
    });

    it('주의 경계는 월요일이다 (지난 일요일은 지난주, 8주 전 월요일까지 포함)', () => {
        const rates = { '2026-10-04': 70, '2026-08-10': 70, '2026-08-09': 0 };
        expect(getWeeklyTarget(rates, WEEK_START).days).toBe(2);
    });

    it('며칠만 기록한 주는 그만큼만 반영된다', () => {
        // 지난주 하루만 0%, 2주 전은 7일 내내 80%
        const rates = fillWeek({ '2026-09-28': 0 }, 2, 80);
        const { baseline } = getWeeklyTarget(rates, WEEK_START);
        // 주 평균끼리 견주면 0과 80의 중간쯤이 되겠지만, 하루는 하루만큼만
        expect(baseline).toBeGreaterThan(65);
    });

    it('50~95 사이로 묶는다', () => {
        expect(getWeeklyTarget(fillWeek({}, 1, 10), WEEK_START).target).toBe(50);
        expect(getWeeklyTarget(fillWeek({}, 1, 100), WEEK_START).target).toBe(95);
    });
});
