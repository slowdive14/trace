import React, { useEffect, useState } from 'react';
import { format, isToday, isYesterday } from 'date-fns';
import { ko } from 'date-fns/locale';
import type { Expense, ExpenseCategory, NavigationTarget } from '../types/types';
import { deleteExpense, applyDueRecurringExpenses } from '../services/firestore';
import { useAuth } from './AuthContext';
import { onSnapshot, collection, query, orderBy } from 'firebase/firestore';
import { db } from '../services/firebase';
import { Trash2, Repeat } from 'lucide-react';
import { EXPENSE_CATEGORY_EMOJI } from '../types/types';
import ExpenseInsights from './ExpenseInsights';
import ExpenseCalendar from './ExpenseCalendar';
import RecurringExpenseModal from './RecurringExpenseModal';

interface ExpenseTimelineProps {
    onDateSelect?: (date: Date) => void;
    navigationTarget?: NavigationTarget | null;
    onNavigationComplete?: () => void;
}

const ExpenseTimeline: React.FC<ExpenseTimelineProps> = ({ onDateSelect, navigationTarget, onNavigationComplete }) => {
    const [expenses, setExpenses] = useState<Expense[]>([]);
    const { user } = useAuth();
    const [deletingId, setDeletingId] = useState<string | null>(null);
    const [selectedDate, setSelectedDate] = useState<Date>(new Date());
    // 통계 카드에서 카테고리를 누르면 그 카테고리 내역만 보여준다
    const [selectedCategory, setSelectedCategory] = useState<ExpenseCategory | null>(null);
    const [showRecurring, setShowRecurring] = useState(false);
    const [autoPosted, setAutoPosted] = useState<string[]>([]);

    useEffect(() => {
        if (!user) return;

        const q = query(
            collection(db, `users/${user.uid}/expenses`),
            orderBy("timestamp", "desc")
        );

        const unsubscribe = onSnapshot(q, (snapshot) => {
            const newExpenses = snapshot.docs.map(doc => ({
                id: doc.id,
                ...doc.data(),
                timestamp: doc.data().timestamp.toDate(),
            })) as Expense[];
            setExpenses(newExpenses);
        });

        return () => unsubscribe();
    }, [user]);

    // 이번 달 지정일이 지난 반복 지출을 자동 입력 (탭 진입 시 1회)
    useEffect(() => {
        if (!user) return;
        let cancelled = false;
        applyDueRecurringExpenses(user.uid)
            .then(posted => { if (!cancelled && posted.length > 0) setAutoPosted(posted); })
            .catch(e => console.error('Failed to apply recurring expenses:', e));
        return () => { cancelled = true; };
    }, [user]);

    // 검색 결과에서 넘어온 지출로 스크롤 + 잠시 강조
    useEffect(() => {
        if (!navigationTarget || navigationTarget.type !== 'expense') return;
        if (expenses.length === 0) return;  // 데이터 로딩 대기

        const timer = setTimeout(() => {
            const el = document.querySelector(`[data-expense-id="${navigationTarget.id}"]`);
            if (!el) {
                onNavigationComplete?.();
                return;
            }
            el.scrollIntoView({ behavior: 'smooth', block: 'center' });
            el.classList.add('search-highlight');
            setTimeout(() => {
                el.classList.remove('search-highlight');
                onNavigationComplete?.();
            }, 2000);
        }, 300);

        return () => clearTimeout(timer);
    }, [navigationTarget, expenses.length]);

    const handleDelete = async (id: string) => {
        if (!user) return;
        await deleteExpense(user.uid, id);
        setDeletingId(null);
    };

    const handleDateSelect = (date: Date) => {
        setSelectedDate(date);
        if (onDateSelect) {
            onDateSelect(date);
        }
    };

    const visibleExpenses = selectedCategory
        ? expenses.filter(e => e.category === selectedCategory)
        : expenses;

    const groupedExpenses = visibleExpenses.reduce((groups: Record<string, Expense[]>, expense: Expense) => {
        const dateKey = format(expense.timestamp, 'yyyy-MM-dd');
        if (!groups[dateKey]) {
            groups[dateKey] = [];
        }
        groups[dateKey].push(expense);
        return groups;
    }, {} as Record<string, Expense[]>);

    const getDateLabel = (dateStr: string) => {
        const [year, month, day] = dateStr.split('-').map(Number);
        const date = new Date(year, month - 1, day);
        if (isToday(date)) return '오늘';
        if (isYesterday(date)) return '어제';
        return format(date, 'M월 d일 (eee)', { locale: ko });
    };

    const getDailyTotal = (dailyExpenses: Expense[]) => {
        return dailyExpenses
            .filter(expense => expense.amount > 0)
            .reduce((sum, expense) => sum + expense.amount, 0);
    };

    return (
        <div className="pb-40 px-4 max-w-md mx-auto">
            <ExpenseCalendar
                expenses={expenses}
                selectedDate={selectedDate}
                onSelectDate={handleDateSelect}
            />
            <ExpenseInsights
                expenses={expenses}
                selectedCategory={selectedCategory}
                onSelectCategory={setSelectedCategory}
            />

            {/* 자동 입력 알림 */}
            {autoPosted.length > 0 && (
                <div className="flex items-start gap-2 mb-4 px-3 py-2 rounded-lg bg-accent/10 text-[11px] text-text-secondary">
                    <Repeat size={13} className="text-accent shrink-0 mt-0.5" />
                    <span className="flex-1">
                        반복 지출 {autoPosted.join(', ')} 이(가) 이번 달 내역으로 자동 입력됐습니다.
                    </span>
                    <button onClick={() => setAutoPosted([])} className="text-text-tertiary hover:text-text-primary shrink-0">
                        ✕
                    </button>
                </div>
            )}

            <button
                onClick={() => setShowRecurring(true)}
                className="flex items-center gap-1.5 mb-4 text-[11px] text-text-tertiary hover:text-text-primary transition-colors"
            >
                <Repeat size={12} />
                반복 지출 관리
            </button>

            {showRecurring && <RecurringExpenseModal onClose={() => setShowRecurring(false)} />}

            {selectedCategory && (
                <div className="flex items-center justify-between mb-4 px-1">
                    <span className="text-xs text-text-secondary">
                        <span className="text-text-tertiary">필터</span>{' '}
                        {EXPENSE_CATEGORY_EMOJI[selectedCategory]} {selectedCategory}
                        <span className="text-text-tertiary"> · {visibleExpenses.length}건</span>
                    </span>
                    <button
                        onClick={() => setSelectedCategory(null)}
                        className="text-xs text-text-tertiary hover:text-text-primary transition-colors"
                    >
                        ✕ 해제
                    </button>
                </div>
            )}

            {Object.entries(groupedExpenses).map(([date, dayExpenses]) => (
                <div key={date} className="mb-8">
                    <div className="sticky top-0 bg-bg-primary/95 backdrop-blur py-2 z-10 border-b border-bg-tertiary flex justify-between items-center mb-4">
                        <h2 className="text-text-secondary text-sm font-bold">
                            {getDateLabel(date)}
                        </h2>
                        <span className="text-sm font-mono font-medium text-text-primary">
                            {getDailyTotal(dayExpenses).toLocaleString()}원
                        </span>
                    </div>
                    <div className="space-y-2">
                        {dayExpenses.map(expense => (
                            <div key={expense.id} data-expense-id={expense.id} className="flex items-center justify-between bg-bg-secondary p-3 rounded-lg group relative">
                                <div className="flex items-center gap-3 overflow-hidden">
                                    <span className="text-xl shrink-0" role="img" aria-label={expense.category}>
                                        {EXPENSE_CATEGORY_EMOJI[expense.category]}
                                    </span>
                                    <div className="min-w-0">
                                        <div className="text-text-primary truncate">{expense.description}</div>
                                        <div className="text-xs text-text-secondary">{expense.category}</div>
                                    </div>
                                </div>
                                <div className="flex items-center gap-3 shrink-0">
                                    <span className={`font-mono font-medium ${expense.amount < 0 ? 'text-green-500' : 'text-text-primary'}`}>
                                        {expense.amount > 0 ? '-' : '+'}{Math.abs(expense.amount).toLocaleString()}
                                    </span>

                                    {deletingId === expense.id ? (
                                        <div className="flex items-center gap-1 animate-fade-in">
                                            <button
                                                onClick={() => setDeletingId(null)}
                                                className="text-xs text-text-secondary hover:text-text-primary px-2 py-1"
                                            >
                                                취소
                                            </button>
                                            <button
                                                onClick={() => handleDelete(expense.id)}
                                                className="text-xs bg-red-500 text-white px-2 py-1 rounded hover:bg-red-600"
                                            >
                                                삭제
                                            </button>
                                        </div>
                                    ) : (
                                        <button
                                            onClick={() => setDeletingId(expense.id)}
                                            className="text-text-secondary hover:text-red-400 opacity-0 group-hover:opacity-100 transition-opacity p-1"
                                        >
                                            <Trash2 size={16} />
                                        </button>
                                    )}
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            ))}
            {expenses.length === 0 && (
                <div className="text-center text-text-secondary mt-20">
                    <p>아직 지출 내역이 없습니다.</p>
                    <p className="text-sm mt-2">"커피 1500" 처럼 입력해보세요.</p>
                </div>
            )}
            {expenses.length > 0 && visibleExpenses.length === 0 && (
                <div className="text-center text-text-tertiary mt-10 text-sm">
                    이 카테고리의 지출 내역이 없습니다.
                </div>
            )}
        </div>
    );
};

export default ExpenseTimeline;
