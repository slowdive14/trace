import { format } from 'date-fns';
import type { Entry, Expense, Todo, Worry, WorryEntry } from '../types/types';
import { EXPENSE_CATEGORY_EMOJI } from '../types/types';
import { getLogicalDate } from './dateUtils';

export const generateMarkdown = (entries: Entry[], date: Date): string => {
    const dateStr = format(date, 'yyyy-MM-dd');
    const dayEntries = entries.filter(entry =>
        format(getLogicalDate(entry.timestamp), 'yyyy-MM-dd') === dateStr
    ).sort((a, b) => a.timestamp.getTime() - b.timestamp.getTime());

    const actions = dayEntries.filter(e => e.category === 'action');
    const thoughts = dayEntries.filter(e => e.category === 'thought');

    let markdown = ``;

    if (actions.length > 0) {
        markdown += `#### 오늘 무슨 일을 했나?\n`;
        actions.forEach(entry => {
            markdown += `- ${format(entry.timestamp, 'HH:mm')} ${entry.content}\n`;
        });
        markdown += `\n`;
    }

    if (thoughts.length > 0) {
        markdown += `#### 오늘 무슨 생각을 했나?\n`;
        thoughts.forEach(entry => {
            markdown += `- ${format(entry.timestamp, 'HH:mm')} ${entry.content}\n`;
        });
        markdown += `\n`;
    }

    return markdown;
}

/**
 * Export daily notes in unified markdown format
 */
export function exportDailyMarkdown(
    date: Date,
    entries: Entry[],
    books: Entry[],
    expenses: Expense[],
    todo?: Todo,
    worryEntries?: WorryEntry[],
    worries?: Worry[]
): string {
    const dateStr = format(date, 'yyyy-MM-dd');

    // Filter entries, books, and expenses for the selected date
    const dayEntries = entries.filter(e =>
        format(getLogicalDate(e.timestamp), 'yyyy-MM-dd') === dateStr
    );
    const dayBooks = books.filter(b =>
        format(getLogicalDate(b.timestamp), 'yyyy-MM-dd') === dateStr
    );
    const dayExpenses = expenses.filter(e =>
        format(getLogicalDate(e.timestamp), 'yyyy-MM-dd') === dateStr
    );

    let markdown = '';

    // Todo Section (Top)
    if (todo && todo.content.trim()) {
        markdown += '## 🎯 오늘의 목표\n';
        markdown += todo.content.trim() + '\n\n';
    }

    markdown += '## 🤔 What happened today?\n';

    // 일상 섹션
    const actionEntries = dayEntries.filter(e => e.category === 'action');
    if (actionEntries.length > 0) {
        markdown += '#### 일상\n';
        actionEntries.forEach(entry => {
            const time = format(entry.timestamp, 'HH:mm');
            markdown += `- ${time} ${entry.content}\n`;
        });
        markdown += '\n';
    }

    // 생각 섹션
    const thoughtEntries = dayEntries.filter(e => e.category === 'thought');
    if (thoughtEntries.length > 0) {
        markdown += '#### 생각\n';
        thoughtEntries.forEach(entry => {
            markdown += `- ${entry.content}\n`;
        });
        markdown += '\n';
    }

    // 책 섹션
    if (dayBooks.length > 0) {
        markdown += '#### 📚 책\n';
        dayBooks.forEach(book => {
            markdown += `- ${book.content}\n`;
        });
        markdown += '\n';
    }

    // 지출 섹션
    if (dayExpenses.length > 0) {
        markdown += '#### 지출\n';
        dayExpenses.forEach(expense => {
            const emoji = EXPENSE_CATEGORY_EMOJI[expense.category];
            if (expense.amount < 0) {
                markdown += `- ${expense.description} ${expense.amount.toLocaleString()}원 ${emoji} (절약)\n`;
            } else {
                markdown += `- ${expense.description} ${expense.amount.toLocaleString()}원 ${emoji}\n`;
            }
        });

        // 합계 계산 (지출만 합산, 절약 제외)
        const total = dayExpenses
            .filter(e => e.amount > 0)
            .reduce((sum, e) => sum + e.amount, 0);
        markdown += `**합계**: ${total.toLocaleString()}원\n`;
    }

    // 고민 섹션 (Worry)
    if (worryEntries && worryEntries.length > 0) {
        // Filter for the specific day
        const dayWorryEntries = worryEntries.filter(e =>
            format(getLogicalDate(e.timestamp), 'yyyy-MM-dd') === dateStr
        );

        if (dayWorryEntries.length > 0) {
            markdown += '\n#### 고민\n';

            // Group by worryId
            const groupedByWorry: Record<string, WorryEntry[]> = {};
            dayWorryEntries.forEach(entry => {
                const worryId = entry.worryId;
                if (!groupedByWorry[worryId]) {
                    groupedByWorry[worryId] = [];
                }
                groupedByWorry[worryId].push(entry);
            });

            // Render each worry group
            Object.entries(groupedByWorry).forEach(([worryId, entries]) => {
                // Find worry title
                const worry = worries?.find(w => w.id === worryId);
                const title = worry ? worry.title : '알 수 없는 고민';

                markdown += `##### ${title}\n`;

                // Build hierarchy for display
                const entryMap = new Map(entries.map(e => [e.id, e]));
                const childrenMap: Record<string, WorryEntry[]> = {};
                const roots: WorryEntry[] = [];

                entries.forEach(entry => {
                    if (entry.parentId && entryMap.has(entry.parentId)) {
                        if (!childrenMap[entry.parentId]) {
                            childrenMap[entry.parentId] = [];
                        }
                        childrenMap[entry.parentId].push(entry);
                    } else {
                        roots.push(entry);
                    }
                });

                // Sort roots: Worry -> Action -> Result, then time
                const typeOrder = { worry: 0, action: 1, result: 2 };
                const sortEntries = (list: WorryEntry[]) => {
                    return list.sort((a, b) => {
                        const typeDiff = typeOrder[a.type] - typeOrder[b.type];
                        if (typeDiff !== 0) return typeDiff;
                        return a.timestamp.getTime() - b.timestamp.getTime();
                    });
                };

                sortEntries(roots);
                Object.values(childrenMap).forEach(list => sortEntries(list));

                // Recursive render
                const renderEntry = (entry: WorryEntry, depth: number = 0) => {
                    const indent = '  '.repeat(depth);
                    const icon = entry.type === 'worry' ? '💭'
                        : entry.type === 'action' ? '⚡'
                            : '✅';
                    markdown += `${indent}- ${icon} ${entry.content}\n`;

                    if (childrenMap[entry.id]) {
                        childrenMap[entry.id].forEach(child => renderEntry(child, depth + 1));
                    }
                };

                roots.forEach(root => renderEntry(root));
                markdown += '\n';
            });
        }
    }

    return markdown.trim();
};



