import React, { useState, useEffect } from 'react';
import { AuthProvider, useAuth } from './components/AuthContext';
import Layout from './components/Layout';
import Timeline from './components/Timeline';
import InputBar from './components/InputBar';
import CalendarView from './components/CalendarView';
import SearchBar from './components/SearchBar';
import ExpenseTimeline from './components/ExpenseTimeline';
import ExpenseInput from './components/ExpenseInput';
import UnifiedCalendarModal from './components/UnifiedCalendarModal';
import TodoTab from './components/TodoTab';
import WorryTab from './components/WorryTab';
import BrainDumpTab from './components/BrainDumpTab';
import type { Entry, Expense, Todo, Worry, WorryEntry, NavigationTarget } from './types/types';
import { onSnapshot, collection, query, orderBy } from 'firebase/firestore';
import { db } from './services/firebase';

const AppContent: React.FC = () => {
  const { user, loading } = useAuth();
  const [showCalendar, setShowCalendar] = useState(false);
  const [showSearch, setShowSearch] = useState(false);
  const [showUnifiedCalendar, setShowUnifiedCalendar] = useState(false);
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

  // Subscribe to books
  useEffect(() => {
    if (!user) return;

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
  }, [user]);

  // Subscribe to expenses
  useEffect(() => {
    if (!user) return;

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
  }, [user]);

  // Subscribe to todos
  useEffect(() => {
    if (!user) return;

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
  }, [user]);

  // Subscribe to worry entries
  useEffect(() => {
    if (!user) return;

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
  }, [user]);

  // Subscribe to active worries (for export context)
  useEffect(() => {
    if (!user) return;

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
  }, [user]);

  const handleSearchNavigate = (target: NavigationTarget) => {
    setShowSearch(false);

    if (target.type === 'entry' && target.category) {
      // Old 'thought' entries still exist in search - navigate to action as fallback
      const tab = target.category === 'thought' ? 'action' : target.category;
      setActiveTab(tab as any);
      setSelectedTag(null);
    } else if (target.type === 'todo') {
      setActiveTab('todo');
    }

    setNavigationTarget(target);
  };

  const handleNavigationComplete = () => {
    setNavigationTarget(null);
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

          {activeTab === 'worry' ? (
            <WorryTab />
          ) : activeTab === 'braindump' ? (
            <BrainDumpTab />
          ) : activeTab === 'expense' ? (
            <>
              <ExpenseTimeline onDateSelect={setSelectedExpenseDate} />
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

          {/* Category Tabs */}
          <div className={`fixed left-0 right-0 bg-bg-primary/80 backdrop-blur-xl border-t border-white/5 z-[45] safe-area-bottom transition-all duration-300 ${['worry', 'braindump'].includes(activeTab) ? 'bottom-0' : 'bottom-20'
            }`}>
            <div className="max-w-md mx-auto flex px-2">
              {[
                { id: 'action', label: '일상', color: 'text-blue-400', border: 'border-blue-400/50' },
                { id: 'braindump', label: '🧠 덤프', color: 'text-accent', border: 'border-accent/50' },
                { id: 'chore', label: '할일', color: 'text-orange-400', border: 'border-orange-400/50' },
                { id: 'book', label: '📚 책', color: 'text-amber-600', border: 'border-amber-600/50' },
                { id: 'todo', label: '투두', color: 'text-emerald-400', border: 'border-emerald-400/50' },
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
