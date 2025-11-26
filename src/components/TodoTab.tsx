import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { useAuth } from './AuthContext';
import { saveTodo, getTodo } from '../services/firestore';
import { CheckSquare, Square, Bold, Highlighter, ArrowRight, ArrowLeft, Edit3, Check } from 'lucide-react';

interface TodoTabProps {
    date?: Date;
    collectionName?: string;
    placeholder?: string;
}

interface TodoItem {
    checked: boolean;
    text: string;
    indent: number;
    lineIndex: number;
}

const TodoTab: React.FC<TodoTabProps> = ({
    date = new Date(),
    collectionName = 'todos',
    placeholder = "오늘의 할 일을 기록하세요..."
}) => {
    const [content, setContent] = useState('');
    const [isEditing, setIsEditing] = useState(false);
    const { user } = useAuth();
    const textareaRef = useRef<HTMLTextAreaElement>(null);
    const saveTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

    const dateStr = useMemo(() => date.toISOString().split('T')[0], [date.getTime()]);

    useEffect(() => {
        const loadTodo = async () => {
            if (!user) return;
            try {
                const todo = await getTodo(user.uid, date, collectionName);
                if (todo) {
                    setContent(todo.content);
                } else {
                    setContent('');
                }
            } catch (error) {
                console.error("Failed to load todo:", error);
            }
        };
        loadTodo();
    }, [user, dateStr, collectionName]);

    const handleSave = useCallback((newContent: string) => {
        if (!user) return;

        if (saveTimeoutRef.current) {
            clearTimeout(saveTimeoutRef.current);
        }

        saveTimeoutRef.current = setTimeout(async () => {
            try {
                await saveTodo(user.uid, date, newContent, collectionName);
            } catch (error) {
                console.error("Failed to save todo:", error);
            }
        }, 500);
    }, [user, date, collectionName]);

    const handleChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
        const newContent = e.target.value;
        setContent(newContent);
        handleSave(newContent);
    };

    const parseTodos = (): TodoItem[] => {
        const lines = content.split('\n');
        const items: TodoItem[] = [];

        lines.forEach((line, index) => {
            // Count tabs and spaces for indentation
            const indentMatch = line.match(/^(\t| )*/);
            let indent = 0;
            if (indentMatch && indentMatch[0]) {
                const indentStr = indentMatch[0];
                // Each tab = 1 level, 2 spaces = 1 level
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

        // Bold: **text**
        rendered = rendered.replace(/\*\*(.+?)\*\*/g, '<strong class="font-bold">$1</strong>');

        // Highlight: ==text==
        rendered = rendered.replace(/==(.+?)==/g, '<mark class="bg-yellow-500/30 px-1">$1</mark>');

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
        if (e.key === 'Enter') {
            e.preventDefault();
            const start = e.currentTarget.selectionStart;
            const lineStart = content.lastIndexOf('\n', start - 1) + 1;
            const lineEnd = content.indexOf('\n', start);
            const currentLine = content.substring(lineStart, lineEnd === -1 ? content.length : lineEnd);

            // Extract indentation (tabs and spaces)
            const indentation = currentLine.match(/^[\t ]*/)?.[0] || '';

            // Always add - [ ] for new line
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

    const todos = parseTodos();

    return (
        <div className="flex flex-col h-[calc(100vh-224px)] relative">
            <div className="w-full max-w-md mx-auto relative flex-1 flex flex-col">
                {/* Toggle Button */}
                <button
                    onClick={() => setIsEditing(!isEditing)}
                    className="absolute top-4 right-4 z-30 p-2 bg-bg-secondary rounded-full text-text-secondary hover:text-accent transition-colors"
                    title={isEditing ? "완료" : "편집"}
                >
                    {isEditing ? <Check size={20} /> : <Edit3 size={20} />}
                </button>

                {isEditing ? (
                    <>
                        {/* Edit Mode */}
                        <textarea
                            ref={textareaRef}
                            value={content}
                            onChange={handleChange}
                            onKeyDown={handleKeyDown}
                            placeholder={placeholder}
                            className="flex-1 w-full bg-transparent text-text-primary p-4 pt-16 resize-none focus:outline-none font-mono text-sm leading-relaxed"
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
                        {/* Reading Mode */}
                        <div className="flex-1 overflow-y-auto p-4 pt-16 pb-4 w-full">
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
                                            <span className={`flex-1 text-sm leading-relaxed ${item.checked ? 'line-through text-text-secondary' : 'text-text-primary'}`}>
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
        </div>
    );
};

export default TodoTab;
