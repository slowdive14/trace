import React, { useState, useEffect } from 'react';
import { Search } from 'lucide-react';
import type { Entry, SearchResult } from '../types/types';
import { getEntries, getTodos, deleteEntry, updateEntry } from '../services/firestore';
import { extractTags } from '../utils/tagUtils';
import { useAuth } from './AuthContext';
import EntryItem from './EntryItem';
import TodoSearchItem from './TodoSearchItem';
import { subDays, startOfDay, endOfDay } from 'date-fns';

function getCollectionName(category?: string): string {
    if (category === 'chore') return 'chores';
    if (category === 'book') return 'books';
    return 'entries';
}

interface SearchBarProps {
    onClose: () => void;
}

const SearchBar: React.FC<SearchBarProps> = ({ onClose }) => {
    const [query, setQuery] = useState('');
    const [results, setResults] = useState<SearchResult[]>([]);
    const [filteredResults, setFilteredResults] = useState<SearchResult[]>([]);
    const { user } = useAuth();

    useEffect(() => {
        const fetchData = async () => {
            if (!user) return;

            // 1. Fetch entries (action/thought)
            const entries = await getEntries(user.uid, 'entries');

            // 2. Fetch chores
            const chores = await getEntries(user.uid, 'chores');

            // 3. Fetch books
            const books = await getEntries(user.uid, 'books');

            // 4. Fetch todos (last 180 days)
            const endDate = endOfDay(new Date());
            const startDate = startOfDay(subDays(new Date(), 180));
            const todos = await getTodos(user.uid, startDate, endDate, 'todos');

            // Convert to SearchResult and combine
            const allResults: SearchResult[] = [
                ...entries.map(e => ({
                    type: 'entry' as const,
                    ...e,
                    timestamp: e.timestamp
                })),
                ...chores.map(c => ({
                    type: 'entry' as const,
                    ...c,
                    timestamp: c.timestamp
                })),
                ...books.map(b => ({
                    type: 'entry' as const,
                    ...b,
                    timestamp: b.timestamp
                })),
                ...todos.map(t => ({
                    type: 'todo' as const,
                    ...t,
                    timestamp: t.date
                }))
            ];

            setResults(allResults);
        };
        fetchData();
    }, [user]);

    const handleDelete = async (id: string) => {
        if (!user) return;
        const target = results.find(r => r.id === id);
        if (!target || target.type !== 'entry') return;
        const col = getCollectionName(target.category);
        await deleteEntry(user.uid, id, col);
        setResults(prev => prev.filter(r => r.id !== id));
    };

    const handleEdit = async (id: string, content: string) => {
        if (!user) return;
        const target = results.find(r => r.id === id);
        if (!target || target.type !== 'entry') return;
        const col = getCollectionName(target.category);
        const tags = extractTags(content);
        await updateEntry(user.uid, id, content, col, { tags });
        setResults(prev => prev.map(r =>
            r.id === id ? { ...r, content, tags } : r
        ));
    };

    useEffect(() => {
        if (!query.trim()) {
            setFilteredResults([]);
            return;
        }

        const lowerQuery = query.toLowerCase();
        const filtered = results.filter(result => {
            if (result.type === 'entry') {
                // Entry: search in content and tags
                return result.content.toLowerCase().includes(lowerQuery) ||
                       result.tags?.some(tag => tag.toLowerCase().includes(lowerQuery));
            } else {
                // Todo: search in content only
                return result.content.toLowerCase().includes(lowerQuery);
            }
        });

        // Sort by timestamp descending (newest first)
        const sorted = filtered.sort((a, b) =>
            b.timestamp.getTime() - a.timestamp.getTime()
        );

        setFilteredResults(sorted);
    }, [query, results]);

    return (
        <div className="fixed inset-0 bg-bg-primary z-50 flex flex-col">
            <div className="p-4 border-b border-bg-tertiary flex items-center gap-4">
                <div className="flex-1 relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-text-secondary" size={20} />
                    <input
                        autoFocus
                        type="text"
                        value={query}
                        onChange={(e) => setQuery(e.target.value)}
                        placeholder="Search entries, chores, todos or #tags..."
                        className="w-full bg-bg-secondary text-text-primary rounded-lg pl-10 pr-4 py-3 focus:outline-none focus:ring-1 focus:ring-accent"
                    />
                </div>
                <button onClick={onClose} className="text-text-secondary hover:text-text-primary">
                    Cancel
                </button>
            </div>

            <div className="flex-1 overflow-y-auto p-4">
                {filteredResults.length > 0 ? (
                    <div className="space-y-1 max-w-md mx-auto">
                        {filteredResults.map(result => (
                            result.type === 'entry' ? (
                                <EntryItem
                                    key={result.id}
                                    entry={result as Entry}
                                    onDelete={handleDelete}
                                    onEdit={handleEdit}
                                    highlightQuery={query}
                                    showDate={true}
                                />
                            ) : (
                                <TodoSearchItem
                                    key={result.id}
                                    todo={result as SearchResult & { type: 'todo' }}
                                    highlightQuery={query}
                                />
                            )
                        ))}
                    </div>
                ) : query ? (
                    <div className="text-center text-text-secondary mt-10">
                        No results found for "{query}"
                    </div>
                ) : (
                    <div className="text-center text-text-secondary mt-10">
                        Type to search...
                    </div>
                )}
            </div>
        </div>
    );
};

export default SearchBar;
