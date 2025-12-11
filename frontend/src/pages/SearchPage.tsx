import { useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowLeft, Filter } from 'lucide-react';
import MediaGrid from '../components/MediaGrid';
import SearchBar from '../components/SearchBar';
import FilterSidebar from '../components/FilterSidebar';
import { useSearch } from '../hooks/useSearch';
import { useGenres, useYears } from '../hooks/useMedia';

export default function SearchPage() {
    const [showFilters, setShowFilters] = useState(false);
    const { results, loading, pagination, filters, updateFilters } = useSearch();
    const { genres } = useGenres();
    const { years } = useYears();

    return (
        <div className="min-h-screen px-8 py-6">
            {/* Header */}
            <div className="flex items-center gap-4 mb-6">
                <Link
                    to="/"
                    className="text-gray-400 hover:text-white transition-colors"
                >
                    <ArrowLeft className="w-6 h-6" />
                </Link>
                <SearchBar
                    initialValue={filters.q || ''}
                    onSearch={(q) => updateFilters({ ...filters, q, page: 1 })}
                    autoFocus
                />
                <button
                    onClick={() => setShowFilters(!showFilters)}
                    className={`btn-secondary md:hidden ${showFilters ? 'bg-(--accent)' : ''}`}
                >
                    <Filter className="w-5 h-5" />
                </button>
            </div>

            {/* Results Count */}
            <div className="mb-4 text-gray-400">
                {pagination.total > 0 ? (
                    <span>
                        Showing {results.length} of {pagination.total} results
                        {filters.q && <span> for "{filters.q}"</span>}
                    </span>
                ) : (
                    !loading && <span>No results found</span>
                )}
            </div>

            <div className="flex gap-6">
                {/* Sidebar - Desktop */}
                <div className="hidden md:block flex-none">
                    <FilterSidebar
                        filters={filters}
                        onFilterChange={(f) => updateFilters({ ...f, page: 1 })}
                        genres={genres}
                        years={years}
                    />
                </div>

                {/* Mobile Filters */}
                {showFilters && (
                    <div className="fixed inset-0 z-50 bg-black/80 md:hidden">
                        <div className="absolute right-0 top-0 bottom-0 w-80 bg-(--bg-primary) p-4 overflow-y-auto">
                            <FilterSidebar
                                filters={filters}
                                onFilterChange={(f) => updateFilters({ ...f, page: 1 })}
                                genres={genres}
                                years={years}
                                onClose={() => setShowFilters(false)}
                                isMobile
                            />
                        </div>
                    </div>
                )}

                {/* Results Grid */}
                <div className="flex-1">
                    <MediaGrid
                        media={results}
                        loading={loading}
                        emptyMessage={filters.q ? `No results for "${filters.q}"` : 'No media matches your filters'}
                    />

                    {/* Pagination */}
                    {pagination.totalPages > 1 && (
                        <div className="flex justify-center gap-2 mt-8">
                            <button
                                onClick={() => updateFilters({ ...filters, page: Math.max(1, (filters.page || 1) - 1) })}
                                disabled={filters.page === 1}
                                className="px-4 py-2 bg-gray-700 rounded text-white disabled:opacity-50"
                            >
                                Previous
                            </button>
                            <span className="px-4 py-2 text-gray-400">
                                Page {filters.page || 1} of {pagination.totalPages}
                            </span>
                            <button
                                onClick={() => updateFilters({ ...filters, page: Math.min(pagination.totalPages, (filters.page || 1) + 1) })}
                                disabled={(filters.page || 1) >= pagination.totalPages}
                                className="px-4 py-2 bg-gray-700 rounded text-white disabled:opacity-50"
                            >
                                Next
                            </button>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}
