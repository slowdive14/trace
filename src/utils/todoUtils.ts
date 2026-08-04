// TodoTab utility functions for stats, levels, and todo parsing

export interface TodoItem {
    checked: boolean;
    text: string;
    indent: number;
    lineIndex: number;
    quadrant: 'q1' | 'q2' | 'q3' | 'q4' | 'inbox';
    weight: number;
    duration?: number;  // 분 단위 (UI 표시용)
}

const DEFAULT_DURATION = 5;

// Parse duration from text like "(2h)", "(30m)", "(1h30m)"
export const parseDuration = (text: string): { minutes: number; cleanText: string } | null => {
    const match = text.match(/\((\d+h)?\s*(\d+m)?\)\s*$/);
    if (!match || (!match[1] && !match[2])) return null;
    const hours = match[1] ? parseInt(match[1]) : 0;
    const minutes = match[2] ? parseInt(match[2]) : 0;
    const total = hours * 60 + minutes;
    if (total === 0) return null;
    return { minutes: total, cleanText: text.replace(match[0], '').trim() };
};

interface TodoNode {
    item: TodoItem;
    children: TodoNode[];
    weight: number;
}

// Check if text has highlight markers
export const isHighlighted = (text: string): boolean => {
    return /==.*==/.test(text);
};

// Build task tree from flat list
export const buildTaskTree = (items: TodoItem[]): TodoNode[] => {
    const rootNodes: TodoNode[] = [];
    const levelStack: { node: TodoNode; indent: number }[] = [];

    items.forEach(item => {
        const node: TodoNode = {
            item,
            children: [],
            weight: item.weight
        };

        while (levelStack.length > 0 && levelStack[levelStack.length - 1].indent >= item.indent) {
            levelStack.pop();
        }

        if (levelStack.length === 0) {
            rootNodes.push(node);
        } else {
            levelStack[levelStack.length - 1].node.children.push(node);
        }

        levelStack.push({ node, indent: item.indent });
    });

    return rootNodes;
};

// Calculate weighted completion for a node
const calculateWeightedCompletion = (node: TodoNode, parentWeight: number): { weight: number; completedWeight: number } => {
    if (node.children.length === 0) {
        return {
            weight: parentWeight,
            completedWeight: node.item.checked ? parentWeight : 0
        };
    }

    const childWeight = parentWeight / node.children.length;
    let totalCompletedWeight = 0;

    node.children.forEach(child => {
        const result = calculateWeightedCompletion(child, childWeight);
        totalCompletedWeight += result.completedWeight;
    });

    return {
        weight: parentWeight,
        completedWeight: totalCompletedWeight
    };
};

// Calculate weighted summary (raw values + percentage)
export const calculateWeightedSummary = (items: TodoItem[]): { totalWeight: number; completedWeight: number; percentage: number } => {
    if (items.length === 0) return { totalWeight: 0, completedWeight: 0, percentage: 0 };

    const rootNodes = buildTaskTree(items);
    let totalWeight = 0;
    let totalCompletedWeight = 0;

    rootNodes.forEach(node => {
        const result = calculateWeightedCompletion(node, node.weight);
        totalWeight += result.weight;
        totalCompletedWeight += result.completedWeight;
    });

    return {
        totalWeight,
        completedWeight: totalCompletedWeight,
        percentage: totalWeight > 0 ? Math.round((totalCompletedWeight / totalWeight) * 100) : 0
    };
};

// Calculate total weighted completion rate
export const calculateTotalWeightedRate = (items: TodoItem[]): number => {
    return calculateWeightedSummary(items).percentage;
};

// Level system (cute lion theme)
export interface LevelInfo {
    level: number;
    title: string;
}

export const getLevelInfo = (percentage: number): LevelInfo => {
    if (percentage >= 100) return { level: 5, title: '사자왕 👑' };
    if (percentage >= 75) return { level: 4, title: '용감한 사자 ⚡' };
    if (percentage >= 50) return { level: 3, title: '씩씩한 사자 💪' };
    if (percentage >= 25) return { level: 2, title: '꼬마 사자 🦁' };
    return { level: 1, title: '아기 사자 🐱' };
};

// Encouragement messages
export const getEncouragementMessage = (percentage: number): string => {
    if (percentage >= 100) return '완벽한 하루! 오늘 정말 잘했어 🎉';
    if (percentage >= 75) return '거의 다 왔어! 조금만 더!';
    if (percentage >= 50) return '절반 넘었어! 잘하고 있어';
    if (percentage >= 25) return '순조롭게 진행 중!';
    if (percentage > 0) return '좋은 시작이야! 계속 가보자';
    return '오늘도 화이팅! 하나씩 시작해볼까?';
};

