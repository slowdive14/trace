import React, { useEffect, useState, useRef, useCallback } from 'react';
import { format, subDays, startOfDay, isSameDay } from 'date-fns';
import { ko } from 'date-fns/locale';
import type { Entry } from '../types/types';
import { deleteEntry, toggleEntryPin, updateEntry } from '../services/firestore';
import { useAuth } from './AuthContext';
import EntryItem from './EntryItem';
import { onSnapshot, collection, query, orderBy } from 'firebase/firestore';
import { db } from '../services/firebase';
import { Share, Check, Pin, LayoutGrid, List } from 'lucide-react';
import { generateMarkdown, copyToClipboard } from '../utils/exportUtils';
import { getLogicalDate } from '../utils/dateUtils';
import { SleepStats } from './SleepStats';
import {
    DndContext,
    closestCenter,
    DragOverlay,
    useDroppable,
    MouseSensor,
    TouchSensor,
    useSensor,
    useSensors,
} from '@dnd-kit/core';
import {
    SortableContext,
    verticalListSortingStrategy,
    useSortable,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';

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
    const [viewMode, setViewMode] = useState<'list' | 'matrix'>('list');
    const [activeId, setActiveId] = useState<string | null>(null);
    const [matrixSearch, setMatrixSearch] = useState('');
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

    const handleEdit = async (id: string, content: string) => {
        if (!user) return;
        await updateEntry(user.uid, id, content, collectionName);
    };

    const sensors = useSensors(
        useSensor(MouseSensor, {
            activationConstraint: { distance: 5 },
        }),
        useSensor(TouchSensor, {
            activationConstraint: { delay: 250, tolerance: 10 },
        })
    );

    const onDragStart = (event: any) => {
        setActiveId(event.active.id.toString());
    };

    const onDragEnd = async (event: any) => {
        setActiveId(null);
        const { active, over } = event;
        if (!over) return;

        const entryId = active.id.toString();
        const targetQuadrant = over.id.toString();

        if (['q1', 'q2', 'q3', 'q4', 'inbox'].includes(targetQuadrant)) {
            const entry = allEntries.find(e => e.id === entryId);
            if (!entry) return;

            // Update content and tags
            let newContent = entry.content;
            let newTags = [...entry.tags];

            // Remove existing #q tags
            newContent = newContent.replace(/\s*#q[1-4]\b/g, '').trim();
            newTags = newTags.filter(tag => !/^#q[1-4]$/.test(tag));

            // Add new tag if not inbox
            if (targetQuadrant !== 'inbox') {
                newContent = `${newContent} #${targetQuadrant}`;
                newTags.push(`#${targetQuadrant}`);
            }

            await updateEntry(user!.uid, entryId, newContent, collectionName, { tags: newTags });
        }
    };

    const getQuadrantFromEntry = (entry: Entry): 'q1' | 'q2' | 'q3' | 'q4' | 'inbox' => {
        const qTag = entry.tags.find(tag => /^#q[1-4]$/.test(tag));
        if (qTag) return qTag.substring(1) as any;
        return 'inbox';
    };

    const matrixEntries = React.useMemo(() => {
        // Apply date filter
        const now = new Date();
        const logicalNow = getLogicalDate(now);
        let filtered = allEntries;

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
                break;
        }

        // Apply category and tag filters
        return filtered
            .filter(entry => category === 'all' || entry.category === category)
            .filter(entry => !selectedTag || entry.tags.some(tag => tag.startsWith(selectedTag)));
        // Note: pinned status doesn't exclude from matrix
    }, [allEntries, dateFilter, category, selectedTag]);

    const quadrantConfig = category === 'chore' ? {
        q1: { title: "Q1: Do First", label: "긴급 & 중요", color: "text-red-400" },
        q2: { title: "Q2: Schedule", label: "중요", color: "text-green-400" },
        q3: { title: "Q3: Someday", label: "언젠가 할 수도 있는 일", color: "text-yellow-400" },
        q4: { title: "Q4: Info", label: "정보/참고", color: "text-blue-400" },
    } : {
        q1: { title: "Q1: Do First", label: "긴급 & 중요", color: "text-red-400" },
        q2: { title: "Q2: Schedule", label: "중요", color: "text-green-400" },
        q3: { title: "Q3: Delegate", label: "긴급", color: "text-yellow-400" },
        q4: { title: "Q4: Eliminate", label: "보관", color: "text-blue-400" },
    };

    const MatrixItemUI = React.forwardRef<HTMLDivElement, { entry: Entry, isDragging?: boolean, isOverlay?: boolean, style?: React.CSSProperties, [key: string]: any }>(
        ({ entry, isDragging, isOverlay, style, ...props }, ref) => {
            return (
                <div
                    ref={ref}
                    style={{
                        ...style,
                        opacity: isDragging ? 0.3 : 1,
                        touchAction: 'none',
                    }}
                    {...props}
                    className={`p-2.5 mb-1.5 bg-bg-primary rounded-lg border border-bg-tertiary shadow-sm text-[11px] cursor-grab active:cursor-grabbing group flex items-start gap-2.5 transition-all hover:border-accent/30 ${isOverlay ? 'shadow-xl ring-2 ring-accent border-accent z-50 w-64' : ''}`}
                >
                    <div className="mt-1 w-2 h-2 rounded-full flex-shrink-0 bg-accent shadow-[0_0_8px_rgba(var(--accent-rgb),0.5)]" />
                    <div className="flex-1 min-w-0">
                        <div className="text-text-primary leading-snug break-words">
                            {entry.content.replace(/\s*#q[1-4]\b/g, '')}
                        </div>
                        {entry.isPinned && (
                            <div className="mt-1 flex items-center gap-1 text-[9px] text-accent font-bold">
                                <Pin size={8} className="fill-accent" /> PINNED
                            </div>
                        )}
                    </div>
                </div>
            );
        }
    );

    const MatrixItem = ({ entry }: { entry: Entry }) => {
        const {
            attributes,
            listeners,
            setNodeRef,
            transform,
            transition,
            isDragging
        } = useSortable({ id: entry.id });

        const style = {
            transform: CSS.Translate.toString(transform),
            transition,
        };

        return <MatrixItemUI
            ref={setNodeRef}
            entry={entry}
            style={style}
            isDragging={isDragging}
            {...attributes}
            {...listeners}
        />;
    };

    const Quadrant = ({ id, title, label, color, items }: { id: string, title: string, label: string, color: string, items: Entry[] }) => {
        const { setNodeRef, isOver } = useDroppable({ id });

        return (
            <div
                ref={setNodeRef}
                className={`flex-1 flex flex-col p-2 rounded-lg border-2 transition-colors overflow-hidden ${isOver ? 'border-accent bg-accent/5' : 'border-bg-tertiary bg-bg-secondary/30'}`}
                style={{ minHeight: '120px' }}
            >
                <div className="flex items-center justify-between mb-2 px-1">
                    <span className={`text-[10px] font-bold uppercase tracking-wider ${color}`}>{title}</span>
                    <span className="text-[9px] text-text-tertiary">{label}</span>
                </div>
                <div className="flex-1 overflow-y-auto space-y-1 scrollbar-hide">
                    {items.map(entry => (
                        <MatrixItem key={entry.id} entry={entry} />
                    ))}
                    {items.length === 0 && !isOver && (
                        <div className="flex-1 flex items-center justify-center border border-dashed border-bg-tertiary rounded opacity-30">
                            <span className="text-[10px] text-text-tertiary">없음</span>
                        </div>
                    )}
                </div>
            </div>
        );
    };

    const DroppableInbox = ({ items }: { items: Entry[] }) => {
        const { setNodeRef, isOver } = useDroppable({ id: 'inbox' });
        const filteredItems = items.filter(item =>
            item.content.toLowerCase().includes(matrixSearch.toLowerCase())
        );

        return (
            <div
                ref={setNodeRef}
                className={`h-full bg-bg-secondary/50 rounded-xl p-4 border-2 flex flex-col transition-all duration-300 ${isOver ? 'bg-accent/10 border-accent' : 'border-bg-tertiary'}`}
            >
                <div className="flex flex-col gap-3 mb-4">
                    <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                            <span className="text-[11px] font-black text-text-primary uppercase tracking-widest">Inbox</span>
                            <span className="px-1.5 py-0.5 bg-bg-tertiary text-text-secondary text-[9px] font-bold rounded-full">
                                {items.length}
                            </span>
                        </div>
                        <span className="text-[10px] text-text-tertiary italic">미분류 항목을 정렬해 보세요</span>
                    </div>

                    <div className="relative group">
                        <input
                            type="text"
                            placeholder="Inbox 내 검색..."
                            value={matrixSearch}
                            onChange={(e) => setMatrixSearch(e.target.value)}
                            className="w-full bg-bg-tertiary/50 border border-bg-tertiary rounded-lg px-3 py-1.5 text-xs text-text-primary focus:outline-none focus:ring-1 focus:ring-accent/50 focus:border-accent/50 transition-all"
                        />
                        {matrixSearch && (
                            <button
                                onClick={() => setMatrixSearch('')}
                                className="absolute right-2 top-1/2 -translate-y-1/2 text-text-tertiary hover:text-text-primary"
                            >
                                <span className="text-xs">×</span>
                            </button>
                        )}
                    </div>
                </div>

                <div className="flex-1 overflow-y-auto pr-1 scrollbar-thin scrollbar-thumb-bg-tertiary">
                    <SortableContext
                        items={filteredItems.map(e => e.id)}
                        strategy={verticalListSortingStrategy}
                    >
                        <div className="space-y-2">
                            {filteredItems.map(entry => (
                                <MatrixItem key={entry.id} entry={entry} />
                            ))}
                            {items.length === 0 && !isOver && (
                                <div className="h-24 flex items-center justify-center border-2 border-dashed border-bg-tertiary/50 rounded-xl opacity-40">
                                    <span className="text-[10px] font-medium">관리할 항목이 없습니다</span>
                                </div>
                            )}
                            {items.length > 0 && filteredItems.length === 0 && (
                                <div className="h-24 flex items-center justify-center text-text-tertiary italic text-[10px]">
                                    검색 결과가 없습니다
                                </div>
                            )}
                        </div>
                    </SortableContext>
                </div>
            </div>
        );
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

            {/* Header: Date Filter & View Toggle */}
            <div className="sticky top-0 bg-bg-primary/95 backdrop-blur border-b border-bg-tertiary z-20 px-4 py-3">
                <div className="max-w-md mx-auto flex flex-col gap-3">
                    <div className="flex gap-2">
                        <div className="flex-1 flex gap-1 bg-bg-secondary rounded-lg p-1">
                            <button
                                onClick={() => setDateFilter('today')}
                                className={`flex-1 py-1 px-2 text-[10px] font-bold rounded-md transition-colors ${dateFilter === 'today'
                                    ? 'bg-accent text-white shadow-sm'
                                    : 'text-text-secondary hover:text-text-primary'
                                    }`}
                            >
                                오늘
                            </button>
                            <button
                                onClick={() => setDateFilter('7days')}
                                className={`flex-1 py-1 px-2 text-[10px] font-bold rounded-md transition-colors ${dateFilter === '7days'
                                    ? 'bg-accent text-white shadow-sm'
                                    : 'text-text-secondary hover:text-text-primary'
                                    }`}
                            >
                                7일
                            </button>
                            <button
                                onClick={() => setDateFilter('30days')}
                                className={`flex-1 py-1 px-2 text-[10px] font-bold rounded-md transition-colors ${dateFilter === '30days'
                                    ? 'bg-accent text-white shadow-sm'
                                    : 'text-text-secondary hover:text-text-primary'
                                    }`}
                            >
                                30일
                            </button>
                            <button
                                onClick={() => setDateFilter('all')}
                                className={`flex-1 py-1 px-2 text-[10px] font-bold rounded-md transition-colors ${dateFilter === 'all'
                                    ? 'bg-accent text-white shadow-sm'
                                    : 'text-text-secondary hover:text-text-primary'
                                    }`}
                            >
                                전체
                            </button>
                        </div>
                        <div className="flex gap-1 bg-bg-secondary rounded-lg p-1">
                            <button
                                onClick={() => setViewMode('list')}
                                className={`p-1.5 rounded-md transition-colors ${viewMode === 'list'
                                    ? 'bg-white text-accent shadow-sm'
                                    : 'text-text-secondary hover:text-text-primary'
                                    }`}
                                title="리스트 형태"
                            >
                                <List size={14} />
                            </button>
                            <button
                                onClick={() => setViewMode('matrix')}
                                className={`p-1.5 rounded-md transition-colors ${viewMode === 'matrix'
                                    ? 'bg-white text-accent shadow-sm'
                                    : 'text-text-secondary hover:text-text-primary'
                                    }`}
                                title="매트릭스 형태"
                            >
                                <LayoutGrid size={14} />
                            </button>
                        </div>
                    </div>
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
                {viewMode === 'list' ? (
                    <>
                        {/* Sleep Stats - 일상 탭에서만 표시 */}
                        {category === 'action' && (
                            <div className="mt-4">
                                <SleepStats entries={allEntries} />
                            </div>
                        )}

                        {/* Pinned Entries Section */}
                        {pinnedEntries.length > 0 && (
                            <div className="mb-8">
                                <div className="sticky top-[57px] bg-bg-primary/95 backdrop-blur py-2 z-10 border-b border-bg-tertiary flex justify-between items-center mb-4">
                                    <h2 className="text-accent text-sm font-bold flex items-center gap-2">
                                        <Pin size={14} className="fill-accent" /> 고정된 {category === 'chore' ? '할일' : category === 'book' ? '책' : category === 'action' ? '일상' : '생각'}
                                    </h2>
                                </div>
                                <div className="space-y-1">
                                    {pinnedEntries.map(entry => (
                                        <EntryItem
                                            key={entry.id}
                                            entry={entry}
                                            onDelete={handleDelete}
                                            onEdit={handleEdit}
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
                                            onEdit={handleEdit}
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
                    </>
                ) : (
                    /* Matrix Mode */
                    <div className="py-2 h-[calc(100vh-220px)] flex flex-col overflow-hidden">
                        <DndContext
                            sensors={sensors}
                            collisionDetection={closestCenter}
                            onDragStart={onDragStart}
                            onDragEnd={onDragEnd}
                        >
                            <div className="h-[45%] grid grid-cols-2 grid-rows-2 gap-3 mb-4">
                                <Quadrant
                                    id="q1"
                                    title={quadrantConfig.q1.title}
                                    label={quadrantConfig.q1.label}
                                    color={quadrantConfig.q1.color}
                                    items={matrixEntries.filter(e => getQuadrantFromEntry(e) === 'q1')}
                                />
                                <Quadrant
                                    id="q2"
                                    title={quadrantConfig.q2.title}
                                    label={quadrantConfig.q2.label}
                                    color={quadrantConfig.q2.color}
                                    items={matrixEntries.filter(e => getQuadrantFromEntry(e) === 'q2')}
                                />
                                <Quadrant
                                    id="q3"
                                    title={quadrantConfig.q3.title}
                                    label={quadrantConfig.q3.label}
                                    color={quadrantConfig.q3.color}
                                    items={matrixEntries.filter(e => getQuadrantFromEntry(e) === 'q3')}
                                />
                                <Quadrant
                                    id="q4"
                                    title={quadrantConfig.q4.title}
                                    label={quadrantConfig.q4.label}
                                    color={quadrantConfig.q4.color}
                                    items={matrixEntries.filter(e => getQuadrantFromEntry(e) === 'q4')}
                                />
                            </div>

                            <div className="flex-1 overflow-hidden min-h-0">
                                <DroppableInbox items={matrixEntries.filter(e => getQuadrantFromEntry(e) === 'inbox')} />
                            </div>

                            <DragOverlay adjustScale={true}>
                                {activeId ? (
                                    <MatrixItemUI
                                        entry={matrixEntries.find(e => e.id === activeId)!}
                                        isOverlay
                                    />
                                ) : null}
                            </DragOverlay>
                        </DndContext>
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