export const generateWorryMarkdown = (
    worry: Worry,
    entries: WorryEntry[]
): string => {
    const lines: string[] = [];

    // Header
    lines.push(`## 고민: ${worry.title}`);

    const startStr = format(worry.startDate, 'yyyy-MM-dd');
    const endStr = worry.closedAt
        ? format(worry.closedAt, 'yyyy-MM-dd')
        : '진행 중';
    lines.push(`**기간**: ${startStr} ~ ${endStr}`);
    lines.push('');

    // Group entries by week
    const byWeek = entries.reduce((acc, entry) => {
        if (!acc[entry.week]) acc[entry.week] = [];
        acc[entry.week].push(entry);
        return acc;
    }, {} as Record<number, WorryEntry[]>);

    // Sort weeks ascending for export
    const weeks = Object.keys(byWeek).map(Number).sort((a, b) => a - b);

    for (const week of weeks) {
        const weekEntries = byWeek[week];
        const firstEntry = weekEntries[0];
        const dateStr = format(firstEntry.timestamp, 'M/d');

        lines.push(`### Week ${week} (${dateStr})`);

        // Build hierarchy
        const entryMap = new Map(weekEntries.map(e => [e.id, e]));
        const childrenMap: Record<string, WorryEntry[]> = {};
        const roots: WorryEntry[] = [];

        weekEntries.forEach(entry => {
            if (entry.parentId && entryMap.has(entry.parentId)) {
                if (!childrenMap[entry.parentId]) {
                    childrenMap[entry.parentId] = [];
                }
                childrenMap[entry.parentId].push(entry);
            } else {
                roots.push(entry);
            }
        });

        // Sort
        const typeOrder = { worry: 0, action: 1, result: 2 };
        const sortEntries = (list: WorryEntry[]) => {
            return list.sort((a, b) => {
                const typeDiff = typeOrder[a.type] - typeOrder[b.type];
                if (typeDiff !== 0) return typeDiff;
                return a.timestamp.getTime() - b.timestamp.getTime();
            });
        };

        sortEntries(roots);
        Object.values(childrenMap).forEach(list => sortEntries(list));

        // Recursive render
        const renderEntry = (entry: WorryEntry, depth: number = 0) => {
            const indent = '  '.repeat(depth);
            const icon = entry.type === 'worry' ? '💭'
                : entry.type === 'action' ? '⚡'
                    : '✅';
            lines.push(`${indent}- ${icon} ${entry.content}`);

            if (childrenMap[entry.id]) {
                childrenMap[entry.id].forEach(child => renderEntry(child, depth + 1));
            }
        };

        roots.forEach(root => renderEntry(root));
        lines.push('');
    }

    // Reflection (if closed)
    if (worry.reflection) {
        lines.push('---');
        lines.push('');
        lines.push('### 마무리 회고');
        lines.push(`- **처음 의도를 이루었는가**: ${worry.reflection.intentAchieved}`);
        lines.push(`- **의도가 변화했는가**: ${worry.reflection.intentChanged}`);
        lines.push(`- **결과가 마음에 드는가**: ${worry.reflection.satisfiedWithResult}`);
        lines.push(`- **어떤 변화가 일어났는가**: ${worry.reflection.whatChanged}`);
    }

    return lines.join('\n');
};

export const copyToClipboard = async (text: string) => {
    try {
        await navigator.clipboard.writeText(text);
        return true;
    } catch (err) {
        console.error('Failed to copy text: ', err);
        return false;
    }
};
