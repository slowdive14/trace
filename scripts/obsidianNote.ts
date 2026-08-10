/**
 * 옵시디언 일간노트 파일 조작 (순수 함수 — Firebase·파일시스템 의존 없음)
 */
import { format } from 'date-fns';

/**
 * Templater 템플릿을 특정 날짜 기준으로 렌더링한다.
 *
 * 옵시디언을 켜지 않은 날은 일간노트가 아예 없으므로, 스크립트가 템플릿으로
 * 만들어 준다. Templater 전체를 흉내 내지는 않고 이 템플릿이 쓰는 범위만 처리한다.
 *  - `<%* ... %>` 실행 블록은 제거 (파일명 변경용이라 여기선 불필요 — 이름은 직접 정한다)
 *  - `<% tp.date.now("FMT") %>` 는 해당 날짜로 치환
 * 그 외 알 수 없는 태그가 남으면 호출측이 알 수 있도록 그대로 둔다.
 */
export function renderTemplate(template: string, date: Date): string {
    // moment 토큰 → date-fns 토큰 (긴 것부터 매칭)
    const TOKENS: Record<string, string> = {
        YYYY: 'yyyy', YY: 'yy',
        MMMM: 'MMMM', MMM: 'MMM', MM: 'MM', M: 'M',
        DD: 'dd', D: 'd',
        dddd: 'EEEE', ddd: 'EEE',
        HH: 'HH', mm: 'mm', ss: 'ss',
        ww: 'ww', w: 'w',   // 로컬 주차 — Templater(moment)의 ww와 같은 기준
    };
    const toDateFns = (fmt: string) =>
        fmt.replace(/YYYY|YY|MMMM|MMM|MM|dddd|ddd|DD|HH|mm|ss|ww|M|D|w/g, t => TOKENS[t] ?? t);

    return template
        // 실행 블록 제거 (여닫는 태그 사이 전부)
        .replace(/<%\*[\s\S]*?%>/g, '')
        // tp.date.now("...") 치환
        .replace(/<%\s*tp\.date\.now\(\s*"([^"]*)"\s*\)\s*%>/g, (whole, fmt: string) => {
            try {
                return format(date, toDateFns(fmt));
            } catch {
                return whole;   // 못 다루는 형식은 그대로 남겨 눈에 띄게 한다
            }
        })
        .replace(/^\n+/, '');   // 실행 블록 자리에 남은 빈 줄 정리
}

/** 렌더링 후에도 남아 있는 Templater 태그 (사람이 확인해야 함) */
export function findUnresolvedTags(rendered: string): string[] {
    return [...new Set(rendered.match(/<%[\s\S]*?%>/g) ?? [])];
}

// 섹션 경계 표식. 이 사이만 갈아끼우므로 몇 번을 돌려도 중복되지 않는다.
export const START_MARKER = '<!-- serein:start -->';
export const END_MARKER = '<!-- serein:end -->';
export const SECTION_HEADING = '# Serein';
/**
 * 표식이 없는 노트에서 섹션의 끝을 판단할 기준 헤딩.
 * 넣는 내용 자체에 '## 🤔' 같은 헤딩이 들어 있어 "다음 헤딩까지"로는 경계를 못 잡는다.
 * 템플릿상 Serein 섹션 바로 뒤에 오는 헤딩을 종료 지점으로 삼는다.
 */
export const DEFAULT_END_HEADING = '## 📊 목표 달성률 계산';

const WEEKDAYS = ['일', '월', '화', '수', '목', '금', '토'];

export const DEFAULT_NOTE_PATH = '일간노트/{yyyy}년/{yyyy}년 {M}월/{yyyyMMdd}{ddd}.md';
export const DEFAULT_TEMPLATE_PATH = 'Templates/daily.md';

/** 날짜 → 볼트 안의 노트 상대 경로 */
export function noteRelPath(date: Date, template: string = DEFAULT_NOTE_PATH): string {
    return template
        .replace(/\{yyyyMMdd\}/g, format(date, 'yyyyMMdd'))
        .replace(/\{yyyy\}/g, format(date, 'yyyy'))
        .replace(/\{M\}/g, String(date.getMonth() + 1))
        .replace(/\{ddd\}/g, WEEKDAYS[date.getDay()]);
}

/**
 * 노트 본문의 '# Serein' 섹션을 새 내용으로 갈아끼운다.
 *  - 표식이 있으면 그 사이만 교체 (재실행해도 안전)
 *  - 표식이 없으면 '# Serein' 다음부터 다음 헤딩 직전까지를 교체하며 표식을 심는다
 *
 * 표식을 쓰는 이유: 넣는 내용 자체에 '## 🤔 What happened today?' 같은 헤딩이
 * 들어 있어서, 헤딩만으로 경계를 잡으면 두 번째 실행부터 뒤쪽 dataviewjs가 잘려나간다.
 *
 * @returns 갱신된 본문. '# Serein' 섹션이 없으면 null (노트를 건드리지 않는다)
 */
export function replaceSereinSection(
    note: string,
    body: string,
    endHeading: string = DEFAULT_END_HEADING,
): string | null {
    const block = `${START_MARKER}\n${body.trim()}\n${END_MARKER}`;

    const start = note.indexOf(START_MARKER);
    const end = note.indexOf(END_MARKER);
    if (start !== -1 && end !== -1 && end > start) {
        return note.slice(0, start) + block + note.slice(end + END_MARKER.length);
    }

    // 표식이 아직 없는 노트 (수동으로 붙여넣어 둔 내용이 있을 수 있다)
    const lines = note.split('\n');
    const headingIdx = lines.findIndex(l => l.trim() === SECTION_HEADING);
    if (headingIdx === -1) return null;

    // 섹션의 끝: 지정된 종료 헤딩 → 없으면 다음 H1 → 없으면 문서 끝.
    // "다음 헤딩"으로 잡으면 넣는 내용 안의 '## 🤔'에 걸려 옛 내용이 남는다.
    let endIdx = lines.length;
    for (let i = headingIdx + 1; i < lines.length; i++) {
        const line = lines[i].trim();
        if (line === endHeading || /^#\s/.test(lines[i])) { endIdx = i; break; }
    }

    const before = lines.slice(0, headingIdx + 1);
    const after = lines.slice(endIdx);
    return [...before, '', block, '', ...after].join('\n');
}
