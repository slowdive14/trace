import React, { useState } from 'react';
import { AuthProvider, useAuth } from './components/AuthContext';
import Layout from './components/Layout';
import Timeline from './components/Timeline';
import InputBar from './components/InputBar';
import CalendarView from './components/CalendarView';
import SearchBar from './components/SearchBar';

const AppContent: React.FC = () => {
  const { user, loading } = useAuth();
  const [showCalendar, setShowCalendar] = useState(false);
  const [showSearch, setShowSearch] = useState(false);
  const [activeCategory, setActiveCategory] = useState<'action' | 'thought' | 'all'>('action');
  const [selectedTag, setSelectedTag] = useState<string | null>(null);

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
      onCalendar={() => setShowCalendar(true)}
    >
      {user ? (
        <>
          {selectedTag && (
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
          <Timeline
            category={activeCategory}
            selectedTag={selectedTag}
            onTagClick={(tag: string) => setSelectedTag(tag)}
          />
          <InputBar activeCategory={activeCategory === 'all' ? 'action' : activeCategory} />

          {/* Category Tabs */}
          <div className="fixed bottom-16 left-0 right-0 bg-bg-secondary/95 backdrop-blur border-t border-bg-tertiary">
            <div className="max-w-md mx-auto flex">
              <button
                onClick={() => setActiveCategory('action')}
                className={`flex-1 py-3 text-sm font-medium transition-colors ${activeCategory === 'action'
                  ? 'text-accent border-b-2 border-accent'
                  : 'text-text-secondary hover:text-text-primary'
                  }`}
              >
                일상
              </button>
              <button
                onClick={() => setActiveCategory('thought')}
                className={`flex-1 py-3 text-sm font-medium transition-colors ${activeCategory === 'thought'
                  ? 'text-accent border-b-2 border-accent'
                  : 'text-text-secondary hover:text-text-primary'
                  }`}
              >
                생각
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
