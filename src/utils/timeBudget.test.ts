import { describe, it, expect } from 'vitest';
import { parseTodos } from './todoUtils';
import type { SleepRecord } from './sleepUtils';
import {
    getTypicalDay, minutesSinceLogicalMidnight, clockLabel, computeTodayLoad, bedClockToMinutes,
    projectFinishTimes, type ItemEstimate,
} from './timeBudget';

/** date(기상일)에 hh:mm 기상, 그 전날 밤(또는 새벽) bed 취침 */
const night = (date: string, bed: [number, number, number], wake: [number, number]): SleepRecord => {
    const [y, m, d] = date.split('-').map(Number);
    return {
        date,
        // bed[0]: 기상일 기준 며칠 차이 (-1이면 전날 저녁, 0이면 같은 날 새벽)
        sleepTime: new Date(y, m - 1, d + bed[0], bed[1], bed[2]),
        wakeTime: new Date(y, m - 1, d, wake[0], wake[1]),
    };
};

describe('평소의 하루 (최근 7일 평균 기상·취침)', () => {
    it('자정을 넘긴 취침은 다음 날 새벽으로 센다 (01:41 → 25:41)', () => {
        const day = getTypicalDay([
            night('2026-10-07', [0, 1, 35], [8, 46]),
            night('2026-10-06', [0, 2, 4], [8, 53]),
            night('2026-10-02', [-1, 23, 38], [9, 32]),
        ], '2026-10-07');
        // 취침: 95+1440, 124+1440, 1418 → 평균 1505.67 → 1506 (=01:06)
        expect(day!.bedMin).toBe(1506);
        expect(clockLabel(day!.bedMin)).toBe('01:06');
        expect(clockLabel(day!.wakeMin)).toBe('09:04');
    });

    it('7일보다 오래된 기록은 쓰지 않는다', () => {
        const day = getTypicalDay([
            night('2026-10-07', [0, 1, 0], [9, 0]),
            night('2026-09-30', [-1, 22, 0], [6, 0]),   // 8일 전
        ], '2026-10-07');
        expect(day).toMatchObject({ wakeMin: 540, bedMin: 1500, wakeCount: 1, bedCount: 1 });
    });

    it('기상이나 취침 기록 중 하나라도 없으면 계산하지 않는다', () => {
        expect(getTypicalDay([], '2026-10-07')).toBeNull();
        expect(getTypicalDay([{ date: '2026-10-07', wakeTime: new Date(2026, 9, 7, 9, 0) }], '2026-10-07')).toBeNull();
    });
});

describe('지금 시각 (논리적 하루 기준)', () => {
    it('자정을 넘기면 24시 이후로 센다', () => {
        expect(minutesSinceLogicalMidnight(new Date(2026, 9, 7, 15, 40), '2026-10-07')).toBe(940);
        expect(minutesSinceLogicalMidnight(new Date(2026, 9, 8, 1, 0), '2026-10-07')).toBe(1500);
    });

    it('직접 정한 취침 시각을 분으로 바꾼다 (새벽은 자정 넘김)', () => {
        expect(bedClockToMinutes('23:30')).toBe(1410);
        expect(bedClockToMinutes('01:30')).toBe(1530);
        expect(bedClockToMinutes('05:59')).toBe(1799);
        expect(bedClockToMinutes('06:00')).toBe(360);
        expect(bedClockToMinutes('25:00')).toBeNull();
        expect(bedClockToMinutes('')).toBeNull();
    });

    it('시계 표기로 되돌린다', () => {
        expect(clockLabel(1541)).toBe('01:41');
        expect(clockLabel(563)).toBe('09:23');
    });
});

