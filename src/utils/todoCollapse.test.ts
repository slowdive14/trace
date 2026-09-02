import { describe, it, expect } from 'vitest';
import { getVisibleRows, getCollapseKey, parseTodos } from './todoUtils';

/** 실제 투두와 같은 모양: 부모 하나 + 하위 7개 (일부 완료) */
const GROUP = parseTodos(`- [ ] 회기리뷰 7개
\t- [x] 1회기
\t- [x] 2회기
\t- [x] 3회기
\t- [ ] 4회기
\t- [ ] 5회기
\t- [ ] 6회기
\t- [ ] 7회기`);

const rowOf = (rows: ReturnType<typeof getVisibleRows>, text: string) =>
    rows.find(r => r.item.text === text)!;

describe('getVisibleRows - 하위 항목 진행 상황', () => {
    it('접었을 때 하위 완료/전체 개수를 부모에 실어 보낸다', () => {
        const rows = getVisibleRows(GROUP, new Set(['회기리뷰 7개']));
        const parent = rowOf(rows, '회기리뷰 7개');

        expect(parent.collapsed).toBe(true);
        expect(parent.childDone).toBe(3);
        expect(parent.childTotal).toBe(7);
        expect(rows).toHaveLength(1);   // 하위는 숨는다
    });

    it('펼쳐도 개수는 그대로 센다 (접는 순간 값이 튀지 않게)', () => {
        const rows = getVisibleRows(GROUP, new Set());
        const parent = rowOf(rows, '회기리뷰 7개');

        expect(parent.collapsed).toBe(false);
        expect(parent.childDone).toBe(3);
        expect(parent.childTotal).toBe(7);
        expect(rows).toHaveLength(8);
    });

    it('하위가 없으면 0으로 둔다', () => {
        const rows = getVisibleRows(parseTodos('- [ ] 혼자짜리'), new Set());

        expect(rows[0].hasChildren).toBe(false);
        expect(rows[0].childTotal).toBe(0);
    });

    it('더 깊은 단계까지 모두 센다', () => {
        const deep = parseTodos(`- [ ] 보고서
\t- [x] 자료조사
\t\t- [x] 논문
\t\t- [ ] 통계
\t- [ ] 초안`);
        const parent = rowOf(getVisibleRows(deep, new Set()), '보고서');

        expect(parent.childTotal).toBe(4);
        expect(parent.childDone).toBe(2);
    });

    it('소요시간 표기가 붙어도 접힘 키가 맞아 진행 상황이 보인다', () => {
        const timed = parseTodos(`- [ ] 회기리뷰 7개 (90m)
\t- [x] 1회기
\t- [ ] 2회기`);
        const key = getCollapseKey(timed[0]);
        const parent = rowOf(getVisibleRows(timed, new Set([key])), '회기리뷰 7개 (90m)');

        expect(parent.collapsed).toBe(true);
        expect(parent.childDone).toBe(1);
        expect(parent.childTotal).toBe(2);
    });

    it('형제 그룹의 하위 항목까지 넘어가 세지 않는다', () => {
        const two = parseTodos(`- [ ] A
\t- [x] a1
- [ ] B
\t- [x] b1
\t- [x] b2`);
        const rows = getVisibleRows(two, new Set());

        expect(rowOf(rows, 'A').childTotal).toBe(1);
        expect(rowOf(rows, 'B').childTotal).toBe(2);
    });
});
