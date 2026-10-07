import { describe, it, expect } from 'vitest';
import { parseTodos } from './todoUtils';
import type { SleepRecord } from './sleepUtils';
import {
    getTypicalDay, minutesSinceLogicalMidnight, clockLabel, computeTodayLoad,
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
        const est: Record<string, number> = { '혼공머신': 75, '넥서스 60': 60 };
        const load = computeTodayLoad(items, item => est[item.text]);
        expect(load).toMatchObject({ remaining: 135, known: 2, estimated: 2, unknown: 1 });
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
  - [ ] 1 (30m)`), item => (item.text === '보고서' ? 120 : undefined));
        expect(load.remaining).toBe(30);
    });

    it('부모 시간이 있으면 하위의 시간은 다시 더하지 않는다', () => {
        const load = computeTodayLoad(parseTodos(`- [ ] 보고서 (120m)
  - [ ] 1 (30m)
  - [ ] 2 (40m)`), none);
        expect(load.remaining).toBe(120);
    });
});