// Progress bar color based on percentage
export const getProgressColor = (percentage: number): string => {
    if (percentage >= 100) return 'bg-gradient-to-r from-yellow-400 to-yellow-300';
    if (percentage >= 75) return 'bg-gradient-to-r from-green-500 to-green-400';
    if (percentage >= 50) return 'bg-gradient-to-r from-lime-500 to-lime-400';
    if (percentage >= 25) return 'bg-gradient-to-r from-yellow-500 to-yellow-400';
    return 'bg-gradient-to-r from-orange-500 to-orange-400';
};

// Real level based on total completed tasks
// Lv.10(1700) 이후로는 ENDLESS_STEP개마다 계속 레벨이 오른다.
// (예전에는 Lv.10이 종점이라 nextLevelAt이 9999라는 자리표시자로 굳어졌고,
//  그 값이 그대로 화면에 "1884/9999"처럼 노출돼 목표처럼 보였다.)
export interface RealLevelInfo {
    level: number;
    title: string;
    nextLevelAt: number;
    /** 이번 레벨 구간의 시작점 (진행률 계산용) */
    levelStartAt: number;
    isEndless: boolean;
}

const LEVEL_TIERS: { at: number; title: string }[] = [
    { at: 0, title: '아기 사자 🐱' },
    { at: 25, title: '꼬마 사자 🦁' },
    { at: 70, title: '씩씩한 사자 💪' },
    { at: 130, title: '용감한 사자 ⚡' },
    { at: 210, title: '사자왕 👑' },
    { at: 330, title: '늠름한 사자 🌟' },
    { at: 500, title: '강인한 사자 🔥' },
    { at: 750, title: '현명한 사자 📚' },
    { at: 1100, title: '위대한 사자 ✨' },
    { at: 1700, title: '전설의 사자왕 🏆' },
];

const ENDLESS_START = 1700;
const ENDLESS_STEP = 300;

export const getRealLevel = (totalCompleted: number): RealLevelInfo => {
    if (totalCompleted >= ENDLESS_START) {
        const steps = Math.floor((totalCompleted - ENDLESS_START) / ENDLESS_STEP);
        return {
            level: LEVEL_TIERS.length + steps,
            title: '전설의 사자왕 🏆',
            levelStartAt: ENDLESS_START + steps * ENDLESS_STEP,
            nextLevelAt: ENDLESS_START + (steps + 1) * ENDLESS_STEP,
            isEndless: true,
        };
    }

    for (let i = LEVEL_TIERS.length - 1; i >= 0; i--) {
        if (totalCompleted >= LEVEL_TIERS[i].at) {
            return {
                level: i + 1,
                title: LEVEL_TIERS[i].title,
                levelStartAt: LEVEL_TIERS[i].at,
                nextLevelAt: LEVEL_TIERS[i + 1].at,
                isEndless: false,
            };
        }
    }
    return { level: 1, title: LEVEL_TIERS[0].title, levelStartAt: 0, nextLevelAt: LEVEL_TIERS[1].at, isEndless: false };
};

// ===== 연속 달성(스트릭) =====
// 누적 개수는 절대 줄지 않고 오늘 한 행동이 눈에 띄지 않아 동기가 되기 어렵다.
// 스트릭은 끊길 수 있고 오늘 행동이 곧바로 결정하므로 동기 지표로 쓴다.

/** 하루를 '달성'으로 인정하는 가중 완료율 기준(%) */
export const STREAK_THRESHOLD = 70;

export interface StreakInfo {
    /** 현재 연속 일수 (오늘이 아직 미달이면 어제까지의 연속을 유지해서 보여준다) */
    current: number;
    longest: number;
    todayMet: boolean;
}

const shiftDay = (dateStr: string, delta: number): string => {
    const [y, m, d] = dateStr.split('-').map(Number);
    const dt = new Date(y, m - 1, d + delta);
    const mm = String(dt.getMonth() + 1).padStart(2, '0');
    const dd = String(dt.getDate()).padStart(2, '0');
    return `${dt.getFullYear()}-${mm}-${dd}`;
};

/**
 * @param ratesByDate 'YYYY-MM-DD' → 그날의 가중 완료율(%)
 * @param todayStr    논리적 오늘 (5시 기준)
 */
export const calculateStreak = (
    ratesByDate: Record<string, number>,
    todayStr: string,
    threshold: number = STREAK_THRESHOLD
): StreakInfo => {
    const met = (key: string) => (ratesByDate[key] ?? -1) >= threshold;
    const todayMet = met(todayStr);

    // 오늘은 아직 진행 중일 수 있으므로 어제부터 거슬러 세고, 오늘 달성 시에만 +1.
    // (이렇게 해야 매일 아침 스트릭이 0으로 보이지 않는다)
    let current = 0;
    let cursor = shiftDay(todayStr, -1);
    while (met(cursor)) {
        current++;
        cursor = shiftDay(cursor, -1);
    }
    if (todayMet) current++;

    // 최장 연속: 달성한 날짜들을 정렬해 연속 구간의 최댓값을 구한다
    const achieved = Object.keys(ratesByDate).filter(met).sort();
    let longest = 0;
    let run = 0;
    let prev: string | null = null;
    for (const key of achieved) {
        run = prev !== null && shiftDay(prev, 1) === key ? run + 1 : 1;
        if (run > longest) longest = run;
        prev = key;
    }

    return { current, longest: Math.max(longest, current), todayMet };
};

