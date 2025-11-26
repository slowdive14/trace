import React, { useEffect, useState, useRef, useCallback } from 'react';
import { format, isToday, isYesterday, subDays, startOfDay } from 'date-fns';
import { ko } from 'date-fns/locale';
import type { Entry } from '../types/types';
import { deleteEntry } from '../services/firestore';
import { useAuth } from './AuthContext';
import EntryItem from './EntryItem';
import { onSnapshot, collection, query, orderBy, limit } from 'firebase/firestore';
import { db } from '../services/firebase';
import { Share, Check } from 'lucide-react';
import { generateMarkdown, copyToClipboard } from '../utils/exportUtils';

interface TimelineProps {
    category?: 'action' | 'thought' | 'chore' | 'all';
    selectedTag?: string | null;
    onTagClick?: (tag: string) => void;
    collectionName?: string;
}

type DateFilter = 'today' | '7days' | '30days' | 'all';

const Timeline: React.FC<TimelineProps> = ({ category = 'action', selectedTag, onTagClick, collectionName = 'entries' }) => {
    const [allEntries, setAllEntries] = useState<Entry[]>([]);
    const [displayLimit, setDisplayLimit] = useState(50);
    const [dateFilter, setDateFilter] = useState<DateFilter>('all');
    const [showToast, setShowToast] = useState(false);
    const { user } = useAuth();
    const loadMoreRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        if (!user) return;

        const q = query(
            collection(db, `users/${user.uid}/${collectionName}`),
            orderBy("timestamp", "desc")
        );

        const unsubscribe = onSnapshot(q, (snapshot) => {
            const newEntries = snapshot.docs.map(doc => ({
                id: doc.id,
                ...doc.data(),
                timestamp: doc.data().timestamp.toDate(),
            })) as Entry[];
            setAllEntries(newEntries);
        });

        return () => unsubscribe();
    }, [user, collectionName]);

    // Infinite scroll observer
    useEffect(() => {
        const observer = new IntersectionObserver(
            (entries) => {
                if (entries[0].isIntersecting) {
                    setDisplayLimit(prev => prev + 30);
                }
            },
            { threshold: 0.1 }
        );

        if (loadMoreRef.current) {
            observer.observe(loadMoreRef.current);
        }

        return () => observer.disconnect();
    }, []);

    const handleDelete = async (id: string) => {
        if (!user) return;
        await deleteEntry(user.uid, id, collectionName);
    };

    const handleExport = async (dateStr: string) => {
        const date = new Date(dateStr);
        const markdown = generateMarkdown(allEntries, date);
        const success = await copyToClipboard(markdown);
        if (success) {
            setShowToast(true);
            setTimeout(() => setShowToast(false), 2000);
        }
    };

    const getFilteredEntries = useCallback(() => {
        let filtered = allEntries;

        // Apply date filter
        const now = new Date();
        switch (dateFilter) {
            case 'today':
                const todayStart = startOfDay(now);
                filtered = filtered.filter(entry => entry.timestamp >= todayStart);
                break;
            case '7days':
                const sevenDaysAgo = subDays(startOfDay(now), 6);
                filtered = filtered.filter(entry => entry.timestamp >= sevenDaysAgo);
                break;
            case '30days':
                const thirtyDaysAgo = subDays(startOfDay(now), 29);
                filtered = filtered.filter(entry => entry.timestamp >= thirtyDaysAgo);
                break;
            case 'all':
            default:
                // No date filtering
                break;
        }

        // Apply category and tag filters
        return filtered
            .filter(entry => category === 'all' || entry.category === category)
            .filter(entry => !selectedTag || entry.tags.some(tag => tag.startsWith(selectedTag)))
            .slice(0, displayLimit);
    }, [allEntries, dateFilter, category, selectedTag, displayLimit]);

    const entries = getFilteredEntries();

    const groupedEntries = entries.reduce((groups: Record<string, Entry[]>, entry: Entry) => {
        const dateKey = format(entry.timestamp, 'yyyy-MM-dd');
        if (!groups[dateKey]) {
            groups[dateKey] = [];
        }
        groups[dateKey].push(entry);
        return groups;
    }, {} as Record<string, Entry[]>);

    const getDateLabel = (dateStr: string) => {
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

            {/* Date Filter */}
            <div className="sticky top-0 bg-bg-primary/95 backdrop-blur border-b border-bg-tertiary z-20 px-4 py-3">
                <div className="max-w-md mx-auto flex gap-2">
                    <button
                        onClick={() => setDateFilter('today')}
                        className={`flex-1 py-1.5 px-3 text-xs font-medium rounded-md transition-colors ${dateFilter === 'today'
                                ? 'bg-accent text-white'
                                : 'bg-bg-secondary text-text-secondary hover:bg-bg-tertiary'
                            }`}
                    >
                        오늘만
                    </button>
                    <button
                        onClick={() => setDateFilter('7days')}
                        className={`flex-1 py-1.5 px-3 text-xs font-medium rounded-md transition-colors ${dateFilter === '7days'
                                ? 'bg-accent text-white'
                                : 'bg-bg-secondary text-text-secondary hover:bg-bg-tertiary'
                            }`}
                    >
                        7일
                    </button>
                    <button
                        onClick={() => setDateFilter('30days')}
                        className={`flex-1 py-1.5 px-3 text-xs font-medium rounded-md transition-colors ${dateFilter === '30days'
                                ? 'bg-accent text-white'
                                : 'bg-bg-secondary text-text-secondary hover:bg-bg-tertiary'
                            }`}
                    >
                        30일
                    </button>
                    <button
                        onClick={() => setDateFilter('all')}
                        className={`flex-1 py-1.5 px-3 text-xs font-medium rounded-md transition-colors ${dateFilter === 'all'
                                ? 'bg-accent text-white'
                                : 'bg-bg-secondary text-text-secondary hover:bg-bg-tertiary'
                            }`}
                    >
                        전체
                    </button>
                </div>
            </div>

            <div className="pb-32 px-4 max-w-md mx-auto">
                {Object.entries(groupedEntries).map(([date, dayEntries]) => (
                    <div key={date} className="mb-8">
                        <div className="sticky top-[57px] bg-bg-primary/95 backdrop-blur py-2 z-10 border-b border-bg-tertiary flex justify-between items-center mb-4">
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

                {entries.length === 0 && (
                    <div className="text-center text-text-secondary mt-20">
                        <p>No entries yet.</p>
                        <p className="text-sm mt-2">Start writing to track your day.</p>
                    </div>
                )}

                {/* Infinite scroll trigger */}
                {entries.length > 0 && entries.length < allEntries.filter(entry => category === 'all' || entry.category === category).length && (
                    <div ref={loadMoreRef} className="py-8 text-center">
                        <div className="inline-block animate-pulse text-text-secondary text-sm">
                            Loading more...
                        </div>
                    </div>
                )}
            </div>
        </>
    );
};

export default Timeline;
