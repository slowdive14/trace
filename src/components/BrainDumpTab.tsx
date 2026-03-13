import React, { useState, useEffect, useRef } from 'react';
import { useAuth } from './AuthContext';
import { saveBrainDump, updateBrainDump, getBrainDumps, deleteBrainDump } from '../services/firestore';
import { analyzeBrainDump } from '../services/gemini';
import type { BrainDump } from '../types/types';
import { format } from 'date-fns';
import { ko } from 'date-fns/locale';
import { Loader2, Trash2, ChevronDown, ChevronUp, Clock, ArrowLeft, History, Sparkles, AlertCircle } from 'lucide-react';

type ViewState = 'idle' | 'writing' | 'analyzing' | 'result' | 'history';

const DURATION_OPTIONS = [5, 10, 15, 20] as const;

const BrainDumpTab: React.FC = () => {
  const { user } = useAuth();
  const [view, setView] = useState<ViewState>('idle');
  const [selectedDuration, setSelectedDuration] = useState<number>(10);
  const [content, setContent] = useState('');
  const [timeLeft, setTimeLeft] = useState(0);
  const [totalTime, setTotalTime] = useState(0);
  const [currentDumpId, setCurrentDumpId] = useState<string | null>(null);
  const [currentResult, setCurrentResult] = useState<BrainDump | null>(null);
  const [dumps, setDumps] = useState<BrainDump[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [showRawContent, setShowRawContent] = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);
  const [resumeBanner, setResumeBanner] = useState<BrainDump | null>(null);

  const [isDeleting, setIsDeleting] = useState(false);
  const [idleSeconds, setIdleSeconds] = useState(0);

  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const autoSaveRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const startTimeRef = useRef<number>(0);
  const lastTypeTimeRef = useRef<number>(Date.now());
  const deleteIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const idleCheckRef = useRef<ReturnType<typeof setInterval> | null>(null);
  // Ref to always have latest finishWriting without stale closures
  const finishWritingRef = useRef<() => void>(() => { });

  // Load dumps on mount
  useEffect(() => {
    if (!user) return;
    loadDumps();
  }, [user]);

  const loadDumps = async () => {
    if (!user) return;
    try {
      const data = await getBrainDumps(user.uid);
      setDumps(data);

      // Check for interrupted writing sessions
      const writingSession = data.find(d => d.status === 'writing');
      if (writingSession) {
        setResumeBanner(writingSession);
      }
    } catch (e) {
      console.error('Error loading brain dumps:', e);
    }
  };

  // Timer logic - counts down to 0, then keeps going negative (overtime)
  useEffect(() => {
    if (view !== 'writing') return;

    timerRef.current = setInterval(() => {
      setTimeLeft(prev => prev - 1);
    }, 1000);

    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [view]);

  // Idle detection: check every 200ms if user stopped typing for 3 seconds
  useEffect(() => {
    if (view !== 'writing') return;

    idleCheckRef.current = setInterval(() => {
      const idleMs = Date.now() - lastTypeTimeRef.current;
      const idleSec = Math.floor(idleMs / 1000);
      setIdleSeconds(idleSec);

      if (idleMs >= 3000) {
        // Start deleting if not already
        if (!deleteIntervalRef.current) {
          setIsDeleting(true);
          deleteIntervalRef.current = setInterval(() => {
            setContent(prev => {
              if (prev.length === 0) return prev;
              // Delete last word (or last char if no space)
              const trimmed = prev.trimEnd();
              const lastSpace = trimmed.lastIndexOf(' ');
              if (lastSpace === -1) {
                // Only one word left - delete char by char
                return trimmed.slice(0, -1);
              }
              return trimmed.slice(0, lastSpace);
            });
          }, 200);
        }
      }
    }, 200);

    return () => {
      if (idleCheckRef.current) clearInterval(idleCheckRef.current);
      if (deleteIntervalRef.current) {
        clearInterval(deleteIntervalRef.current);
        deleteIntervalRef.current = null;
      }
    };
  }, [view]);

  // Auto-save: use ref for content to avoid restarting interval on every keystroke
  const contentRef = useRef(content);
  contentRef.current = content;
  const currentDumpIdRef = useRef(currentDumpId);
  currentDumpIdRef.current = currentDumpId;

  useEffect(() => {
    if (view !== 'writing' || !currentDumpId || !user) return;

    autoSaveRef.current = setInterval(async () => {
      const currentContent = contentRef.current;
      const dumpId = currentDumpIdRef.current;
      if (currentContent.trim() && dumpId) {
        try {
          await updateBrainDump(user.uid, dumpId, {
            content: currentContent,
            wordCount: currentContent.replace(/\s/g, '').length,
            actualDurationSeconds: Math.floor((Date.now() - startTimeRef.current) / 1000),
          });
        } catch (e) {
          console.error('Auto-save failed:', e);
        }
      }
    }, 30000);

    return () => {
      if (autoSaveRef.current) clearInterval(autoSaveRef.current);
    };
  }, [view, currentDumpId, user]);

  // Focus textarea when entering writing mode
  useEffect(() => {
    if (view === 'writing' && textareaRef.current) {
      setTimeout(() => textareaRef.current?.focus(), 100);
    }
  }, [view]);

  const handleStart = async () => {
    if (!user) return;

    const durationSeconds = selectedDuration * 60;
    setTimeLeft(durationSeconds);
    setTotalTime(durationSeconds);
    setContent('');
    setError(null);
    startTimeRef.current = Date.now();

    try {
      const id = await saveBrainDump(user.uid, '', selectedDuration, 0, 0, 'writing');
      setCurrentDumpId(id);
      setView('writing');
    } catch (e) {
      console.error('Error starting brain dump:', e);
    }
  };

  const handleResume = (dump: BrainDump) => {
    setContent(dump.content);
    setCurrentDumpId(dump.id);
    setSelectedDuration(dump.durationMinutes);
    // Give remaining time (at least 1 minute)
    const remaining = Math.max(60, dump.durationMinutes * 60 - dump.actualDurationSeconds);
    setTimeLeft(remaining);
    setTotalTime(remaining);
    startTimeRef.current = Date.now() - (dump.actualDurationSeconds * 1000);
    setResumeBanner(null);
    setView('writing');
  };

  const handleDiscardResume = async (dump: BrainDump) => {
    if (!user) return;
    try {
      await updateBrainDump(user.uid, dump.id, { status: 'completed' });
      setResumeBanner(null);
      loadDumps();
    } catch (e) {
      console.error('Error discarding session:', e);
    }
  };

  const cleanupWritingIntervals = () => {
    if (timerRef.current) clearInterval(timerRef.current);
    if (autoSaveRef.current) clearInterval(autoSaveRef.current);
    if (deleteIntervalRef.current) { clearInterval(deleteIntervalRef.current); deleteIntervalRef.current = null; }
    if (idleCheckRef.current) { clearInterval(idleCheckRef.current); idleCheckRef.current = null; }
    setIsDeleting(false);
    setIdleSeconds(0);
  };

  const handleManualStop = () => {
    const charCount = content.replace(/\s/g, '').length;
    if (charCount < 20) {
      setError('조금 더 적어볼까요? (최소 20자)');
      setTimeout(() => setError(null), 3000);
      return;
    }
    cleanupWritingIntervals();
    finishWriting();
  };

  const finishWriting = async () => {
    if (!user || !currentDumpId) return;
    // Prevent double-invocation
    if (view !== 'writing' && view !== 'analyzing') return;

    const actualSeconds = Math.floor((Date.now() - startTimeRef.current) / 1000);
    const wordCount = content.replace(/\s/g, '').length;

    // Save final content
    try {
      await updateBrainDump(user.uid, currentDumpId, {
        content,
        actualDurationSeconds: actualSeconds,
        wordCount,
        status: 'analyzing',
      });
    } catch (e) {
      console.error('Error saving final content:', e);
    }

    // Skip AI if content too short
    if (wordCount < 20) {
      await updateBrainDump(user.uid, currentDumpId, { status: 'completed' });
      const result: BrainDump = {
        id: currentDumpId,
        content,
        durationMinutes: selectedDuration,
        actualDurationSeconds: actualSeconds,
        wordCount,
        status: 'completed',
        timestamp: new Date(),
        createdAt: new Date(),
        updatedAt: new Date(),
      };
      setCurrentResult(result);
      setView('result');
      loadDumps();
      return;
    }

    setView('analyzing');

    // Try AI analysis
    try {
      const insight = await analyzeBrainDump(content);
      await updateBrainDump(user.uid, currentDumpId, {
        status: 'completed',
        insight,
      });

      const result: BrainDump = {
        id: currentDumpId,
        content,
        durationMinutes: selectedDuration,
        actualDurationSeconds: actualSeconds,
        wordCount,
        status: 'completed',
        insight,
        timestamp: new Date(),
        createdAt: new Date(),
        updatedAt: new Date(),
      };
      setCurrentResult(result);
      setView('result');
    } catch (e) {
      console.error('AI analysis failed:', e);
      await updateBrainDump(user.uid, currentDumpId, { status: 'completed' });

      const result: BrainDump = {
        id: currentDumpId,
        content,
        durationMinutes: selectedDuration,
        actualDurationSeconds: actualSeconds,
        wordCount,
        status: 'completed',
        timestamp: new Date(),
        createdAt: new Date(),
        updatedAt: new Date(),
      };
      setCurrentResult(result);
      setError('AI 분석에 실패했습니다. 원문은 저장되었습니다.');
      setView('result');
    }

    loadDumps();
  };

  // Keep ref in sync so timer callback always calls latest finishWriting
  finishWritingRef.current = finishWriting;

  const handleRetryAnalysis = async () => {
    if (!user || !currentResult) return;
    setError(null);
    setView('analyzing');

    try {
      const insight = await analyzeBrainDump(currentResult.content);
      await updateBrainDump(user.uid, currentResult.id, { insight });
      setCurrentResult({ ...currentResult, insight });
      setView('result');
      loadDumps();
    } catch (e) {
      console.error('Retry failed:', e);
      setError('AI 분석에 다시 실패했습니다.');
      setView('result');
    }
  };

  const handleDelete = async (dumpId: string) => {
    if (!user) return;
    try {
      await deleteBrainDump(user.uid, dumpId);
      setDeleteConfirm(null);
      loadDumps();
      if (currentResult?.id === dumpId) {
        setCurrentResult(null);
        setView('idle');
      }
    } catch (e) {
      console.error('Error deleting:', e);
    }
  };

  const viewDump = (dump: BrainDump) => {
    setCurrentResult(dump);
    setShowRawContent(false);
    setError(null);
    setView('result');
  };

  const handleAnalyzeFromHistory = async (dump: BrainDump) => {
    if (!user) return;
    setCurrentResult(dump);
    setError(null);
    setView('analyzing');

    try {
      const insight = await analyzeBrainDump(dump.content);
      await updateBrainDump(user.uid, dump.id, { insight });
      setCurrentResult({ ...dump, insight });
      setView('result');
      loadDumps();
    } catch (e) {
      console.error('Analysis from history failed:', e);
      setCurrentResult(dump);
      setError('AI 분석에 실패했습니다.');
      setView('result');
    }
  };

  const formatTime = (seconds: number) => {
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  };

  const formatDuration = (seconds: number) => {
    if (seconds < 60) return `${seconds}초`;
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return s > 0 ? `${m}분 ${s}초` : `${m}분`;
  };

  // ─── Writing View ───
  if (view === 'writing') {
    const progress = totalTime > 0 ? Math.min(((totalTime - timeLeft) / totalTime) * 100, 100) : 0;
    const charCount = content.replace(/\s/g, '').length;
    const isOvertime = timeLeft <= 0;

    return (
      <div className="fixed inset-0 z-50 bg-bg-primary flex flex-col">
        {/* Progress bar */}
        <div className="h-1 bg-bg-tertiary">
          <div
            className={`h-full transition-all duration-1000 ${isOvertime
              ? 'bg-gradient-to-r from-green-500 to-emerald-400'
              : 'bg-gradient-to-r from-purple-600 to-purple-400'
              }`}
            style={{ width: `${progress}%` }}
          />
        </div>

        {/* Top bar */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-bg-tertiary">
          <div className="flex items-center gap-3">
            <span className={`font-mono text-lg font-bold ${isOvertime ? 'text-green-400' : timeLeft <= 60 ? 'text-red-400 animate-pulse' : 'text-purple-400'
              }`}>
              {isOvertime ? `+${formatTime(Math.abs(timeLeft))}` : formatTime(timeLeft)}
            </span>
            <span className="text-text-secondary text-sm">{charCount}자</span>
          </div>
          <button
            onClick={handleManualStop}
            className="px-4 py-1.5 bg-purple-600 text-white rounded-full text-sm font-medium hover:bg-purple-500 transition-colors"
          >
            완료
          </button>
        </div>

        {/* Error message */}
        {error && (
          <div className="px-4 py-2 bg-red-500/10 text-red-400 text-sm text-center">
            {error}
          </div>
        )}

        {/* Idle warning */}
        {idleSeconds >= 2 && !isDeleting && content.length > 0 && (
          <div className="px-4 py-1.5 bg-orange-500/10 text-orange-400 text-xs text-center animate-pulse">
            계속 적으세요... 멈추면 글이 사라집니다
          </div>
        )}
        {isDeleting && (
          <div className="px-4 py-1.5 bg-red-500/20 text-red-400 text-xs text-center animate-pulse font-medium">
            타이핑하세요! 글이 사라지고 있어요!
          </div>
        )}

        {/* Textarea */}
        <textarea
          ref={textareaRef}
          value={content}
          onChange={e => {
            setContent(e.target.value);
            lastTypeTimeRef.current = Date.now();
            setIdleSeconds(0);
            // Stop deletion if currently deleting
            if (deleteIntervalRef.current) {
              clearInterval(deleteIntervalRef.current);
              deleteIntervalRef.current = null;
              setIsDeleting(false);
            }
          }}
          className={`flex-1 w-full bg-transparent text-lg leading-relaxed p-6 resize-none focus:outline-none placeholder-text-secondary/50 transition-colors ${isDeleting ? 'text-red-400/70' : 'text-text-primary'
            }`}
          placeholder="지금 머릿속에 있는 것들을 자유롭게 쏟아내세요..."
        />
      </div>
    );
  }

  // ─── Analyzing View ───
  if (view === 'analyzing') {
    return (
      <div className="flex flex-col items-center justify-center py-20 px-4">
        <div className="relative mb-6">
          <div className="w-16 h-16 rounded-full bg-purple-500/20 flex items-center justify-center">
            <Loader2 size={32} className="animate-spin text-purple-400" />
          </div>
          <div className="absolute inset-0 w-16 h-16 rounded-full bg-purple-500/10 animate-ping" />
        </div>
        <p className="text-text-primary text-lg font-medium mb-2">AI가 분석하고 있어요</p>
        <p className="text-text-secondary text-sm">당신의 생각에서 패턴과 인사이트를 찾는 중...</p>
      </div>
    );
  }

  // ─── Result View ───
  if (view === 'result' && currentResult) {
    const insight = currentResult.insight;
    const hasApiKey = !!localStorage.getItem('gemini_api_key') || !!import.meta.env.VITE_GEMINI_API_KEY;

    return (
      <div className="pb-16 px-4">
        {/* Header */}
        <div className="flex items-center justify-between py-4">
          <button
            onClick={() => { setView('idle'); setError(null); }}
            className="flex items-center gap-1 text-text-secondary hover:text-text-primary transition-colors"
          >
            <ArrowLeft size={18} />
            <span className="text-sm">돌아가기</span>
          </button>
          <div className="flex items-center gap-2 text-text-secondary text-sm">
            <Clock size={14} />
            <span>{formatDuration(currentResult.actualDurationSeconds)}</span>
            <span className="text-text-secondary/50">|</span>
            <span>{currentResult.wordCount}자</span>
          </div>
        </div>

        <div className="text-text-secondary text-xs mb-4">
          {format(currentResult.timestamp, 'yyyy년 M월 d일 (EEE) HH:mm', { locale: ko })}
        </div>

        {/* Error + retry */}
        {error && (
          <div className="mb-4 p-3 rounded-lg bg-red-500/10 border border-red-500/20">
            <div className="flex items-center gap-2 text-red-400 text-sm mb-2">
              <AlertCircle size={16} />
              <span>{error}</span>
            </div>
            <button
              onClick={handleRetryAnalysis}
              className="text-sm text-purple-400 hover:text-purple-300 transition-colors"
            >
              다시 시도
            </button>
          </div>
        )}

        {/* No API key notice */}
        {!insight && !error && !hasApiKey && (
          <div className="mb-4 p-3 rounded-lg bg-purple-500/10 border border-purple-500/20">
            <p className="text-sm text-purple-300">
              설정에서 Gemini API 키를 등록하면 AI 분석을 받을 수 있어요.
            </p>
          </div>
        )}

        {/* Analyze button for dumps without insight */}
        {!insight && !error && hasApiKey && (
          <div className="mb-4 p-4 rounded-lg bg-purple-500/10 border border-purple-500/20">
            <p className="text-sm text-purple-300 mb-3">AI 분석이 아직 되지 않았어요.</p>
            <button
              onClick={handleRetryAnalysis}
              className="flex items-center gap-1.5 px-4 py-2 bg-purple-600 text-white rounded-lg text-sm font-medium hover:bg-purple-500 transition-colors"
            >
              <Sparkles size={14} />
              AI 분석하기
            </button>
          </div>
        )}

        {/* Insight sections */}
        {insight && (
          <div className="space-y-5">
            {/* Summary */}
            {insight.summary && (
              <div className="border-l-2 border-purple-500 pl-4">
                <h3 className="text-xs text-purple-400 font-medium mb-1.5 uppercase tracking-wider">요약</h3>
                <p className="text-text-primary text-sm leading-relaxed">{insight.summary}</p>
              </div>
            )}

            {/* Themes */}
            {insight.themes.length > 0 && (
              <div>
                <h3 className="text-xs text-purple-400 font-medium mb-2 uppercase tracking-wider">핵심 주제</h3>
                <div className="flex flex-wrap gap-2">
                  {insight.themes.map((theme, i) => (
                    <span key={i} className="px-3 py-1 bg-purple-500/15 text-purple-300 rounded-full text-sm">
                      {theme}
                    </span>
                  ))}
                </div>
              </div>
            )}

            {/* Emotions */}
            {insight.emotions.length > 0 && (
              <div>
                <h3 className="text-xs text-purple-400 font-medium mb-2 uppercase tracking-wider">감정</h3>
                <div className="flex flex-wrap gap-2">
                  {insight.emotions.map((emotion, i) => (
                    <span key={i} className="px-3 py-1 bg-bg-tertiary text-text-primary rounded-full text-sm">
                      {emotion}
                    </span>
                  ))}
                </div>
              </div>
            )}

            {/* Action Items */}
            {insight.actionItems.length > 0 && (
              <div>
                <h3 className="text-xs text-purple-400 font-medium mb-2 uppercase tracking-wider">실천 항목</h3>
                <ul className="space-y-1.5">
                  {insight.actionItems.map((item, i) => (
                    <li key={i} className="flex items-start gap-2 text-sm text-text-primary">
                      <span className="text-purple-400 mt-0.5">▸</span>
                      <span>{item}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {/* Key Insights */}
            {insight.keyInsights.length > 0 && (
              <div>
                <h3 className="text-xs text-purple-400 font-medium mb-2 uppercase tracking-wider flex items-center gap-1">
                  <Sparkles size={12} />
                  핵심 인사이트
                </h3>
                <ul className="space-y-2">
                  {insight.keyInsights.map((ins, i) => (
                    <li key={i} className="text-sm text-text-primary bg-purple-500/5 border border-purple-500/10 rounded-lg p-3">
                      {ins}
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        )}

        {/* Raw content - always shown if no insight, toggleable if insight exists */}
        <div className="mt-6">
          {insight ? (
            <>
              <button
                onClick={() => setShowRawContent(!showRawContent)}
                className="flex items-center gap-1 text-text-secondary text-sm hover:text-text-primary transition-colors"
              >
                {showRawContent ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                원문 보기
              </button>
              {showRawContent && (
                <div className="mt-2 p-4 bg-bg-secondary rounded-lg text-text-primary text-sm leading-relaxed whitespace-pre-wrap font-serif max-h-64 overflow-y-auto">
                  {currentResult.content}
                </div>
              )}
            </>
          ) : (
            <div>
              <h3 className="text-xs text-purple-400 font-medium mb-2 uppercase tracking-wider">원문</h3>
              <div className="p-4 bg-bg-secondary rounded-lg text-text-primary text-sm leading-relaxed whitespace-pre-wrap font-serif">
                {currentResult.content}
              </div>
            </div>
          )}
        </div>

        {/* Actions */}
        <div className="flex gap-3 mt-6">
          <button
            onClick={() => { setView('idle'); setError(null); }}
            className="flex-1 py-3 bg-purple-600 text-white rounded-xl font-medium hover:bg-purple-500 transition-colors"
          >
            새로 쓰기
          </button>
          <button
            onClick={() => { setView('history'); setError(null); }}
            className="flex-1 py-3 bg-bg-tertiary text-text-primary rounded-xl font-medium hover:bg-bg-secondary transition-colors"
          >
            기록 목록
          </button>
        </div>
      </div>
    );
  }

  // ─── History View ───
  if (view === 'history') {
    const completedDumps = dumps.filter(d => d.status === 'completed');

    return (
      <div className="pb-16 px-4">
        {/* Header */}
        <div className="flex items-center justify-between py-4">
          <button
            onClick={() => setView('idle')}
            className="flex items-center gap-1 text-text-secondary hover:text-text-primary transition-colors"
          >
            <ArrowLeft size={18} />
            <span className="text-sm">돌아가기</span>
          </button>
          <h2 className="text-text-primary font-medium">브레인 덤프 기록</h2>
          <div className="w-16" />
        </div>

        {completedDumps.length === 0 ? (
          <div className="text-center py-16">
            <p className="text-text-secondary text-sm">아직 기록이 없어요.</p>
            <p className="text-text-secondary text-xs mt-1">첫 번째 브레인 덤프를 시작해보세요!</p>
          </div>
        ) : (
          <div className="space-y-3">
            {completedDumps.map(dump => (
              <div
                key={dump.id}
                className="group bg-bg-secondary rounded-xl p-4 cursor-pointer hover:bg-bg-tertiary transition-colors"
                onClick={() => viewDump(dump)}
              >
                <div className="flex items-start justify-between mb-2">
                  <div className="text-text-secondary text-xs">
                    {format(dump.timestamp, 'M월 d일 (EEE) HH:mm', { locale: ko })}
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-purple-400 bg-purple-500/10 px-2 py-0.5 rounded-full">
                      {formatDuration(dump.actualDurationSeconds)}
                    </span>
                    {!dump.insight && (
                      <span className="text-xs text-orange-400 bg-orange-500/10 px-2 py-0.5 rounded-full">
                        미분석
                      </span>
                    )}
                    <button
                      onClick={e => {
                        e.stopPropagation();
                        setDeleteConfirm(deleteConfirm === dump.id ? null : dump.id);
                      }}
                      className="opacity-0 group-hover:opacity-100 text-text-secondary hover:text-red-400 transition-all p-1"
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                </div>

                {/* Delete confirm */}
                {deleteConfirm === dump.id && (
                  <div className="flex items-center gap-2 mb-2 p-2 bg-red-500/10 rounded-lg" onClick={e => e.stopPropagation()}>
                    <span className="text-xs text-red-400">삭제하시겠습니까?</span>
                    <button
                      onClick={() => handleDelete(dump.id)}
                      className="text-xs text-red-400 hover:text-red-300 font-medium"
                    >
                      삭제
                    </button>
                    <button
                      onClick={() => setDeleteConfirm(null)}
                      className="text-xs text-text-secondary hover:text-text-primary"
                    >
                      취소
                    </button>
                  </div>
                )}

                {/* AI Summary */}
                {dump.insight?.summary && (
                  <p className="text-text-primary text-sm mb-2">{dump.insight.summary}</p>
                )}

                {/* Full raw content */}
                <div className="text-text-secondary text-sm leading-relaxed whitespace-pre-wrap max-h-60 overflow-y-auto">
                  {dump.content}
                </div>

                {/* Tags preview */}
                {dump.insight?.emotions && dump.insight.emotions.length > 0 && (
                  <div className="flex flex-wrap gap-1 mt-3">
                    {dump.insight.emotions.slice(0, 3).map((emotion, i) => (
                      <span key={i} className="text-xs px-2 py-0.5 bg-bg-tertiary text-text-secondary rounded-full">
                        {emotion}
                      </span>
                    ))}
                  </div>
                )}

                <div className="flex items-center justify-between mt-2">
                  <span className="text-xs text-text-secondary">{dump.wordCount}자</span>
                  {!dump.insight && dump.wordCount >= 20 && (
                    <button
                      onClick={e => { e.stopPropagation(); handleAnalyzeFromHistory(dump); }}
                      className="flex items-center gap-1 text-xs text-purple-400 hover:text-purple-300 transition-colors"
                    >
                      <Sparkles size={12} />
                      AI 분석하기
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    );
  }

  // ─── Idle View (Default) ───
  const recentDumps = dumps.filter(d => d.status === 'completed').slice(0, 3);

  return (
    <div className="pb-16 px-4">
      {/* Resume banner */}
      {resumeBanner && (
        <div className="mt-4 p-4 bg-purple-500/10 border border-purple-500/20 rounded-xl">
          <p className="text-sm text-purple-300 mb-3">이전에 작성 중이던 브레인 덤프가 있어요.</p>
          <div className="flex gap-2">
            <button
              onClick={() => handleResume(resumeBanner)}
              className="flex-1 py-2 bg-purple-600 text-white rounded-lg text-sm font-medium hover:bg-purple-500 transition-colors"
            >
              이어서 쓰기
            </button>
            <button
              onClick={() => handleDiscardResume(resumeBanner)}
              className="px-4 py-2 bg-bg-tertiary text-text-secondary rounded-lg text-sm hover:text-text-primary transition-colors"
            >
              무시
            </button>
          </div>
        </div>
      )}

      {/* Header */}
      <div className="flex items-center justify-between pt-4 pb-2">
        <h2 className="text-text-primary text-lg font-medium">🧠 브레인 덤프</h2>
        <button
          onClick={() => { setView('history'); loadDumps(); }}
          className="flex items-center gap-1 text-text-secondary hover:text-text-primary transition-colors"
        >
          <History size={18} />
          <span className="text-sm">기록</span>
        </button>
      </div>

      <p className="text-text-secondary text-sm mb-6">
        머릿속 생각을 자유롭게 쏟아내세요. 타이머가 끝나면 AI가 정리해줍니다.
      </p>

      {/* Duration selector */}
      <div className="mb-6">
        <p className="text-text-secondary text-xs mb-2">시간 선택</p>
        <div className="flex gap-2">
          {DURATION_OPTIONS.map(min => (
            <button
              key={min}
              onClick={() => setSelectedDuration(min)}
              className={`flex-1 py-3 rounded-xl text-sm font-medium transition-all ${selectedDuration === min
                ? 'bg-purple-600 text-white shadow-lg shadow-purple-600/20'
                : 'bg-bg-secondary text-text-secondary hover:bg-bg-tertiary hover:text-text-primary'
                }`}
            >
              {min}분
            </button>
          ))}
        </div>
      </div>

      {/* Start button */}
      <button
        onClick={handleStart}
        className="w-full py-4 bg-gradient-to-r from-purple-600 to-purple-500 text-white rounded-2xl text-lg font-medium hover:from-purple-500 hover:to-purple-400 transition-all shadow-lg shadow-purple-600/20 active:scale-[0.98] mb-8"
      >
        시작하기
      </button>

      {/* Recent sessions */}
      {recentDumps.length > 0 && (
        <div>
          <h3 className="text-text-secondary text-xs mb-3 uppercase tracking-wider">최근 기록</h3>
          <div className="space-y-2">
            {recentDumps.map(dump => (
              <div
                key={dump.id}
                className="bg-bg-secondary rounded-xl p-3 cursor-pointer hover:bg-bg-tertiary transition-colors"
                onClick={() => viewDump(dump)}
              >
                <div className="flex items-center justify-between mb-1">
                  <span className="text-text-secondary text-xs">
                    {format(dump.timestamp, 'M/d HH:mm')}
                  </span>
                  <span className="text-xs text-purple-400">{dump.wordCount}자</span>
                </div>
                {dump.insight?.summary ? (
                  <p className="text-text-primary text-sm line-clamp-1">{dump.insight.summary}</p>
                ) : (
                  <p className="text-text-secondary text-sm line-clamp-1 italic">
                    {dump.content.substring(0, 60)}
                  </p>
                )}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

export default BrainDumpTab;
