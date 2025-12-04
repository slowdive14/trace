import { GoogleGenerativeAI } from "@google/generative-ai";

const getApiKey = () => {
    // 1. Try environment variable
    const envKey = import.meta.env.VITE_GEMINI_API_KEY;
    if (envKey) return envKey;

    // 2. Try localStorage (shared with Expense feature)
    const localKey = localStorage.getItem('gemini_api_key');
    if (localKey) return localKey;

    return null;
};

const initializeGenAI = () => {
    const apiKey = getApiKey();
    if (apiKey) {
        return new GoogleGenerativeAI(apiKey);
    }
    return null;
};

let genAI: GoogleGenerativeAI | null = initializeGenAI();

export const generateWorryActions = async (worryContent: string): Promise<string[]> => {
    // Re-initialize if null (in case key was added to localStorage later)
    if (!genAI) {
        genAI = initializeGenAI();
    }

    if (!genAI) {
        throw new Error("Gemini API key is not configured. Please add it in settings or .env file.");
    }

    const model = genAI.getGenerativeModel({ model: "gemini-2.5-flash" });

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
