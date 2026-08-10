import { describe, it, expect } from 'vitest';
import { renderTemplate, findUnresolvedTags } from './obsidianNote';

const date = new Date(2026, 7, 10, 12); // 2026-08-10 (월)

describe('renderTemplate', () => {
    it('tp.date.now 형식을 해당 날짜로 치환한다', () => {
        const out = renderTemplate(
            'date: <% tp.date.now("YYYY-MM-DD") %>\nmonth: <% tp.date.now("YYYY-MM") %>',
            date,
        );
        expect(out).toBe('date: 2026-08-10\nmonth: 2026-08');
    });

    it('주차(ww)는 실제 노트 값과 일치한다', () => {
        // 볼트의 20260810월.md 는 week: 2026-W33, 20260731금.md 는 2026-W31
        expect(renderTemplate('<% tp.date.now("YYYY") %>-W<% tp.date.now("ww") %>', date))
            .toBe('2026-W33');
        expect(renderTemplate('<% tp.date.now("YYYY") %>-W<% tp.date.now("ww") %>', new Date(2026, 6, 31, 12)))
            .toBe('2026-W31');
    });

    it('파일명 변경용 실행 블록(<%* %>)은 제거한다', () => {
        const out = renderTemplate('---\nx: 1\n---\n<%*\n  const a = 1;\n  await tp.file.rename("x");\n%>\n\n본문', date);
        expect(out).not.toContain('tp.file.rename');
        expect(out).not.toContain('<%*');
        expect(out).toContain('본문');
        expect(out).toContain('x: 1');
    });

    it('dataviewjs 블록 등 나머지는 그대로 둔다', () => {
        const src = '```dataviewjs\nconst tasks = dv.current().file.tasks;\n```';
        expect(renderTemplate(src, date)).toBe(src);
    });

    it('다룰 수 없는 태그는 남겨서 눈에 띄게 한다', () => {
        const out = renderTemplate('<% tp.file.title %>', date);
        expect(findUnresolvedTags(out)).toEqual(['<% tp.file.title %>']);
    });

    it('처리한 태그만 있으면 남는 태그가 없다', () => {
        const out = renderTemplate('date: <% tp.date.now("YYYY-MM-DD") %>\n<%* const x=1; %>', date);
        expect(findUnresolvedTags(out)).toEqual([]);
    });
});
