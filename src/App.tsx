import React, { useState, useEffect, Suspense, lazy } from 'react';
import { AuthProvider, useAuth } from './components/AuthContext';
import Layout from './components/Layout';
import Timeline from './components/Timeline';
import InputBar from './components/InputBar';
import EmotionPickerModal from './components/EmotionPickerModal';

// 시작 화면(일상 탭 = Timeline + InputBar)에 필요 없는 화면은 코드 분할한다.
// 하나의 번들을 전부 파싱해야 첫 화면이 뜨던 비용을 줄이기 위함.
const CalendarView = lazy(() => import('./components/CalendarView'));
const SearchBar = lazy(() => import('./components/SearchBar'));
const ExpenseTimeline = lazy(() => import('./components/ExpenseTimeline'));
const ExpenseInput = lazy(() => import('./components/ExpenseInput'));
const UnifiedCalendarModal = lazy(() => import('./components/UnifiedCalendarModal'));
const PhotoGallery = lazy(() => import('./components/PhotoGallery'));
const TodoTab = lazy(() => import('./components/TodoTab'));
const WorryTab = lazy(() => import('./components/WorryTab'));
const BrainDumpTab = lazy(() => import('./components/BrainDumpTab'));
import Toast from './components/common/Toast';
import { useToast } from './hooks/useToast';
import { addEntry } from './services/firestore';
import { findEmotionByTag, getEmotionName } from './utils/emotionTags';
import { extractTags } from './utils/tagUtils';
import { Smile } from 'lucide-react';
import type { Entry, Expense, Todo, Worry, WorryEntry, NavigationTarget } from './types/types';
import { onSnapshot, collection, query, orderBy } from 'firebase/firestore';
import { db } from './services/firebase';

