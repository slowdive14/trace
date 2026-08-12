import { GoogleGenerativeAI } from "@google/generative-ai";
import type { BrainDumpInsight, MonthlyReview, SleepCoaching } from "../types/types";

const getApiKey = () => {
    // 1. Try environment variable
    const envKey = import.meta.env.VITE_GEMINI_API_KEY;
    if (envKey) return envKey;

    // 2. Try localStorage (shared with Expense feature)
    const localKey = localStorage.getItem('gemini_api_key');
    if (localKey) return localKey;

    return null;
};

export const generateWorryActions = async (worryContent: string): Promise<string[]> => {
    const apiKey = getApiKey();

    if (!apiKey) {
        throw new Error("Gemini API key is not configured. Please add it in settings or .env file.");
    }

    const genAI = new GoogleGenerativeAI(apiKey);
    const model = genAI.getGenerativeModel({ model: "gemini-3.5-flash" });

    const prompt = `
    사용자의 고민: "${worryContent}"
    
    이 고민을 해결하기 위한 구체적이고 실천 가능한 '액션 아이템' 3가지를 제안해줘.
    각 액션은 다음 형식을 따라야 해:
    1. 이모지 + 제목: 구체적인 행동 내용
    
    예시:
    1. 🗣️ 리허설: 발표 도입부 1분만 녹음해서 들어보기
    2. 📝 시나리오: 최악의 상황 1가지와 대처법 적기
    3. 🧘 마인드셋: 발표 직전 3분 심호흡 루틴 정하기
    
    응답은 오직 3가지 항목만 줄바꿈으로 구분해서 줘. 번호는 붙이지 마.
    `;

    try {
        const result = await model.generateContent(prompt);
        const response = await result.response;
        const text = response.text();

        // Split by newline and filter empty lines
        return text.split('\n').filter(line => line.trim().length > 0);
    } catch (error) {
        console.error("Error generating actions:", error);
        throw error;
    }
};

