import { useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { Search, X } from 'lucide-react';

interface SearchBarProps {
    initialValue?: string;
    onSearch?: (query: string) => void;
    placeholder?: string;
    autoFocus?: boolean;
}

export default function SearchBar({
    initialValue = '',
    onSearch,
    placeholder = 'Search movies, TV shows...',
    autoFocus = false
}: SearchBarProps) {
    const [query, setQuery] = useState(initialValue);
    const navigate = useNavigate();

    const handleSubmit = useCallback((e: React.FormEvent) => {
        e.preventDefault();
        const trimmed = query.trim();
        if (trimmed) {
            if (onSearch) {
                onSearch(trimmed);
            } else {
                navigate(`/search?q=${encodeURIComponent(trimmed)}`);
            }
        }
    }, [query, onSearch, navigate]);

    const handleClear = useCallback(() => {
        setQuery('');
        if (onSearch) {
            onSearch('');
        }
    }, [onSearch]);

    return (
        <form onSubmit={handleSubmit} className="relative w-full max-w-lg">
            <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                <input
                    type="text"
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                    placeholder={placeholder}
                    autoFocus={autoFocus}
                    className="w-full pl-10 pr-10 py-2.5 bg-[var(--bg-secondary)] border border-gray-700 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:border-gray-500 transition-colors"
                />
                {query && (
                    <button
                        type="button"
                        onClick={handleClear}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-white transition-colors"
                    >
                        <X className="w-5 h-5" />
                    </button>
                )}
            </div>
        </form>
    );
}