describe('남은 할 일에 드는 시간', () => {
    const none = () => undefined;

    it('직접 적은 시간을 더하고, 완료한 것은 뺀다', () => {
        const load = computeTodayLoad(parseTodos(`- [x] 웨이트 (60m)
- [ ] 혼공머신 (60m)
- [ ] 방송대 강의 (60m)`), none);
        expect(load).toMatchObject({ remaining: 120, known: 2, unknown: 0, estimated: 0 });
    });

    it('직접 적지 않은 것은 예상 시간을 쓰고, 그것도 없으면 모름으로 센다', () => {
        const items = parseTodos(`- [ ] 혼공머신
- [ ] 넥서스 60
- [ ] 배터리 찾아오기`);
        const est: Record<string, ItemEstimate> = { '혼공머신': { minutes: 75 }, '넥서스 60': { minutes: 60 } };
        const load = computeTodayLoad(items, item => est[item.text]);
        expect(load).toMatchObject({ remaining: 135, known: 2, estimated: 2, unknown: 1 });
    });

    it('범위가 있는 예상은 위쪽 값으로 "늦으면"을 따로 더한다 (직접 적은 시간은 그대로)', () => {
        const items = parseTodos(`- [ ] 혼공머신
- [ ] 웨이트 (60m)`);
        const load = computeTodayLoad(items, item => (item.text === '혼공머신' ? { minutes: 75, high: 90 } : undefined));
        expect(load).toMatchObject({ remaining: 135, remainingHigh: 150 });
    });

    it('최상위 항목마다 남은 몫을 따로 준다 (시간을 아는 것만)', () => {
        const items = parseTodos(`- [ ] 혼공머신
- [ ] 배터리 찾아오기
- [x] 웨이트 (60m)
- [ ] 보고서 (120m)
  - [x] 초안
  - [ ] 검토`);
        const load = computeTodayLoad(items, item => (item.text === '혼공머신' ? { minutes: 75, high: 90 } : undefined));
        expect([...load.perRoot.entries()]).toEqual([
            [0, { remaining: 75, high: 90 }],
            [3, { remaining: 60, high: 60 }],
        ]);
    });

    it('추가 항목(+)도 시간은 든다', () => {
        const load = computeTodayLoad(parseTodos('- [ ] +방송대 과제 (90m)'), none);
        expect(load.remaining).toBe(90);
    });

    it('하위 항목이 반쯤 끝난 일은 남은 비율만큼만', () => {
        const load = computeTodayLoad(parseTodos(`- [ ] 보고서 (120m)
  - [x] 초안
  - [ ] 검토`), none);
        expect(load.remaining).toBe(60);
    });

    it('부모에 시간이 없으면 하위 항목의 남은 몫을 더한다 (두 번 세지 않는다)', () => {
        const load = computeTodayLoad(parseTodos(`- [ ] 보고서
  - [ ] 1 (30m)
  - [x] 2 (40m)
  - [ ] 3 (20m)`), none);
        expect(load).toMatchObject({ remaining: 50, known: 2 });
    });

    it('하위에 직접 적은 시간이 있으면 부모 이름으로 짐작하지 않는다', () => {
        const load = computeTodayLoad(parseTodos(`- [ ] 보고서
  - [ ] 1 (30m)`), item => (item.text === '보고서' ? { minutes: 120 } : undefined));
        expect(load.remaining).toBe(30);
    });

    it('부모 시간이 있으면 하위의 시간은 다시 더하지 않는다', () => {
        const load = computeTodayLoad(parseTodos(`- [ ] 보고서 (120m)
  - [ ] 1 (30m)
  - [ ] 2 (40m)`), none);
        expect(load.remaining).toBe(120);
    });
});

describe('끝나는 시각 (지금부터 순서대로)', () => {
    const perRoot = new Map([
        [0, { remaining: 70, high: 90 }],
        [2, { remaining: 75, high: 75 }],
        [5, { remaining: 80, high: 100 }],
    ]);
    const at1540 = 15 * 60 + 40;

    it('화면 순서대로 이어 붙인다', () => {
        const finish = projectFinishTimes([0, 2, 5], perRoot, at1540);
        expect([...finish.entries()].map(([i, m]) => [i, clockLabel(m)])).toEqual([
            [0, '16:50'], [2, '18:05'], [5, '19:25'],
        ]);
    });

    it('순서를 바꾸면 끝나는 시각도 바뀐다', () => {
        const finish = projectFinishTimes([5, 0, 2], perRoot, at1540);
        expect(clockLabel(finish.get(5)!)).toBe('17:00');
        expect(clockLabel(finish.get(2)!)).toBe('19:25');
    });

    it('시간을 모르는 항목은 건너뛰고 끝나는 시각을 붙이지 않는다', () => {
        const finish = projectFinishTimes([0, 9, 2], perRoot, at1540);
        expect(finish.has(9)).toBe(false);
        expect(clockLabel(finish.get(2)!)).toBe('18:05');
    });

    it('자정을 넘기면 다음 날 새벽 시각으로 적는다', () => {
        const finish = projectFinishTimes([0], perRoot, 23 * 60 + 30);
        expect(clockLabel(finish.get(0)!)).toBe('00:40');
    });
});