export const analyzeBrainDump = async (content: string): Promise<BrainDumpInsight> => {
    // Re-initialize if null
    const key = getApiKey();
    let currentGenAI = key ? new GoogleGenerativeAI(key) : null;

    if (!currentGenAI) {
        throw new Error("Gemini API key is not configured.");
    }

    const model = currentGenAI.getGenerativeModel({ model: "gemini-3.5-flash" });

    const prompt = `
    아래는 사용자가 자유롭게 쏟아낸 생각의 기록입니다. 이 텍스트를 분석해서 구조화된 인사이트를 제공해줘.

    """
    ${content}
    """

    다음 JSON 형식으로 응답해줘. 반드시 유효한 JSON만 출력하고, JSON 외의 텍스트는 포함하지 마.

    {
        "summary": "전체 내용을 2-3문장으로 요약",
        "themes": ["핵심 주제 1", "핵심 주제 2", "핵심 주제 3"],
        "emotions": ["감지된 감정 1", "감지된 감정 2"],
        "actionItems": ["구체적인 실천 항목 1", "구체적인 실천 항목 2"],
        "keyInsights": ["핵심 인사이트 1", "핵심 인사이트 2"]
    }

    지침:
    - summary: 사용자의 핵심 생각과 흐름을 요약. 공감적이고 따뜻한 톤으로.
    - themes: 3~5개의 주요 주제를 추출. 짧은 키워드나 구로.
    - emotions: 텍스트에서 감지되는 감정들. 한국어로 작성 (예: 불안, 기대, 피곤함, 설렘).
    - actionItems: 텍스트에서 추출하거나 제안할 수 있는 실천 가능한 항목. 없으면 빈 배열.
    - keyInsights: 사용자가 미처 인식하지 못했을 수 있는 패턴이나 통찰. 1~3개.
    `;

    try {
        const result = await model.generateContent(prompt);
        const response = await result.response;
        const text = response.text();

        const jsonStr = text.replace(/\`\`\`json\n?/g, '').replace(/\`\`\`\n?/g, '').trim();
        const parsed = JSON.parse(jsonStr);

        return {
            summary: parsed.summary || '',
            themes: parsed.themes || [],
            emotions: parsed.emotions || [],
            actionItems: parsed.actionItems || [],
            keyInsights: parsed.keyInsights || [],
        };
    } catch (error) {
        console.error("Error analyzing brain dump:", error);
        throw error;
    }
};

// 한 달치 기록 + 감정 통계를 분석해 월간 회고를 생성
export const analyzeMonth = async (
    monthLabel: string,
    statsText: string,
    recordsText: string,
    feedback?: string
): Promise<MonthlyReview> => {
    const key = getApiKey();
    if (!key) {
        throw new Error("Gemini API key is not configured. Please add it in settings or .env file.");
    }

    const genAI = new GoogleGenerativeAI(key);
    const model = genAI.getGenerativeModel({
        model: "gemini-3.5-flash",
        generationConfig: {
            maxOutputTokens: 8192, // 풍부하고 자세한 회고를 위해 출력 토큰 확대
            temperature: 0.3, // 사실성 우선 — 창작·윤색·환각 억제
        },
    });

    const prompt = `
아래는 사용자의 ${monthLabel} 한 달치 기록과 감정 통계입니다. 이를 바탕으로 정확하고 따뜻한 '월간 회고'를 작성해줘.

⚠️ 가장 중요한 규칙 — 사실성(이걸 어기면 회고가 무용지물이야):
- 기록에 명시되지 않은 사실(시간·장소·인물·사건·대화·숫자·인과관계)을 절대 지어내지 마.
- 디테일은 '상상'이 아니라 '기록 인용'에서만 가져와. 기록에 실제로 적힌 표현·고유명사·숫자를 그대로 인용해.
- 확실하지 않은 추론은 단정하지 말고 "~로 보인다 / ~인 듯하다 / 아마 ~"처럼 추측임을 표시해.
- 근거가 빈약하면 항목 수를 줄여. 빈약한 걸 그럴듯하게 부풀리지 마. 모르면 비워.
${feedback && feedback.trim() ? `
🔧 사용자가 이전 분석에서 틀렸다고 지적한 정정 사항 — 최우선으로 반드시 반영하고, 같은 실수를 반복하지 마:
"""
${feedback.trim()}
"""
` : ''}
[감정 통계]
${statsText}

[기록]
"""
${recordsText}
"""

다음 JSON 형식으로만 응답해줘. 유효한 JSON 외의 텍스트는 절대 포함하지 마.

{
    "moodSummary": "이번 달 감정의 흐름을 실제 기록된 사건에 근거해 3~5문장으로 서술. 월초→월말의 변화를 기록에 있는 일로 설명. 추측은 추측이라고 표시.",
    "triggers": [
        {"emotion": "감정 (이모지 포함, 예: 😣 신경질나는)", "trigger": "그 감정이 기록된 맥락을 기록에 근거해 2~3문장으로 서술. 기록에 적힌 구체적 내용을 인용하되, 적히지 않은 디테일은 절대 덧붙이지 마.", "source": "근거가 된 기록의 날짜 (예: 2/18) 또는 기록의 짧은 직접 인용"}
    ],
    "patterns": ["근거(날짜)를 포함한 반복 패턴. 인과는 단정 말고 '~로 보임'으로."],
    "positives": ["기록에 근거한 좋았던 순간 (날짜 포함)"],
    "challenges": ["기록에 근거한 힘들었던 부분 (날짜 포함)"],
    "insights": ["기록에서 도출되는 통찰 1~3개. 근거와 함께, 추론이면 '~로 보임' 표시."],
    "suggestion": "기록에 근거한, 다음 달을 위한 따뜻하고 구체적인 제안 한 가지"
}

지침:
- triggers는 입력의 '감정이 직접 기록된 항목' 섹션에만 근거해야 해. 그 섹션에 없는 감정·상황을 만들어내지 마. source에는 반드시 출처 날짜를 넣어.
- 각 trigger는 해당 기록에 실제로 적힌 내용만 인용해 서술해. 기록에 없는 시간·장소·대화·디테일을 보태지 마.
- '배경 맥락' 섹션(지출·고민 등)은 그날 무슨 일이 있었는지 이해하는 용도로만 써. 거기서 새로운 감정을 추정하거나, 그 내용을 트리거의 사실처럼 단정하지 마.
- 따뜻하되 정확하게. 평가·훈계 금지. 사실성과 충돌하면 항상 사실성을 택해.
- triggers는 근거가 분명한 것 위주로 4~6개. 그 외 배열은 1~3개씩. 근거 없으면 빈 배열.
`;

    try {
        const result = await model.generateContent(prompt);
        const response = await result.response;
        const text = response.text();

        const jsonStr = text.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
        const parsed = JSON.parse(jsonStr);

        return {
            moodSummary: parsed.moodSummary || '',
            triggers: Array.isArray(parsed.triggers)
                ? parsed.triggers
                    .filter((t: unknown): t is { emotion?: string; trigger?: string; source?: string } => !!t && typeof t === 'object')
                    .map((t: { emotion?: string; trigger?: string; source?: string }) => ({ emotion: t.emotion || '', trigger: t.trigger || '', source: t.source || '' }))
                    .filter((t: { emotion: string; trigger: string }) => t.emotion || t.trigger)
                : [],
            patterns: parsed.patterns || [],
            positives: parsed.positives || [],
            challenges: parsed.challenges || [],
            insights: parsed.insights || [],
            suggestion: parsed.suggestion || '',
        };
    } catch (error) {
        console.error("Error analyzing month:", error);
        throw error;
    }
};

/**
 * 수면 점수 진단을 받아 '무엇을 어떻게 할지' 행동 지침을 만든다.
 *
 * 점수 계산은 이미 코드(sleepCoach.analyzeSleepGaps)가 끝냈고, AI는 그 숫자를
 * 인용해 행동으로 옮기는 역할만 한다. 언어모델에 산수를 맡기면 그럴듯한 점수를
 * 지어내는데, 점수 이야기가 틀리면 조언 전체를 믿을 수 없게 된다.
 */
export const generateSleepCoaching = async (
    diagnosisText: string,
    recordsText: string,
    scheduleHint: string,
): Promise<SleepCoaching> => {
    const key = getApiKey();
    if (!key) {
        throw new Error("Gemini API key is not configured. Please add it in settings or .env file.");
    }

    const genAI = new GoogleGenerativeAI(key);
    const model = genAI.getGenerativeModel({
        model: "gemini-3.5-flash",
        generationConfig: {
            maxOutputTokens: 8192,
            temperature: 0.4,
        },
    });

    const prompt = `
너는 수면 습관 코치다. 아래는 사용자의 수면 점수 진단과 실제 기록이다.
점수를 올리면서 동시에 수면 루틴이 안정되도록, 구체적이고 바로 실행 가능한 행동 지침을 짜줘.

⚠️ 숫자 규칙 (어기면 조언 전체가 무용지물이다):
- 점수·시간·일수는 아래 [진단]에 있는 값을 그대로 인용해. 직접 계산하거나 새로 만들어내지 마.
- [진단]에 없는 점수를 추정해서 쓰지 마.

⚠️ 범위 규칙:
- 생활습관(수면위생) 조언만 해라. 질병 진단, 약·영양제 복용 권유는 절대 하지 마.
- 코골이·수면무호흡·만성 불면처럼 습관으로 해결되지 않는 신호가 기록에서 보이면,
  단정하지 말고 qualityNotes에 "전문가 상담을 고려해볼 만하다"고만 적어.

[진단]
${diagnosisText}

[최근 수면 기록]
${recordsText}

[앱이 계산한 다음 단계 목표 시각]
${scheduleHint}

다음 JSON 형식으로만 응답해. 유효한 JSON 외의 텍스트는 절대 넣지 마.

{
  "diagnosis": "지금 수면 상태를 3~4문장으로 진단. 반드시 [진단]의 수치를 인용하고, 실제 기록에서 관찰되는 패턴(예: 주말에만 늦게 잠)을 짚어줘.",
  "biggestLever": {
    "target": "가장 먼저 손댈 항목 이름",
    "expectedGain": "되찾을 점수 (진단의 값 그대로)",
    "why": "왜 이것부터인지 2~3문장. 점수 효율과 실행 난이도를 함께 근거로."
  },
  "actions": [
    {
      "title": "행동 제목 (짧고 명령형)",
      "points": "이 행동이 노리는 점수 (진단의 값 인용)",
      "timing": "실행 시각 또는 시점 (예: 22:30, 기상 직후)",
      "steps": ["구체적 실행 단계 2~4개. 무엇을 어디서 어떻게 하는지까지."]
    }
  ],
  "weekPlan": ["월요일: ...", "화요일: ...", "수요일: ...", "목요일: ...", "금요일: ...", "토요일: ...", "일요일: ..."],
  "pitfalls": ["이 계획에서 흔히 무너지는 지점과 대처법 2~4개"],
  "qualityNotes": ["점수에는 안 잡히지만 수면의 질에 중요한 것 2~4개"]
}

지침:
- actions는 4~6개. 점수 이득이 큰 순서로 배치해.
- 추상적인 말("일찍 자라", "규칙적으로") 금지. 몇 시에 무엇을 하는지까지 적어.
- 사용자의 실제 취침·기상 시각에서 출발해. 지금보다 2시간 이른 취침처럼 갑작스러운 변화를 요구하지 말고,
  [다음 단계 목표 시각]을 기준으로 15~30분 단위의 점진적 조정을 제안해.
- weekPlan은 요일마다 다른 구체적 초점을 줘. 주말에 무너지기 쉬운 점을 반영해.
- 훈계하지 말고, 담백하고 실용적인 톤으로.
`;

    try {
        const result = await model.generateContent(prompt);
        const text = (await result.response).text();
        const jsonStr = text.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
        const parsed = JSON.parse(jsonStr);

        return {
            diagnosis: parsed.diagnosis || '',
            biggestLever: {
                target: parsed.biggestLever?.target || '',
                expectedGain: parsed.biggestLever?.expectedGain || '',
                why: parsed.biggestLever?.why || '',
            },
            actions: Array.isArray(parsed.actions)
                ? parsed.actions
                    .filter((a: unknown): a is Record<string, unknown> => !!a && typeof a === 'object')
                    .map((a: Record<string, unknown>) => ({
                        title: String(a.title ?? ''),
                        points: String(a.points ?? ''),
                        timing: String(a.timing ?? ''),
                        steps: Array.isArray(a.steps) ? a.steps.map(String) : [],
                    }))
                    .filter((a: { title: string }) => a.title)
                : [],
            weekPlan: Array.isArray(parsed.weekPlan) ? parsed.weekPlan.map(String) : [],
            pitfalls: Array.isArray(parsed.pitfalls) ? parsed.pitfalls.map(String) : [],
            qualityNotes: Array.isArray(parsed.qualityNotes) ? parsed.qualityNotes.map(String) : [],
        };
    } catch (error) {
        console.error("Error generating sleep coaching:", error);
        throw error;
    }
};
