import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { useAuth } from './AuthContext';
import { saveTodo, getTodo, getTodos, getAllTodos, saveTemplate, getTemplate } from '../services/firestore';
import { CheckSquare, Square, Bold, Highlighter, ArrowRight, ArrowLeft, Edit3, Check } from 'lucide-react';
import { format, subDays, startOfDay, endOfDay, startOfWeek, endOfWeek } from 'date-fns';
import { ko } from 'date-fns/locale';
import type { Todo } from '../types/types';
import { getLogicalDate } from '../utils/dateUtils';
import {
    type TodoItem,
    parseTodos,
    calculateTotalWeightedRate,
    getLevelInfo,
    getEncouragementMessage,
    getProgressColor,
    getRealLevel
} from '../utils/todoUtils';
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

interface TodoTabProps {
    collectionName?: string;
    placeholder?: string;
    quadrantConfig?: {
        q1: { title: string; label: string; color: string };
        q2: { title: string; label: string; color: string };
        q3: { title: string; label: string; color: string };
        q4: { title: string; label: string; color: string };
    };
}

type ViewMode = 'edit' | 'history' | 'template' | 'matrix';

const TodoTab: React.FC<TodoTabProps> = ({
    collectionName = 'todos',
    placeholder = "오늘의 할 일을 기록하세요...",
    quadrantConfig = {
        q1: { title: "Q1: Do First", label: "긴급 & 중요", color: "text-red-400" },
        q2: { title: "Q2: Schedule", label: "중요", color: "text-green-400" },
        q3: { title: "Q3: Delegate", label: "긴급", color: "text-yellow-400" },
        q4: { title: "Q4: Eliminate", label: "보관", color: "text-blue-400" },
    }
}) => {
    const [content, setContent] = useState('');
    const [isEditing, setIsEditing] = useState(false);
    const [viewMode, setViewMode] = useState<ViewMode>('edit');
    const [historyTodos, setHistoryTodos] = useState<Todo[]>([]);
    const [allTodos, setAllTodos] = useState<Todo[]>([]);
    const [isSaving, setIsSaving] = useState(false);
    const [lastSaved, setLastSaved] = useState<Date | null>(null);
    const [currentLogicalDay, setCurrentLogicalDay] = useState(format(getLogicalDate(), 'yyyy-MM-dd'));

    const { user } = useAuth();
    const textareaRef = useRef<HTMLTextAreaElement>(null);
    const saveTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

    // Auto-refresh when logical day changes (5AM cutoff)
    useEffect(() => {
        const checkDayChange = () => {
            const newDay = format(getLogicalDate(), 'yyyy-MM-dd');
            if (newDay !== currentLogicalDay) {
                setCurrentLogicalDay(newDay);
            }
        };

        const interval = setInterval(checkDayChange, 30000); // 30s check
        window.addEventListener('focus', checkDayChange);
        return () => {
            clearInterval(interval);
            window.removeEventListener('focus', checkDayChange);
        };
    }, [currentLogicalDay]);

    // Load content based on view mode
    useEffect(() => {
        const loadContent = async () => {
            if (!user) return;

            try {
                if (viewMode === 'edit' || viewMode === 'matrix') {
                    // Load logical today's todo (5AM cutoff)
                    const today = getLogicalDate();
                    const todo = await getTodo(user.uid, today, collectionName);
                    if (todo) {
                        setContent(todo.content);
                        setLastSaved(todo.updatedAt || new Date());
                    } else {
                        // If no todo for today, try to load template
                        const template = await getTemplate(user.uid, collectionName);
                        if (template) {
                            setContent(template);
                            // Optional: Auto-save the template as today's todo immediately?
                            // For now, we just pre-fill it. It will be saved when user edits.
                        } else {
                            setContent('');
                        }
                    }
                } else if (viewMode === 'template') {
                    // Load template
                    const template = await getTemplate(user.uid, collectionName);
                    setContent(template || '');
                }
            } catch (error) {
                console.error("Failed to load content:", error);
            }
        };
        loadContent();
    }, [user, collectionName, viewMode, currentLogicalDay]);

    // Load history (last 30 days) - also used for stats in edit mode
    useEffect(() => {
        const loadHistory = async () => {
            if (!user) return;
            // Load history for both 'history' and 'edit' modes (for stats)
            if (viewMode === 'template') return;
            try {
                // Use logical date for history range
                const logicalToday = getLogicalDate();
                const endDate = endOfDay(logicalToday);
                const startDate = startOfDay(subDays(logicalToday, 29));
                const todos = await getTodos(user.uid, startDate, endDate, collectionName);
                setHistoryTodos(todos);
            } catch (error) {
                console.error("Failed to load history:", error);
            }
        };
        loadHistory();
    }, [user, viewMode, collectionName, currentLogicalDay]);

    // Load all todos for level calculation (all time)
    useEffect(() => {
        const loadAllTodos = async () => {
            if (!user) return;
            try {
                const todos = await getAllTodos(user.uid, collectionName);
                setAllTodos(todos);
            } catch (error) {
                console.error("Failed to load all todos:", error);
            }
        };
        loadAllTodos();
    }, [user, collectionName, currentLogicalDay]);

    // Calculate weekly stats (Korean week: Monday start) - memoized for performance
    const weeklyStats = useMemo(() => {
        const logicalToday = getLogicalDate();
        const todayStr = format(logicalToday, 'yyyy-MM-dd');

        // This week
        const thisWeekStart = startOfWeek(logicalToday, { weekStartsOn: 1 });
        const thisWeekEnd = endOfWeek(logicalToday, { weekStartsOn: 1 });

        // Last week
        const lastWeekStart = startOfWeek(subDays(thisWeekStart, 1), { weekStartsOn: 1 });
        const lastWeekEnd = endOfWeek(subDays(thisWeekStart, 1), { weekStartsOn: 1 });

        const calcStats = (start: Date, end: Date) => {
            const todosInRange = historyTodos.filter(todo => {
                const todoDate = new Date(todo.date);
                return todoDate >= start && todoDate <= end;
            });

            let completed = 0;
            let total = 0;

            let weightedPercentageSum = 0;
            let dayCount = 0;

            todosInRange.forEach(todo => {
                const todoDateStr = format(new Date(todo.date), 'yyyy-MM-dd');
                const todoContent = todoDateStr === todayStr ? content : todo.content;
                const items = parseTodos(todoContent);
                if (items.length > 0) {
                    weightedPercentageSum += calculateTotalWeightedRate(items);
                    dayCount++;
                }
                completed += items.filter(item => item.checked).length;
                total += items.length;
            });

            return {
                avgPercentage: dayCount > 0 ? Math.round(weightedPercentageSum / dayCount) : 0,
                totalCompleted: completed
            };
        };

        return {
            thisWeek: calcStats(thisWeekStart, thisWeekEnd),
            lastWeek: calcStats(lastWeekStart, lastWeekEnd)
        };
    }, [historyTodos, content, currentLogicalDay]);

    // Calculate total completed (all time) for real level - memoized for performance
    const totalCompleted = useMemo(() => {
        const logicalToday = getLogicalDate();
        const todayStr = format(logicalToday, 'yyyy-MM-dd');

        let total = 0;
        allTodos.forEach(todo => {
            const todoDateStr = format(new Date(todo.date), 'yyyy-MM-dd');
            // Use current content for today (real-time update)
            const todoContent = todoDateStr === todayStr ? content : todo.content;
            const items = parseTodos(todoContent);
            total += items.filter(item => item.checked).length;
        });
        return total;
    }, [allTodos, content, currentLogicalDay]);

    const handleSave = useCallback((newContent: string) => {
        if (!user) return;

        setIsSaving(true);
        if (saveTimeoutRef.current) {
            clearTimeout(saveTimeoutRef.current);
        }

        saveTimeoutRef.current = setTimeout(async () => {
            try {
                if (viewMode === 'edit' || viewMode === 'matrix') {
                    // Save to logical today's date
                    const today = getLogicalDate();
                    await saveTodo(user.uid, today, newContent, collectionName);
                } else if (viewMode === 'template') {
                    // Save as template
                    await saveTemplate(user.uid, newContent, collectionName);
                }
                setLastSaved(new Date());
            } catch (error) {
                console.error("Failed to save content:", error);
            } finally {
                setIsSaving(false);
            }
        }, 500);
    }, [user, collectionName, viewMode]);

    const handleChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
        const newContent = e.target.value;
        setContent(newContent);
        handleSave(newContent);
    };

    const toggleCheckbox = (lineIndex: number) => {
        const lines = content.split('\n');
        const line = lines[lineIndex];

        if (line.includes('- [ ]')) {
            lines[lineIndex] = line.replace('- [ ]', '- [x]');
        } else if (line.includes('- [x]')) {
            lines[lineIndex] = line.replace('- [x]', '- [ ]');
        }

        const newContent = lines.join('\n');
        setContent(newContent);
        handleSave(newContent);
    };

    const toggleHistoryCheckbox = async (dateStr: string, lineIndex: number) => {
        const todo = historyTodos.find(t => format(t.date, 'yyyy-MM-dd') === dateStr);
        if (!todo || !user) return;

        const lines = todo.content.split('\n');
        const line = lines[lineIndex];

        if (line.includes('- [ ]')) {
            lines[lineIndex] = line.replace('- [ ]', '- [x]');
        } else if (line.includes('- [x]')) {
            lines[lineIndex] = line.replace('- [x]', '- [ ]');
        }

        const newContent = lines.join('\n');

        // Update local state
        setHistoryTodos(prev => prev.map(t => {
            if (format(t.date, 'yyyy-MM-dd') === dateStr) {
                return { ...t, content: newContent };
            }
            return t;
        }));

        // Also update today's content state if it's today
        const logicalToday = format(getLogicalDate(), 'yyyy-MM-dd');
        if (dateStr === logicalToday) {
            setContent(newContent);
        }

        // Save to Firestore
        try {
            const [year, month, day] = dateStr.split('-').map(Number);
            const date = new Date(year, month - 1, day);
            await saveTodo(user.uid, date, newContent, collectionName);
        } catch (error) {
            console.error('Failed to save history checkbox toggle:', error);
        }
    };

    const renderText = (text: string): React.ReactNode => {
        // Safe parsing without dangerouslySetInnerHTML
        const parts: React.ReactNode[] = [];
        let remaining = text;
        let keyIndex = 0;

        while (remaining.length > 0) {
            // Find the earliest match
            const boldMatch = remaining.match(/\*\*(.+?)\*\*/);
            const highlightMatch = remaining.match(/==(.+?)==/);

            const boldIndex = boldMatch ? remaining.indexOf(boldMatch[0]) : Infinity;
            const highlightIndex = highlightMatch ? remaining.indexOf(highlightMatch[0]) : Infinity;

            if (boldIndex === Infinity && highlightIndex === Infinity) {
                // No more matches, add remaining text
                parts.push(remaining);
                break;
            }

            if (boldIndex <= highlightIndex && boldMatch) {
                // Bold comes first
                if (boldIndex > 0) {
                    parts.push(remaining.substring(0, boldIndex));
                }
                parts.push(<strong key={keyIndex++} className="font-bold">{boldMatch[1]}</strong>);
                remaining = remaining.substring(boldIndex + boldMatch[0].length);
            } else if (highlightMatch) {
                // Highlight comes first
                if (highlightIndex > 0) {
                    parts.push(remaining.substring(0, highlightIndex));
                }
                parts.push(<mark key={keyIndex++} className="bg-yellow-300 px-1">{highlightMatch[1]}</mark>);
                remaining = remaining.substring(highlightIndex + highlightMatch[0].length);
            }
        }

        return <span>{parts}</span>;
    };

    const insertText = (text: string, cursorOffset = 0) => {
        if (!textareaRef.current) return;

        const start = textareaRef.current.selectionStart;
        const end = textareaRef.current.selectionEnd;
        const newContent = content.substring(0, start) + text + content.substring(end);

        setContent(newContent);
        handleSave(newContent);

        setTimeout(() => {
            if (textareaRef.current) {
                textareaRef.current.selectionStart = textareaRef.current.selectionEnd = start + text.length + cursorOffset;
                textareaRef.current.focus();
            }
        }, 0);
    };

    const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
        if (e.key === 'Tab') {
            e.preventDefault();
            if (e.shiftKey) {
                handleIndent('out');
            } else {
                handleIndent('in');
            }
        } else if (e.key === 'Enter') {
            e.preventDefault();
            const start = e.currentTarget.selectionStart;
            const lineStart = content.lastIndexOf('\n', start - 1) + 1;
            const lineEnd = content.indexOf('\n', start);
            const currentLine = content.substring(lineStart, lineEnd === -1 ? content.length : lineEnd);

            const indentation = currentLine.match(/^[\t ]*/)?.[0] || '';
            let nextLinePrefix = '\n' + indentation + '- [ ] ';

            insertText(nextLinePrefix);
        }
    };

    const handleIndent = (direction: 'in' | 'out') => {
        if (!textareaRef.current) return;

        const start = textareaRef.current.selectionStart;
        const lineStart = content.lastIndexOf('\n', start - 1) + 1;

        if (direction === 'in') {
            const newContent = content.substring(0, lineStart) + '\t' + content.substring(lineStart);
            setContent(newContent);
            handleSave(newContent);
            setTimeout(() => {
                if (textareaRef.current) {
                    textareaRef.current.selectionStart = textareaRef.current.selectionEnd = start + 1;
                    textareaRef.current.focus();
                }
            }, 0);
        } else {
            const currentLine = content.substring(lineStart);
            if (currentLine.startsWith('\t')) {
                const newContent = content.substring(0, lineStart) + content.substring(lineStart + 1);
                setContent(newContent);
                handleSave(newContent);
                setTimeout(() => {
                    if (textareaRef.current) {
                        textareaRef.current.selectionStart = textareaRef.current.selectionEnd = Math.max(lineStart, start - 1);
                        textareaRef.current.focus();
                    }
                }, 0);
            }
        }
    };

    const getDateLabel = (dateStr: string) => {
        const [year, month, day] = dateStr.split('-').map(Number);
        const date = new Date(year, month - 1, day);
        const logicalToday = getLogicalDate();

        // Compare with logical today
        if (format(date, 'yyyy-MM-dd') === format(logicalToday, 'yyyy-MM-dd')) return '오늘';
        if (format(date, 'yyyy-MM-dd') === format(subDays(logicalToday, 1), 'yyyy-MM-dd')) return '어제';

        return format(date, 'M월 d일 (eee)', { locale: ko });
    };

    const groupedTodos = historyTodos.reduce((groups: Record<string, Todo>, todo) => {
        const dateKey = format(todo.date, 'yyyy-MM-dd');
        if (!groups[dateKey]) {
            groups[dateKey] = todo;
        }
        return groups;
    }, {});

    const [activeId, setActiveId] = useState<string | null>(null);
    const todos = parseTodos(content);

    const sensors = useSensors(
        useSensor(MouseSensor, {
            activationConstraint: {
                distance: 5,
            },
        }),
        useSensor(TouchSensor, {
            activationConstraint: {
                delay: 250,
                tolerance: 10,
            },
        })
    );

    const onDragStart = (event: any) => {
        setActiveId(event.active.id.toString());
    };

    const onDragEnd = (event: any) => {
        setActiveId(null);
        const { active, over } = event;
        if (!over) return;

        const activeId = active.id.toString();
        const overId = over.id.toString();

        // activeId is the lineIndex
        const lineIndex = parseInt(activeId);

        // Find target quadrant (could be the quadrant ID or another item's ID)
        let targetQuadrant: 'q1' | 'q2' | 'q3' | 'q4' | 'inbox';

        if (['q1', 'q2', 'q3', 'q4', 'inbox'].includes(overId)) {
            targetQuadrant = overId as any;
        } else {
            // overId is another item's lineIndex
            const overItem = todos.find(t => t.lineIndex.toString() === overId);
            if (!overItem) return;
            targetQuadrant = overItem.quadrant;
        }

        const lines = content.split('\n');
        let line = lines[lineIndex];

        // Remove existing #q tags (safely)
        line = line.replace(/\s*#q[1-4]\b/g, '').trim();

        // Add new tag if not inbox
        if (targetQuadrant !== 'inbox') {
            line = `${line} #${targetQuadrant}`;
        }

        lines[lineIndex] = line;
        const newContent = lines.join('\n');
        setContent(newContent);
        handleSave(newContent);
    };

    const DroppableInbox = ({ items }: { items: TodoItem[] }) => {
        const { setNodeRef, isOver } = useDroppable({ id: 'inbox' });

        return (
            <div
                ref={setNodeRef}
                className={`h-full bg-bg-secondary/50 rounded-lg p-3 border border-bg-tertiary flex flex-col transition-colors ${isOver ? 'bg-accent/10 border-accent' : ''}`}
            >
                <div className="flex items-center justify-between mb-2">
                    <span className="text-[10px] font-bold text-text-secondary uppercase tracking-widest">Inbox</span>
                    <span className="text-[9px] text-text-tertiary">분류 전 할 일</span>
                </div>
                <div className="flex-1 overflow-x-auto overflow-y-hidden pb-1" style={{ WebkitOverflowScrolling: 'touch' }}>
                    <SortableContext
                        items={items.map(t => t.lineIndex.toString())}
                        strategy={verticalListSortingStrategy}
                    >
                        <div className="flex gap-2 h-full items-start">
                            {items.map(item => (
                                <div key={item.lineIndex} className="w-32 flex-shrink-0">
                                    <MatrixItem item={item} />
                                </div>
                            ))}
                            {items.length === 0 && !isOver && (
                                <div className="flex-1 self-stretch flex items-center justify-center border border-dashed border-bg-tertiary rounded opacity-30 min-w-[200px]">
                                    <span className="text-[10px]">드래그하여 이쪽으로 옮길 수 있습니다</span>
                                </div>
                            )}
                        </div>
                    </SortableContext>
                </div>
            </div>
        );
    };

    const MatrixItemUI = React.forwardRef<HTMLDivElement, { item: TodoItem, isDragging?: boolean, isOverlay?: boolean, style?: React.CSSProperties, [key: string]: any }>(
        ({ item, isDragging, isOverlay, style, ...props }, ref) => {
            return (
                <div
                    ref={ref}
                    style={{
                        ...style,
                        opacity: isDragging ? 0.3 : 1,
                        touchAction: isOverlay ? 'none' : 'auto',
                    }}
                    {...props}
                    className={`p-2 mb-1 bg-bg-primary rounded border border-bg-tertiary shadow-sm text-xs cursor-grab active:cursor-grabbing group flex items-center gap-2 ${isOverlay ? 'shadow-xl ring-2 ring-accent border-accent z-50' : ''}`}
                >
                    <div className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${item.checked ? 'bg-text-tertiary' : 'bg-accent'}`} />
                    <span className={`truncate ${item.checked ? 'line-through text-text-tertiary' : 'text-text-primary'}`}>
                        {item.text}
                    </span>
                </div>
            );
        }
    );

    const MatrixItem = ({ item }: { item: TodoItem }) => {
        const {
            attributes,
            listeners,
            setNodeRef,
            transform,
            transition,
            isDragging
        } = useSortable({ id: item.lineIndex.toString() });

        const style = {
            transform: CSS.Translate.toString(transform),
            transition,
        };

        return <MatrixItemUI
            ref={setNodeRef}
            item={item}
            style={style}
            isDragging={isDragging}
            {...attributes}
            {...listeners}
        />;
    };

    const Quadrant = ({ id, title, label, color, items }: { id: string, title: string, label: string, color: string, items: TodoItem[] }) => {
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
                <div className="flex-1 overflow-y-auto space-y-1" style={{ WebkitOverflowScrolling: 'touch', overscrollBehaviorY: 'contain' }}>
                    {items.map(item => (
                        <MatrixItem key={item.lineIndex} item={item} />
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

    return (
        <div className="flex flex-col relative" style={{ height: 'calc(100vh - 160px)' }}>
            {/* Mode Tabs */}
            <div className="flex-shrink-0 bg-bg-primary/95 backdrop-blur border-b border-bg-tertiary z-20 px-4">
                <div className="max-w-md mx-auto flex gap-2 py-2">
                    <button
                        onClick={() => setViewMode('edit')}
                        className={`flex-1 py-2 px-4 text-sm font-medium rounded-md transition-colors ${viewMode === 'edit'
                            ? 'bg-accent text-white'
                            : 'bg-bg-secondary text-text-secondary hover:bg-bg-tertiary'
                            }`}
                    >
                        편집 모드
                    </button>
                    <button
                        onClick={() => setViewMode('history')}
                        className={`flex-1 py-2 px-4 text-sm font-medium rounded-md transition-colors ${viewMode === 'history'
                            ? 'bg-accent text-white'
                            : 'bg-bg-secondary text-text-secondary hover:bg-bg-tertiary'
                            }`}
                    >
                        히스토리
                    </button>
                    <button
                        onClick={() => setViewMode('matrix')}
                        className={`flex-1 py-2 px-4 text-sm font-medium rounded-md transition-colors ${viewMode === 'matrix'
                            ? 'bg-accent text-white'
                            : 'bg-bg-secondary text-text-secondary hover:bg-bg-tertiary'
                            }`}
                    >
                        매트릭스
                    </button>
                    <button
                        onClick={() => setViewMode('template')}
                        className={`flex-1 py-2 px-4 text-sm font-medium rounded-md transition-colors ${viewMode === 'template'
                            ? 'bg-accent text-white'
                            : 'bg-bg-secondary text-text-secondary hover:bg-bg-tertiary'
                            }`}
                    >
                        루틴 설정
                    </button>
                </div>
            </div>

            {viewMode === 'history' ? (
                /* History Mode */
                <div className="flex-1 overflow-y-auto px-4 pb-8">
                    <div className="max-w-md mx-auto pt-4">
                        {Object.entries(groupedTodos).map(([date, todo]) => (
                            <div key={date} className="mb-8">
                                <div
                                    className="sticky top-0 bg-bg-primary/95 backdrop-blur py-3 border-b border-bg-tertiary mb-4"
                                    style={{ zIndex: 10 }}
                                >
                                    <h2 className="text-text-secondary text-sm font-bold">
                                        {getDateLabel(date)}
                                    </h2>
                                </div>
                                <div className="space-y-1">
                                    {parseTodos(todo.content).map((item, idx) => (
                                        <div
                                            key={idx}
                                            className="flex items-start gap-2 py-1"
                                            style={{ paddingLeft: `${item.indent * 24}px` }}
                                        >
                                            <input
                                                type="checkbox"
                                                checked={item.checked}
                                                onChange={() => toggleHistoryCheckbox(date, item.lineIndex)}
                                                className="mt-1 w-4 h-4 rounded border-text-secondary focus:ring-accent focus:ring-2 cursor-pointer"
                                            />
                                            <span className={`flex-1 leading-relaxed ${item.checked ? 'line-through text-text-secondary' : 'text-text-primary'}`}>
                                                {renderText(item.text)}
                                            </span>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        ))}
                        {historyTodos.length === 0 && (
                            <div className="text-center text-text-secondary mt-20">
                                <p>최근 30일간 작성된 투두가 없습니다.</p>
                            </div>
                        )}
                    </div>
                </div>
            ) : viewMode === 'matrix' ? (
                /* Matrix Mode */
                <div className="flex-1 flex flex-col p-4 overflow-y-auto" style={{ WebkitOverflowScrolling: 'touch' }}>
                    <DndContext
                        sensors={sensors}
                        collisionDetection={closestCenter}
                        onDragStart={onDragStart}
                        onDragEnd={onDragEnd}
                    >
                        <div className="flex-1 grid grid-cols-2 grid-rows-2 gap-3 mb-4">
                            <Quadrant
                                id="q1"
                                title={quadrantConfig.q1.title}
                                label={quadrantConfig.q1.label}
                                color={quadrantConfig.q1.color}
                                items={todos.filter(t => t.quadrant === 'q1')}
                            />
                            <Quadrant
                                id="q2"
                                title={quadrantConfig.q2.title}
                                label={quadrantConfig.q2.label}
                                color={quadrantConfig.q2.color}
                                items={todos.filter(t => t.quadrant === 'q2')}
                            />
                            <Quadrant
                                id="q3"
                                title={quadrantConfig.q3.title}
                                label={quadrantConfig.q3.label}
                                color={quadrantConfig.q3.color}
                                items={todos.filter(t => t.quadrant === 'q3')}
                            />
                            <Quadrant
                                id="q4"
                                title={quadrantConfig.q4.title}
                                label={quadrantConfig.q4.label}
                                color={quadrantConfig.q4.color}
                                items={todos.filter(t => t.quadrant === 'q4')}
                            />
                        </div>

                        {/* Inbox / Unassigned */}
                        <div className="h-1/4">
                            <DroppableInbox items={todos.filter(t => t.quadrant === 'inbox')} />
                        </div>

                        <DragOverlay adjustScale={true}>
                            {activeId && todos.find(t => t.lineIndex.toString() === activeId) ? (
                                <MatrixItemUI
                                    item={todos.find(t => t.lineIndex.toString() === activeId)!}
                                    isOverlay
                                />
                            ) : null}
                        </DragOverlay>
                    </DndContext>

                    <div className="mt-4 text-[10px] text-text-tertiary text-center">
                        할 일을 드래그하여 우선순위를 분류하세요. 자동으로 저장됩니다.
                    </div>
                </div>
            ) : (
                /* Edit Mode & Template Mode */
                <div className="w-full max-w-md mx-auto relative flex flex-col flex-1 overflow-hidden">
                    {/* Saving Indicator */}
                    <div className="absolute top-4 right-16 z-30 flex items-center gap-2 pointer-events-none">
                        <span className={`text-xs font-medium transition-opacity duration-300 ${isSaving ? 'text-accent opacity-100' : 'opacity-0'}`}>
                            저장 중...
                        </span>
                        {!isSaving && lastSaved && (
                            <span className="text-xs text-text-tertiary transition-opacity duration-500 opacity-100">
                                저장됨
                            </span>
                        )}
                    </div>

                    {/* Toggle Button (Only for Edit Mode) */}
                    {viewMode === 'edit' && (
                        <button
                            onClick={() => setIsEditing(!isEditing)}
                            className="absolute top-4 right-4 z-30 p-2 bg-bg-secondary rounded-full text-text-secondary hover:text-accent transition-colors"
                            title={isEditing ? "완료" : "편집"}
                        >
                            {isEditing ? <Check size={20} /> : <Edit3 size={20} />}
                        </button>
                    )}

                    {/* Template Mode Indicator */}
                    {viewMode === 'template' && (
                        <div className="absolute top-4 right-4 z-30 px-3 py-1 bg-accent/10 text-accent text-xs font-bold rounded-full border border-accent/20">
                            매일 반복되는 루틴을 입력하세요
                        </div>
                    )}

                    {isEditing || viewMode === 'template' ? (
                        <>
                            {/* Editor */}
                            <textarea
                                ref={textareaRef}
                                value={content}
                                onChange={handleChange}
                                onKeyDown={handleKeyDown}
                                placeholder={viewMode === 'template' ? "매일 반복할 루틴을 입력하세요..." : placeholder}
                                className="flex-1 w-full bg-transparent text-text-primary p-4 pt-16 pb-8 resize-none focus:outline-none font-mono text-sm leading-relaxed overflow-y-auto"
                                spellCheck={false}
                            />

                            {/* Mobile Toolbar */}
                            <div className="fixed bottom-0 left-0 right-0 bg-bg-secondary border-t border-bg-tertiary p-2 flex items-center justify-around z-20 max-w-md mx-auto">
                                <button onClick={() => insertText('- [ ] ')} className="p-2 text-text-secondary hover:text-accent" title="Checklist">
                                    <Square size={20} />
                                </button>
                                <button onClick={() => insertText('- [x] ')} className="p-2 text-text-secondary hover:text-accent" title="Completed">
                                    <CheckSquare size={20} />
                                </button>
                                <button onClick={() => insertText('==', -2)} className="p-2 text-text-secondary hover:text-accent" title="Highlight">
                                    <Highlighter size={20} />
                                </button>
                                <button onClick={() => insertText('**', -2)} className="p-2 text-text-secondary hover:text-accent" title="Bold">
                                    <Bold size={20} />
                                </button>
                                <button onClick={() => handleIndent('out')} className="p-2 text-text-secondary hover:text-accent" title="Outdent">
                                    <ArrowLeft size={20} />
                                </button>
                                <button onClick={() => handleIndent('in')} className="p-2 text-text-secondary hover:text-accent" title="Indent">
                                    <ArrowRight size={20} />
                                </button>
                            </div>
                        </>
                    ) : (
                        <>
                            {/* Reading Mode (Only for Edit Mode) */}
                            <div className="flex-1 overflow-y-auto p-4 pt-16 pb-20 w-full">
                                {/* Progress Bar */}
                                {todos.length > 0 && (() => {
                                    const completed = todos.filter(t => t.checked).length;
                                    const total = todos.length;
                                    const percentage = calculateTotalWeightedRate(todos);
                                    const levelInfo = getLevelInfo(percentage);
                                    const message = getEncouragementMessage(percentage);
                                    const progressColor = getProgressColor(percentage);

                                    // Stats - using memoized values
                                    const realLevel = getRealLevel(totalCompleted);

                                    return (
                                        <div className={`mb-6 p-4 bg-bg-secondary rounded-xl border border-bg-tertiary ${percentage >= 100 ? 'animate-pulse' : ''}`}>
                                            {/* Real Level (Cumulative) */}
                                            <div className="flex items-center justify-between mb-3 pb-3 border-b border-bg-tertiary">
                                                <div className="flex items-center gap-2">
                                                    <span className="text-base font-bold text-text-primary">
                                                        Lv.{realLevel.level} {realLevel.title}
                                                    </span>
                                                </div>
                                                <span className="text-xs text-text-tertiary">
                                                    {totalCompleted}/{realLevel.nextLevelAt} 완료
                                                </span>
                                            </div>

                                            {/* Today's Progress */}
                                            <div className="flex items-center justify-between mb-2">
                                                <span className="text-sm text-text-secondary">
                                                    오늘의 {levelInfo.title}
                                                </span>
                                                <span className="text-sm text-text-secondary">
                                                    {percentage}% ({completed}/{total})
                                                </span>
                                            </div>

                                            {/* Progress Bar */}
                                            <div className="h-3 bg-bg-tertiary rounded-full overflow-hidden mb-3">
                                                <div
                                                    className={`h-full ${progressColor} transition-all duration-500 ease-out rounded-full`}
                                                    style={{ width: `${percentage}%` }}
                                                />
                                            </div>

                                            {/* Weekly Stats */}
                                            <div className="flex items-center justify-between text-xs text-text-tertiary mb-2">
                                                <span>이번 주: {weeklyStats.thisWeek.avgPercentage}% ({weeklyStats.thisWeek.totalCompleted}개)</span>
                                                <span>지난 주: {weeklyStats.lastWeek.avgPercentage}%</span>
                                            </div>

                                            {/* Encouragement Message */}
                                            <p className="text-xs text-text-secondary text-center pt-2 border-t border-bg-tertiary">
                                                {message}
                                            </p>
                                        </div>
                                    );
                                })()}

                                {todos.length === 0 ? (
                                    <p className="text-text-secondary text-sm">할 일이 없습니다. 편집 버튼을 눌러 추가하세요.</p>
                                ) : (
                                    <div className="space-y-2">
                                        {todos.map((item, idx) => (
                                            <div
                                                key={idx}
                                                className="flex items-start gap-2 py-1"
                                                style={{ paddingLeft: `${item.indent * 24}px` }}
                                            >
                                                <input
                                                    type="checkbox"
                                                    checked={item.checked}
                                                    onChange={() => toggleCheckbox(item.lineIndex)}
                                                    className="mt-1 w-4 h-4 rounded border-text-secondary focus:ring-accent focus:ring-2"
                                                />
                                                <span className={`flex-1 leading-relaxed ${item.checked ? 'line-through text-text-secondary' : 'text-text-primary'}`}>
                                                    {renderText(item.text)}
                                                </span>
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </div>
                        </>
                    )}
                </div>
            )}
        </div>
    );
};

export default TodoTab;
