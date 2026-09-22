import { describe, it, expect } from 'vitest';
import {
    parseTodos,
    calculateWeightedSummary,
    calculateTotalWeightedRate,
    makeTodoBaseline,
    getTodoBonus,
    stripExtraCheckboxes,
    mergeTemplateInto,
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

describe('추가 항목(+)을 처음부터 따로 넣은 경우', () => {
    it('+ 표시를 읽어내고 본문에서는 떼어 낸다', () => {
        const [item] = parseTodos('- [x] +갑자기 온 상담 (60m)');
        expect(item.isExtra).toBe(true);
        expect(item.text).toBe('갑자기 온 상담 (60m)');
        expect(item.duration).toBe(60);
    });

    it('기준점이 없어도 분모에 들어가지 않는다', () => {
        const planOnly = parseTodos(DONE_DAY);
        const withExtra = parseTodos(`${DONE_DAY}\n- [ ] +갑자기 온 상담 (60m)`);

        // 90분 계획 그대로. 추가 항목을 적어도 분모가 커지지 않는다
        expect(calculateWeightedSummary(planOnly).totalWeight).toBe(90);
        expect(calculateWeightedSummary(withExtra).totalWeight).toBe(90);
        expect(calculateTotalWeightedRate(withExtra)).toBe(100);
    });

    it('아직 100%가 아닌 날에도 달성률을 깎지 않는다', () => {
        const midday = parseTodos(`- [x] 달리기 (30m)
- [ ] 보고서 (60m)
- [x] +갑자기 온 상담 (60m)`);
        expect(calculateTotalWeightedRate(midday)).toBe(33);   // 30/90, 추가 항목과 무관
    });

    it('완료하면 기준점 없이도 초과분으로 센다', () => {
        const items = parseTodos(`${DONE_DAY}\n- [x] +갑자기 온 상담 (60m)`);
        expect(getTodoBonus(items, undefined)).toEqual({ count: 1, minutes: 60 });
    });

    it('적어만 두고 완료하지 않으면 세지 않는다', () => {
        const items = parseTodos(`${DONE_DAY}\n- [ ] +갑자기 온 상담 (60m)`);
        expect(getTodoBonus(items, undefined)).toEqual({ count: 0, minutes: 0 });
    });

    it('소요시간을 안 적어도 개수는 센다 (직접 표시한 것이므로)', () => {
        const items = parseTodos(`${DONE_DAY}\n- [x] +동료 부탁 들어주기`);
        expect(getTodoBonus(items, undefined)).toEqual({ count: 1, minutes: 0 });
    });

    it('추가 항목의 하위 항목도 분모에서 함께 빠진다', () => {
        const items = parseTodos(`${DONE_DAY}
- [x] +갑자기 온 상담 (60m)
  - [x] 기록 정리
  - [x] 다음 회기 준비`);
        expect(calculateWeightedSummary(items).totalWeight).toBe(90);
        expect(calculateTotalWeightedRate(items)).toBe(100);
    });
});

describe('두 경로가 겹쳐도 한 번만 센다', () => {
    it('기준점이 있는 날에 추가 항목을 넣어도 이중으로 세지 않는다', () => {
        const baseline = makeTodoBaseline(parseTodos(DONE_DAY));
        const items = parseTodos(`${DONE_DAY}\n- [x] +갑자기 온 상담 (60m)`);

        // 표시가 있으므로 표시 쪽으로만 센다 (기준점 차이로 또 세면 2개가 된다)
        expect(getTodoBonus(items, baseline)).toEqual({ count: 1, minutes: 60 });
    });

    it('표시한 것과 표시 없이 덧붙인 것이 함께 있으면 둘 다 센다', () => {
        const baseline = makeTodoBaseline(parseTodos(DONE_DAY));
        const items = parseTodos(`${DONE_DAY}
- [x] +갑자기 온 상담 (60m)
- [x] 장보기 (20m)`);
        expect(getTodoBonus(items, baseline)).toEqual({ count: 2, minutes: 80 });
    });

    it('추가 항목은 기준점을 굳힐 때도 분모에 넣지 않는다', () => {
        const items = parseTodos(`${DONE_DAY}\n- [x] +갑자기 온 상담 (60m)`);
        expect(makeTodoBaseline(items)).toEqual({ weight: 90, timedCount: 2, timedMinutes: 90 });
    });
});

describe('옵시디언으로 내보낼 때', () => {
    it('추가 항목은 체크박스를 떼어 옵시디언 분모에 안 들어가게 한다', () => {
        const out = stripExtraCheckboxes(`- [x] 달리기 (30m)
- [x] +갑자기 온 상담 (60m)
- [ ] +장보기`);
        expect(out).toBe(`- [x] 달리기 (30m)
- ✅ 갑자기 온 상담 (60m)
- ⬜ 장보기`);
    });

    it('추가 항목의 하위도 함께 체크박스를 뗀다', () => {
        const out = stripExtraCheckboxes(`- [x] +갑자기 온 상담 (60m)
  - [x] 기록 정리
- [x] 보고서 (60m)
  - [x] 초안`);
        expect(out).toBe(`- ✅ 갑자기 온 상담 (60m)
  - ✅ 기록 정리
- [x] 보고서 (60m)
  - [x] 초안`);
    });

    it('추가 항목이 없으면 원문 그대로 둔다', () => {
        const plan = `## 💻 매일 습관
- [x] 달리기 (30m)
  - [ ] 스트레칭`;
        expect(stripExtraCheckboxes(plan)).toBe(plan);
    });
});

describe('매일 루틴 채워 넣기', () => {
    const TEMPLATE = `## 💻 매일 습관
- [ ] 달리기 (30m)
- [ ] 미니닌 영어

## 🎯 추가 할 일`;

    it('미리 적어 둔 계획을 지우지 않고 루틴을 앞에 둔다', () => {
        const merged = mergeTemplateInto('- [ ] 김동은 보고서 작성', TEMPLATE);
        expect(merged).toBe(`${TEMPLATE}\n- [ ] 김동은 보고서 작성`);
    });

    it('빈 날에는 템플릿만 들어간다', () => {
        expect(mergeTemplateInto('', TEMPLATE)).toBe(TEMPLATE);
    });

    it('템플릿이 없으면 그대로 둔다', () => {
        expect(mergeTemplateInto('- [ ] 보고서', '')).toBe('- [ ] 보고서');
    });

    it('이미 있는 항목은 두 번 넣지 않는다', () => {
        const merged = mergeTemplateInto('- [x] 달리기 (30m)\n- [ ] 보고서', TEMPLATE);
        expect(parseTodos(merged).filter(t => t.text === '달리기 (30m)')).toHaveLength(1);
        expect(merged).toContain('- [ ] 보고서');
    });

    it('중복된 헤딩을 다시 넣지 않는다', () => {
        const merged = mergeTemplateInto('## 🎯 추가 할 일\n- [ ] 보고서', TEMPLATE);
        expect(merged.split('## 🎯 추가 할 일')).toHaveLength(2);
    });

    it('루틴이 들어와도 계획한 항목 수가 줄지 않는다', () => {
        const planned = '- [ ] 보고서\n- [ ] 회의 준비 (40m)';
        const merged = mergeTemplateInto(planned, TEMPLATE);
        const texts = parseTodos(merged).map(t => t.text);

        expect(texts).toContain('보고서');
        expect(texts).toContain('회의 준비 (40m)');
        expect(texts).toContain('달리기 (30m)');
        expect(texts).toHaveLength(4);
    });
});
