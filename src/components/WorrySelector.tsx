import React, { useState } from 'react';
import type { Worry } from '../types/types';
import { Plus, ChevronRight, ArrowLeft, Trash2 } from 'lucide-react';
import { format } from 'date-fns';

interface WorrySelectorProps {
    activeWorries: Worry[];
    selectedWorryId: string | null;
    onSelectWorry: (id: string | null) => void;
    onCreateNew: (title: string) => void;
    onDeleteWorry: (id: string) => void;
    onClose: () => void;
}

const WorrySelector: React.FC<WorrySelectorProps> = ({
    activeWorries,
    selectedWorryId,
    onSelectWorry,
    onCreateNew,
    onDeleteWorry,
    onClose
}) => {
    const [isCreating, setIsCreating] = useState(false);
    const [newTitle, setNewTitle] = useState('');
    const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        if (newTitle.trim()) {
            onCreateNew(newTitle);
            setNewTitle('');
            setIsCreating(false);
        }
    };

    const handleDeleteClick = (e: React.MouseEvent, id: string) => {
        e.stopPropagation();
        setDeleteConfirmId(id);
    };

    const handleConfirmDelete = () => {
        if (deleteConfirmId) {
            onDeleteWorry(deleteConfirmId);
            setDeleteConfirmId(null);
        }
    };

    const selectedWorry = activeWorries.find(w => w.id === selectedWorryId);

    if (selectedWorryId && selectedWorry) {
        return (
            <div className="p-4 bg-bg-secondary border-b border-bg-tertiary">
                <div className="flex items-center justify-between mb-2">
                    <button
                        onClick={() => onSelectWorry(null)}
                        className="text-text-secondary hover:text-text-primary flex items-center gap-1 text-sm"
                    >
                        <ArrowLeft size={16} />
                        목록으로
                    </button>
                    <button
                        onClick={onClose}
                        className="px-3 py-1 text-xs bg-bg-tertiary text-text-secondary rounded-full hover:bg-red-900/20 hover:text-red-400 transition-colors"
                    >
                        고민 마무리하기
                    </button>
                </div>
                <h2 className="text-xl font-bold text-text-primary">{selectedWorry.title}</h2>
                <p className="text-xs text-text-secondary mt-1">
                    {format(selectedWorry.startDate, 'yyyy.MM.dd')} 시작
                </p>
            </div>
        );
    }

    return (
        <div className="p-4 bg-bg-secondary border-b border-bg-tertiary">
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
                <form onSubmit={handleSubmit} className="mb-4">
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

            <div className="space-y-2">
                {activeWorries.length === 0 && !isCreating ? (
                    <div className="text-center py-8 text-text-secondary text-sm">
                        <p>진행 중인 고민이 없습니다.</p>
                        <p className="mt-1">새로운 고민을 등록해보세요.</p>
                    </div>
                ) : (
                    activeWorries.map(worry => (
                        <div
                            key={worry.id}
                            onClick={() => onSelectWorry(worry.id)}
                            className="w-full p-3 bg-bg-primary border border-bg-tertiary rounded-lg flex items-center justify-between hover:border-purple-500/50 transition-colors group cursor-pointer"
                        >
                            <div className="text-left">
                                <h3 className="text-text-primary font-medium text-sm">{worry.title}</h3>
                                <p className="text-xs text-text-secondary mt-0.5">
                                    {format(worry.startDate, 'yyyy.MM.dd')}
                                </p>
                            </div>
                            <div className="flex items-center gap-2">
                                <button
                                    onClick={(e) => handleDeleteClick(e, worry.id)}
                                    className="p-1.5 text-text-secondary hover:text-red-400 hover:bg-red-900/20 rounded-full transition-colors opacity-0 group-hover:opacity-100"
                                    title="고민 삭제"
                                >
                                    <Trash2 size={14} />
                                </button>
                                <ChevronRight size={16} className="text-text-secondary group-hover:text-purple-500" />
                            </div>
                        </div>
                    ))
                )}
            </div>

            {/* Delete Confirmation Modal */}
            {deleteConfirmId && (
                <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
                    <div className="bg-bg-secondary rounded-xl p-6 max-w-xs w-full border border-bg-tertiary shadow-xl">
                        <h3 className="text-lg font-bold text-text-primary mb-2">고민 삭제</h3>
                        <p className="text-text-secondary text-sm mb-6">
                            이 고민과 관련된 모든 기록이 영구적으로 삭제됩니다. 계속하시겠습니까?
                        </p>
                        <div className="flex gap-2">
                            <button
                                onClick={() => setDeleteConfirmId(null)}
                                className="flex-1 py-2 px-4 bg-bg-tertiary text-text-primary rounded-lg hover:bg-bg-primary text-sm"
                            >
                                취소
                            </button>
                            <button
                                onClick={handleConfirmDelete}
                                className="flex-1 py-2 px-4 bg-red-600 text-white rounded-lg hover:bg-red-700 text-sm"
                            >
                                삭제
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default WorrySelector;
