import React, { useState, useEffect } from 'react';
import { useAuth } from './AuthContext';
import { getActiveWorries, createWorry, closeWorry, deleteWorry } from '../services/firestore';
import type { Worry, WorryReflection } from '../types/types';
import WorrySection from './WorrySection';
import WorryCloseModal from './WorryCloseModal';
import { Plus } from 'lucide-react';

const WorryTab: React.FC = () => {
    const { user } = useAuth();
    const [activeWorries, setActiveWorries] = useState<Worry[]>([]);
    const [loading, setLoading] = useState(true);
    const [worryToClose, setWorryToClose] = useState<Worry | null>(null);

    // Creation state
    const [isCreating, setIsCreating] = useState(false);
    const [newTitle, setNewTitle] = useState('');

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
        } catch (error) {
            console.error("Failed to close worry:", error);
            alert("고민 마무리 중 오류가 발생했습니다.");
        }
    }

    if (loading) return <div className="p-4 text-center text-text-secondary">Loading...</div>;

    return (
        <div className="flex flex-col h-full max-w-md mx-auto pb-24">
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
                    activeWorries.map(worry => (
                        <WorrySection
                            key={worry.id}
                            worry={worry}
                            onDeleteWorry={handleDeleteWorry}
                            onCloseWorry={setWorryToClose}
                        />
                    ))
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
        </div>
    );
};

export default WorryTab;
