import React, { useState, useEffect, useCallback } from 'react';
import { format, startOfWeek, subWeeks } from 'date-fns';
import { Sparkles, RefreshCw, Target, AlertTriangle, CalendarDays, Loader2 } from 'lucide-react';
import type { SleepCoaching, SleepCoachingRecord } from '../types/types';
import type { SleepRecord, SleepScore } from '../utils/sleepUtils';
import { getIdealSleepSchedule, getWeeklyRecords } from '../utils/sleepUtils';
import { analyzeSleepGaps, formatDiagnosisForPrompt, formatRecordsForPrompt } from '../utils/sleepCoach';
import { generateSleepCoaching } from '../services/gemini';
import { saveSleepCoaching, getSleepCoaching } from '../services/firestore';
import { useAuth } from './AuthContext';

interface Props {
    score: SleepScore;
    allRecords: SleepRecord[];
    weekOffset: number;
}

/** 점수 손실이 큰 항목부터 보여주는 막대 */
const GapBar: React.FC<{ label: string; current: number; max: number }> = ({ label, current, max }) => (
    <div>
        <div className="flex items-baseline justify-between mb-1">
            <span className="text-[11px] text-text-secondary">{label}</span>
            <span className="text-[11px] text-text-tertiary tabular-nums">{current}/{max}</span>
        </div>
        <div className="h-1 bg-bg-tertiary rounded-full">
            <div
                className="h-full bg-indigo-400 rounded-full transition-all duration-500"
                style={{ width: `${max > 0 ? (current / max) * 100 : 0}%` }}
            />
        </div>
    </div>
);

