import React, { useMemo } from 'react';
import type { WorryEntry } from '../types/types';
import WorryCard from './WorryCard';
import { format } from 'date-fns';

interface WorryTimelineProps {
    entries: WorryEntry[];
    onUpdate: (id: string, content: string) => void;
    onDelete: (id: string) => void;
    onReply: (id: string, type: 'action' | 'result', content?: string) => void;
}

const WorryTimeline: React.FC<WorryTimelineProps> = ({ entries, onUpdate, onDelete, onReply }) => {
    const groupedEntries = useMemo(() => {
        // Create a map for quick parent lookup
        const entryMap = new Map(entries.map(e => [e.id, e]));

        const groups: Record<number, WorryEntry[]> = {};
        entries.forEach(entry => {
            // If entry has a parent, use parent's week; otherwise use its own week
            let targetWeek = entry.week;
            if (entry.parentId) {
                const parent = entryMap.get(entry.parentId);
                if (parent) {
                    targetWeek = parent.week;
                }
            }

            if (!groups[targetWeek]) {
                groups[targetWeek] = [];
            }
            groups[targetWeek].push(entry);
        });
        return groups;
    }, [entries]);

    const sortedWeeks = Object.keys(groupedEntries)
        .map(Number)
        .sort((a, b) => b - a);

    const renderThreadedEntries = (weekEntries: WorryEntry[]) => {
        // 1. Map entries by ID for easy lookup
        const entryMap = new Map(weekEntries.map(e => [e.id, e]));

        // 2. Separate roots and children
        const roots: WorryEntry[] = [];
        const childrenMap: Record<string, WorryEntry[]> = {};

        weekEntries.forEach(entry => {
            // An entry is a child if it has a parentId AND that parent exists in this week's list
            // If parent is not in this list (e.g. different week), treat as root for this view
            const isChild = entry.parentId && entryMap.has(entry.parentId);

            if (isChild) {
                if (!childrenMap[entry.parentId!]) {
                    childrenMap[entry.parentId!] = [];
                }
                childrenMap[entry.parentId!].push(entry);
            } else {
                roots.push(entry);
            }
        });

        // 3. Sort roots by timestamp DESC (Newest first)
        roots.sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());

        // 4. Sort children by timestamp ASC (Oldest first - story flow)
        Object.values(childrenMap).forEach(list => {
            list.sort((a, b) => a.timestamp.getTime() - b.timestamp.getTime());
        });

        // Recursive render function
        const renderNode = (entry: WorryEntry) => (
            <div key={entry.id} className="relative">
                <WorryCard
                    entry={entry}
                    onUpdate={onUpdate}
                    onDelete={onDelete}
                    onReply={onReply}
                />
                {childrenMap[entry.id] && (
                    <div className="ml-6 pl-4 border-l-2 border-bg-tertiary space-y-3 mt-2">
                        {childrenMap[entry.id].map(child => renderNode(child))}
                    </div>
                )}
            </div>
        );

        return (
            <div className="space-y-4">
                {roots.map(root => renderNode(root))}
            </div>
        );
    };

    return (
        <div className="pb-4">
            {sortedWeeks.map(week => {
                const weekEntries = groupedEntries[week];
                const firstEntryDate = weekEntries[0]?.timestamp;

                return (
                    <div key={week} className="mb-6">
                        <div className="flex items-center gap-2 mb-3">
                            <h4 className="font-bold text-text-primary">Week {week}</h4>
                            {firstEntryDate && (
                                <span className="text-xs text-text-secondary">
                                    ({format(firstEntryDate, 'M/d')}~)
                                </span>
                            )}
                        </div>
                        {renderThreadedEntries(weekEntries)}
                    </div>
                );
            })}
        </div>
    );
};

export default WorryTimeline;
