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
import type { Entry, Expense } from './types/types';
import { onSnapshot, collection, query, orderBy } from 'firebase/firestore';
import { db } from './services/firebase';

const AppContent: React.FC = () => {
  const { user, loading } = useAuth();
  const [showCalendar, setShowCalendar] = useState(false);
  const [showSearch, setShowSearch] = useState(false);
  const [showUnifiedCalendar, setShowUnifiedCalendar] = useState(false);
  const [activeTab, setActiveTab] = useState<'action' | 'thought' | 'expense'>('action');
  const [selectedTag, setSelectedTag] = useState<string | null>(null);
  const [selectedExpenseDate, setSelectedExpenseDate] = useState<Date | undefined>(undefined);

  // Data for unified calendar
  const [entries, setEntries] = useState<Entry[]>([]);
  const [expenses, setExpenses] = useState<Expense[]>([]);

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
          {selectedTag && activeTab !== 'expense' && (
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

          {activeTab === 'expense' ? (
            <>
              <ExpenseTimeline onDateSelect={setSelectedExpenseDate} />
              <ExpenseInput externalDate={selectedExpenseDate} />
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
          <div className="fixed bottom-16 left-0 right-0 bg-bg-primary/95 backdrop-blur border-t border-bg-tertiary z-30 md:bottom-4">
            <div className="max-w-md mx-auto flex">
              <button
                onClick={() => {
                  setActiveTab('action');
                  setSelectedTag(null);
                }}
                className={`flex-1 py-3 text-sm font-medium transition-colors ${activeTab === 'action'
                  ? 'text-accent border-b-2 border-accent'
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
                className={`flex-1 py-3 text-sm font-medium transition-colors ${activeTab === 'thought'
                  ? 'text-accent border-b-2 border-accent'
                  : 'text-text-secondary hover:text-text-primary'
                  }`}
              >
                생각
              </button>
              <button
                onClick={() => {
                  setActiveTab('expense');
                  setSelectedTag(null);
                }}
                className={`flex-1 py-3 text-sm font-medium transition-colors ${activeTab === 'expense'
                  ? 'text-accent border-b-2 border-accent'
                  : 'text-text-secondary hover:text-text-primary'
                  }`}
              >
                💰 가계부
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
