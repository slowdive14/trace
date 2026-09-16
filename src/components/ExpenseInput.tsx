import React, { useState, useEffect } from 'react';
import { Send, Calendar, DollarSign } from 'lucide-react';
import { useAuth } from './AuthContext';
import { addExpense, addBatchExpenses } from '../services/firestore';
import type { ExpenseCategory } from '../types/types';
import { EXPENSE_CATEGORIES, EXPENSE_CATEGORY_EMOJI } from '../types/types';
import { classifyExpenseWithAI, extractAmountFromDescription, parseBatchExpenses } from '../utils/expenseClassifier';
import { format } from 'date-fns';

interface ExpenseInputProps {
    externalDate?: Date;
}

const ExpenseInput: React.FC<ExpenseInputProps> = ({ externalDate }) => {
    const [input, setInput] = useState('');
    const [amount, setAmount] = useState<number | ''>('');
    const [description, setDescription] = useState('');
    const [category, setCategory] = useState<ExpenseCategory>('기타');
    const [selectedDate, setSelectedDate] = useState<Date>(new Date());
    const [showDatePicker, setShowDatePicker] = useState(false);
    // 금액을 못 읽었거나 저장이 실패했을 때 알린다.
    // 전에는 둘 다 조용히 넘어가서(콘솔에만 기록) 사용자는 왜 안 되는지 알 길이 없었다.
    const [saveError, setSaveError] = useState<string | null>(null);
    const [batchParsed, setBatchParsed] = useState<Array<{
        description: string;
        amount: number;
        category: ExpenseCategory;
        rawLine: string;
    }>>([]);

    const { user } = useAuth();

    // externalDate가 변경되면 selectedDate 업데이트
    useEffect(() => {
        if (externalDate) {
            setSelectedDate(externalDate);
        }
    }, [externalDate]);

    // 입력 내용이 변경될 때마다 금액과 카테고리 추론 (디바운싱)
    useEffect(() => {
        if (!input.trim()) {
            setDescription('');
            setAmount('');
            setBatchParsed([]);
            return;
        }

        // 타이핑이 멈춘 후 800ms 뒤에 실행
        const timer = setTimeout(async () => {
            // 여러 줄인지 확인
            const hasMultipleLines = input.includes('\n');

            if (hasMultipleLines) {
                // 배치 모드: 여러 줄 파싱
                const parsed = parseBatchExpenses(input);
                console.log('📦 Parsed batch:', parsed);
                const withCategories = await Promise.all(
                    parsed.map(async (item) => ({
                        ...item,
                        category: await classifyExpenseWithAI(item.description)
                    }))
                );
                console.log('🏷️ With categories:', withCategories);
                setBatchParsed(withCategories);
                console.log('✅ Set batchParsed state:', withCategories.length, 'items');
                setDescription('');
                setAmount('');
            } else {
                // 단일 모드: 기존 로직
                setBatchParsed([]);
                const { description: desc, amount: extractedAmount } = extractAmountFromDescription(input);

                if (desc) {
                    setDescription(desc);
                    // 카테고리 자동 분류
                    classifyExpenseWithAI(desc).then(cat => {
                        setCategory(cat);
                    });
                }

                if (extractedAmount !== null) {
                    setAmount(extractedAmount);
                }
            }
        }, 800);

        return () => clearTimeout(timer);
    }, [input]);

    const handleSubmit = async () => {
        if (!user) return;

        const raw = input;
        if (!raw.trim()) return;

        // 무엇을 저장할지 화면을 비우기 전에 확정한다.
        // 디바운스(800ms)가 아직 안 돌아 미리보기가 비어 있어도, 제출 시점에
        // 입력을 다시 읽어 엔터가 헛돌지 않게 한다.
        const isBatch = raw.includes('\n');
        let single: { description: string; amount: number } | null = null;

        if (isBatch) {
            if (batchParsed.length === 0 && parseBatchExpenses(raw).length === 0) {
                setSaveError('금액을 읽지 못했습니다. 줄마다 "커피 1500"처럼 적어 주세요.');
                return;
            }
        } else {
            if (typeof amount === 'number' && amount !== 0 && description) {
                single = { description, amount };
            } else {
                const parsed = extractAmountFromDescription(raw);
                if (parsed.description && parsed.amount !== null && parsed.amount !== 0) {
                    single = { description: parsed.description, amount: parsed.amount };
                }
            }
            if (!single) {
                setSaveError('금액을 읽지 못했습니다. "커피 1500"처럼 적어 주세요.');
                return;
            }
        }

        const pendingBatch = batchParsed;
        const pendingCategory = category;
        const pendingDate = selectedDate;

        // 저장을 기다리기 전에 화면부터 비운다.
        // Firestore 쓰기는 서버 확인까지 기다리므로, 통신이 느리면 이미 목록에
        // 올라간 뒤에도 입력창에 글자가 몇 초씩 남아 입력이 안 된 것처럼 보인다.
        setInput('');
        setAmount('');
        setDescription('');
        setCategory('기타');
        setBatchParsed([]);
        setSaveError(null);
        if (!externalDate) {
            setSelectedDate(new Date());
        }

        try {
            if (isBatch) {
                const items = pendingBatch.length > 0
                    ? pendingBatch
                    : await Promise.all(parseBatchExpenses(raw).map(async item => ({
                        ...item,
                        category: await classifyExpenseWithAI(item.description),
                    })));
                await addBatchExpenses(user.uid, items, pendingDate);
            } else if (single) {
                // 분류가 아직 안 끝났으면 여기서 마저 한다 (화면은 이미 비워 기다려도 티가 안 난다)
                const cat = pendingCategory !== '기타'
                    ? pendingCategory
                    : await classifyExpenseWithAI(single.description);
                await addExpense(user.uid, single.description, single.amount, cat, pendingDate);
            }
        } catch (error) {
            console.error("Failed to add expense:", error);
            // 그 사이 새로 적지 않았다면 입력을 되돌려 다시 시도할 수 있게 한다
            setInput(prev => (prev === '' ? raw : prev));
            setSaveError('저장하지 못했습니다. 다시 시도해 주세요.');
        }
    };

    const handleKeyDown = (e: React.KeyboardEvent) => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            handleSubmit();
        }
    };

    const isToday = format(selectedDate, 'yyyy-MM-dd') === format(new Date(), 'yyyy-MM-dd');

    return (
        <>
            <div className="fixed bottom-0 left-0 right-0 bg-bg-secondary border-t border-bg-tertiary transition-all duration-300 z-50" style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}>
                <div className="app-container flex flex-col gap-3 p-4 max-h-[calc(100vh-160px)] overflow-y-auto">
                    {!isToday && (
                        <div className="text-xs text-accent text-center">
                            📅 {format(selectedDate, 'yyyy년 M월 d일')} 지출 기록
                        </div>
                    )}

                    {saveError && (
                        <div className="text-xs text-red-400 text-center">{saveError}</div>
                    )}

                    {/* Preview & Manual Override Section */}
                    {batchParsed.length > 0 ? (
                        <div className="flex flex-col gap-1.5 text-sm">
                            <div className="text-xs text-text-secondary">📋 {batchParsed.length}개 항목</div>
                            {(() => {
                                console.log('🎨 Rendering batch preview, items:', batchParsed);
                                return batchParsed.map((item, idx) => (
                                    <div key={idx} className="flex items-center gap-2 overflow-x-auto pb-1">
                                        <div className={`flex items-center gap-1 px-2 py-1 rounded-full bg-bg-tertiary whitespace-nowrap ${item.amount < 0 ? 'text-green-500' : 'text-text-primary'}`}>
                                            <DollarSign size={14} />
                                            <span className="font-mono">{item.amount.toLocaleString()}원</span>
                                        </div>
                                        <div className="flex items-center gap-1 px-2 py-1 rounded-full bg-bg-tertiary whitespace-nowrap text-text-primary">
                                            <span>{EXPENSE_CATEGORY_EMOJI[item.category]}</span>
                                            <span className="text-xs">{item.category}</span>
                                        </div>
                                        <span className="text-text-secondary text-xs">{item.description}</span>
                                    </div>
                                ));
                            })()}
                        </div>
                    ) : (amount !== '' || description) && (
                        <div className="flex items-center gap-2 text-sm overflow-x-auto pb-1">
                            <div className={`flex items-center gap-1 px-2 py-1 rounded-full bg-bg-tertiary whitespace-nowrap ${Number(amount) < 0 ? 'text-green-500' : 'text-text-primary'}`}>
                                <DollarSign size={14} />
                                <span className="font-mono">{Number(amount).toLocaleString()}원</span>
                            </div>
                            <div className="flex items-center gap-1 px-2 py-1 rounded-full bg-bg-tertiary whitespace-nowrap text-text-primary">
                                <span>{EXPENSE_CATEGORY_EMOJI[category]}</span>
                                <select
                                    value={category}
                                    onChange={(e) => setCategory(e.target.value as ExpenseCategory)}
                                    className="bg-transparent border-none focus:outline-none text-xs appearance-none cursor-pointer"
                                >
                                    {EXPENSE_CATEGORIES.map(c => (
                                        <option key={c} value={c}>{c}</option>
                                    ))}
                                </select>
                            </div>
                        </div>
                    )}

                    <div className="flex items-center gap-2">
                        <textarea
                            value={input}
                            onChange={(e) => {
                                setInput(e.target.value);
                                if (saveError) setSaveError(null);
                            }}
                            onKeyDown={handleKeyDown}
                            placeholder="예: 커피 1500 (한 줄로 입력)&#10;또는 여러 줄로 입력:&#10;커피 5500&#10;택시 8000&#10;점심 -12000"
                            className="flex-1 bg-bg-tertiary text-text-primary rounded-lg p-3 focus:outline-none focus:ring-1 focus:ring-accent resize-none"
                            style={{ minHeight: '48px', maxHeight: '120px', overflowY: 'auto' }}
                            rows={1}
                            autoFocus
                        />
                        <button
                            onClick={() => setShowDatePicker(true)}
                            className={`p-2 transition-colors ${isToday ? 'text-text-secondary hover:text-text-primary' : 'text-accent'}`}
                        >
                            <Calendar size={20} />
                        </button>
                        <button
                            onClick={handleSubmit}
                            /* 디바운스가 돌기 전에도 누를 수 있어야 한다 (엔터와 같은 기준).
                               금액을 못 읽으면 handleSubmit이 이유를 알려 준다 */
                            disabled={!input.trim()}
                            className="p-2 bg-accent text-white rounded-full hover:bg-opacity-90 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
                        >
                            <Send size={20} />
                        </button>
                    </div>
                </div>
            </div>

            {showDatePicker && (
                <div className="fixed inset-0 bg-black/50 z-40 flex items-center justify-center p-4" onClick={() => setShowDatePicker(false)}>
                    <div className="bg-bg-secondary rounded-2xl p-6 max-w-xs w-full" onClick={(e) => e.stopPropagation()}>
                        <h3 className="text-lg font-bold mb-4 text-center">날짜 선택</h3>
                        <input
                            type="date"
                            value={format(selectedDate, 'yyyy-MM-dd')}
                            onChange={(e) => {
                                setSelectedDate(new Date(e.target.value + 'T12:00:00'));
                                setShowDatePicker(false);
                            }}
                            className="w-full bg-bg-tertiary text-text-primary rounded-lg p-3 focus:outline-none focus:ring-1 focus:ring-accent"
                        />
                        <div className="flex gap-2 mt-4">
                            <button
                                onClick={() => {
                                    setSelectedDate(new Date());
                                    setShowDatePicker(false);
                                }}
                                className="flex-1 py-2 px-4 bg-accent text-white rounded-lg hover:bg-opacity-90"
                            >
                                오늘
                            </button>
                            <button
                                onClick={() => setShowDatePicker(false)}
                                className="flex-1 py-2 px-4 bg-bg-tertiary text-text-primary rounded-lg hover:bg-bg-primary"
                            >
                                취소
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </>
    );
};

export default ExpenseInput;
