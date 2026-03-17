import { GoogleGenerativeAI } from "@google/generative-ai";
import type { BrainDumpInsight } from "../types/types";

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
