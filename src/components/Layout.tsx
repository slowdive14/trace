import React, { useState } from 'react';
import { useAuth } from './AuthContext';
import { LogOut, Calendar, Search, Settings, Images } from 'lucide-react';
import SettingsModal from './SettingsModal';

/** 화면 전환 메뉴 한 칸 */
export interface NavTab {
    id: string;
    label: string;
    /** 선택됐을 때의 글자색 (탭마다 다르다) */
    color: string;
}

interface LayoutProps {
    children: React.ReactNode;
    onSearch?: () => void;
    onCalendar?: () => void;
    onGallery?: () => void;
    /** 넓은 화면의 왼쪽 메뉴에 그릴 탭 (좁은 화면에서는 App의 아래쪽 탭이 맡는다) */
    nav?: {
        tabs: NavTab[];
        active: string;
        onSelect: (id: string) => void;
    };
}

const iconButton = 'text-text-secondary hover:text-accent transition-all duration-200 hover:scale-110 active:scale-95';

const Layout: React.FC<LayoutProps> = ({ children, onSearch, onCalendar, onGallery, nav }) => {
    const { user, signOut, signInWithGoogle } = useAuth();
    const [showSettings, setShowSettings] = useState(false);

    const actions = user ? (
        <>
            <button onClick={onSearch} className={iconButton} aria-label="검색" title="검색">
                <Search size={22} strokeWidth={2.2} />
            </button>
            <button onClick={onCalendar} className={iconButton} aria-label="통합 캘린더" title="통합 캘린더">
                <Calendar size={22} strokeWidth={2.2} />
            </button>
            <button onClick={onGallery} className={iconButton} aria-label="사진 갤러리" title="사진 갤러리">
                <Images size={22} strokeWidth={2.2} />
            </button>
            <button onClick={() => setShowSettings(true)} className={iconButton} aria-label="설정" title="설정">
                <Settings size={22} strokeWidth={2.2} />
            </button>
            <button
                onClick={signOut}
                className="text-text-secondary hover:text-red-400/80 transition-all duration-200 hover:scale-110 active:scale-95"
                aria-label="로그아웃"
                title="로그아웃"
            >
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
    );

    // 왼쪽 메뉴는 로그인해서 탭이 있을 때만 쓴다. 없으면 넓은 화면에서도 위쪽 헤더를 둔다.
    const hasRail = !!(user && nav);

    return (
        <div className="min-h-screen bg-bg-primary text-text-primary font-sans selection:bg-accent/30 tracking-tight">
            <header className={`fixed top-0 left-0 right-0 h-16 bg-bg-primary/70 backdrop-blur-xl border-b border-white/5 z-[50] px-6 flex items-center justify-between app-container transition-all duration-300 ${hasRail ? 'lg:hidden' : ''}`}>
                <h1 className="text-xl font-bold tracking-tighter bg-clip-text text-transparent bg-gradient-to-r from-white to-white/60">Serein</h1>
                <div className="flex items-center gap-5">{actions}</div>
            </header>

            {/* 넓은 화면: 위쪽 헤더와 아래쪽 탭을 합친 왼쪽 메뉴. 세로 공간을 본문에 돌려준다 */}
            {hasRail && (
                <aside className="hidden lg:flex fixed inset-y-0 left-0 w-[var(--rail-w)] flex-col border-r border-white/5 bg-bg-primary z-[50] px-3 py-6">
                    <h1 className="px-3 text-xl font-bold tracking-tighter bg-clip-text text-transparent bg-gradient-to-r from-white to-white/60">
                        Serein
                    </h1>
                    <nav className="mt-8 flex flex-col gap-0.5" aria-label="화면">
                        {nav!.tabs.map(tab => {
                            const active = nav!.active === tab.id;
                            return (
                                <button
                                    key={tab.id}
                                    onClick={() => nav!.onSelect(tab.id)}
                                    aria-current={active ? 'page' : undefined}
                                    className={`flex items-center gap-3 px-3 py-2 rounded-lg text-[15px] text-left transition-colors ${active
                                        ? `${tab.color} font-semibold bg-white/[0.05]`
                                        : 'text-text-secondary font-normal hover:text-text-primary hover:bg-white/[0.03]'
                                        }`}
                                >
                                    {/* 지금 화면에만 모바일 탭과 같은 빛나는 점을 둔다.
                                        나머지는 자리만 지켜 글자 줄이 흔들리지 않게 한다 */}
                                    <span
                                        className={`w-1.5 h-1.5 rounded-full shrink-0 ${active ? 'bg-current shadow-[0_0_8px_currentColor]' : ''}`}
                                        aria-hidden="true"
                                    />
                                    <span className="truncate">{tab.label}</span>
                                </button>
                            );
                        })}
                    </nav>
                    <div className="mt-auto flex items-center justify-between px-3 pt-4 border-t border-white/5">
                        {actions}
                    </div>
                </aside>
            )}

            <main className={`pt-20 pb-24 min-h-screen transition-all duration-500 ${hasRail ? 'lg:pt-6 lg:pb-6 lg:pl-[var(--rail-w)]' : ''}`}>
                {children}
            </main>
            {showSettings && <SettingsModal onClose={() => setShowSettings(false)} />}
        </div>
    );
};

export default Layout;
