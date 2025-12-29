import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useAuth } from './AuthContext';
import { saveTodo, getTodo, getTodos, saveTemplate, getTemplate } from '../services/firestore';
import { CheckSquare, Square, Bold, Highlighter, ArrowRight, ArrowLeft, Edit3, Check } from 'lucide-react';
import { format, subDays, startOfDay, endOfDay } from 'date-fns';
import { ko } from 'date-fns/locale';
import type { Todo } from '../types/types';
import { getLogicalDate } from '../utils/dateUtils';

interface TodoTabProps {
    collectionName?: string;
    placeholder?: string;
}

interface TodoItem {
    checked: boolean;
    text: string;
    indent: number;
    lineIndex: number;
}

type ViewMode = 'edit' | 'history' | 'template';

// 레벨 시스템 (귀여운 사자 테마)
const getLevelInfo = (percentage: number): { level: number; title: string } => {
    if (percentage >= 100) return { level: 5, title: '사자왕 👑' };
    if (percentage >= 75) return { level: 4, title: '용감한 사자 ⚡' };
    if (percentage >= 50) return { level: 3, title: '씩씩한 사자 💪' };
    if (percentage >= 25) return { level: 2, title: '꼬마 사자 🦁' };
    return { level: 1, title: '아기 사자 🐱' };
};

// 격려 메시지
const getEncouragementMessage = (percentage: number): string => {
    if (percentage >= 100) return '완벽한 하루! 오늘 정말 잘했어 🎉';
    if (percentage >= 75) return '거의 다 왔어! 조금만 더!';
    if (percentage >= 50) return '절반 넘었어! 잘하고 있어';
    if (percentage >= 25) return '순조롭게 진행 중!';
    if (percentage > 0) return '좋은 시작이야! 계속 가보자';
    return '오늘도 화이팅! 하나씩 시작해볼까?';
};

// 프로그레스바 색상 (진행률에 따라)
const getProgressColor = (percentage: number): string => {
    if (percentage >= 100) return 'bg-gradient-to-r from-yellow-400 to-yellow-300';
    if (percentage >= 75) return 'bg-gradient-to-r from-green-500 to-green-400';
    if (percentage >= 50) return 'bg-gradient-to-r from-lime-500 to-lime-400';
    if (percentage >= 25) return 'bg-gradient-to-r from-yellow-500 to-yellow-400';
    return 'bg-gradient-to-r from-orange-500 to-orange-400';
};

