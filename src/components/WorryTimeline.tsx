import React, { useMemo } from 'react';
import type { WorryEntry } from '../types/types';
import WorryCard from './WorryCard';
import { format } from 'date-fns';

interface WorryTimelineProps {
    entries: WorryEntry[];
    onUpdate: (id: string, content: string) => void;
    onDelete: (id: string) => void;
}

const WorryTimeline: React.FC<WorryTimelineProps> = ({ entries, onUpdate, onDelete }) => {
    const groupedEntries = useMemo(() => {
        const groups: Record<number, WorryEntry[]> = {};
        entries.forEach(entry => {
            if (!groups[entry.week]) {
                groups[entry.week] = [];
            }
            groups[entry.week].push(entry);
        });
        return groups;
    }, [entries]);

    const sortedWeeks = Object.keys(groupedEntries)
        .map(Number)
        .sort((a, b) => b - a);

    const sortEntries = (weekEntries: WorryEntry[]) => {
        const typeOrder = { worry: 0, action: 1, result: 2 };
        return [...weekEntries].sort((a, b) => {
            const typeDiff = typeOrder[a.type] - typeOrder[b.type];
            if (typeDiff !== 0) return typeDiff;
            return b.timestamp.getTime() - a.timestamp.getTime();
        });
    };

    return (
        <div className="pb-4">
            {sortedWeeks.map(week => {
                const weekEntries = groupedEntries[week];
                const sortedWeekEntries = sortEntries(weekEntries);
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
                        <div className="space-y-2">
                            {sortedWeekEntries.map(entry => (
                                <WorryCard
                                    key={entry.id}
                                    entry={entry}
                                    onUpdate={onUpdate}
                                    onDelete={onDelete}
                                />
                            ))}
                        </div>
                    </div>
                );
            })}
        </div>
    );
};

export default WorryTimeline;
