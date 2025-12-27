import React, { useState, useEffect } from 'react';
import { differenceInWeeks, startOfDay } from 'date-fns';
import {
    DndContext,
    closestCenter,
    KeyboardSensor,
    PointerSensor,
    TouchSensor,
    useSensor,
    useSensors,
} from '@dnd-kit/core';
import type { DragEndEvent } from '@dnd-kit/core';
import {
    arrayMove,
    SortableContext,
    sortableKeyboardCoordinates,
    verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import { useAuth } from './AuthContext';
import { getActiveWorries, createWorry, closeWorry, deleteWorry, getWorryEntries, addWorryEntry, updateWorryEntry, deleteWorryEntry, updateWorryOrders } from '../services/firestore';
import type { Worry, WorryReflection, WorryEntry } from '../types/types';
import WorrySection from './WorrySection';
import WorryCloseModal from './WorryCloseModal';
import WorryInput from './WorryInput';
import { Plus } from 'lucide-react';

const WorryTab: React.FC = () => {
    const { user } = useAuth();
    const [activeWorries, setActiveWorries] = useState<Worry[]>([]);
    const [loading, setLoading] = useState(true);
    const [worryToClose, setWorryToClose] = useState<Worry | null>(null);

    // Creation state
    const [isCreating, setIsCreating] = useState(false);
    const [newTitle, setNewTitle] = useState('');

    // Expansion and entries state
    const [expandedWorryId, setExpandedWorryId] = useState<string | null>(null);
    const [entries, setEntries] = useState<WorryEntry[]>([]);
    const [replyingToId, setReplyingToId] = useState<string | null>(null);
    const [replyType, setReplyType] = useState<'action' | 'result'>('action');

    useEffect(() => {
        if (user) {
            loadActiveWorries();
        }
    }, [user]);

    // Load entries when expanded worry changes
    useEffect(() => {
        if (user && expandedWorryId) {
            loadEntries(expandedWorryId);
        } else {
            setEntries([]);
        }
        // Clear reply state when switching worries
        setReplyingToId(null);
    }, [user, expandedWorryId]);

    const loadEntries = async (worryId: string) => {
        if (!user) return;
        try {
            const fetchedEntries = await getWorryEntries(user.uid, worryId);
            setEntries(fetchedEntries);
        } catch (error) {
            console.error("Failed to load entries:", error);
        }
    };

    const loadActiveWorries = async () => {
        if (!user) return;
        try {
            const worries = await getActiveWorries(user.uid);
            setActiveWorries(worries);
        } catch (error) {
            console.error("Failed to load active worries:", error);
        } finally {
            setLoading(false);
        }
    };

    const handleCreateWorry = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!user || !newTitle.trim()) return;
        try {
            await createWorry(user.uid, newTitle);
            await loadActiveWorries();
            setNewTitle('');
            setIsCreating(false);
        } catch (error) {
            console.error("Failed to create worry:", error);
            alert("고민 생성 중 오류가 발생했습니다.");
        }
    };

    const handleDeleteWorry = async (worryId: string) => {
        if (!user) return;
        try {
            await deleteWorry(user.uid, worryId);
            await loadActiveWorries();
        } catch (error) {
            console.error("Failed to delete worry:", error);
            alert("고민 삭제 중 오류가 발생했습니다.");
        }
    };

    const handleCloseWorry = async (reflection: WorryReflection) => {
        if (!user || !worryToClose) return;
        try {
            await closeWorry(user.uid, worryToClose.id, reflection);
            await loadActiveWorries();
            setWorryToClose(null);
            if (expandedWorryId === worryToClose.id) {
                setExpandedWorryId(null);
            }
        } catch (error) {
            console.error("Failed to close worry:", error);
            alert("고민 마무리 중 오류가 발생했습니다.");
        }
    };

    // Entry handlers
    const calculateWeek = (startDate: Date): number => {
        const today = startOfDay(new Date());
        const start = startOfDay(startDate);
        const diffWeeks = differenceInWeeks(today, start);
        return diffWeeks + 1;
    };

    const handleAddEntry = async (entryData: { type: 'worry' | 'action' | 'result', content: string, week: number, parentId?: string }) => {
        if (!user || !expandedWorryId) return;
        try {
            await addWorryEntry(user.uid, expandedWorryId, entryData.type, entryData.content, entryData.week, entryData.parentId);
            await loadEntries(expandedWorryId);
        } catch (error) {
            console.error("Failed to add entry:", error);
            alert("기록 저장 중 오류가 발생했습니다.");
        }
    };

    const handleAddEntryWithContent = async (type: 'action' | 'result', content: string, parentId: string) => {
        const expandedWorry = activeWorries.find(w => w.id === expandedWorryId);
        if (!expandedWorry) return;
        const week = calculateWeek(expandedWorry.startDate);
        await handleAddEntry({ type, content, week, parentId });
    };

    const handleUpdateEntry = async (entryId: string, content: string) => {
        if (!user) return;
        try {
            await updateWorryEntry(user.uid, entryId, content);
            if (expandedWorryId) await loadEntries(expandedWorryId);
        } catch (error) {
            console.error('Error updating entry:', error);
            alert("수정 중 오류가 발생했습니다.");
        }
    };

    const handleDeleteEntry = async (entryId: string) => {
        if (!user) return;
        try {
            await deleteWorryEntry(user.uid, entryId);
            if (expandedWorryId) await loadEntries(expandedWorryId);
        } catch (error) {
            console.error('Error deleting entry:', error);
            alert("삭제 중 오류가 발생했습니다.");
        }
    };

    const handleReplyRequest = (entryId: string, type: 'action' | 'result') => {
        setReplyingToId(entryId);
        setReplyType(type);
    };

    const handleToggleExpand = (worryId: string) => {
        setExpandedWorryId(prev => prev === worryId ? null : worryId);
    };

    // Drag and drop sensors
    const sensors = useSensors(
        useSensor(PointerSensor, {
            activationConstraint: {
                distance: 5, // Reduced for better responsiveness
            },
        }),
        useSensor(TouchSensor, {
            activationConstraint: {
                delay: 100, // Shorter delay for faster touch response
                tolerance: 10, // More tolerance for touch movement
            },
        }),
        useSensor(KeyboardSensor, {
            coordinateGetter: sortableKeyboardCoordinates,
        })
    );

    const handleDragEnd = async (event: DragEndEvent) => {
        const { active, over } = event;

        if (over && active.id !== over.id) {
            const oldIndex = activeWorries.findIndex(w => w.id === active.id);
            const newIndex = activeWorries.findIndex(w => w.id === over.id);

            // Optimistic update
            const newWorries = arrayMove(activeWorries, oldIndex, newIndex);
            setActiveWorries(newWorries);

            // Calculate new orders and persist
            const orderUpdates = newWorries.map((worry, index) => ({
                id: worry.id,
                order: index + 1,
            }));

            try {
                await updateWorryOrders(user!.uid, orderUpdates);
            } catch (error) {
                console.error('Failed to update worry orders:', error);
                // Revert on error
                await loadActiveWorries();
            }
        }
    };

    // Get expanded worry for WorryInput
    const expandedWorry = activeWorries.find(w => w.id === expandedWorryId);

    if (loading) return <div className="p-4 text-center text-text-secondary">Loading...</div>;

    return (
        <div className="flex flex-col h-full max-w-md mx-auto pb-48">
            <div className="p-4 bg-bg-secondary border-b border-bg-tertiary mb-4">
                <div className="flex items-center justify-between mb-4">
                    <h2 className="text-lg font-bold text-text-primary">진행 중인 고민</h2>
                    <button
                        onClick={() => setIsCreating(true)}
                        className="p-1.5 bg-bg-tertiary text-text-primary rounded-full hover:bg-bg-primary transition-colors"
                    >
                        <Plus size={16} />
                    </button>
                </div>

                {isCreating && (
                    <form onSubmit={handleCreateWorry} className="mb-2">
                        <div className="flex gap-2">
                            <input
                                type="text"
                                value={newTitle}
                                onChange={(e) => setNewTitle(e.target.value)}
                                placeholder="새로운 고민을 입력하세요"
                                className="flex-1 px-3 py-2 bg-bg-primary border border-bg-tertiary rounded-lg text-text-primary text-sm focus:outline-none focus:border-purple-500"
                                autoFocus
                            />
                            <button
                                type="submit"
                                className="px-3 py-2 bg-purple-600 text-white rounded-lg text-sm font-medium hover:bg-purple-700"
                            >
                                시작
                            </button>
                            <button
                                type="button"
                                onClick={() => setIsCreating(false)}
                                className="px-3 py-2 bg-bg-tertiary text-text-secondary rounded-lg text-sm hover:text-text-primary"
                            >
                                취소
                            </button>
                        </div>
                    </form>
                )}
            </div>

            <div className="flex-1 overflow-y-auto px-4 scrollbar-hide">
                {activeWorries.length === 0 ? (
                    <div className="flex flex-col items-center justify-center h-64 text-text-secondary">
                        <p>진행 중인 고민이 없습니다.</p>
                        <p className="mt-1">새로운 고민을 등록해보세요.</p>
                    </div>
                ) : (
                    <DndContext
                        sensors={sensors}
                        collisionDetection={closestCenter}
                        onDragEnd={handleDragEnd}
                    >
                        <SortableContext
                            items={activeWorries.map(w => w.id)}
                            strategy={verticalListSortingStrategy}
                        >
                            {activeWorries.map(worry => (
                                <WorrySection
                                    key={worry.id}
                                    worry={worry}
                                    entries={worry.id === expandedWorryId ? entries : []}
                                    isExpanded={worry.id === expandedWorryId}
                                    onToggleExpand={handleToggleExpand}
                                    onDeleteWorry={handleDeleteWorry}
                                    onCloseWorry={setWorryToClose}
                                    onUpdateEntry={handleUpdateEntry}
                                    onDeleteEntry={handleDeleteEntry}
                                    onReplyRequest={handleReplyRequest}
                                    onAddEntryWithContent={handleAddEntryWithContent}
                                />
                            ))}
                        </SortableContext>
                    </DndContext>
                )}
            </div>

            {worryToClose && (
                <WorryCloseModal
                    worry={worryToClose}
                    isOpen={!!worryToClose}
                    onClose={() => setWorryToClose(null)}
                    onSubmit={handleCloseWorry}
                />
            )}

            {expandedWorry && (
                <WorryInput
                    activeWorryId={expandedWorry.id}
                    worryStartDate={expandedWorry.startDate}
                    worryTitle={expandedWorry.title}
                    replyingToId={replyingToId}
                    replyType={replyType}
                    onCancelReply={() => setReplyingToId(null)}
                    onSubmit={handleAddEntry}
                    isEmbedded={false}
                />
            )}
        </div>
    );
};

export default WorryTab;
