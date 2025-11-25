import React, { useState, useEffect } from 'react';
import { Send, Calendar, DollarSign } from 'lucide-react';
import { useAuth } from './AuthContext';
import { addExpense } from '../services/firestore';
import type { ExpenseCategory } from '../types/types';
import { EXPENSE_CATEGORIES, EXPENSE_CATEGORY_EMOJI } from '../types/types';
import { classifyExpenseWithAI, extractAmountFromDescription } from '../utils/expenseClassifier';
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
            return;
        }

        // 타이핑이 멈춘 후 800ms 뒤에 실행
        const timer = setTimeout(() => {
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
        }, 800);

        return () => clearTimeout(timer);
    }, [input]);

    const handleSubmit = async () => {
        if (!user || typeof amount !== 'number' || amount === 0 || !description) return;

        try {
            await addExpense(user.uid, description, Number(amount), category, selectedDate);
            // Reset form
            setInput('');
            setAmount('');
            setDescription('');
            setCategory('기타');
            // externalDate가 있으면 유지, 없으면 오늘로 리셋
            if (!externalDate) {
                setSelectedDate(new Date());
            }
        } catch (error) {
            console.error("Failed to add expense:", error);
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
            <div className="fixed bottom-0 left-0 right-0 bg-bg-secondary border-t border-bg-tertiary p-4 transition-all duration-300">
                <div className="max-w-md mx-auto flex flex-col gap-3">
                    {!isToday && (
                        <div className="text-xs text-accent text-center">
                            📅 {format(selectedDate, 'yyyy년 M월 d일')} 지출 기록
                        </div>
                    )}

                    {/* Preview & Manual Override Section */}
                    {(amount !== '' || description) && (
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
                        <input
                            type="text"
                            value={input}
                            onChange={(e) => setInput(e.target.value)}
                            onKeyDown={handleKeyDown}
                            placeholder="예: 커피 1500, 택시비 8000"
                            className="flex-1 bg-bg-tertiary text-text-primary rounded-lg p-3 focus:outline-none focus:ring-1 focus:ring-accent"
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
                            disabled={typeof amount !== 'number' || amount === 0}
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
                                setSelectedDate(new Date(e.target.value + 'T00:00:00'));
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
