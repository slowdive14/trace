import React, { useState, useEffect, useRef } from 'react';
import { useAuth } from './AuthContext';
import { saveTodo, getTodo } from '../services/firestore';
import { CheckSquare, Square, Bold, Highlighter, ArrowRight, ArrowLeft } from 'lucide-react';

interface TodoTabProps {
    date?: Date;
}

const TodoTab: React.FC<TodoTabProps> = ({ date = new Date() }) => {
    const [content, setContent] = useState('');
    const { user } = useAuth();
    const textareaRef = useRef<HTMLTextAreaElement>(null);
    const saveTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

    useEffect(() => {
        const loadTodo = async () => {
            if (!user) return;
            try {
                const todo = await getTodo(user.uid, date);
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
    }, [user, date]);

    const handleSave = (newContent: string) => {
        if (!user) {
            console.log("❌ TodoTab: No user, cannot save");
            return;
        }

        console.log("⏳ TodoTab: Scheduling save for content:", newContent.substring(0, 50));

        if (saveTimeoutRef.current) {
            clearTimeout(saveTimeoutRef.current);
        }

        saveTimeoutRef.current = setTimeout(async () => {
            try {
                console.log("💾 TodoTab: Attempting to save to Firestore...");
                console.log("  - User ID:", user.uid);
                console.log("  - Date:", date.toISOString());
                console.log("  - Content length:", newContent.length);
                await saveTodo(user.uid, date, newContent);
                console.log("✅ TodoTab: Save successful!");
            } catch (error) {
                console.error("❌ TodoTab: Failed to save todo:", error);
            }
        }, 1000);
    };

    const handleChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
        const newContent = e.target.value;
        setContent(newContent);
        handleSave(newContent);
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

            let nextLinePrefix = '\n';
            if (currentLine.trim().startsWith('- [ ] ')) {
                nextLinePrefix += '- [ ] ';
            } else if (currentLine.trim().startsWith('- [x] ')) {
                nextLinePrefix += '- [ ] '; // Always continue with unchecked
            } else if (currentLine.trim().startsWith('- ')) {
                nextLinePrefix += '- ';
            }

            // Preserve indentation
            const indentation = currentLine.match(/^\s*/)?.[0] || '';
            if (nextLinePrefix !== '\n') {
                nextLinePrefix = '\n' + indentation + nextLinePrefix.trimStart();
            } else {
                nextLinePrefix += indentation;
            }

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
            // Adjust cursor
            setTimeout(() => {
                if (textareaRef.current) {
                    textareaRef.current.selectionStart = textareaRef.current.selectionEnd = start + 1;
                    textareaRef.current.focus();
                }
            }, 0);
        } else {
            // Outdent logic (remove tab or 4 spaces)
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

    return (
        <div className="flex flex-col h-[calc(100vh-64px)] relative pb-20">
            <textarea
                ref={textareaRef}
                value={content}
                onChange={handleChange}
                onKeyDown={handleKeyDown}
                placeholder="오늘의 할 일을 기록하세요..."
                className="flex-1 w-full bg-transparent text-text-primary p-4 resize-none focus:outline-none font-mono text-sm leading-relaxed"
                spellCheck={false}
            />

            {/* Mobile Toolbar */}
            <div className="fixed bottom-20 left-0 right-0 bg-bg-secondary border-t border-bg-tertiary p-2 flex items-center justify-around z-20 max-w-md mx-auto">
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
        </div>
    );
};

export default TodoTab;