const TodoTab: React.FC<TodoTabProps> = ({
    collectionName = 'todos',
    placeholder = "오늘의 할 일을 기록하세요..."
}) => {
    const [content, setContent] = useState('');
    const [isEditing, setIsEditing] = useState(false);
    const [viewMode, setViewMode] = useState<ViewMode>('edit');
    const [historyTodos, setHistoryTodos] = useState<Todo[]>([]);
    const [isSaving, setIsSaving] = useState(false);
    const [lastSaved, setLastSaved] = useState<Date | null>(null);

    const { user } = useAuth();
    const textareaRef = useRef<HTMLTextAreaElement>(null);
    const saveTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

    // Load content based on view mode
    useEffect(() => {
        const loadContent = async () => {
            if (!user) return;

            try {
                if (viewMode === 'edit') {
                    // Load logical today's todo (5AM cutoff)
                    const today = getLogicalDate();
                    const todo = await getTodo(user.uid, today, collectionName);
                    if (todo) {
                        setContent(todo.content);
                        setLastSaved(todo.updatedAt || new Date());
                    } else {
                        // If no todo for today, try to load template
                        const template = await getTemplate(user.uid, collectionName);
                        if (template) {
                            setContent(template);
                            // Optional: Auto-save the template as today's todo immediately?
                            // For now, we just pre-fill it. It will be saved when user edits.
                        } else {
                            setContent('');
                        }
                    }
                } else if (viewMode === 'template') {
                    // Load template
                    const template = await getTemplate(user.uid, collectionName);
                    setContent(template || '');
                }
            } catch (error) {
                console.error("Failed to load content:", error);
            }
        };
        loadContent();
    }, [user, collectionName, viewMode]);

    // Load history (last 30 days)
    useEffect(() => {
        const loadHistory = async () => {
            if (!user || viewMode !== 'history') return;
            try {
                // Use logical date for history range
                const logicalToday = getLogicalDate();
                const endDate = endOfDay(logicalToday);
                const startDate = startOfDay(subDays(logicalToday, 29));
                const todos = await getTodos(user.uid, startDate, endDate, collectionName);
                setHistoryTodos(todos);
            } catch (error) {
                console.error("Failed to load history:", error);
            }
        };
        loadHistory();
    }, [user, viewMode, collectionName]);

    const handleSave = useCallback((newContent: string) => {
        if (!user) return;

        setIsSaving(true);
        if (saveTimeoutRef.current) {
            clearTimeout(saveTimeoutRef.current);
        }

        saveTimeoutRef.current = setTimeout(async () => {
            try {
                if (viewMode === 'edit') {
                    // Save to logical today's date
                    const today = getLogicalDate();
                    await saveTodo(user.uid, today, newContent, collectionName);
                } else if (viewMode === 'template') {
                    // Save as template
                    await saveTemplate(user.uid, newContent, collectionName);
                }
                setLastSaved(new Date());
            } catch (error) {
                console.error("Failed to save content:", error);
            } finally {
                setIsSaving(false);
            }
        }, 500);
    }, [user, collectionName, viewMode]);

    const handleChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
        const newContent = e.target.value;
        setContent(newContent);
        handleSave(newContent);
    };

    const parseTodos = (content: string): TodoItem[] => {
        const lines = content.split('\n');
        const items: TodoItem[] = [];

        lines.forEach((line, index) => {
            const indentMatch = line.match(/^(\t| )*/);
            let indent = 0;
            if (indentMatch && indentMatch[0]) {
                const indentStr = indentMatch[0];
                indent = (indentStr.match(/\t/g) || []).length + Math.floor((indentStr.match(/ /g) || []).length / 2);
            }

            const uncheckedMatch = line.match(/^[\t ]*- \[ \] (.+)$/);
            const checkedMatch = line.match(/^[\t ]*- \[x\] (.+)$/);

            if (uncheckedMatch) {
                items.push({ checked: false, text: uncheckedMatch[1], indent, lineIndex: index });
            } else if (checkedMatch) {
                items.push({ checked: true, text: checkedMatch[1], indent, lineIndex: index });
            }
        });

        return items;
    };

    const toggleCheckbox = (lineIndex: number) => {
        const lines = content.split('\n');
        const line = lines[lineIndex];

        if (line.includes('- [ ]')) {
            lines[lineIndex] = line.replace('- [ ]', '- [x]');
        } else if (line.includes('- [x]')) {
            lines[lineIndex] = line.replace('- [x]', '- [ ]');
        }

        const newContent = lines.join('\n');
        setContent(newContent);
        handleSave(newContent);
    };

    const renderText = (text: string) => {
        let rendered = text;
        rendered = rendered.replace(/\*\*(.+?)\*\*/g, '<strong class="font-bold">$1</strong>');
        rendered = rendered.replace(/==(.+?)==/g, '<mark class="bg-yellow-300 px-1">$1</mark>');
        return <span dangerouslySetInnerHTML={{ __html: rendered }} />;
    };

    const insertText = (text: string, cursorOffset = 0) => {
        if (!textareaRef.current) return;

        const start = textareaRef.current.selectionStart;
        const end = textareaRef.current.selectionEnd;
        const newContent = content.substring(0, start) + text + content.substring(end);

        setContent(newContent);
        handleSave(newContent);

        setTimeout(() => {
            if (textareaRef.current) {
                textareaRef.current.selectionStart = textareaRef.current.selectionEnd = start + text.length + cursorOffset;
                textareaRef.current.focus();
            }
        }, 0);
    };

    const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
        if (e.key === 'Tab') {
            e.preventDefault();
            if (e.shiftKey) {
                handleIndent('out');
            } else {
                handleIndent('in');
            }
        } else if (e.key === 'Enter') {
            e.preventDefault();
            const start = e.currentTarget.selectionStart;
            const lineStart = content.lastIndexOf('\n', start - 1) + 1;
            const lineEnd = content.indexOf('\n', start);
            const currentLine = content.substring(lineStart, lineEnd === -1 ? content.length : lineEnd);

            const indentation = currentLine.match(/^[\t ]*/)?.[0] || '';
            let nextLinePrefix = '\n' + indentation + '- [ ] ';

            insertText(nextLinePrefix);
        }
    };

    const handleIndent = (direction: 'in' | 'out') => {
        if (!textareaRef.current) return;

        const start = textareaRef.current.selectionStart;
        const lineStart = content.lastIndexOf('\n', start - 1) + 1;

        if (direction === 'in') {
            const newContent = content.substring(0, lineStart) + '\t' + content.substring(lineStart);
            setContent(newContent);
            handleSave(newContent);
            setTimeout(() => {
                if (textareaRef.current) {
                    textareaRef.current.selectionStart = textareaRef.current.selectionEnd = start + 1;
                    textareaRef.current.focus();
                }
            }, 0);
        } else {
            const currentLine = content.substring(lineStart);
            if (currentLine.startsWith('\t')) {
                const newContent = content.substring(0, lineStart) + content.substring(lineStart + 1);
                setContent(newContent);
                handleSave(newContent);
                setTimeout(() => {
                    if (textareaRef.current) {
                        textareaRef.current.selectionStart = textareaRef.current.selectionEnd = Math.max(lineStart, start - 1);
                        textareaRef.current.focus();
                    }
                }, 0);
            }
        }
    };

    const getDateLabel = (dateStr: string) => {
        const [year, month, day] = dateStr.split('-').map(Number);
        const date = new Date(year, month - 1, day);
        const logicalToday = getLogicalDate();

        // Compare with logical today
        if (format(date, 'yyyy-MM-dd') === format(logicalToday, 'yyyy-MM-dd')) return '오늘';
        if (format(date, 'yyyy-MM-dd') === format(subDays(logicalToday, 1), 'yyyy-MM-dd')) return '어제';

        return format(date, 'M월 d일 (eee)', { locale: ko });
    };

    const groupedTodos = historyTodos.reduce((groups: Record<string, Todo>, todo) => {
        const dateKey = format(todo.date, 'yyyy-MM-dd');
        if (!groups[dateKey]) {
            groups[dateKey] = todo;
        }
        return groups;
    }, {});

    const todos = parseTodos(content);

    return (
        <div className="flex flex-col relative" style={{ height: 'calc(100vh - 160px)' }}>
            {/* Mode Tabs */}
            <div className="flex-shrink-0 bg-bg-primary/95 backdrop-blur border-b border-bg-tertiary z-20 px-4">
                <div className="max-w-md mx-auto flex gap-2 py-2">
                    <button
                        onClick={() => setViewMode('edit')}
                        className={`flex-1 py-2 px-4 text-sm font-medium rounded-md transition-colors ${viewMode === 'edit'
                            ? 'bg-accent text-white'
                            : 'bg-bg-secondary text-text-secondary hover:bg-bg-tertiary'
                            }`}
                    >
                        편집 모드
                    </button>
                    <button
                        onClick={() => setViewMode('history')}
                        className={`flex-1 py-2 px-4 text-sm font-medium rounded-md transition-colors ${viewMode === 'history'
                            ? 'bg-accent text-white'
                            : 'bg-bg-secondary text-text-secondary hover:bg-bg-tertiary'
                            }`}
                    >
                        히스토리
                    </button>
                    <button
                        onClick={() => setViewMode('template')}
                        className={`flex-1 py-2 px-4 text-sm font-medium rounded-md transition-colors ${viewMode === 'template'
                            ? 'bg-accent text-white'
                            : 'bg-bg-secondary text-text-secondary hover:bg-bg-tertiary'
                            }`}
                    >
                        루틴 설정
                    </button>
                </div>
            </div>

            {viewMode === 'history' ? (
                /* History Mode */
                <div className="flex-1 overflow-y-auto px-4 pb-8">
                    <div className="max-w-md mx-auto pt-4">
                        {Object.entries(groupedTodos).map(([date, todo]) => (
                            <div key={date} className="mb-8">
                                <div
                                    className="sticky top-0 bg-bg-primary/95 backdrop-blur py-3 border-b border-bg-tertiary mb-4"
                                    style={{ zIndex: 10 }}
                                >
                                    <h2 className="text-text-secondary text-sm font-bold">
                                        {getDateLabel(date)}
                                    </h2>
                                </div>
                                <div className="space-y-1">
                                    {parseTodos(todo.content).map((item, idx) => (
                                        <div
                                            key={idx}
                                            className="flex items-start gap-2 py-1"
                                            style={{ paddingLeft: `${item.indent * 24}px` }}
                                        >
                                            <input
                                                type="checkbox"
                                                checked={item.checked}
                                                readOnly
                                                className="mt-1 w-4 h-4 rounded border-text-secondary pointer-events-none"
                                            />
                                            <span className={`flex-1 leading-relaxed ${item.checked ? 'line-through text-text-secondary' : 'text-text-primary'}`}>
                                                {renderText(item.text)}
                                            </span>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        ))}
                        {historyTodos.length === 0 && (
                            <div className="text-center text-text-secondary mt-20">
                                <p>최근 30일간 작성된 투두가 없습니다.</p>
                            </div>
                        )}
                    </div>
                </div>
            ) : (
                /* Edit Mode & Template Mode */
                <div className="w-full max-w-md mx-auto relative flex flex-col flex-1 overflow-hidden">
                    {/* Saving Indicator */}
                    <div className="absolute top-4 right-16 z-30 flex items-center gap-2 pointer-events-none">
                        <span className={`text-xs font-medium transition-opacity duration-300 ${isSaving ? 'text-accent opacity-100' : 'opacity-0'}`}>
                            저장 중...
                        </span>
                        {!isSaving && lastSaved && (
                            <span className="text-xs text-text-tertiary transition-opacity duration-500 opacity-100">
                                저장됨
                            </span>
                        )}
                    </div>

                    {/* Toggle Button (Only for Edit Mode) */}
                    {viewMode === 'edit' && (
                        <button
                            onClick={() => setIsEditing(!isEditing)}
                            className="absolute top-4 right-4 z-30 p-2 bg-bg-secondary rounded-full text-text-secondary hover:text-accent transition-colors"
                            title={isEditing ? "완료" : "편집"}
                        >
                            {isEditing ? <Check size={20} /> : <Edit3 size={20} />}
                        </button>
                    )}

                    {/* Template Mode Indicator */}
                    {viewMode === 'template' && (
                        <div className="absolute top-4 right-4 z-30 px-3 py-1 bg-accent/10 text-accent text-xs font-bold rounded-full border border-accent/20">
                            매일 반복되는 루틴을 입력하세요
                        </div>
                    )}

                    {isEditing || viewMode === 'template' ? (
                        <>
                            {/* Editor */}
                            <textarea
                                ref={textareaRef}
                                value={content}
                                onChange={handleChange}
                                onKeyDown={handleKeyDown}
                                placeholder={viewMode === 'template' ? "매일 반복할 루틴을 입력하세요..." : placeholder}
                                className="flex-1 w-full bg-transparent text-text-primary p-4 pt-16 pb-8 resize-none focus:outline-none font-mono text-sm leading-relaxed overflow-y-auto"
                                spellCheck={false}
                            />

                            {/* Mobile Toolbar */}
                            <div className="fixed bottom-0 left-0 right-0 bg-bg-secondary border-t border-bg-tertiary p-2 flex items-center justify-around z-20 max-w-md mx-auto">
                                <button onClick={() => insertText('- [ ] ')} className="p-2 text-text-secondary hover:text-accent" title="Checklist">
                                    <Square size={20} />
                                </button>
                                <button onClick={() => insertText('- [x] ')} className="p-2 text-text-secondary hover:text-accent" title="Completed">
                                    <CheckSquare size={20} />
                                </button>
                                <button onClick={() => insertText('==', -2)} className="p-2 text-text-secondary hover:text-accent" title="Highlight">
                                    <Highlighter size={20} />
                                </button>
                                <button onClick={() => insertText('**', -2)} className="p-2 text-text-secondary hover:text-accent" title="Bold">
                                    <Bold size={20} />
                                </button>
                                <button onClick={() => handleIndent('out')} className="p-2 text-text-secondary hover:text-accent" title="Outdent">
                                    <ArrowLeft size={20} />
                                </button>
                                <button onClick={() => handleIndent('in')} className="p-2 text-text-secondary hover:text-accent" title="Indent">
                                    <ArrowRight size={20} />
                                </button>
                            </div>
                        </>
                    ) : (
                        <>
                            {/* Reading Mode (Only for Edit Mode) */}
                            <div className="flex-1 overflow-y-auto p-4 pt-16 pb-8 w-full">
                                {/* Progress Bar */}
                                {todos.length > 0 && (() => {
                                    const completed = todos.filter(t => t.checked).length;
                                    const total = todos.length;
                                    const percentage = Math.round((completed / total) * 100);
                                    const levelInfo = getLevelInfo(percentage);
                                    const message = getEncouragementMessage(percentage);
                                    const progressColor = getProgressColor(percentage);

                                    return (
                                        <div className={`mb-6 p-4 bg-bg-secondary rounded-xl border border-bg-tertiary ${percentage >= 100 ? 'animate-pulse' : ''}`}>
                                            {/* Level & Progress */}
                                            <div className="flex items-center justify-between mb-2">
                                                <span className="text-sm font-bold text-text-primary">
                                                    Lv.{levelInfo.level} {levelInfo.title}
                                                </span>
                                                <span className="text-sm text-text-secondary">
                                                    {completed}/{total}
                                                </span>
                                            </div>

                                            {/* Progress Bar */}
                                            <div className="h-3 bg-bg-tertiary rounded-full overflow-hidden mb-2">
                                                <div
                                                    className={`h-full ${progressColor} transition-all duration-500 ease-out rounded-full`}
                                                    style={{ width: `${percentage}%` }}
                                                />
                                            </div>

                                            {/* Encouragement Message */}
                                            <p className="text-xs text-text-secondary text-center">
                                                {message}
                                            </p>
                                        </div>
                                    );
                                })()}

                                {todos.length === 0 ? (
                                    <p className="text-text-secondary text-sm">할 일이 없습니다. 편집 버튼을 눌러 추가하세요.</p>
                                ) : (
                                    <div className="space-y-2">
                                        {todos.map((item, idx) => (
                                            <div
                                                key={idx}
                                                className="flex items-start gap-2 py-1"
                                                style={{ paddingLeft: `${item.indent * 24}px` }}
                                            >
                                                <input
                                                    type="checkbox"
                                                    checked={item.checked}
                                                    onChange={() => toggleCheckbox(item.lineIndex)}
                                                    className="mt-1 w-4 h-4 rounded border-text-secondary focus:ring-accent focus:ring-2"
                                                />
                                                <span className={`flex-1 leading-relaxed ${item.checked ? 'line-through text-text-secondary' : 'text-text-primary'}`}>
                                                    {renderText(item.text)}
                                                </span>
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </div>
                        </>
                    )}
                </div>
            )}
        </div>
    );
};

export default TodoTab;
