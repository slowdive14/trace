import React, { useState, useEffect } from 'react';
import { Search } from 'lucide-react';
import type { Entry } from '../types/types';
import { getEntries } from '../services/firestore';
import { useAuth } from './AuthContext';
import EntryItem from './EntryItem';

interface SearchBarProps {
    onClose: () => void;
}

const SearchBar: React.FC<SearchBarProps> = ({ onClose }) => {
    const [query, setQuery] = useState('');
    const [entries, setEntries] = useState<Entry[]>([]);
    const [filteredEntries, setFilteredEntries] = useState<Entry[]>([]);
    const { user } = useAuth();

    useEffect(() => {
        const fetchEntries = async () => {
            if (!user) return;
            const allEntries = await getEntries(user.uid);
            setEntries(allEntries);
        };
        fetchEntries();
    }, [user]);

    useEffect(() => {
        if (!query.trim()) {
            setFilteredEntries([]);
            return;
        }
        const lowerQuery = query.toLowerCase();
        const filtered = entries.filter(entry =>
            entry.content.toLowerCase().includes(lowerQuery) ||
            entry.tags.some(tag => tag.toLowerCase().includes(lowerQuery))
        );
        setFilteredEntries(filtered);
    }, [query, entries]);

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
                        placeholder="Search entries or #tags..."
                        className="w-full bg-bg-secondary text-text-primary rounded-lg pl-10 pr-4 py-3 focus:outline-none focus:ring-1 focus:ring-accent"
                    />
                </div>
                <button onClick={onClose} className="text-text-secondary hover:text-text-primary">
                    Cancel
                </button>
            </div>

            <div className="flex-1 overflow-y-auto p-4">
                {filteredEntries.length > 0 ? (
                    <div className="space-y-1 max-w-md mx-auto">
                        {filteredEntries.map(entry => (
                            <EntryItem key={entry.id} entry={entry} onDelete={() => { }} highlightQuery={query} />
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
