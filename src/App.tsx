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
import type { Entry, Expense, Todo, Worry, WorryEntry } from './types/types';
import { onSnapshot, collection, query, orderBy } from 'firebase/firestore';
import { db } from './services/firebase';

const AppContent: React.FC = () => {
  const { user, loading } = useAuth();
  const [showCalendar, setShowCalendar] = useState(false);
  const [showSearch, setShowSearch] = useState(false);
  const [showUnifiedCalendar, setShowUnifiedCalendar] = useState(false);
  const [activeTab, setActiveTab] = useState<'action' | 'thought' | 'chore' | 'todo' | 'expense' | 'worry'>('action');
  const [selectedTag, setSelectedTag] = useState<string | null>(null);
  const [selectedExpenseDate, setSelectedExpenseDate] = useState<Date | undefined>(undefined);

  // Data for unified calendar
  const [entries, setEntries] = useState<Entry[]>([]);
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
          {selectedTag && activeTab !== 'expense' && activeTab !== 'todo' && (
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
          ) : activeTab === 'expense' ? (
            <>
              <ExpenseTimeline onDateSelect={setSelectedExpenseDate} />
              <ExpenseInput externalDate={selectedExpenseDate} />
            </>
          ) : activeTab === 'todo' ? (
            <TodoTab />
          ) : activeTab === 'chore' ? (
            <>
              <Timeline
                category="chore"
                selectedTag={selectedTag}
                onTagClick={(tag: string) => setSelectedTag(tag)}
                collectionName="chores"
              />
              <InputBar activeCategory="chore" collectionName="chores" />
            </>
          ) : (
            <>
              <Timeline
                category={activeTab}
                selectedTag={selectedTag}
                onTagClick={(tag: string) => setSelectedTag(tag)}
              />
              <InputBar activeCategory={activeTab} />
            </>
          )}

          {/* Category Tabs */}
          <div className={`fixed left-0 right-0 bg-bg-primary/95 backdrop-blur border-t border-bg-tertiary z-30 ${['worry'].includes(activeTab) ? 'bottom-0' : 'bottom-20'
            }`}>
            <div className="max-w-md mx-auto flex">
              <button
                onClick={() => {
                  setActiveTab('action');
                  setSelectedTag(null);
                }}
                className={`flex-1 py-4 text-sm font-medium transition-colors ${activeTab === 'action'
                  ? 'text-blue-500 border-b-2 border-blue-500'
                  : 'text-text-secondary hover:text-text-primary'
                  }`}
              >
                일상
              </button>
              <button
                onClick={() => {
                  setActiveTab('thought');
                  setSelectedTag(null);
                }}
                className={`flex-1 py-4 text-sm font-medium transition-colors ${activeTab === 'thought'
                  ? 'text-purple-500 border-b-2 border-purple-500'
                  : 'text-text-secondary hover:text-text-primary'
                  }`}
              >
                생각
              </button>
              <button
                onClick={() => {
                  setActiveTab('chore');
                  setSelectedTag(null);
                }}
                className={`flex-1 py-4 text-sm font-medium transition-colors ${activeTab === 'chore'
                  ? 'text-orange-500 border-b-2 border-orange-500'
                  : 'text-text-secondary hover:text-text-primary'
                  }`}
              >
                할일
              </button>
              <button
                onClick={() => {
                  setActiveTab('todo');
                  setSelectedTag(null);
                }}
                className={`flex-1 py-4 text-sm font-medium transition-colors ${activeTab === 'todo'
                  ? 'text-accent border-b-2 border-accent'
                  : 'text-text-secondary hover:text-text-primary'
                  }`}
              >
                투두
              </button>
              <button
                onClick={() => {
                  setActiveTab('expense');
                  setSelectedTag(null);
                }}
                className={`flex-1 py-4 text-sm font-medium transition-colors ${activeTab === 'expense'
                  ? 'text-accent border-b-2 border-accent'
                  : 'text-text-secondary hover:text-text-primary'
                  }`}
              >
                💰 가계부
              </button>
              <button
                onClick={() => {
                  setActiveTab('worry');
                  setSelectedTag(null);
                }}
                className={`flex-1 py-4 text-sm font-medium transition-colors ${activeTab === 'worry'
                  ? 'text-green-500 border-b-2 border-green-500'
                  : 'text-text-secondary hover:text-text-primary'
                  }`}
              >
                🌱 고민
              </button>
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
            <SearchBar onClose={() => setShowSearch(false)} />
          )}

          {showUnifiedCalendar && (
            <UnifiedCalendarModal
              onClose={() => setShowUnifiedCalendar(false)}
              entries={entries}
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