/** 지난주 평균을 기준으로 이번 주 목표치를 정한다 (조금만 더 높게) */
export const getWeeklyTarget = (lastWeekAvg: number): number => {
    if (lastWeekAvg <= 0) return 60;
    return Math.min(95, Math.max(50, Math.round(lastWeekAvg) + 2));
};

// Format minutes as human-readable string (e.g., 90 → "1h30m")
export const formatDuration = (minutes: number): string => {
    const h = Math.floor(minutes / 60);
    const m = minutes % 60;
    if (h > 0 && m > 0) return `${h}h${m}m`;
    if (h > 0) return `${h}h`;
    return `${m}m`;
};

/**
 * 하위 항목 접힘 상태를 식별하는 키.
 * lineIndex는 순서 변경·추가·삭제로 쉽게 바뀌어 엉뚱한 항목이 접히므로 텍스트를 쓴다.
 * 소요시간 표기는 자주 바뀌므로 키에서 제외한다.
 */
export const getCollapseKey = (item: TodoItem): string =>
    item.text.replace(/\s*\(\d+h?\s*\d*m?\)\s*$/, '').trim();

export interface TodoRow {
    item: TodoItem;
    hasChildren: boolean;
    collapsed: boolean;
    /** 접혀서 감춰진 하위 항목 수 */
    hiddenCount: number;
}

/**
 * 접힌 부모의 하위 항목을 제외한 렌더 대상 목록.
 * 들여쓰기가 더 깊은 연속 구간을 그 항목의 하위 항목으로 본다.
 */
export const getVisibleRows = (group: TodoItem[], collapsedKeys: Set<string>): TodoRow[] => {
    const out: TodoRow[] = [];
    let hideDeeperThan: number | null = null;

    for (let i = 0; i < group.length; i++) {
        const item = group[i];

        if (hideDeeperThan !== null) {
            if (item.indent > hideDeeperThan) continue;  // 접힌 구간 안쪽
            hideDeeperThan = null;                        // 구간을 벗어남
        }

        const next = group[i + 1];
        const hasChildren = !!next && next.indent > item.indent;
        const collapsed = hasChildren && collapsedKeys.has(getCollapseKey(item));

        let hiddenCount = 0;
        if (collapsed) {
            for (let j = i + 1; j < group.length && group[j].indent > item.indent; j++) hiddenCount++;
            hideDeeperThan = item.indent;
        }

        out.push({ item, hasChildren, collapsed, hiddenCount });
    }
    return out;
};

// Parse todo content string into TodoItem array
export const parseTodos = (content: string): TodoItem[] => {
    const lines = content.split('\n');
    const items: TodoItem[] = [];
    let hasDuration = false;

    // 1st pass: parse all items
    lines.forEach((line, index) => {
        const indentMatch = line.match(/^(\t| )*/);
        let indent = 0;
        if (indentMatch && indentMatch[0]) {
            const indentStr = indentMatch[0];
            indent = (indentStr.match(/\t/g) || []).length + Math.floor((indentStr.match(/ /g) || []).length / 2);
        }

        const uncheckedMatch = line.match(/^[\t ]*- \[ \] (.+)$/);
        const checkedMatch = line.match(/^[\t ]*- \[x\] (.+)$/);

        if (uncheckedMatch || checkedMatch) {
            const isChecked = !!checkedMatch;
            const rawText = uncheckedMatch ? uncheckedMatch[1] : checkedMatch![1];

            // Extract quadrant tag (#q1, #q2, #q3, #q4)
            let quadrant: 'q1' | 'q2' | 'q3' | 'q4' | 'inbox' = 'inbox';
            let cleanText = rawText;

            // Remove {eid:...} markers from display
            cleanText = cleanText.replace(/\s*\{eid:[^}]+\}/g, '');

            const qMatch = rawText.match(/#(q[1-4])\b/);
            if (qMatch) {
                quadrant = qMatch[1] as 'q1' | 'q2' | 'q3' | 'q4';
                cleanText = cleanText.replace(qMatch[0], '').trim();
            }

            const duration = parseDuration(cleanText);
            if (duration) hasDuration = true;

            items.push({
                checked: isChecked,
                text: cleanText,
                indent,
                lineIndex: index,
                quadrant,
                weight: duration ? duration.minutes : (isHighlighted(rawText) ? 2 : 1),
                duration: duration?.minutes
            });
        }
    });

    // 2nd pass: if any task has duration, set default weight for tasks without duration
    if (hasDuration) {
        items.forEach(item => {
            if (!item.duration) {
                item.weight = isHighlighted(item.text) ? DEFAULT_DURATION * 2 : DEFAULT_DURATION;
            }
        });
    }

    return items;
};
