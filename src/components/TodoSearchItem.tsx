import React, { useMemo } from 'react';
import { format } from 'date-fns';
import type { SearchResult } from '../types/types';

interface TodoItem {
    checked: boolean;
    text: string;
    indent: number;
    lineIndex: number;
}

interface TodoSearchItemProps {
    todo: SearchResult & { type: 'todo' };
    highlightQuery: string;
}

const TodoSearchItem: React.FC<TodoSearchItemProps> = ({ todo, highlightQuery }) => {
    // Parse todo content into individual items (from TodoTab.tsx)
    const parseTodos = (content: string): TodoItem[] => {
        const lines = content.split('\n');
        const items: TodoItem[] = [];

        lines.forEach((line, index) => {
            const indentMatch = line.match(/^(\t| )*/);
            let indent = 0;
            if (indentMatch && indentMatch[0]) {
                const indentStr = indentMatch[0];
                indent = (indentStr.match(/\t/g) || []).length + Math.floor((indentStr.match(/ /g) || []).length / 2);
            }

            const uncheckedMatch = line.match(/^[\t ]*- \[ \] (.+)$/);
            const checkedMatch = line.match(/^[\t ]*- \[x\] (.+)$/);

            if (uncheckedMatch) {
                items.push({ checked: false, text: uncheckedMatch[1], indent, lineIndex: index });
            } else if (checkedMatch) {
                items.push({ checked: true, text: checkedMatch[1], indent, lineIndex: index });
            }
        });

        return items;
    };

    // Render text with markdown formatting (from TodoTab.tsx)
    const renderText = (text: string) => {
        let rendered = text;
        rendered = rendered.replace(/\*\*(.+?)\*\*/g, '<strong class="font-bold">$1</strong>');
        rendered = rendered.replace(/==(.+?)==/g, '<mark class="bg-yellow-300 px-1">$1</mark>');
        return rendered;
    };

    // Highlight matching query text
    const highlightText = (text: string): React.ReactNode[] => {
        if (!highlightQuery.trim()) {
            return [<span key="0" dangerouslySetInnerHTML={{ __html: renderText(text) }} />];
        }

        const regex = new RegExp(`(${highlightQuery.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')})`, 'gi');
        const parts = text.split(regex);

        return parts.map((part, index) => {
            if (part.toLowerCase() === highlightQuery.toLowerCase()) {
                return (
                    <mark key={index} className="bg-yellow-300 text-black px-0.5 rounded">
                        {part}
                    </mark>
                );
            }
            return <span key={index} dangerouslySetInnerHTML={{ __html: renderText(part) }} />;
        });
    };

    // Parse and filter items that match the query
    const matchingItems = useMemo(() => {
        const allItems = parseTodos(todo.content);
        if (!highlightQuery.trim()) {
            return allItems.slice(0, 5); // Show first 5 items if no search query
        }
        // Filter items that contain the search query
        return allItems.filter(item =>
            item.text.toLowerCase().includes(highlightQuery.toLowerCase())
        );
    }, [todo.content, highlightQuery]);

    if (matchingItems.length === 0) {
        return null;
    }

    return (
        <div className="bg-bg-secondary hover:bg-bg-tertiary transition-colors rounded-lg p-3 border border-bg-tertiary">
            <div className="flex items-start gap-2">
                {/* Date indicator with green accent */}
                <div className="flex-shrink-0 w-12 text-xs text-green-400 font-mono mt-0.5">
                    {format(todo.date || todo.timestamp, 'M/d')}
                </div>

                {/* Todo items */}
                <div className="flex-1 min-w-0 space-y-1">
                    {matchingItems.map((item, index) => (
                        <div
                            key={index}
                            className="flex items-start gap-2 text-sm"
                            style={{ paddingLeft: `${item.indent * 20}px` }}
                        >
                            {/* Checkbox icon */}
                            <span className="flex-shrink-0 text-text-secondary select-none mt-0.5">
                                {item.checked ? '☑' : '☐'}
                            </span>

                            {/* Todo text with highlighting */}
                            <div className={`flex-1 text-text-primary ${item.checked ? 'line-through opacity-60' : ''}`}>
                                {highlightText(item.text)}
                            </div>
                        </div>
                    ))}

                    {/* Show indicator if there are more items */}
                    {!highlightQuery.trim() && parseTodos(todo.content).length > 5 && (
                        <div className="text-xs text-text-secondary italic pl-6">
                            +{parseTodos(todo.content).length - 5} more items...
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};

export default TodoSearchItem;
