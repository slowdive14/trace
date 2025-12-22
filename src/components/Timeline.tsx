import React, { useEffect, useState, useRef, useCallback } from 'react';
import { format, subDays, startOfDay, isSameDay } from 'date-fns';
import { ko } from 'date-fns/locale';
import type { Entry } from '../types/types';
import { deleteEntry, toggleEntryPin } from '../services/firestore';
import { useAuth } from './AuthContext';
import EntryItem from './EntryItem';
import { onSnapshot, collection, query, orderBy } from 'firebase/firestore';
import { db } from '../services/firebase';
import { Share, Check, Pin } from 'lucide-react';
import { generateMarkdown, copyToClipboard } from '../utils/exportUtils';
import { getLogicalDate } from '../utils/dateUtils';

interface TimelineProps {
    category?: 'action' | 'thought' | 'chore' | 'book' | 'all';
    selectedTag?: string | null;
    onTagClick?: (tag: string) => void;
    collectionName?: string;
    subFilter?: string | null;
    onSubFilterChange?: (filter: string | null) => void;
}

type DateFilter = 'today' | '7days' | '30days' | 'all';

const Timeline: React.FC<TimelineProps> = ({ category = 'action', selectedTag, onTagClick, collectionName = 'entries', subFilter, onSubFilterChange }) => {
    const [allEntries, setAllEntries] = useState<Entry[]>([]);
    const [displayLimit, setDisplayLimit] = useState(50);
    const [dateFilter, setDateFilter] = useState<DateFilter>('today');
    const [showToast, setShowToast] = useState(false);
    const { user } = useAuth();
    const [loadMoreNode, setLoadMoreNode] = useState<HTMLDivElement | null>(null);
    const isFirstLoadRef = useRef<Record<string, boolean>>({});

    useEffect(() => {
        if (!user) return;

        const q = query(
            collection(db, `users/${user.uid}/${collectionName}`),
            orderBy("timestamp", "desc")
        );

        // Track first load per collection to persist across tab switches
        const collectionKey = `${user.uid}/${collectionName}`;
        if (!(collectionKey in isFirstLoadRef.current)) {
            isFirstLoadRef.current[collectionKey] = true;
        }

        const unsubscribe = onSnapshot(q, (snapshot) => {
            const newEntries = snapshot.docs.map(doc => ({
                id: doc.id,
                ...doc.data(),
                timestamp: doc.data().timestamp.toDate(),
            })) as Entry[];

            // Scroll to top when new entries are added (but not on initial load for this collection)
            if (!isFirstLoadRef.current[collectionKey] && newEntries.length > allEntries.length) {
                window.scrollTo({ top: 0, behavior: 'smooth' });
            }

            setAllEntries(newEntries);
            isFirstLoadRef.current[collectionKey] = false;
        });

        return () => unsubscribe();
    }, [user, collectionName, allEntries.length]);

    // Infinite scroll observer - uses callback ref pattern for dynamic elements
    useEffect(() => {
        if (!loadMoreNode) return;

        const observer = new IntersectionObserver(
            (entries) => {
                if (entries[0].isIntersecting) {
                    setDisplayLimit(prev => prev + 30);
                }
            },
            { threshold: 0.1 }
        );

        observer.observe(loadMoreNode);

        return () => observer.disconnect();
    }, [loadMoreNode]);

    const handleDelete = async (id: string) => {
        if (!user) return;
        await deleteEntry(user.uid, id, collectionName);
    };

    const handlePin = async (id: string, currentStatus: boolean) => {
        if (!user) return;
        await toggleEntryPin(user.uid, id, currentStatus, collectionName);
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

    const getPinnedEntries = useCallback(() => {
        return allEntries.filter(entry => {
            // Basic filters
            if (category !== 'all' && entry.category !== category) return false;
            if (selectedTag && !entry.tags.some(tag => tag.startsWith(selectedTag))) return false;

            // Sub-filter (book category only)
            if (subFilter && category === 'book' && !entry.tags.some(tag => tag === subFilter)) return false;

            return entry.isPinned;
        });
    }, [allEntries, category, selectedTag, subFilter]);

    const getFilteredEntriesAll = useCallback(() => {
        let filtered = allEntries.filter(entry => !entry.isPinned); // Exclude pinned items from main list

        // Apply date filter
        const now = new Date();
        const logicalNow = getLogicalDate(now);

        switch (dateFilter) {
            case 'today':
                filtered = filtered.filter(entry =>
                    isSameDay(getLogicalDate(entry.timestamp), logicalNow)
                );
                break;
            case '7days':
                const sevenDaysAgo = subDays(startOfDay(logicalNow), 6);
                filtered = filtered.filter(entry => getLogicalDate(entry.timestamp) >= sevenDaysAgo);
                break;
            case '30days':
                const thirtyDaysAgo = subDays(startOfDay(logicalNow), 29);
                filtered = filtered.filter(entry => getLogicalDate(entry.timestamp) >= thirtyDaysAgo);
                break;
            case 'all':
            default:
                // No date filtering
                break;
        }

        // Apply category and tag filters
        filtered = filtered
            .filter(entry => category === 'all' || entry.category === category)
            .filter(entry => !selectedTag || entry.tags.some(tag => tag.startsWith(selectedTag)));

        // Apply sub-filter (book category only)
        if (subFilter && category === 'book') {
            filtered = filtered.filter(entry => entry.tags.some(tag => tag === subFilter));
        }

        return filtered;
    }, [allEntries, dateFilter, category, selectedTag, subFilter]);

    const pinnedEntries = getPinnedEntries();
    const filteredEntriesAll = getFilteredEntriesAll();
    const entries = filteredEntriesAll.slice(0, displayLimit);

    const groupedEntries = entries.reduce((groups: Record<string, Entry[]>, entry: Entry) => {
        const dateKey = format(getLogicalDate(entry.timestamp), 'yyyy-MM-dd');
        if (!groups[dateKey]) {
            groups[dateKey] = [];
        }
        groups[dateKey].push(entry);
        return groups;
    }, {} as Record<string, Entry[]>);

    const getDateLabel = (dateStr: string) => {
        const [year, month, day] = dateStr.split('-').map(Number);
        const date = new Date(year, month - 1, day);
        const logicalNow = getLogicalDate();

        if (isSameDay(date, logicalNow)) return '오늘';
        if (isSameDay(date, subDays(logicalNow, 1))) return '어제';
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

            {/* Sub-filter for Book Category */}
            {category === 'book' && (
                <div className="sticky top-[57px] bg-bg-primary/95 backdrop-blur border-b border-bg-tertiary z-19 px-4 py-2">
                    <div className="max-w-md mx-auto flex gap-2">
                        <button
                            onClick={() => onSubFilterChange?.(null)}
                            className={`flex-1 py-1.5 px-2 text-xs font-medium rounded-md transition-colors ${subFilter === null
                                ? 'bg-amber-700 text-white'
                                : 'bg-bg-secondary text-text-secondary hover:bg-bg-tertiary'
                                }`}
                        >
                            전체
                        </button>
                        <button
                            onClick={() => onSubFilterChange?.('#발췌')}
                            className={`flex-1 py-1.5 px-2 text-xs font-medium rounded-md transition-colors ${subFilter === '#발췌'
                                ? 'bg-amber-700 text-white'
                                : 'bg-bg-secondary text-text-secondary hover:bg-bg-tertiary'
                                }`}
                        >
                            발췌
                        </button>
                        <button
                            onClick={() => onSubFilterChange?.('#읽을책')}
                            className={`flex-1 py-1.5 px-2 text-xs font-medium rounded-md transition-colors ${subFilter === '#읽을책'
                                ? 'bg-amber-700 text-white'
                                : 'bg-bg-secondary text-text-secondary hover:bg-bg-tertiary'
                                }`}
                        >
                            읽을책
                        </button>
                    </div>
                </div>
            )}

            <div className={`px-4 max-w-md mx-auto ${category === 'book' ? 'pb-60' : 'pb-32'}`}>
                {/* Pinned Entries Section */}
                {pinnedEntries.length > 0 && (
                    <div className="mb-8">
                        <div className="sticky top-[57px] bg-bg-primary/95 backdrop-blur py-2 z-10 border-b border-bg-tertiary flex justify-between items-center mb-4">
                            <h2 className="text-accent text-sm font-bold flex items-center gap-2">
                                <Pin size={14} className="fill-accent" /> 고정된 생각
                            </h2>
                        </div>
                        <div className="space-y-1">
                            {pinnedEntries.map(entry => (
                                <EntryItem
                                    key={entry.id}
                                    entry={entry}
                                    onDelete={handleDelete}
                                    onTagClick={onTagClick}
                                    onPin={handlePin}
                                />
                            ))}
                        </div>
                    </div>
                )}

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
                                <EntryItem
                                    key={entry.id}
                                    entry={entry}
                                    onDelete={handleDelete}
                                    onTagClick={onTagClick}
                                    onPin={handlePin}
                                />
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
                {entries.length > 0 && entries.length < filteredEntriesAll.length && (
                    <div ref={setLoadMoreNode} className="py-8 text-center">
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
