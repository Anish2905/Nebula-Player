import { X } from 'lucide-react';
import type { SearchParams } from '../types';

interface FilterSidebarProps {
    filters: SearchParams;
    onFilterChange: (filters: SearchParams) => void;
    genres: string[];
    years: number[];
    onClose?: () => void;
    isMobile?: boolean;
}

export default function FilterSidebar({
    filters,
    onFilterChange,
    genres,
    years,
    onClose,
    isMobile = false,
}: FilterSidebarProps) {
    const handleChange = (key: keyof SearchParams, value: unknown) => {
        onFilterChange({ ...filters, [key]: value || undefined });
    };

    const handleClearAll = () => {
        onFilterChange({ q: filters.q });
    };

    const hasFilters = filters.genre || filters.year || filters.resolution || filters.type;

    return (
        <div className={`bg-(--bg-secondary) p-4 rounded-lg ${isMobile ? 'w-full' : 'w-64'}`}>
            <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-semibold text-white">Filters</h3>
                <div className="flex gap-2">
                    {hasFilters && (
                        <button
                            onClick={handleClearAll}
                            className="text-sm text-red-400 hover:text-red-300"
                        >
                            Clear all
                        </button>
                    )}
                    {isMobile && onClose && (
                        <button onClick={onClose} className="text-gray-400 hover:text-white">
                            <X className="w-5 h-5" />
                        </button>
                    )}
                </div>
            </div>

            {/* Type Filter */}
            <div className="mb-4">
                <label className="block text-sm text-gray-400 mb-2">Type</label>
                <select
                    value={filters.type || 'all'}
                    onChange={(e) => handleChange('type', e.target.value === 'all' ? undefined : e.target.value)}
                    className="w-full px-3 py-2 bg-(--bg-card) border border-gray-700 rounded text-white focus:outline-none focus:border-gray-500"
                >
                    <option value="all">All</option>
                    <option value="movie">Movies</option>
                    <option value="tv">TV Shows</option>
                </select>
            </div>

            {/* Genre Filter */}
            <div className="mb-4">
                <label className="block text-sm text-gray-400 mb-2">Genre</label>
                <select
                    value={filters.genre || ''}
                    onChange={(e) => handleChange('genre', e.target.value)}
                    className="w-full px-3 py-2 bg-(--bg-card) border border-gray-700 rounded text-white focus:outline-none focus:border-gray-500"
                >
                    <option value="">All Genres</option>
                    {genres.map((genre) => (
                        <option key={genre} value={genre}>
                            {genre}
                        </option>
                    ))}
                </select>
            </div>

            {/* Year Filter */}
            <div className="mb-4">
                <label className="block text-sm text-gray-400 mb-2">Year</label>
                <select
                    value={filters.year || ''}
                    onChange={(e) => handleChange('year', e.target.value ? parseInt(e.target.value) : undefined)}
                    className="w-full px-3 py-2 bg-(--bg-card) border border-gray-700 rounded text-white focus:outline-none focus:border-gray-500"
                >
                    <option value="">All Years</option>
                    {years.map((year) => (
                        <option key={year} value={year}>
                            {year}
                        </option>
                    ))}
                </select>
            </div>

            {/* Resolution Filter */}
            <div className="mb-4">
                <label className="block text-sm text-gray-400 mb-2">Resolution</label>
                <select
                    value={filters.resolution || ''}
                    onChange={(e) => handleChange('resolution', e.target.value)}
                    className="w-full px-3 py-2 bg-(--bg-card) border border-gray-700 rounded text-white focus:outline-none focus:border-gray-500"
                >
                    <option value="">All Resolutions</option>
                    <option value="4K">4K</option>
                    <option value="1080p">1080p</option>
                    <option value="720p">720p</option>
                    <option value="SD">SD</option>
                </select>
            </div>

            {/* Sort Options */}
            <div className="mb-4">
                <label className="block text-sm text-gray-400 mb-2">Sort By</label>
                <select
                    value={filters.sort || 'rating'}
                    onChange={(e) => handleChange('sort', e.target.value)}
                    className="w-full px-3 py-2 bg-(--bg-card) border border-gray-700 rounded text-white focus:outline-none focus:border-gray-500"
                >
                    <option value="rating">Rating</option>
                    <option value="title">Title</option>
                    <option value="year">Year</option>
                    <option value="added_at">Recently Added</option>
                </select>
            </div>

            {/* Sort Order */}
            <div className="mb-4">
                <label className="block text-sm text-gray-400 mb-2">Order</label>
                <div className="flex gap-2">
                    <button
                        onClick={() => handleChange('order', 'DESC')}
                        className={`flex-1 py-2 px-3 rounded text-sm ${filters.order !== 'ASC'
                            ? 'bg-(--accent) text-white'
                            : 'bg-(--bg-card) text-gray-400'
                            }`}
                    >
                        Desc
                    </button>
                    <button
                        onClick={() => handleChange('order', 'ASC')}
                        className={`flex-1 py-2 px-3 rounded text-sm ${filters.order === 'ASC'
                            ? 'bg-(--accent) text-white'
                            : 'bg-(--bg-card) text-gray-400'
                            }`}
                    >
                        Asc
                    </button>
                </div>
            </div>
        </div>
    );
}
