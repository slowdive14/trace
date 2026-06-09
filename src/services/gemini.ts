import { GoogleGenerativeAI } from "@google/generative-ai";
import type { BrainDumpInsight, MonthlyReview } from "../types/types";

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
    const model = genAI.getGenerativeModel({ model: "gemini-3-flash-preview" });

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

    const model = currentGenAI.getGenerativeModel({ model: "gemini-3-flash-preview" });

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
    recordsText: string
): Promise<MonthlyReview> => {
    const key = getApiKey();
    if (!key) {
        throw new Error("Gemini API key is not configured. Please add it in settings or .env file.");
    }

    const genAI = new GoogleGenerativeAI(key);
    const model = genAI.getGenerativeModel({
        model: "gemini-3-flash-preview",
        generationConfig: {
            maxOutputTokens: 8192, // 풍부하고 자세한 회고를 위해 출력 토큰 확대
            temperature: 0.85,
        },
    });

    const prompt = `
아래는 사용자의 ${monthLabel} 한 달치 기록과 감정 통계입니다.
시간이 지나 기억이 흐려졌을 때 이 회고만 읽어도 그 순간들이 영화처럼 생생하게 다시 떠오르도록, 매우 구체적이고 풍부한 '월간 회고'를 작성해줘.

[감정 통계]
${statsText}

[기록 (일상·생각·지출·고민, 시간 포함)]
"""
${recordsText}
"""

다음 JSON 형식으로만 응답해줘. 유효한 JSON 외의 텍스트는 절대 포함하지 마.

{
    "moodSummary": "이번 달 감정의 흐름을 실제 사건과 함께 4~6문장으로 서술. 월초→월말의 변화와 전환점을 구체적인 일을 들어 설명.",
    "triggers": [
        {"emotion": "감정 (이모지 포함, 예: 😣 신경질나는)", "trigger": "그 감정이 솟은 순간을 2~4문장으로 생생하게 재현. 날짜·시간대·장소·함께 있던 사람·구체적으로 무슨 일/대화/행동이 있었는지·어떤 디테일이 있었는지를 기록에 근거해 충분히 풀어서 서술."}
    ],
    "patterns": ["반복되는 패턴을 구체적 사례(날짜·사건)와 함께 2~3문장으로 서술"],
    "positives": ["좋았던 순간을 구체적인 장면과 함께 서술"],
    "challenges": ["힘들었던 부분을 맥락·원인과 함께 구체적으로 서술"],
    "insights": ["사용자가 미처 보지 못했을 통찰 1~3개, 근거가 되는 사실과 함께"],
    "suggestion": "다음 달을 위한 구체적이고 따뜻한 제안 한 가지"
}

지침:
- 공감적이고 따뜻한 한국어 톤. 평가하거나 훈계하지 마.
- **가장 중요: 모든 항목을 '생생한 복기'가 가능하도록 구체적으로 써.** 기록에 등장하는 고유명사(사람 이름, 장소, 책·작품명), 숫자, 실제 대화나 행동을 최대한 인용해. "~한 순간", "~할 때"처럼 막연한 요약은 금지.
- triggers는 가장 중요한 항목이야. 주요 감정마다 그 감정이 솟은 '구체적 장면'을 재현해줘. 긍정·부정 감정 모두 다루고, 반복 트리거를 우선하되 5~7개. 각 trigger는 최소 2문장 이상으로 충분히 길고 자세하게.
- #감정/xxx 태그는 그 시점에 느낀 감정이고, 같은 날짜·줄의 다른 내용이 그 감정의 단서야. 지출·고민 기록은 그날 무슨 일이 있었는지 배경 맥락으로 적극 활용해.
- 기록에 없는 내용을 지어내지는 마. 단, 기록에 흩어진 단서들은 적극적으로 연결하고 풀어서 서술해.
- triggers 외 배열은 2~4개씩. 해당 내용이 없으면 빈 배열.
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
                    .filter((t: unknown): t is { emotion?: string; trigger?: string } => !!t && typeof t === 'object')
                    .map((t: { emotion?: string; trigger?: string }) => ({ emotion: t.emotion || '', trigger: t.trigger || '' }))
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
