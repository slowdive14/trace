import React, { useState } from 'react';
import { useAuth } from './AuthContext';
import { LogOut, Calendar, Search, Settings } from 'lucide-react';
import SettingsModal from './SettingsModal';

interface LayoutProps {
    children: React.ReactNode;
    onSearch?: () => void;
    onCalendar?: () => void;
}

const Layout: React.FC<LayoutProps> = ({ children, onSearch, onCalendar }) => {
    const { user, signOut, signInWithGoogle } = useAuth();
    const [showSettings, setShowSettings] = useState(false);

    return (
        <div className="min-h-screen bg-bg-primary text-text-primary font-sans selection:bg-accent/30 tracking-tight">
            <header className="fixed top-0 left-0 right-0 h-16 bg-bg-primary/70 backdrop-blur-xl border-b border-white/5 z-[50] px-6 flex items-center justify-between max-w-md mx-auto w-full transition-all duration-300">
                <h1 className="text-xl font-bold tracking-tighter bg-clip-text text-transparent bg-gradient-to-r from-white to-white/60">Serein</h1>
                <div className="flex items-center gap-5">
                    {user ? (
                        <>
                            <button
                                onClick={onSearch}
                                className="text-text-secondary hover:text-accent transition-all duration-200 hover:scale-110 active:scale-95"
                            >
                                <Search size={22} strokeWidth={2.2} />
                            </button>
                            <button
                                onClick={onCalendar}
                                className="text-text-secondary hover:text-accent transition-all duration-200 hover:scale-110 active:scale-95"
                            >
                                <Calendar size={22} strokeWidth={2.2} />
                            </button>
                            <button
                                onClick={() => setShowSettings(true)}
                                className="text-text-secondary hover:text-accent transition-all duration-200 hover:scale-110 active:scale-95"
                            >
                                <Settings size={22} strokeWidth={2.2} />
                            </button>
                            <button onClick={signOut} className="text-text-secondary hover:text-red-400/80 transition-all duration-200 hover:scale-110 active:scale-95">
                                <LogOut size={22} strokeWidth={2.2} />
                            </button>
                        </>
                    ) : (
                        <button
                            onClick={signInWithGoogle}
                            className="text-sm font-semibold bg-accent text-white px-5 py-2 rounded-full hover:bg-accent-hover transition-all duration-200 shadow-lg shadow-accent/20 active:scale-95"
                        >
                            Sign In
                        </button>
                    )}
                </div>
            </header>
            <main className="pt-20 pb-24 min-h-screen transition-all duration-500">
                {children}
            </main>
            {showSettings && <SettingsModal onClose={() => setShowSettings(false)} />}
        </div>
    );
};

export default Layout;
