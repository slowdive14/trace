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
        <div className="min-h-screen bg-bg-primary text-text-primary font-sans">
            <header className="fixed top-0 left-0 right-0 h-14 bg-bg-primary/80 backdrop-blur border-b border-bg-tertiary z-20 px-4 flex items-center justify-between max-w-md mx-auto w-full">
                <h1 className="text-lg font-bold tracking-tight">Serein</h1>
                <div className="flex items-center gap-4">
                    {user ? (
                        <>
                            <button
                                onClick={onSearch}
                                className="text-text-secondary hover:text-text-primary transition-colors"
                            >
                                <Search size={20} />
                            </button>
                            <button
                                onClick={onCalendar}
                                className="text-text-secondary hover:text-text-primary transition-colors"
                            >
                                <Calendar size={20} />
                            </button>
                            <button
                                onClick={() => setShowSettings(true)}
                                className="text-text-secondary hover:text-text-primary transition-colors"
                            >
                                <Settings size={20} />
                            </button>
                            <button onClick={signOut} className="text-text-secondary hover:text-red-400 transition-colors">
                                <LogOut size={20} />
                            </button>
                        </>
                    ) : (
                        <button
                            onClick={signInWithGoogle}
                            className="text-sm bg-accent text-white px-3 py-1.5 rounded-md hover:bg-opacity-90 transition-all"
                        >
                            Sign In
                        </button>
                    )}
                </div>
            </header>
            <main className="pt-16 min-h-screen">
                {children}
            </main>
            {showSettings && <SettingsModal onClose={() => setShowSettings(false)} />}
        </div>
    );
};

export default Layout;
