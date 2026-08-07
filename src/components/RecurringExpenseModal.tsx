import React, { useState, useEffect } from 'react';
import { X, Plus, Trash2, Repeat } from 'lucide-react';
import type { ExpenseCategory, RecurringExpense } from '../types/types';
import { EXPENSE_CATEGORIES, EXPENSE_CATEGORY_EMOJI } from '../types/types';
import {
    getRecurringExpenses, addRecurringExpense, updateRecurringExpense, deleteRecurringExpense,
} from '../services/firestore';
import { useAuth } from './AuthContext';

interface RecurringExpenseModalProps {
    onClose: () => void;
}

const RecurringExpenseModal: React.FC<RecurringExpenseModalProps> = ({ onClose }) => {
    const { user } = useAuth();
    const [rules, setRules] = useState<RecurringExpense[]>([]);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [deletingId, setDeletingId] = useState<string | null>(null);

    const [description, setDescription] = useState('');
    const [amount, setAmount] = useState('');
    const [category, setCategory] = useState<ExpenseCategory>('기타');
    const [dayOfMonth, setDayOfMonth] = useState('1');

    const load = async () => {
        if (!user) return;
        try {
            setRules(await getRecurringExpenses(user.uid));
        } catch (e) {
            console.error('Failed to load recurring expenses:', e);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => { load(); }, [user]);

    const parsedAmount = parseInt(amount.replace(/[^\d-]/g, ''), 10);
    const parsedDay = parseInt(dayOfMonth, 10);
    const canSave = description.trim().length > 0
        && !isNaN(parsedAmount) && parsedAmount !== 0
        && !isNaN(parsedDay) && parsedDay >= 1 && parsedDay <= 31;

    const handleAdd = async () => {
        if (!user || !canSave || saving) return;
        setSaving(true);
        try {
            await addRecurringExpense(user.uid, {
                description: description.trim(),
                amount: parsedAmount,
                category,
                dayOfMonth: parsedDay,
            });
            setDescription('');
            setAmount('');
            setDayOfMonth('1');
            setCategory('기타');
            await load();
        } catch (e) {
            console.error('Failed to add recurring expense:', e);
        } finally {
            setSaving(false);
        }
    };

    const handleToggle = async (rule: RecurringExpense) => {
        if (!user) return;
        setRules(prev => prev.map(r => r.id === rule.id ? { ...r, active: !r.active } : r));
        try {
            await updateRecurringExpense(user.uid, rule.id, { active: !rule.active });
        } catch (e) {
            console.error('Failed to toggle recurring expense:', e);
            await load();
        }
    };

    const handleDelete = async (id: string) => {
        if (!user) return;
        try {
            await deleteRecurringExpense(user.uid, id);
            setRules(prev => prev.filter(r => r.id !== id));
        } catch (e) {
            console.error('Failed to delete recurring expense:', e);
        } finally {
            setDeletingId(null);
        }
    };

    return (
        <div className="fixed inset-0 bg-black/60 z-[100] flex items-end sm:items-center justify-center" onClick={onClose}>
            <div
                className="bg-bg-secondary w-full sm:max-w-md rounded-t-2xl sm:rounded-2xl max-h-[85vh] flex flex-col"
                onClick={e => e.stopPropagation()}
            >
                {/* 헤더 */}
                <div className="flex items-center justify-between px-4 py-3 border-b border-bg-tertiary shrink-0">
                    <div className="flex items-center gap-2">
                        <Repeat size={16} className="text-accent" />
                        <h2 className="text-sm font-semibold text-text-primary">반복 지출</h2>
                    </div>
                    <button onClick={onClose} className="p-1 text-text-tertiary hover:text-text-primary transition-colors">
                        <X size={18} />
                    </button>
                </div>

                <div className="overflow-y-auto px-4 py-3">
                    <p className="text-[11px] text-text-tertiary mb-4 leading-relaxed">
                        구독료처럼 매달 나가는 지출을 등록해 두면, 지정한 날짜가 지난 뒤 앱을 열 때
                        이번 달 지출로 한 번만 자동 입력됩니다.
                    </p>

                    {/* 등록 폼 */}
                    <div className="bg-bg-primary rounded-lg p-3 mb-4 space-y-2">
                        <input
                            type="text"
                            value={description}
                            onChange={e => setDescription(e.target.value)}
                            placeholder="내역 (예: Claude 구독료)"
                            className="w-full bg-bg-tertiary text-text-primary text-base rounded-md px-3 py-2 outline-none focus:ring-1 focus:ring-accent placeholder:text-text-tertiary"
                        />
                        <div className="flex gap-2">
                            <input
                                type="text"
                                inputMode="numeric"
                                value={amount}
                                onChange={e => setAmount(e.target.value)}
                                placeholder="금액"
                                className="flex-1 min-w-0 bg-bg-tertiary text-text-primary text-base rounded-md px-3 py-2 outline-none focus:ring-1 focus:ring-accent placeholder:text-text-tertiary tabular-nums"
                            />
                            <div className="flex items-center gap-1 bg-bg-tertiary rounded-md px-2 shrink-0">
                                <span className="text-xs text-text-tertiary">매달</span>
                                <input
                                    type="text"
                                    inputMode="numeric"
                                    value={dayOfMonth}
                                    onChange={e => setDayOfMonth(e.target.value)}
                                    className="w-8 bg-transparent text-text-primary text-base text-center outline-none tabular-nums"
                                />
                                <span className="text-xs text-text-tertiary">일</span>
                            </div>
                        </div>
                        <select
                            value={category}
                            onChange={e => setCategory(e.target.value as ExpenseCategory)}
                            className="w-full bg-bg-tertiary text-text-primary text-sm rounded-md px-3 py-2 outline-none focus:ring-1 focus:ring-accent"
                        >
                            {EXPENSE_CATEGORIES.map(c => (
                                <option key={c} value={c}>{EXPENSE_CATEGORY_EMOJI[c]} {c}</option>
                            ))}
                        </select>
                        <button
                            onClick={handleAdd}
                            disabled={!canSave || saving}
                            className="w-full flex items-center justify-center gap-1 bg-accent text-white text-sm font-medium rounded-md py-2 transition-colors hover:bg-accent-hover disabled:opacity-30"
                        >
                            <Plus size={15} /> 등록
                        </button>
                    </div>

                    {/* 등록된 목록 */}
                    {loading ? (
                        <div className="text-center text-text-tertiary text-sm py-6">불러오는 중…</div>
                    ) : rules.length === 0 ? (
                        <div className="text-center text-text-tertiary text-sm py-6">등록된 반복 지출이 없습니다.</div>
                    ) : (
                        <div className="space-y-1.5">
                            {rules.map(rule => (
                                <div
                                    key={rule.id}
                                    className={`flex items-center gap-2 bg-bg-primary rounded-lg px-3 py-2.5 ${rule.active ? '' : 'opacity-45'}`}
                                >
                                    <span className="text-lg shrink-0">{EXPENSE_CATEGORY_EMOJI[rule.category]}</span>
                                    <div className="min-w-0 flex-1">
                                        <div className="text-sm text-text-primary truncate">{rule.description}</div>
                                        <div className="text-[11px] text-text-tertiary tabular-nums">
                                            매달 {rule.dayOfMonth}일 · {rule.category}
                                            {rule.lastPostedMonth && ` · 최근 ${rule.lastPostedMonth}`}
                                        </div>
                                    </div>
                                    <span className="text-sm text-text-secondary tabular-nums shrink-0">
                                        {rule.amount.toLocaleString()}
                                    </span>

                                    {deletingId === rule.id ? (
                                        <div className="flex items-center gap-1 shrink-0">
                                            <button onClick={() => setDeletingId(null)} className="text-[11px] text-text-tertiary px-1.5 py-1">
                                                취소
                                            </button>
                                            <button onClick={() => handleDelete(rule.id)} className="text-[11px] text-red-400 px-1.5 py-1">
                                                삭제
                                            </button>
                                        </div>
                                    ) : (
                                        <div className="flex items-center gap-0.5 shrink-0">
                                            <button
                                                onClick={() => handleToggle(rule)}
                                                className="text-[10px] text-text-tertiary hover:text-text-primary px-1.5 py-1 rounded transition-colors"
                                                title={rule.active ? '일시 중지' : '다시 활성화'}
                                            >
                                                {rule.active ? '켜짐' : '꺼짐'}
                                            </button>
                                            <button
                                                onClick={() => setDeletingId(rule.id)}
                                                className="text-text-tertiary hover:text-red-400 p-1.5 transition-colors"
                                                aria-label="삭제"
                                            >
                                                <Trash2 size={14} />
                                            </button>
                                        </div>
                                    )}
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};

export default RecurringExpenseModal;
