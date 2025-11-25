import type { ExpenseCategory } from '../types/types';

// 키워드 기반 카테고리 매칭
const CATEGORY_KEYWORDS: Record<ExpenseCategory, string[]> = {
    '커피/음료': ['커피', '아메리카노', '카페', '라떼', '음료', '이디야', '메가커피', '스타벅스', '스벅', '카페인', '차', '주스'],
    '식사': ['밥', '점심', '저녁', '아침', '식사', '김밥', '국수', '돈까스', '찌개', '백반', '정식', '도시락', '치킨', '피자'],
    '간식': ['간식', '과자', '빵', '디저트', '아이스크림', '초콜릿', '에너지바', '군것질', '떡볶이', '순대'],
    '교통': ['버스', '지하철', '택시', '교통비', '유류비', '주유', '기름', '카카오택시'],
    '문화/취미': ['영화', '책', '공연', '전시', '취미', '게임', '운동', '헬스', '수영'],
    '종교/기부': ['봉헌', '헌금', '성당', '교회', '절', '기부', '후원'],
    '생필품': ['마트', '편의점', '생필품', '세제', '휴지', '샴푸', '비누', '치약'],
    '공간 사용료': ['스터디카페', '스카', '독서실', '상담실', '대여', '공간', '회의실', '세미나실', '연습실'],
    '기타': []
};

/**
 * 키워드 매칭을 통한 카테고리 감지
 */
export function detectCategoryByKeyword(description: string): ExpenseCategory | null {
    const lowerDesc = description.toLowerCase();

    for (const [category, keywords] of Object.entries(CATEGORY_KEYWORDS)) {
        if (keywords.some(keyword => lowerDesc.includes(keyword))) {
            return category as ExpenseCategory;
        }
    }

    return null;
}

/**
 * Gemini API를 사용한 자동 카테고리 분류
 * localStorage에서 API 키를 읽어서 사용
 */
export async function classifyExpenseWithAI(description: string): Promise<ExpenseCategory> {
    // 먼저 키워드 매칭 시도 (빠르고 무료)
    const keywordMatch = detectCategoryByKeyword(description);
    if (keywordMatch) {
        return keywordMatch;
    }

    // 키워드 매칭 실패 시 Gemini API 사용
    try {
        // localStorage에서 API 키 읽기
        const apiKey = localStorage.getItem('gemini_api_key');
        if (!apiKey) {
            console.log('Gemini API key not found in settings');
            return '기타';
        }

        const response = await fetch(
            `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`,
            {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    contents: [{
                        parts: [{
                            text: `다음 지출 내역을 적절한 카테고리 하나로 분류해주세요.

카테고리 목록:
- 커피/음료
- 식사
- 간식
- 교통
- 문화/취미
- 종교/기부
- 생필품
- 공간 사용료
- 기타

지출 내역: "${description}"

응답은 반드시 위 카테고리 중 하나만 정확히 답해주세요. 다른 설명 없이 카테고리 이름만 출력하세요.`
                        }]
                    }]
                })
            }
        );

        if (!response.ok) {
            throw new Error(`API request failed: ${response.status}`);
        }

        const data = await response.json();
        const category = data.candidates?.[0]?.content?.parts?.[0]?.text?.trim() as ExpenseCategory;

        // 유효한 카테고리인지 확인
        const validCategories: ExpenseCategory[] = [
            '커피/음료', '식사', '간식', '교통', '문화/취미', '종교/기부', '생필품', '공간 사용료', '기타'
        ];

        if (validCategories.includes(category)) {
            console.log(`✨ AI classified "${description}" as "${category}"`);
            return category;
        }
    } catch (error) {
        console.error('AI classification failed:', error);
    }

    return '기타';
}

/**
 * 금액 파싱 (음수 포함)
 */
export function parseAmount(input: string): number | null {
    // "-1500", "1500", "1,500" 등을 파싱
    const cleaned = input.replace(/,/g, '').trim();
    const amount = parseFloat(cleaned);
    return isNaN(amount) ? null : amount;
}

/**
 * 설명에서 금액 추출
 */
export function extractAmountFromDescription(description: string): {
    description: string;
    amount: number | null;
} {
    // "커피 1500" 형태에서 금액 추출
    const regex = /(-?\d+(?:,\d{3})*)/;
    const match = description.match(regex);

    if (match) {
        const amount = parseAmount(match[1]);
        const cleanedDesc = description.replace(regex, '').trim();
        return { description: cleanedDesc, amount };
    }

    return { description, amount: null };
}

/**
 * 여러 줄의 지출 내역을 한 번에 파싱
 */
export function parseBatchExpenses(input: string): Array<{
    description: string;
    amount: number;
    rawLine: string;
}> {
    const lines = input.split('\n').map(line => line.trim()).filter(line => line.length > 0);
    const results: Array<{ description: string; amount: number; rawLine: string }> = [];

    for (const line of lines) {
        const { description, amount } = extractAmountFromDescription(line);
        if (amount !== null && description) {
            results.push({ description, amount, rawLine: line });
        }
    }

    return results;
}
