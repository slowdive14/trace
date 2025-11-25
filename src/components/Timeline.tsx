import React, { useEffect, useState } from 'react';
import { format, isToday, isYesterday } from 'date-fns';
import { ko } from 'date-fns/locale';
import type { Entry } from '../types/types';
import { deleteEntry } from '../services/firestore';
import { useAuth } from './AuthContext';
import EntryItem from './EntryItem';
import { onSnapshot, collection, query, orderBy } from 'firebase/firestore';
import { db } from '../services/firebase';
import { Share, Check } from 'lucide-react';
import { generateMarkdown, copyToClipboard } from '../utils/exportUtils';

interface TimelineProps {
    category?: 'action' | 'thought' | 'all';
    selectedTag?: string | null;
    onTagClick?: (tag: string) => void;
}

const Timeline: React.FC<TimelineProps> = ({ category = 'action', selectedTag, onTagClick }) => {
    const [entries, setEntries] = useState<Entry[]>([]);
    const [showToast, setShowToast] = useState(false);
    const { user } = useAuth();

    useEffect(() => {
        if (!user) return;

        const q = query(
            collection(db, `users/${user.uid}/entries`),
            orderBy("timestamp", "desc")
        );

        const unsubscribe = onSnapshot(q, (snapshot) => {
            const newEntries = snapshot.docs.map(doc => ({
                id: doc.id,
                ...doc.data(),
                timestamp: doc.data().timestamp.toDate(),
            })) as Entry[];
            setEntries(newEntries);
        });

        return () => unsubscribe();
    }, [user]);

    const handleDelete = async (id: string) => {
        if (!user) return;
        await deleteEntry(user.uid, id);
    };

    const handleExport = async (dateStr: string) => {
        const date = new Date(dateStr);
        const markdown = generateMarkdown(entries, date);
        const success = await copyToClipboard(markdown);
        if (success) {
            setShowToast(true);
            setTimeout(() => setShowToast(false), 2000);
        }
    };

    const groupedEntries = entries
        .filter(entry => category === 'all' || entry.category === category)
        .filter(entry => !selectedTag || entry.tags.some(tag => tag.startsWith(selectedTag)))
        .reduce((groups: Record<string, Entry[]>, entry: Entry) => {
            const dateKey = format(entry.timestamp, 'yyyy-MM-dd');
            if (!groups[dateKey]) {
                groups[dateKey] = [];
            }
            groups[dateKey].push(entry);
            return groups;
        }, {} as Record<string, Entry[]>);

    const getDateLabel = (dateStr: string) => {
        // Parse as local date to prevent timezone issues
        const [year, month, day] = dateStr.split('-').map(Number);
        const date = new Date(year, month - 1, day);
        if (isToday(date)) return '오늘';
        if (isYesterday(date)) return '어제';
        return format(date, 'M월 d일 (eee)', { locale: ko });
    };

    return (
        <>
            {/* Toast Notification */}
            {showToast && (
                <div className="fixed top-20 left-1/2 -translate-x-1/2 z-50 bg-accent text-white px-4 py-2 rounded-lg shadow-lg flex items-center gap-2 animate-fade-in">
                    <Check size={16} />
                    <span className="text-sm font-medium">복사 완료!</span>
                </div>
            )}

            <div className="pb-32 px-4 max-w-md mx-auto">
                {Object.entries(groupedEntries).map(([date, dayEntries]) => (
                    <div key={date} className="mb-8">
                        <div className="sticky top-0 bg-bg-primary/95 backdrop-blur py-2 z-10 border-b border-bg-tertiary flex justify-between items-center mb-4">
                            <h2 className="text-text-secondary text-sm font-bold">
                                {getDateLabel(date)}
                            </h2>
                            <button
                                onClick={() => handleExport(date)}
                                className="text-text-secondary hover:text-accent transition-colors p-1"
                                title="Export to Obsidian"
                            >
                                <Share size={16} />
                            </button>
                        </div>
                        <div className="space-y-1">
                            {dayEntries.map(entry => (
                                <EntryItem key={entry.id} entry={entry} onDelete={handleDelete} onTagClick={onTagClick} />
                            ))}
                        </div>
                    </div>
                ))}
                {entries.filter(entry => category === 'all' || entry.category === category).length === 0 && (
                    <div className="text-center text-text-secondary mt-20">
                        <p>No entries yet.</p>
                        <p className="text-sm mt-2">Start writing to track your day.</p>
                    </div>
                )}
            </div>
        </>
    );
};

export default Timeline;