const AppContent: React.FC = () => {
  const { user, loading } = useAuth();
  const [showCalendar, setShowCalendar] = useState(false);
  const [showSearch, setShowSearch] = useState(false);
  const [showUnifiedCalendar, setShowUnifiedCalendar] = useState(false);
  const [showGallery, setShowGallery] = useState(false);
  const [showEmotionFab, setShowEmotionFab] = useState(false);
  const [pendingEmotion, setPendingEmotion] = useState<string | null>(null);
  const [emotionNote, setEmotionNote] = useState('');
  const emotionToast = useToast();
  const [activeTab, setActiveTab] = useState<'action' | 'braindump' | 'chore' | 'book' | 'todo' | 'expense' | 'worry'>('action');
  const [selectedTag, setSelectedTag] = useState<string | null>(null);
  const [selectedExpenseDate, setSelectedExpenseDate] = useState<Date | undefined>(undefined);
  const [bookSubFilter, setBookSubFilter] = useState<string | null>(null);
  const [navigationTarget, setNavigationTarget] = useState<NavigationTarget | null>(null);

  // Data for unified calendar
  const [entries, setEntries] = useState<Entry[]>([]);
  const [books, setBooks] = useState<Entry[]>([]);
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [todos, setTodos] = useState<Todo[]>([]);
  const [worryEntries, setWorryEntries] = useState<WorryEntry[]>([]);
  const [activeWorries, setActiveWorries] = useState<Worry[]>([]);

  // 통합 캘린더 전용 데이터(books/expenses/todos/worryEntries/worries)는
  // 모달을 처음 열 때부터 구독한다. 시작 시 전 컬렉션을 내려받느라
  // 첫 화면이 늦어지던 문제를 없애기 위함. 한 번 켜지면 계속 유지되어
  // 두 번째부터는 즉시 열린다.
  const [calendarDataEnabled, setCalendarDataEnabled] = useState(false);

  // 모달을 열 때만 구독한다.
  // 예전에는 첫 화면이 뜬 뒤 idle 시점에 미리 구독해 뒀는데, 시작 직후
  // 전 컬렉션 5개(books·expenses·todos·worryEntries·worries) 리스너가 한꺼번에
  // 붙으면서 IndexedDB 캐시 초기화와 겹쳐 앱이 멈춘 것처럼 보였다.
  // 캘린더는 자주 여는 화면이 아니므로 열 때 받는 편이 낫다.
  useEffect(() => {
    if (showUnifiedCalendar) setCalendarDataEnabled(true);
  }, [showUnifiedCalendar]);


  // Subscribe to entries
  useEffect(() => {
    if (!user) return;

    const q = query(
      collection(db, `users/${user.uid}/entries`),
      orderBy("timestamp", "desc")
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const newEntries = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data(),
        timestamp: doc.data().timestamp.toDate(),
      })) as Entry[];
      setEntries(newEntries);
    });

    return () => unsubscribe();
  }, [user]);

  // Subscribe to books (통합 캘린더 전용 → 지연 구독)
  useEffect(() => {
    if (!user || !calendarDataEnabled) return;

    const q = query(
      collection(db, `users/${user.uid}/books`),
      orderBy("timestamp", "desc")
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const newBooks = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data(),
        timestamp: doc.data().timestamp.toDate(),
      })) as Entry[];
      setBooks(newBooks);
    });

    return () => unsubscribe();
  }, [user, calendarDataEnabled]);

  // Subscribe to expenses (통합 캘린더 전용 → 지연 구독)
  useEffect(() => {
    if (!user || !calendarDataEnabled) return;

    const q = query(
      collection(db, `users/${user.uid}/expenses`),
      orderBy("timestamp", "desc")
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const newExpenses = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data(),
        timestamp: doc.data().timestamp.toDate(),
      })) as Expense[];
      setExpenses(newExpenses);
    });

    return () => unsubscribe();
  }, [user, calendarDataEnabled]);

  // Subscribe to todos (통합 캘린더 전용 → 지연 구독)
  useEffect(() => {
    if (!user || !calendarDataEnabled) return;

    const q = query(
      collection(db, `users/${user.uid}/todos`),
      orderBy("date", "desc")
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const newTodos = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data(),
        date: doc.data().date.toDate(),
      })) as Todo[];
      setTodos(newTodos);
    });

    return () => unsubscribe();
  }, [user, calendarDataEnabled]);

  // Subscribe to worry entries (통합 캘린더 전용 → 지연 구독)
  useEffect(() => {
    if (!user || !calendarDataEnabled) return;

    const q = query(
      collection(db, `users/${user.uid}/worryEntries`),
      orderBy("timestamp", "desc")
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const newWorryEntries = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data(),
        timestamp: doc.data().timestamp.toDate(),
        createdAt: doc.data().createdAt.toDate(),
      })) as WorryEntry[];
      setWorryEntries(newWorryEntries);
    });

    return () => unsubscribe();
  }, [user, calendarDataEnabled]);

  // Subscribe to active worries (통합 캘린더 전용 → 지연 구독)
  useEffect(() => {
    if (!user || !calendarDataEnabled) return;

    const q = query(
      collection(db, `users/${user.uid}/worries`),
      orderBy("startDate", "desc")
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const newWorries = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data(),
        startDate: doc.data().startDate.toDate(),
        closedAt: doc.data().closedAt ? doc.data().closedAt.toDate() : undefined,
      })) as Worry[];
      setActiveWorries(newWorries);
    });

    return () => unsubscribe();
  }, [user, calendarDataEnabled]);

  const handleSearchNavigate = (target: NavigationTarget) => {
    setShowSearch(false);

    if (target.type === 'entry' && target.category) {
      // Old 'thought' entries still exist in search - navigate to action as fallback
      const tab = target.category === 'thought' ? 'action' : target.category;
      setActiveTab(tab as any);
      setSelectedTag(null);
    } else if (target.type === 'todo') {
      setActiveTab('todo');
    } else if (target.type === 'expense') {
      setActiveTab('expense');
    }

    setNavigationTarget(target);
  };

  const handleNavigationComplete = () => {
    setNavigationTarget(null);
  };

  // 갤러리에서 사진 → 해당 기록(엔트리)으로 점프
  const handleGalleryJump = (entryId: string) => {
    const entry = entries.find(e => e.id === entryId);
    setShowGallery(false);
    setSelectedTag(null);
    // 'thought'는 별도 탭이 없어 일상(action) 탭으로 폴백
    const tab = entry && entry.category !== 'thought' ? entry.category : 'action';
    setActiveTab(tab);
    setNavigationTarget({ id: entryId, type: 'entry', category: entry?.category ?? 'action', timestamp: entry?.timestamp ?? new Date() });
  };

  // FAB: 감정 선택 → 메모 작성 단계로 전환
  const handlePickEmotion = (tag: string) => {
    setPendingEmotion(tag);
  };

  // 감정 + 메모를 'entries'에 action 카테고리로 저장
  const handleSaveEmotionEntry = async () => {
    if (!user || !pendingEmotion) return;
    const note = emotionNote.trim();
    const content = note ? `${note} ${pendingEmotion}` : pendingEmotion;
    try {
      await addEntry(user.uid, content, extractTags(content), 'action', undefined, 'entries', false);
      setPendingEmotion(null);
      setEmotionNote('');
      emotionToast.show();
    } catch (e) {
      console.error('Failed to log emotion:', e);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-bg-primary flex items-center justify-center text-text-secondary">
        Loading...
      </div>
    );
  }

  return (
    <Layout
      onSearch={() => setShowSearch(true)}
      onCalendar={() => setShowUnifiedCalendar(true)}
      onGallery={() => setShowGallery(true)}
    >
      {user ? (
        <>
          {selectedTag && activeTab !== 'expense' && activeTab !== 'todo' && activeTab !== 'book' && (
            <div className="sticky top-0 bg-bg-secondary/95 backdrop-blur border-b border-bg-tertiary py-2 px-4 z-20">
              <div className="max-w-md mx-auto flex items-center justify-between">
                <span className="text-sm text-text-secondary">
                  필터: <span className="text-accent font-medium">{selectedTag}</span>
                </span>
                <button
                  onClick={() => setSelectedTag(null)}
                  className="text-text-secondary hover:text-text-primary text-sm"
                >
                  ✕ 해제
                </button>
              </div>
            </div>
          )}

          <Suspense fallback={<div className="flex items-center justify-center py-20 text-text-secondary text-sm">불러오는 중…</div>}>
          {activeTab === 'worry' ? (
            <WorryTab />
          ) : activeTab === 'braindump' ? (
            <BrainDumpTab />
          ) : activeTab === 'expense' ? (
            <>
              <ExpenseTimeline
                onDateSelect={setSelectedExpenseDate}
                navigationTarget={navigationTarget}
                onNavigationComplete={handleNavigationComplete}
              />
              <ExpenseInput externalDate={selectedExpenseDate} />
            </>
          ) : activeTab === 'todo' ? (
            <TodoTab key="todo-tab" navigationTarget={navigationTarget} onNavigationComplete={handleNavigationComplete} />
          ) : activeTab === 'chore' ? (
            <>
              <Timeline
                key="chores"
                category="chore"
                selectedTag={selectedTag}
                onTagClick={(tag: string) => setSelectedTag(tag)}
                collectionName="chores"
                navigationTarget={navigationTarget}
                onNavigationComplete={handleNavigationComplete}
              />
              <InputBar activeCategory="chore" collectionName="chores" entries={entries} />
            </>
          ) : activeTab === 'book' ? (
            <>
              <Timeline
                key="books"
                category="book"
                selectedTag={selectedTag}
                onTagClick={(tag: string) => setSelectedTag(tag)}
                collectionName="books"
                subFilter={bookSubFilter}
                onSubFilterChange={setBookSubFilter}
                navigationTarget={navigationTarget}
                onNavigationComplete={handleNavigationComplete}
              />
              <InputBar activeCategory="book" collectionName="books" entries={entries} />
            </>
          ) : (
            <>
              <Timeline
                key={activeTab}
                category={activeTab}
                selectedTag={selectedTag}
                onTagClick={(tag: string) => setSelectedTag(tag)}
                navigationTarget={navigationTarget}
                onNavigationComplete={handleNavigationComplete}
              />
              <InputBar activeCategory={activeTab} entries={entries} />
            </>
          )}
          </Suspense>

          {/* Category Tabs */}
          <div className={`fixed left-0 right-0 bg-bg-primary/80 backdrop-blur-xl border-t border-white/5 z-[45] safe-area-bottom transition-all duration-300 ${['worry', 'braindump'].includes(activeTab) ? 'bottom-0' : 'bottom-20'
            }`}>
            <div className="max-w-md mx-auto flex px-2">
              {[
                { id: 'todo', label: '투두', color: 'text-emerald-400', border: 'border-emerald-400/50' },
                { id: 'action', label: '일상', color: 'text-blue-400', border: 'border-blue-400/50' },
                { id: 'chore', label: '할일', color: 'text-orange-400', border: 'border-orange-400/50' },
                { id: 'braindump', label: '🧠 덤프', color: 'text-accent', border: 'border-accent/50' },
                { id: 'book', label: '📚 책', color: 'text-amber-600', border: 'border-amber-600/50' },
                { id: 'expense', label: '💰 돈', color: 'text-rose-400', border: 'border-rose-400/50' },
                { id: 'worry', label: '🌱 고민', color: 'text-green-400', border: 'border-green-400/50' },
              ].map((tab) => (
                <button
                  key={tab.id}
                  onClick={() => {
                    setActiveTab(tab.id as any);
                    setSelectedTag(null);
                    if (tab.id === 'book') setBookSubFilter(null);
                  }}
                  className={`flex-1 py-5 text-xs font-bold transition-all duration-300 flex flex-col items-center gap-1 ${activeTab === tab.id
                    ? `${tab.color} scale-110`
                    : 'text-text-secondary hover:text-text-primary'
                    }`}
                >
                  <span className="truncate w-full text-center">{tab.label}</span>
                  {activeTab === tab.id && (
                    <div className={`w-1 h-1 rounded-full bg-current shadow-[0_0_8px_currentColor]`} />
                  )}
                </button>
              ))}
            </div>
          </div>

          {/* 감정 빠른 기록 FAB (전체화면 탭 제외) */}
          {!['worry', 'braindump'].includes(activeTab) && (
            <button
              onClick={() => setShowEmotionFab(true)}
              className="fixed right-4 bottom-60 z-[65] w-12 h-12 rounded-full bg-yellow-500 text-white shadow-lg flex items-center justify-center hover:bg-yellow-400 active:scale-95 transition-all"
              aria-label="감정 빠른 기록"
              title="지금 기분 기록"
            >
              <Smile size={24} />
            </button>
          )}

          <EmotionPickerModal
            isOpen={showEmotionFab}
            onClose={() => setShowEmotionFab(false)}
            onSelect={handlePickEmotion}
            title="지금 기분은? 😊"
          />

          {/* 감정 선택 후 메모 작성 단계 */}
          {pendingEmotion && (
            <div
              className="fixed inset-0 bg-black/50 z-[205] flex items-center justify-center p-4"
              onClick={() => { setPendingEmotion(null); setEmotionNote(''); }}
            >
              <div className="bg-bg-secondary rounded-2xl max-w-md w-full p-5" onClick={(e) => e.stopPropagation()}>
                <h2 className="text-lg font-bold mb-3">지금 기분 기록</h2>
                <button
                  onClick={() => setShowEmotionFab(true)}
                  className="inline-flex items-center gap-1.5 px-3 py-2 rounded-full bg-accent/15 hover:bg-accent/25 text-text-primary mb-3 transition-colors"
                  title="감정 다시 고르기"
                >
                  <span className="text-base leading-none">{findEmotionByTag(pendingEmotion)?.emoji}</span>
                  <span>{getEmotionName(pendingEmotion)}</span>
                  <span className="text-xs text-text-secondary ml-1">바꾸기</span>
                </button>
                <textarea
                  value={emotionNote}
                  onChange={(e) => setEmotionNote(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && !e.shiftKey) {
                      e.preventDefault();
                      handleSaveEmotionEntry();
                    }
                  }}
                  placeholder="무슨 일이 있었나요?"
                  autoFocus
                  rows={3}
                  className="w-full bg-bg-tertiary text-text-primary rounded-lg p-3 resize-none focus:outline-none focus:ring-1 focus:ring-accent"
                />
                <div className="flex gap-2 mt-3">
                  <button
                    onClick={() => { setPendingEmotion(null); setEmotionNote(''); }}
                    className="flex-1 py-2 px-4 bg-bg-tertiary text-text-primary rounded-lg hover:bg-bg-primary transition-colors"
                  >
                    취소
                  </button>
                  <button
                    onClick={handleSaveEmotionEntry}
                    className="flex-1 py-2 px-4 bg-yellow-500 text-white rounded-lg hover:bg-yellow-400 transition-colors"
                  >
                    기록
                  </button>
                </div>
              </div>
            </div>
          )}

          <Toast message="감정이 기록되었어요" isVisible={emotionToast.isVisible} icon={<Smile size={16} />} />

          <Suspense fallback={null}>
            {showCalendar && (
              <CalendarView
                onClose={() => setShowCalendar(false)}
                onSelectDate={(date) => {
                  console.log("Selected date:", date);
                  setShowCalendar(false);
                  // TODO: Scroll to date or filter timeline
                }}
              />
            )}
            {showSearch && (
              <SearchBar onClose={() => setShowSearch(false)} onNavigate={handleSearchNavigate} />
            )}

            {showUnifiedCalendar && (
              <UnifiedCalendarModal
                onClose={() => setShowUnifiedCalendar(false)}
                entries={entries}
                books={books}
                expenses={expenses}
                todos={todos}
                worryEntries={worryEntries}
                worries={activeWorries}
              />
            )}

            {showGallery && (
              <PhotoGallery
                entries={entries}
                onClose={() => setShowGallery(false)}
                onJumpToEntry={handleGalleryJump}
              />
            )}
          </Suspense>
        </>
      ) : (
        <div className="flex flex-col items-center justify-center min-h-[80vh] px-4 text-center">
          <h2 className="text-2xl font-bold mb-4">Welcome to Serein</h2>
          <p className="text-text-secondary mb-8">
            A minimal, elegant daily logging app.
            <br />
            Sign in to start capturing your day.
          </p>
        </div>
      )}
    </Layout>
  );
};

const App: React.FC = () => {
  return (
    <AuthProvider>
      <AppContent />
    </AuthProvider>
  );
};

export default App;
