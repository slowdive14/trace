import { format } from 'date-fns';
import type { Entry } from '../types/types';

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
