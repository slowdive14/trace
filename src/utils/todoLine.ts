/**
 * 투두 한 줄을 다루는 작은 도구들.
 * - 체크한 뒤 '걸린 시간' 창에서 저장할 때, 그 사이 바뀐 내용에서도 같은 항목을 찾아 시간을 붙인다.
 * - 안 끝낸 항목을 다른 날로 옮길 때, 옮겨 갈 줄과 남길 줄을 나눈다.
 */

const TODO_LINE_RE = /^[\t ]*- \[[ xX]\] /;
const EID_RE = /\s*\{eid:[^}]+\}/g;
// parseDuration과 같은 꼴: 줄 끝의 (30m), (2h), (1h30m)
const TRAILING_DURATION_RE = /\s*\((\d+h)?\s*(\d+m)?\)\s*$/;

/**
 * 항목 자체를 가리키는 열쇠. 체크 상태, 줄 끝의 시간, 일상 기록 연결 표시는 뺀다.
 * 들여쓰기는 남긴다 (부모가 다른 같은 이름의 하위 항목을 가르는 데 쓴다).
 */
export const todoLineKey = (line: string): string => line
    .replace(/^([\t ]*)- \[[ xX]\] /, '$1')
    .replace(EID_RE, '')
    .replace(TRAILING_DURATION_RE, '')
    .trimEnd();

/**
 * 체크할 때 기억해 둔 줄을 지금 내용에서 다시 찾는다.
 * 그 사이 시간이나 연결 표시가 붙었거나, 다른 줄이 끼어 자리가 밀렸어도 같은 항목을 찾는다.
 * 같은 이름이 여럿이면 원래 자리에서 가장 가까운 것을 고른다. 거리가 같으면 아래쪽을 고른다
 * (창이 열린 사이에는 지우기보다 위에 끼워 넣어 아래로 밀리는 일이 흔하다). 없으면 -1.
 */
export const findTodoLine = (lines: string[], expectedIndex: number, lineText: string): number => {
    const key = todoLineKey(lineText);
    const matches = (line: string | undefined) =>
        line !== undefined && TODO_LINE_RE.test(line) && todoLineKey(line) === key;
    if (matches(lines[expectedIndex])) return expectedIndex;

    let best = -1;
    lines.forEach((line, i) => {
        if (!matches(line)) return;
        if (best === -1 || Math.abs(i - expectedIndex) <= Math.abs(best - expectedIndex)) best = i;
    });
    return best;
};

/** 줄 끝의 걸린 시간을 바꾼다 (없으면 붙인다). 일상 기록 연결 표시는 맨 뒤에 그대로 둔다 */
export const setLineMinutes = (line: string, minutes: number): string => {
    const eid = (line.match(EID_RE) ?? []).join('');
    const body = line.replace(EID_RE, '').replace(TRAILING_DURATION_RE, '').trimEnd();
    return `${body} (${minutes}m)${eid}`;
};

/** 일상 기록 연결 표시를 붙인다 (이미 있으면 그대로) */
export const addLineEid = (line: string, eid: string): string =>
    line.includes(`{eid:${eid}}`) ? line : `${line.trimEnd()} {eid:${eid}}`;

/** 들여쓰기 단계 (parseTodos와 같은 셈: 탭 하나, 또는 공백 두 칸이 한 단계) */
const indentLevel = (line: string): number => {
    const lead = line.match(/^[\t ]*/)?.[0] ?? '';
    return (lead.match(/\t/g) ?? []).length + Math.floor((lead.match(/ /g) ?? []).length / 2);
};

export interface MoveSplit {
    /** 옮기고 난 뒤 이 날에 남는 내용 */
    remaining: string;
    /** 다른 날로 옮겨 갈 줄 (맨 앞이 그 항목, 들여쓰기는 항목 기준) */
    moved: string[];
    /** 끝낸 하위 항목이 있어 항목 줄도 이 날에 남는지 */
    keptHead: boolean;
}

/**
 * 아직 안 끝낸 항목을 다른 날로 옮기기 위해 나눈다.
 * 그 항목과 안 끝낸 하위 항목은 옮겨 가고, 끝낸 하위 항목은 이 날에 남는다
 * (그날 한 일과 걸린 시간은 그날의 기록이다). 끝낸 하위 항목이 있으면 항목 줄도 함께 남긴다.
 * 옮겨 가는 항목은 그날의 계획이 되므로 '계획 외 추가(+)' 표시를 뗀다.
 * 끝낸 항목이거나 항목 줄이 아니면 null.
 */
export const splitForMove = (content: string, lineIndex: number): MoveSplit | null => {
    const lines = content.split('\n');
    const head = lines[lineIndex];
    if (head === undefined || !/^[\t ]*- \[ \] /.test(head)) return null;

    const level = indentLevel(head);
    let end = lineIndex + 1;
    while (end < lines.length && lines[end].trim() !== '' && indentLevel(lines[end]) > level) end++;

    const lead = head.match(/^[\t ]*/)?.[0] ?? '';
    const children = lines.slice(lineIndex + 1, end);
    const done = children.filter(l => /^[\t ]*- \[[xX]\] /.test(l));
    const notDone = children.filter(l => !/^[\t ]*- \[[xX]\] /.test(l));

    const keptHead = done.length > 0;
    const remainingLines = [
        ...lines.slice(0, lineIndex),
        ...(keptHead ? [head, ...done] : []),
        ...lines.slice(end),
    ];
    const moved = [head, ...notDone]
        .map(l => (l.startsWith(lead) ? l.slice(lead.length) : l.trimStart()))
        .map((l, i) => (i === 0 ? l.replace(/^(- \[ \] )\+\s*/, '$1') : l));

    return { remaining: remainingLines.join('\n'), moved, keptHead };
};

/** 본문 끝에 여러 줄을 덧붙인다 (빈 본문·끝 개행 모두 처리) */
export const appendLines = (content: string, lines: string[]): string => {
    if (lines.length === 0) return content;
    const block = lines.join('\n');
    if (!content) return block;
    return content.endsWith('\n') ? content + block : `${content}\n${block}`;
};