export const SleepCoachSection: React.FC<Props> = ({ score, allRecords, weekOffset }) => {
    const { user } = useAuth();
    const [coaching, setCoaching] = useState<SleepCoaching | null>(null);
    const [savedAt, setSavedAt] = useState<Date | null>(null);
    const [savedScore, setSavedScore] = useState<number | null>(null);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const weekKey = format(startOfWeek(subWeeks(new Date(), weekOffset), { weekStartsOn: 1 }), 'yyyy-MM-dd');
    const weekRecords = getWeeklyRecords(allRecords, weekOffset).records;

    // 점수 분해는 코드가 계산한다 (AI에 산수를 맡기지 않는다)
    const diagnosis = analyzeSleepGaps(score, weekRecords);

    useEffect(() => {
        if (!user) return;
        let cancelled = false;
        setCoaching(null);
        setError(null);
        getSleepCoaching(user.uid, weekKey)
            .then((rec: SleepCoachingRecord | null) => {
                if (cancelled || !rec) return;
                setCoaching(rec.coaching);
                setSavedAt(rec.generatedAt);
                setSavedScore(rec.scoreSnapshot);
            })
            .catch(e => console.error('Failed to load sleep coaching:', e));
        return () => { cancelled = true; };
    }, [user, weekKey]);

    const generate = useCallback(async () => {
        if (!user || loading) return;
        setLoading(true);
        setError(null);
        try {
            const schedule = getIdealSleepSchedule(allRecords);
            const result = await generateSleepCoaching(
                formatDiagnosisForPrompt(diagnosis),
                formatRecordsForPrompt(weekRecords),
                `다음 목표: ${schedule.bedtime} 취침 → ${schedule.waketime} 기상 (앱이 현재 평균에서 점진적으로 계산한 값)`,
            );
            setCoaching(result);
            setSavedAt(new Date());
            setSavedScore(score.total);
            await saveSleepCoaching(user.uid, weekKey, result, score.total);
        } catch (e) {
            const msg = e instanceof Error ? e.message : String(e);
            setError(msg.includes('API key')
                ? 'Gemini API 키가 설정되지 않았습니다. 설정에서 키를 입력해 주세요.'
                : `생성 실패: ${msg}`);
        } finally {
            setLoading(false);
        }
    }, [user, loading, diagnosis, weekRecords, allRecords, score.total, weekKey]);

    const stale = savedScore !== null && savedScore !== score.total;

    return (
        <div className="pt-3 border-t border-bg-tertiary">
            <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-1.5">
                    <Sparkles size={13} className="text-indigo-400" />
                    <span className="text-xs font-medium text-text-primary">수면 코칭</span>
                </div>
                {coaching && (
                    <button
                        onClick={generate}
                        disabled={loading}
                        className="flex items-center gap-1 text-[10px] text-text-tertiary hover:text-text-primary transition-colors disabled:opacity-40"
                    >
                        <RefreshCw size={10} className={loading ? 'animate-spin' : ''} /> 다시 생성
                    </button>
                )}
            </div>

            {/* 코드가 계산한 항목별 손실 — AI 없이도 항상 보인다 */}
            <div className="space-y-2 mb-3">
                {[...diagnosis.gaps].sort((a, b) => b.lost - a.lost).map(g => (
                    <GapBar key={g.key} label={g.label} current={g.current} max={g.max} />
                ))}
            </div>

            {diagnosis.biggest && (
                <p className="text-[11px] text-text-tertiary mb-3 leading-relaxed">
                    <span className="text-text-secondary">되찾을 여지가 가장 큰 곳</span> · {diagnosis.biggest.label}{' '}
                    <span className="text-indigo-400 tabular-nums">+{Math.round(diagnosis.biggest.lost)}점</span>
                    <br />{diagnosis.biggest.lever}
                </p>
            )}

            {error && (
                <div className="text-[11px] text-red-300 bg-red-500/10 border border-red-500/20 rounded-lg px-2.5 py-1.5 mb-3 break-words">
                    {error}
                </div>
            )}

            {!coaching ? (
                <button
                    onClick={generate}
                    disabled={loading || diagnosis.recordedDays === 0}
                    className="w-full flex items-center justify-center gap-1.5 py-2 rounded-lg bg-indigo-500/15 text-indigo-300 text-xs font-medium hover:bg-indigo-500/25 transition-colors disabled:opacity-40"
                >
                    {loading
                        ? <><Loader2 size={13} className="animate-spin" /> 분석 중…</>
                        : <><Sparkles size={13} /> 행동 지침 만들기</>}
                </button>
            ) : (
                <div className="space-y-3">
                    {stale && (
                        <p className="text-[10px] text-text-tertiary">
                            생성 시점 {savedScore}점 → 지금 {score.total}점. 다시 생성하면 최신 상태로 갱신됩니다.
                        </p>
                    )}

                    <p className="text-[11px] text-text-secondary leading-relaxed">{coaching.diagnosis}</p>

                    {coaching.biggestLever?.target && (
                        <div className="rounded-lg bg-indigo-500/10 px-3 py-2">
                            <div className="flex items-center gap-1.5 mb-1">
                                <Target size={11} className="text-indigo-400" />
                                <span className="text-[11px] font-medium text-text-primary">{coaching.biggestLever.target}</span>
                                <span className="text-[11px] text-indigo-400 tabular-nums">{coaching.biggestLever.expectedGain}</span>
                            </div>
                            <p className="text-[11px] text-text-tertiary leading-relaxed">{coaching.biggestLever.why}</p>
                        </div>
                    )}

                    {coaching.actions.length > 0 && (
                        <div className="space-y-2">
                            {coaching.actions.map((a, i) => (
                                <div key={i} className="rounded-lg bg-bg-primary px-3 py-2">
                                    <div className="flex items-baseline justify-between gap-2 mb-1">
                                        <span className="text-[11px] font-medium text-text-primary">{a.title}</span>
                                        {a.timing && <span className="text-[10px] text-text-tertiary tabular-nums shrink-0">{a.timing}</span>}
                                    </div>
                                    {a.points && <div className="text-[10px] text-indigo-400 mb-1 tabular-nums">{a.points}</div>}
                                    <ul className="space-y-0.5">
                                        {a.steps.map((s, j) => (
                                            <li key={j} className="text-[11px] text-text-secondary leading-relaxed pl-3 -indent-3">· {s}</li>
                                        ))}
                                    </ul>
                                </div>
                            ))}
                        </div>
                    )}

                    {coaching.weekPlan.length > 0 && (
                        <div>
                            <div className="flex items-center gap-1.5 mb-1.5">
                                <CalendarDays size={11} className="text-text-tertiary" />
                                <span className="text-[11px] font-medium text-text-secondary">이번 주 계획</span>
                            </div>
                            <ul className="space-y-0.5">
                                {coaching.weekPlan.map((d, i) => (
                                    <li key={i} className="text-[11px] text-text-tertiary leading-relaxed">{d}</li>
                                ))}
                            </ul>
                        </div>
                    )}

                    {coaching.pitfalls.length > 0 && (
                        <div>
                            <div className="flex items-center gap-1.5 mb-1.5">
                                <AlertTriangle size={11} className="text-amber-400/70" />
                                <span className="text-[11px] font-medium text-text-secondary">무너지기 쉬운 지점</span>
                            </div>
                            <ul className="space-y-0.5">
                                {coaching.pitfalls.map((p, i) => (
                                    <li key={i} className="text-[11px] text-text-tertiary leading-relaxed pl-3 -indent-3">· {p}</li>
                                ))}
                            </ul>
                        </div>
                    )}

                    {coaching.qualityNotes.length > 0 && (
                        <div>
                            <span className="text-[11px] font-medium text-text-secondary">점수 밖의 수면의 질</span>
                            <ul className="space-y-0.5 mt-1.5">
                                {coaching.qualityNotes.map((n, i) => (
                                    <li key={i} className="text-[11px] text-text-tertiary leading-relaxed pl-3 -indent-3">· {n}</li>
                                ))}
                            </ul>
                        </div>
                    )}

                    <p className="text-[10px] text-text-tertiary pt-1">
                        생활습관 조언입니다. 잠들기 어려움이 오래 이어지면 전문가 상담을 권합니다.
                        {savedAt && ` · ${format(savedAt, 'M/d HH:mm')} 생성`}
                    </p>
                </div>
            )}
        </div>
    );
};

export default SleepCoachSection;
