import { format } from 'date-fns';
import type { Entry, Expense } from '../types/types';
import { EXPENSE_CATEGORY_EMOJI } from '../types/types';

export const generateMarkdown = (entries: Entry[], date: Date): string => {
    const dateStr = format(date, 'yyyy-MM-dd');
    const dayEntries = entries.filter(entry =>
        format(entry.timestamp, 'yyyy-MM-dd') === dateStr
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
    }

    return markdown;
}

/**
 * Export daily notes in unified markdown format
 */
export function exportDailyMarkdown(
    date: Date,
    entries: Entry[],
    expenses: Expense[]
): string {
    const dateStr = format(date, 'yyyy-MM-dd');

    // Filter entries and expenses for the selected date
    const dayEntries = entries.filter(e =>
        format(e.timestamp, 'yyyy-MM-dd') === dateStr
    );
    const dayExpenses = expenses.filter(e =>
        format(e.timestamp, 'yyyy-MM-dd') === dateStr
    );

    let markdown = '';

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

        // 합계 계산
        const total = dayExpenses.reduce((sum, e) => sum + e.amount, 0);
        markdown += `**합계**: ${total.toLocaleString()}원\n`;
    }

    return markdown.trim();
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
