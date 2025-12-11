import { NavLink } from 'react-router-dom';
import { Home, Film, Tv, Settings, Search, RefreshCw, X } from 'lucide-react';
import { useState } from 'react';
import { mediaApi } from '../api/client';
import { useQueryClient } from '@tanstack/react-query';

interface SidebarProps {
    isOpen: boolean;
    onClose: () => void;
}

export default function Sidebar({ isOpen, onClose }: SidebarProps) {
    const [scanning, setScanning] = useState(false);
    const queryClient = useQueryClient();

    const handleScan = async () => {
        setScanning(true);
        try {
            await mediaApi.scan();
            await queryClient.invalidateQueries({ queryKey: ['media'] });
            await queryClient.invalidateQueries({ queryKey: ['continue-watching'] });
        } catch (err) {
            console.error('Scan failed:', err);
        } finally {
            setScanning(false);
        }
    };

    const links = [
        { to: '/', icon: Home, label: 'Home' },
        { to: '/?type=movie', icon: Film, label: 'Movies' },
        { to: '/?type=tv', icon: Tv, label: 'TV Shows' },
        { to: '/search', icon: Search, label: 'Search' },
        { to: '/settings', icon: Settings, label: 'Settings' },
    ];

    return (
        <>
            {/* Mobile Overlay */}
            <div
                className={`fixed inset-0 bg-black/50 z-40 transition-opacity md:hidden ${isOpen ? 'opacity-100' : 'opacity-0 pointer-events-none'
                    }`}
                onClick={onClose}
            />

            {/* Sidebar Container */}
            <aside
                className={`fixed top-0 left-0 bottom-0 bg-black/95 border-r border-white/10 z-50 transition-all duration-300 group
                    ${isOpen ? 'translate-x-0' : '-translate-x-full md:translate-x-0'}
                    md:w-20 md:hover:w-64 w-64
                `}
            >
                <div className="flex flex-col h-full p-4">
                    {/* Logo/Header */}
                    <div className="flex items-center justify-between mb-8 h-10 overflow-hidden">
                        <h1 className="text-2xl font-bold bg-linear-to-r from-teal-400 to-blue-500 bg-clip-text text-transparent truncate opacity-0% group-hover:opacity-100 transition-opacity duration-300 md:opacity-0 md:group-hover:opacity-100 opacity-100">
                            Nebula
                        </h1>
                        {/* Always show a small dot or icon when collapsed? No, logo text fading in is fine. 
                            Actually, when collapsed (w-20), we want to show something. 
                            Let's show a small logo icon when collapsed, and full text when expanded.
                        */}
                        <div className="absolute left-6 w-8 h-8 rounded-full bg-linear-to-r from-teal-400 to-blue-500 md:opacity-100 md:group-hover:opacity-0 transition-opacity duration-300 pointer-events-none" />

                        <button onClick={onClose} className="md:hidden text-gray-400 hover:text-white">
                            <X className="w-6 h-6" />
                        </button>
                    </div>

                    {/* Navigation */}
                    <nav className="flex-1 space-y-2">
                        {links.map((link) => (
                            <NavLink
                                key={link.to}
                                to={link.to}
                                onClick={() => window.innerWidth < 768 && onClose()}
                                className={({ isActive }) =>
                                    `flex items-center gap-3 px-3 py-3 rounded-lg transition-colors overflow-hidden whitespace-nowrap ${isActive
                                        ? 'bg-white/10 text-white'
                                        : 'text-gray-400 hover:text-white hover:bg-white/5'
                                    }`
                                }
                            >
                                <link.icon className="w-5 h-5 shrink-0" />
                                <span className="font-medium opacity-100 md:opacity-0 md:group-hover:opacity-100 transition-opacity duration-300 delay-75">
                                    {link.label}
                                </span>
                            </NavLink>
                        ))}
                    </nav>

                    {/* Footer Actions */}
                    <div className="pt-4 border-t border-white/10 space-y-2">
                        <button
                            onClick={handleScan}
                            disabled={scanning}
                            className="flex items-center gap-3 px-3 py-3 w-full text-left text-gray-400 hover:text-white hover:bg-white/5 rounded-lg transition-colors overflow-hidden whitespace-nowrap"
                        >
                            <RefreshCw className={`w-5 h-5 shrink-0 ${scanning ? 'animate-spin' : ''}`} />
                            <span className="font-medium opacity-100 md:opacity-0 md:group-hover:opacity-100 transition-opacity duration-300 delay-75">
                                {scanning ? 'Scanning...' : 'Scan Library'}
                            </span>
                        </button>
                    </div>
                </div>
            </aside>
        </>
    );
}
