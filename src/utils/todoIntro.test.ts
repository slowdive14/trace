import { describe, it, expect } from 'vitest';
import { findTodoBodyStart, stripTodoIntro, countTodoIntroLines } from './todoUtils';

/** 실제 일간 투두와 같은 모양 (리마인드 블록 + 본문) */
const REAL = `나를 가꾸는 일 — 오늘 체력이나 지적 호기심을 위해 할 수 있는 게 뭐가 있지?

가까운 사람과 함께하는 일 — 오늘 아내와 웃을 수 있는 순간을 만들 수 있나?
---
    •● 척추위생 지킨다

    •● 고맙습니다, 감사합니다.
 ---

**유연함**
계획을 세우되, 삶이 준비한 뜻밖의 일에 열린 자세를 유지한다.

---

## 이번 주 해야 할 것
요즘 어때 프로그램 공부 및 발표 준비 자료 만들기


## 💻 매일 습관
- [x] 썬크림 or 아이크림 or 세안 오일
- [ ] 미니닌 영어(15m)

## 🎯 추가 할 일
- [x] 보고서1 (80m)`;

describe('findTodoBodyStart', () => {
    it('## 이번 주 헤딩을 본문 시작으로 잡는다', () => {
        const lines = REAL.split('\n');
        const idx = findTodoBodyStart(REAL);
        expect(lines[idx].trim()).toBe('## 이번 주 해야 할 것');
    });

    it('헤딩 뒤 공백이 있어도 찾는다', () => {
        const lines = '앞\n##  이번주  해야 할 것\n- [ ] a'.split('\n');
        expect(lines[findTodoBodyStart('앞\n##  이번주  해야 할 것\n- [ ] a')].trim())
            .toBe('##  이번주  해야 할 것');
    });

    it('이번 주 헤딩이 없으면 첫 헤딩을 쓴다', () => {
        const c = '리마인드 문구\n\n## 💻 매일 습관\n- [ ] a';
        expect(findTodoBodyStart(c)).toBe(2);
    });

    it('이미 본문부터 시작하면 0', () => {
        expect(findTodoBodyStart('## 💻 매일 습관\n- [ ] a')).toBe(0);
    });

    it('헤딩이 하나도 없으면 -1', () => {
        expect(findTodoBodyStart('- [ ] a\n- [ ] b')).toBe(-1);
    });
});

describe('stripTodoIntro', () => {
    it('리마인드 블록만 지우고 본문은 그대로 둔다', () => {
        const out = stripTodoIntro(REAL);
        expect(out.startsWith('## 이번 주 해야 할 것')).toBe(true);
        expect(out).toContain('## 💻 매일 습관');
        expect(out).toContain('- [x] 보고서1 (80m)');
        expect(out).not.toContain('척추위생');
        expect(out).not.toContain('유연함');
    });

    it('체크 상태를 건드리지 않는다', () => {
        const out = stripTodoIntro(REAL);
        expect(out).toContain('- [x] 썬크림 or 아이크림 or 세안 오일');
        expect(out).toContain('- [ ] 미니닌 영어(15m)');
    });

    it('지울 것이 없으면 원본 그대로', () => {
        const c = '## 💻 매일 습관\n- [ ] a';
        expect(stripTodoIntro(c)).toBe(c);
    });

    it('헤딩이 없으면 아무것도 지우지 않는다 (전부 날리지 않도록)', () => {
        const c = '- [ ] a\n- [ ] b';
        expect(stripTodoIntro(c)).toBe(c);
    });

    it('두 번 실행해도 더 지워지지 않는다', () => {
        const once = stripTodoIntro(REAL);
        expect(stripTodoIntro(once)).toBe(once);
    });
});

describe('countTodoIntroLines', () => {
    it('빈 줄을 뺀 실제 줄 수를 센다', () => {
        // REAL의 리마인드 블록에서 내용이 있는 줄만
        expect(countTodoIntroLines(REAL)).toBe(9);
    });

    it('지울 것이 없으면 0', () => {
        expect(countTodoIntroLines('## 💻 매일 습관\n- [ ] a')).toBe(0);
        expect(countTodoIntroLines('- [ ] a')).toBe(0);
    });
});
