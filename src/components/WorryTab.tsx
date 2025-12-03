import React, { useState, useEffect } from 'react';
import { useAuth } from './AuthContext';
import { getActiveWorries, getWorryEntries, createWorry, addWorryEntry, closeWorry, deleteWorryEntry, updateWorryEntry, deleteWorry } from '../services/firestore';
import type { Worry, WorryEntry, WorryReflection } from '../types/types';
import WorrySelector from './WorrySelector';
import WorryInput from './WorryInput';
import WorryTimeline from './WorryTimeline';
import WorryCloseModal from './WorryCloseModal';

const WorryTab: React.FC = () => {
    const { user } = useAuth();
    const [activeWorries, setActiveWorries] = useState<Worry[]>([]);
    const [selectedWorryId, setSelectedWorryId] = useState<string | null>(null);
    const [entries, setEntries] = useState<WorryEntry[]>([]);
    const [loading, setLoading] = useState(true);
    const [isCloseModalOpen, setIsCloseModalOpen] = useState(false);

    useEffect(() => {
        if (user) {
            loadActiveWorries();
        }
    }, [user]);

    const loadActiveWorries = async () => {
        if (!user) return;
        try {
            const worries = await getActiveWorries(user.uid);
            setActiveWorries(worries);

            // If there's a selected worry, reload its entries
            if (selectedWorryId) {
                const stillExists = worries.find(w => w.id === selectedWorryId);
                if (stillExists) {
                    loadEntries(selectedWorryId);
                } else {
                    setSelectedWorryId(null);
                    setEntries([]);
                }
            }
        } catch (error) {
            console.error("Failed to load active worries:", error);
        } finally {
            setLoading(false);
        }
    };

    const loadEntries = async (worryId: string) => {
        if (!user) return;
        try {
            const fetchedEntries = await getWorryEntries(user.uid, worryId);
            setEntries(fetchedEntries);
        } catch (error) {
            console.error("Failed to load entries:", error);
        }
    };

    const handleCreateWorry = async (title: string) => {
        if (!user) return;
        try {
            const newWorryId = await createWorry(user.uid, title);
            await loadActiveWorries();
            // Automatically select the new worry
            setSelectedWorryId(newWorryId);
            setEntries([]);
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
            if (selectedWorryId === worryId) {
                setSelectedWorryId(null);
                setEntries([]);
            }
        } catch (error) {
            console.error("Failed to delete worry:", error);
            alert("고민 삭제 중 오류가 발생했습니다.");
        }
    };

    const handleAddEntry = async (entryData: { type: 'worry' | 'action' | 'result', content: string, week: number }) => {
        if (!user || !selectedWorryId) return;
        try {
            await addWorryEntry(user.uid, selectedWorryId, entryData.type, entryData.content, entryData.week);
            await loadEntries(selectedWorryId);
        } catch (error) {
            console.error("Failed to add entry:", error);
            alert("기록 저장 중 오류가 발생했습니다.");
        }
    };

    const handleUpdateEntry = async (entryId: string, content: string) => {
        if (!user) return;
        try {
            await updateWorryEntry(user.uid, entryId, content);
            if (selectedWorryId) {
                await loadEntries(selectedWorryId);
            }
        } catch (error) {
            console.error('Error updating entry:', error);
            alert("수정 중 오류가 발생했습니다.");
        }
    };

    const handleDeleteEntry = async (entryId: string) => {
        if (!user) return;
        try {
            await deleteWorryEntry(user.uid, entryId);
            if (selectedWorryId) {
                await loadEntries(selectedWorryId);
            }
        } catch (error) {
            console.error('Error deleting entry:', error);
            alert("삭제 중 오류가 발생했습니다.");
        }
    };

    const handleCloseWorry = async (reflection: WorryReflection) => {
        if (!user || !selectedWorryId) return;
        try {
            await closeWorry(user.uid, selectedWorryId, reflection);
            await loadActiveWorries();
            setSelectedWorryId(null);
            setEntries([]);
            setIsCloseModalOpen(false);
        } catch (error) {
            console.error("Failed to close worry:", error);
            alert("고민 마무리 중 오류가 발생했습니다.");
        }
    }

    const activeWorry = activeWorries.find(w => w.id === selectedWorryId);

    if (loading) return <div className="p-4 text-center text-text-secondary">Loading...</div>;

    return (
        <div className="flex flex-col h-full max-w-md mx-auto pb-56">
            <WorrySelector
                activeWorries={activeWorries}
                selectedWorryId={selectedWorryId}
                onSelectWorry={(id) => {
                    setSelectedWorryId(id);
                    if (id) loadEntries(id);
                    else setEntries([]);
                }}
                onCreateNew={handleCreateWorry}
                onDeleteWorry={handleDeleteWorry}
                onClose={() => setIsCloseModalOpen(true)}
            />

            <div className="flex-1 overflow-y-auto px-4 py-2 scrollbar-hide">
                {selectedWorryId ? (
                    <WorryTimeline
                        entries={entries}
                        onUpdate={handleUpdateEntry}
                        onDelete={handleDeleteEntry}
                    />
                ) : (
                    <div className="flex flex-col items-center justify-center h-64 text-text-secondary">
                        <p>고민을 선택하거나 새로운 고민을 시작하세요.</p>
                    </div>
                )}
            </div>

            {selectedWorryId && (
                <WorryInput
                    activeWorryId={selectedWorryId}
                    worryStartDate={activeWorry?.startDate || null}
                    onSubmit={handleAddEntry}
                />
            )}

            {activeWorry && (
                <WorryCloseModal
                    worry={activeWorry}
                    isOpen={isCloseModalOpen}
                    onClose={() => setIsCloseModalOpen(false)}
                    onSubmit={handleCloseWorry}
                />
            )}
        </div>
    );
};

export default WorryTab;
