import React, { useEffect, useState, useCallback, useMemo } from 'react';
import { format, isToday, isYesterday } from 'date-fns';
import { ko } from 'date-fns/locale';
import type { Expense, ExpenseCategory, NavigationTarget, RecurringExpense } from '../types/types';
import { deleteExpense, applyDueRecurringExpenses, getRecurringExpenses } from '../services/firestore';
import { useAuth } from './AuthContext';
import { onSnapshot, collection, query, orderBy } from 'firebase/firestore';
import { db } from '../services/firebase';
import { Trash2, Repeat } from 'lucide-react';
import { EXPENSE_CATEGORY_EMOJI } from '../types/types';
import ExpenseInsights from './ExpenseInsights';
import ExpenseCalendar from './ExpenseCalendar';
import RecurringExpenseModal from './RecurringExpenseModal';

// 반복 지출 자동 입력을 이번 세션에서 이미 시도한 사용자·월.
// 탭을 오갈 때마다 컴포넌트가 다시 마운트되는데, 그때마다 Firestore 쓰기를
// 던지면 느린 네트워크에서 대기 중인 쓰기가 쌓인다. 세션당 한 번으로 제한한다.
const recurringApplied = new Set<string>();

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
    // 월말 예상액 계산에 쓰인다 (남은 기간에 예정된 반복 지출을 정확히 반영)
    const [recurringRules, setRecurringRules] = useState<RecurringExpense[]>([]);

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
    const loadRules = useCallback(async () => {
        if (!user) return;
        try {
            setRecurringRules(await getRecurringExpenses(user.uid));
        } catch (e) {
            console.error('Failed to load recurring rules:', e);
        }
    }, [user]);

    useEffect(() => {
        if (!user) return;
        let cancelled = false;

        const sessionKey = `${user.uid}:${format(new Date(), 'yyyy-MM')}`;
        if (recurringApplied.has(sessionKey)) {
            loadRules();   // 자동 입력은 건너뛰고 목록만 최신화
            return;
        }
        recurringApplied.add(sessionKey);

        applyDueRecurringExpenses(user.uid)
            .then(posted => {
                if (cancelled) return;
                if (posted.length > 0) setAutoPosted(posted);
                return loadRules();
            })
            .catch(e => {
                // 실패하면 다음 진입에서 다시 시도할 수 있게 표시를 되돌린다
                recurringApplied.delete(sessionKey);
                console.error('Failed to apply recurring expenses:', e);
            });

        return () => { cancelled = true; };
    }, [user, loadRules]);

    // 검색 결과에서 넘어온 지출로 스크롤 + 잠시 강조
    useEffect(() => {
        if (!navigationTarget || navigationTarget.type !== 'expense') return;
        if (expenses.length === 0) return;  // 데이터 로딩 대기

        let clearTimer: ReturnType<typeof setTimeout> | undefined;
        const timer = setTimeout(() => {
            const el = document.querySelector(`[data-expense-id="${navigationTarget.id}"]`);
            if (!el) {
                onNavigationComplete?.();
                return;
            }
            el.scrollIntoView({ behavior: 'smooth', block: 'center' });
            el.classList.add('search-highlight');
            clearTimer = setTimeout(() => {
                el.classList.remove('search-highlight');
                onNavigationComplete?.();
            }, 2000);
        }, 300);

        // 강조 해제 타이머까지 정리한다. 실시간 스냅샷으로 이 효과가 다시 실행되면
        // 예전에는 안쪽 타이머가 남아 계속 쌓였다.
        return () => { clearTimeout(timer); if (clearTimer) clearTimeout(clearTimer); };
    }, [navigationTarget, expenses.length]);

    const handleDelete = async (id: string) => {
        if (!user) return;
        await deleteExpense(user.uid, id);
        setDeletingId(null);
    };

    // React.memo가 걸린 자식(ExpenseCalendar)이 매 렌더마다 무효화되지 않도록 고정한다
    const handleDateSelect = useCallback((date: Date) => {
        setSelectedDate(date);
        onDateSelect?.(date);
    }, [onDateSelect]);

    const visibleExpenses = useMemo(
        () => selectedCategory ? expenses.filter(e => e.category === selectedCategory) : expenses,
        [expenses, selectedCategory]
    );

    // 날짜별 그룹화도 지출 건마다 format()을 호출하므로 메모이즈한다
    const groupedExpenses = useMemo(() => {
        const groups: Record<string, Expense[]> = {};
        for (const expense of visibleExpenses) {
            const dateKey = format(expense.timestamp, 'yyyy-MM-dd');
            (groups[dateKey] ??= []).push(expense);
        }
        return groups;
    }, [visibleExpenses]);

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
        <div className="pb-40 px-4 app-container">
            <ExpenseCalendar
                expenses={expenses}
                selectedDate={selectedDate}
                onSelectDate={handleDateSelect}
            />
            <ExpenseInsights
                expenses={expenses}
                selectedCategory={selectedCategory}
                onSelectCategory={setSelectedCategory}
                recurringRules={recurringRules}
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

            {showRecurring && (
                <RecurringExpenseModal onClose={() => { setShowRecurring(false); loadRules(); }} />
            )}

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
