import { describe, it, expect } from 'vitest';
import {
    parseTodos,
    calculateWeightedSummary,
    calculateTotalWeightedRate,
    makeTodoBaseline,
    getTodoBonus,
} from './todoUtils';

/** 소요시간이 적힌 항목만으로 이루어진 하루 (30분 + 60분) */
const DONE_DAY = `- [x] 달리기 (30m)
- [x] 보고서 (60m)`;

describe('기준점이 없을 때 (기존 동작)', () => {
    it('분모는 지금 목록 전체다', () => {
        const summary = calculateWeightedSummary(parseTodos(DONE_DAY));
        expect(summary.totalWeight).toBe(90);
        expect(summary.completedWeight).toBe(90);
        expect(summary.percentage).toBe(100);
    });

    it('다 끝낸 뒤 항목을 추가하면 달성률이 떨어진다 (고치려는 문제)', () => {
        const added = parseTodos(`${DONE_DAY}\n- [ ] 산책 (30m)`);
        expect(calculateTotalWeightedRate(added)).toBe(75);   // 90/120
    });

    it('초과분은 세지 않는다', () => {
        expect(getTodoBonus(parseTodos(DONE_DAY), undefined)).toEqual({ count: 0, minutes: 0 });
    });
});

describe('기준점을 굳힌 뒤', () => {
    const baseline = makeTodoBaseline(parseTodos(DONE_DAY));

    it('기준점은 그 시점의 분모와 완료 항목을 담는다', () => {
        expect(baseline).toEqual({ weight: 90, timedCount: 2, timedMinutes: 90 });
    });

    it('항목을 추가해도 달성률이 100%에서 내려가지 않는다', () => {
        const added = parseTodos(`${DONE_DAY}\n- [ ] 산책 (30m)`);
        expect(calculateTotalWeightedRate(added, baseline)).toBe(100);
    });

    it('추가한 항목을 완료해도 100%를 넘기지 않고, 초과분으로 쌓인다', () => {
        const items = parseTodos(`${DONE_DAY}\n- [x] 산책 (30m)`);
        const summary = calculateWeightedSummary(items, baseline);

        expect(summary.percentage).toBe(100);
        expect(summary.totalWeight).toBe(90);        // 분모는 기준점 그대로
        expect(summary.completedWeight).toBe(90);    // 넘어선 몫은 잘라 낸다
        expect(getTodoBonus(items, baseline)).toEqual({ count: 1, minutes: 30 });
    });

    it('기준 항목을 체크 해제하면 100% 아래로 정직하게 내려간다', () => {
        const items = parseTodos(`- [ ] 달리기 (30m)\n- [x] 보고서 (60m)`);
        expect(calculateWeightedSummary(items, baseline).percentage).toBe(67);   // 60/90
    });
});

describe('완화 장치: 소요시간이 적힌 항목만 초과로 인정한다', () => {
    const baseline = makeTodoBaseline(parseTodos(DONE_DAY));

    it('시간 없는 항목을 여러 개 추가해 완료해도 초과로 세지 않는다', () => {
        const items = parseTodos(`${DONE_DAY}
- [x] 물 마시기
- [x] 스트레칭
- [x] 창문 열기`);
        expect(getTodoBonus(items, baseline)).toEqual({ count: 0, minutes: 0 });
    });

    it('시간을 적은 항목만 골라 센다', () => {
        const items = parseTodos(`${DONE_DAY}
- [x] 물 마시기
- [x] 청소 (20m)`);
        expect(getTodoBonus(items, baseline)).toEqual({ count: 1, minutes: 20 });
    });

    it('추가만 하고 완료하지 않으면 초과가 아니다', () => {
        const items = parseTodos(`${DONE_DAY}\n- [ ] 청소 (20m)`);
        expect(getTodoBonus(items, baseline)).toEqual({ count: 0, minutes: 0 });
    });
});

describe('기준점을 굳히는 시점', () => {
    it('100%를 채운 순간의 분모가 잡힌다 (그 전 상태로는 잡지 않는다)', () => {
        const halfway = parseTodos(`- [x] 달리기 (30m)\n- [ ] 보고서 (60m)`);
        expect(calculateWeightedSummary(halfway).percentage).toBeLessThan(100);

        // 100%가 된 뒤에 굳힌 기준점만 분모 90을 갖는다
        expect(makeTodoBaseline(parseTodos(DONE_DAY)).weight).toBe(90);
    });

    it('하위 항목이 있는 날도 부모 가중치 기준으로 굳는다', () => {
        const items = parseTodos(`- [x] 보고서 (60m)
  - [x] 초안
  - [x] 검토`);
        // 부모 60분이 분모이고 하위는 그 안에서 나눠 갖는다
        expect(makeTodoBaseline(items).weight).toBe(60);
        expect(calculateWeightedSummary(items).percentage).toBe(100);
    });
});
