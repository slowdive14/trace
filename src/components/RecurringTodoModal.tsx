import React, { useState, useEffect } from 'react';
import { X, Plus, Trash2, CalendarClock } from 'lucide-react';
import { format } from 'date-fns';
import type { RecurringTodo, TodoRepeatKind } from '../types/types';
import {
    getRecurringTodos, addRecurringTodo, updateRecurringTodo, deleteRecurringTodo,
} from '../services/firestore';
import { describeRepeat } from '../utils/todoRepeat';
import { getLogicalDate } from '../utils/dateUtils';
import { useAuth } from './AuthContext';

interface RecurringTodoModalProps {
    onClose: () => void;
    /** 규칙이 바뀌면 알려 준다 (열려 있는 날짜에 바로 반영되도록) */
    onChanged?: (rules: RecurringTodo[]) => void;
}

const WEEKDAYS = ['일', '월', '화', '수', '목', '금', '토'];

const KIND_LABEL: Record<TodoRepeatKind, string> = {
    weekly: '매주',
    biweekly: '격주',
    monthlyNth: '매월 N번째',
};

const RecurringTodoModal: React.FC<RecurringTodoModalProps> = ({ onClose, onChanged }) => {
    const { user } = useAuth();
    const [rules, setRules] = useState<RecurringTodo[]>([]);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [deletingId, setDeletingId] = useState<string | null>(null);

    const [text, setText] = useState('');
    const [kind, setKind] = useState<TodoRepeatKind>('weekly');
    const [weekday, setWeekday] = useState(1);   // 월요일
    const [nth, setNth] = useState(2);

    const load = async () => {
        if (!user) return;
        try {
            const next = await getRecurringTodos(user.uid);
            setRules(next);
            onChanged?.(next);
        } catch (e) {
            console.error('반복 일정을 불러오지 못했습니다:', e);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => { load(); }, [user]);

    const canSave = text.trim().length > 0;

    const handleAdd = async () => {
        if (!user || !canSave || saving) return;
        setSaving(true);
        try {
            await addRecurringTodo(user.uid, {
                text: text.trim(),
                kind,
                weekday,
                ...(kind === 'monthlyNth' ? { nth } : {}),
                // 격주는 기준이 있어야 어느 주에 넣을지 정해진다. 오늘이 속한 주를 기준으로 삼는다.
                ...(kind === 'biweekly' ? { anchorDate: format(getLogicalDate(), 'yyyy-MM-dd') } : {}),
            });
            setText('');
            await load();
        } catch (e) {
            console.error('반복 일정을 등록하지 못했습니다:', e);
        } finally {
            setSaving(false);
        }
    };

    const handleToggle = async (rule: RecurringTodo) => {
        if (!user) return;
        try {
            await updateRecurringTodo(user.uid, rule.id, { active: !rule.active });
            await load();
        } catch (e) {
            console.error('반복 일정을 바꾸지 못했습니다:', e);
        }
    };

    const handleDelete = async (ruleId: string) => {
        if (!user) return;
        try {
            await deleteRecurringTodo(user.uid, ruleId);
            await load();
        } catch (e) {
            console.error('반복 일정을 지우지 못했습니다:', e);
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
                <div className="flex items-center justify-between px-4 py-3 border-b border-bg-tertiary shrink-0">
                    <div className="flex items-center gap-2">
                        <CalendarClock size={16} className="text-accent" />
                        <h2 className="text-sm font-semibold text-text-primary">반복 일정</h2>
                    </div>
                    <button onClick={onClose} className="p-1 text-text-tertiary hover:text-text-primary transition-colors">
                        <X size={18} />
                    </button>
                </div>

                <div className="overflow-y-auto px-4 py-3">
                    <p className="text-[11px] text-text-tertiary mb-4 leading-relaxed">
                        요일이나 주기가 정해진 일을 등록해 두면 그날 목록에 한 번만 들어갑니다.
                        매일 하는 일은 위의 루틴(템플릿)에 적어 주세요.
                        들어온 항목을 지우면 그날은 다시 들어오지 않습니다.
                    </p>

                    {/* 등록 폼 */}
                    <div className="bg-bg-primary rounded-lg p-3 mb-4 space-y-2">
                        <input
                            type="text"
                            value={text}
                            onChange={e => setText(e.target.value)}
                            onKeyDown={e => { if (e.key === 'Enter') handleAdd(); }}
                            placeholder="할 일 (예: 뉴스레터 초안 (90m))"
                            className="w-full bg-bg-tertiary text-text-primary text-base rounded-md px-3 py-2 outline-none focus:ring-1 focus:ring-accent placeholder:text-text-tertiary"
                        />
                        <div className="flex gap-2">
                            <select
                                value={kind}
                                onChange={e => setKind(e.target.value as TodoRepeatKind)}
                                className="flex-1 min-w-0 bg-bg-tertiary text-text-primary text-sm rounded-md px-2 py-2 outline-none focus:ring-1 focus:ring-accent"
                            >
                                {(Object.keys(KIND_LABEL) as TodoRepeatKind[]).map(k => (
                                    <option key={k} value={k}>{KIND_LABEL[k]}</option>
                                ))}
                            </select>
                            {kind === 'monthlyNth' && (
                                <select
                                    value={nth}
                                    onChange={e => setNth(Number(e.target.value))}
                                    className="bg-bg-tertiary text-text-primary text-sm rounded-md px-2 py-2 outline-none focus:ring-1 focus:ring-accent shrink-0"
                                >
                                    {[1, 2, 3, 4, 5].map(n => (
                                        <option key={n} value={n}>{n}번째</option>
                                    ))}
                                </select>
                            )}
                            <select
                                value={weekday}
                                onChange={e => setWeekday(Number(e.target.value))}
                                className="bg-bg-tertiary text-text-primary text-sm rounded-md px-2 py-2 outline-none focus:ring-1 focus:ring-accent shrink-0"
                            >
                                {WEEKDAYS.map((d, i) => (
                                    <option key={d} value={i}>{d}요일</option>
                                ))}
                            </select>
                        </div>
                        {kind === 'biweekly' && (
                            <p className="text-[10px] text-text-tertiary">
                                이번 주부터 2주 간격으로 들어갑니다.
                            </p>
                        )}
                        <button
                            onClick={handleAdd}
                            disabled={!canSave || saving}
                            className="w-full flex items-center justify-center gap-1 bg-accent text-white text-sm font-medium rounded-md py-2 transition-colors hover:bg-accent-hover disabled:opacity-30"
                        >
                            <Plus size={15} /> 등록
                        </button>
                    </div>

                    {/* 등록된 규칙 */}
                    {loading ? (
                        <p className="text-xs text-text-tertiary text-center py-4">불러오는 중…</p>
                    ) : rules.length === 0 ? (
                        <p className="text-xs text-text-tertiary text-center py-4">등록된 반복 일정이 없습니다.</p>
                    ) : (
                        <div className="space-y-1.5">
                            {rules.map(rule => (
                                <div
                                    key={rule.id}
                                    className={`flex items-center gap-2 bg-bg-primary rounded-lg px-3 py-2 ${rule.active ? '' : 'opacity-50'}`}
                                >
                                    <div className="flex-1 min-w-0">
                                        <div className="text-sm text-text-primary truncate">{rule.text}</div>
                                        <div className="text-[10px] text-text-tertiary">
                                            {describeRepeat(rule)}
                                            {!rule.active && ' · 꺼짐'}
                                        </div>
                                    </div>
                                    {deletingId === rule.id ? (
                                        <>
                                            <button
                                                onClick={() => setDeletingId(null)}
                                                className="text-xs text-text-secondary hover:text-text-primary px-2 py-1"
                                            >
                                                취소
                                            </button>
                                            <button
                                                onClick={() => handleDelete(rule.id)}
                                                className="text-xs text-red-400 hover:text-red-300 px-2 py-1"
                                            >
                                                삭제
                                            </button>
                                        </>
                                    ) : (
                                        <>
                                            <button
                                                onClick={() => handleToggle(rule)}
                                                className="text-[11px] text-text-tertiary hover:text-accent px-2 py-1 rounded"
                                            >
                                                {rule.active ? '끄기' : '켜기'}
                                            </button>
                                            <button
                                                onClick={() => setDeletingId(rule.id)}
                                                className="text-text-tertiary hover:text-red-400 p-1.5"
                                                aria-label="삭제"
                                            >
                                                <Trash2 size={15} />
                                            </button>
                                        </>
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

export default RecurringTodoModal;
