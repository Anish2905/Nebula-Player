import { useState } from 'react';
import { useLocation } from 'react-router-dom';
import { Menu } from 'lucide-react';
import Sidebar from './Sidebar';

interface LayoutProps {
    children: React.ReactNode;
}

export default function Layout({ children }: LayoutProps) {
    const [sidebarOpen, setSidebarOpen] = useState(false);
    const location = useLocation();

    return (
        <div className="min-h-screen bg-(--bg-primary) flex">
            {/* Sidebar */}
            <Sidebar
                isOpen={sidebarOpen}
                onClose={() => setSidebarOpen(false)}
            />

            {/* Main Content - fixed padding for collapsed sidebar width */}
            <div className="flex-1 flex flex-col transition-all duration-300 w-full md:pl-20">
                {/* Mobile Header */}
                <div className="md:hidden flex items-center p-4 bg-black/50 backdrop-blur-md sticky top-0 z-30 border-b border-white/10">
                    <button
                        onClick={() => setSidebarOpen(true)}
                        className="text-white p-2 -ml-2 hover:bg-white/10 rounded-lg"
                    >
                        <Menu className="w-6 h-6" />
                    </button>
                    <span className="ml-3 font-bold text-lg text-white">Nebula</span>
                </div>

                {/* Page Content */}
                <main className="flex-1 relative">
                    <div key={location.pathname} className="animate-fadeIn min-h-full">
                        {children}
                    </div>
                </main>
            </div>
        </div>
    );
}
