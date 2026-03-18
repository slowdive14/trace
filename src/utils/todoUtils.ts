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

const DEFAULT_DURATION = 30;

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

// Real level based on total completed tasks (max Lv.10 = 1700)
export interface RealLevelInfo {
    level: number;
    title: string;
    nextLevelAt: number;
}

export const getRealLevel = (totalCompleted: number): RealLevelInfo => {
    if (totalCompleted >= 1700) return { level: 10, title: '전설의 사자왕 🏆', nextLevelAt: 9999 };
    if (totalCompleted >= 1100) return { level: 9, title: '위대한 사자 ✨', nextLevelAt: 1700 };
    if (totalCompleted >= 750) return { level: 8, title: '현명한 사자 📚', nextLevelAt: 1100 };
    if (totalCompleted >= 500) return { level: 7, title: '강인한 사자 🔥', nextLevelAt: 750 };
    if (totalCompleted >= 330) return { level: 6, title: '늠름한 사자 🌟', nextLevelAt: 500 };
    if (totalCompleted >= 210) return { level: 5, title: '사자왕 👑', nextLevelAt: 330 };
    if (totalCompleted >= 130) return { level: 4, title: '용감한 사자 ⚡', nextLevelAt: 210 };
    if (totalCompleted >= 70) return { level: 3, title: '씩씩한 사자 💪', nextLevelAt: 130 };
    if (totalCompleted >= 25) return { level: 2, title: '꼬마 사자 🦁', nextLevelAt: 70 };
    return { level: 1, title: '아기 사자 🐱', nextLevelAt: 25 };
};

// Format minutes as human-readable string (e.g., 90 → "1h30m")
export const formatDuration = (minutes: number): string => {
    const h = Math.floor(minutes / 60);
    const m = minutes % 60;
    if (h > 0 && m > 0) return `${h}h${m}m`;
    if (h > 0) return `${h}h`;
    return `${m}m`;
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
