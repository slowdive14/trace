import { describe, it, expect } from 'vitest';
import { replaceSereinSection } from './obsidianNote';

/** 실제 일간노트와 같은 모양 */
const noteWithEmptySection = `---
tags:
  - daily_note
date: 2026-08-10
---

# 📅 오늘 마감

\`\`\`dataview
TASK
FROM "2026_Roadmap.md"
\`\`\`

# Serein


## 📊 목표 달성률 계산
\`\`\`dataviewjs
const tasks = dv.current().file.tasks;
\`\`\`
`;

const body = `## 🤔 What happened today?
#### 일상
- 09:00 산책
#### 지출
- 커피 4,500원 ☕
**합계**: 4,500원`;

describe('replaceSereinSection', () => {
    it('표식이 없으면 # Serein 아래에 심고 내용을 넣는다', () => {
        const out = replaceSereinSection(noteWithEmptySection, body)!;
        expect(out).toContain('<!-- serein:start -->');
        expect(out).toContain('<!-- serein:end -->');
        expect(out).toContain('- 09:00 산책');
    });

    it('앞뒤 내용은 그대로 보존한다', () => {
        const out = replaceSereinSection(noteWithEmptySection, body)!;
        expect(out).toContain('tags:\n  - daily_note');           // 프론트매터
        expect(out).toContain('# 📅 오늘 마감');                    // 앞 섹션
        expect(out).toContain('## 📊 목표 달성률 계산');            // 뒤 섹션
        expect(out).toContain('const tasks = dv.current().file.tasks;'); // 뒤 코드블록
    });

    it('다시 실행해도 중복되지 않는다 (핵심: 매일 돌아가므로)', () => {
        const once = replaceSereinSection(noteWithEmptySection, body)!;
        const twice = replaceSereinSection(once, body)!;
        expect(twice).toBe(once);
        expect(twice.match(/<!-- serein:start -->/g)).toHaveLength(1);
        expect(twice.match(/## 🤔 What happened today\?/g)).toHaveLength(1);
    });

    it('내용이 바뀌면 이전 내용을 대체한다', () => {
        const once = replaceSereinSection(noteWithEmptySection, body)!;
        const updated = replaceSereinSection(once, '## 🤔 What happened today?\n#### 일상\n- 22:00 독서')!;
        expect(updated).toContain('- 22:00 독서');
        expect(updated).not.toContain('- 09:00 산책');
        expect(updated.match(/<!-- serein:start -->/g)).toHaveLength(1);
    });

    it('생성된 내용 안의 ## 헤딩에 헷갈리지 않는다', () => {
        // 첫 삽입 후 본문에 ## 헤딩이 생기는데, 재실행 시 그걸 섹션 끝으로
        // 착각하면 뒤쪽 dataviewjs가 잘려나간다
        const once = replaceSereinSection(noteWithEmptySection, body)!;
        const twice = replaceSereinSection(once, body)!;
        expect(twice).toContain('## 📊 목표 달성률 계산');
        expect(twice).toContain('const tasks = dv.current().file.tasks;');
    });

    it('수동으로 붙여넣어 둔 기존 내용을 대체한다', () => {
        const manual = noteWithEmptySection.replace(
            '# Serein\n\n',
            '# Serein\n\n## 🤔 What happened today?\n#### 일상\n- 07:00 예전에 붙여넣은 것\n\n',
        );
        const out = replaceSereinSection(manual, body)!;
        expect(out).not.toContain('예전에 붙여넣은 것');
        expect(out).toContain('- 09:00 산책');
        expect(out).toContain('## 📊 목표 달성률 계산');   // 뒤 섹션 보존
    });

    it('# Serein 섹션이 없으면 null (노트를 건드리지 않음)', () => {
        expect(replaceSereinSection('# 다른 노트\n내용', body)).toBeNull();
    });

    it('# Serein이 문서 맨 끝에 있어도 동작한다', () => {
        const out = replaceSereinSection('# 앞\n내용\n\n# Serein\n', body)!;
        expect(out).toContain('- 09:00 산책');
        expect(out).toContain('# 앞');
    });
});
