// 감정 태그 데이터 구조
export interface EmotionTag {
    tag: string;
    meaning: string;
    category: string;
    subcategory?: string;
    relatedEmotions?: string[];
    bodyPart?: string;
}

// 핵심 감정 매트릭스 (65개)
const coreEmotions: EmotionTag[] = [
    // 높은 에너지 + 긍정 (13개)
    { tag: '#감정/환희', meaning: '극도로 기쁘고 즐거워서 하늘을 날 듯한 행복감', category: '핵심', subcategory: '높은 에너지 + 긍정' },
    { tag: '#감정/황홀', meaning: '꿈꾸는 듯이 기쁘고 도취된 극한의 즐거움', category: '핵심', subcategory: '높은 에너지 + 긍정' },
    { tag: '#감정/벅찬', meaning: '감동과 기쁨이 넘쳐흘러 가슴이 벅차오르는 느낌', category: '핵심', subcategory: '높은 에너지 + 긍정' },
    { tag: '#감정/짜릿한', meaning: '신체적 쾌감과 흥분이 결합된 전율하는 기분', category: '핵심', subcategory: '높은 에너지 + 긍정' },
    { tag: '#감정/통쾌한', meaning: '답답함이 해소되어 속이 시원하고 상쾌한 기분', category: '핵심', subcategory: '높은 에너지 + 긍정' },
    { tag: '#감정/신나는', meaning: '기분이 좋아 들뜨고 활기찬 상태', category: '핵심', subcategory: '높은 에너지 + 긍정' },
    { tag: '#감정/활기찬', meaning: '생기와 에너지가 넘치는 상태', category: '핵심', subcategory: '높은 에너지 + 긍정' },
    { tag: '#감정/힘이남', meaning: '몸과 마음에 활력이 충만한 상태', category: '핵심', subcategory: '높은 에너지 + 긍정' },
    { tag: '#감정/상쾌한', meaning: '깔끔하고 시원한 기분 좋은 상태', category: '핵심', subcategory: '높은 에너지 + 긍정' },
    { tag: '#감정/용기있는', meaning: '어려운 일에 맞설 용기와 의지가 솟는 상태', category: '핵심', subcategory: '높은 에너지 + 긍정' },
    { tag: '#감정/재미있는', meaning: '흥미롭고 즐거워서 웃음이 나는 상태', category: '핵심', subcategory: '높은 에너지 + 긍정' },
    { tag: '#감정/호기심', meaning: '새로운 것에 대한 관심과 알고 싶은 마음', category: '핵심', subcategory: '높은 에너지 + 긍정' },
    { tag: '#감정/뿌듯한', meaning: '성취나 만족스러운 결과에 대한 자부심과 기쁨', category: '핵심', subcategory: '높은 에너지 + 긍정' },

    // 높은 에너지 + 부정 (17개)
    { tag: '#감정/화난', meaning: '불쾌한 일에 대해 격하게 반응하는 강한 분노 상태', category: '핵심', subcategory: '높은 에너지 + 부정' },
    { tag: '#감정/격노한', meaning: '화남보다 더 극도로 분개하여 이성을 잃을 정도로 격렬한 분노', category: '핵심', subcategory: '높은 에너지 + 부정' },
    { tag: '#감정/분개', meaning: '부당하고 억울한 일에 대해 의분을 느끼며 강하게 화내는 상태', category: '핵심', subcategory: '높은 에너지 + 부정' },
    { tag: '#감정/분통', meaning: '억울하고 분한 마음이 터질 듯이 쌓여 있는 상태', category: '핵심', subcategory: '높은 에너지 + 부정' },
    { tag: '#감정/억울한', meaning: '잘못 없이 피해를 당하거나 오해받아서 서러운 마음', category: '핵심', subcategory: '높은 에너지 + 부정' },
    { tag: '#감정/불안한', meaning: '앞으로 일어날 일에 대한 걱정과 초조함으로 마음이 편하지 않은 상태', category: '핵심', subcategory: '높은 에너지 + 부정' },
    { tag: '#감정/두려운', meaning: '무서워하고 겁을 내는 상태', category: '핵심', subcategory: '높은 에너지 + 부정' },
    { tag: '#감정/경악', meaning: '예상치 못한 충격적인 일에 놀라 정신이 아찔한 상태', category: '핵심', subcategory: '높은 에너지 + 부정' },
    { tag: '#감정/신경질나는', meaning: '사소한 일에도 짜증이 나고 예민해진 상태', category: '핵심', subcategory: '높은 에너지 + 부정' },
    { tag: '#감정/진땀나는', meaning: '긴장되고 초조해서 식은땀이 날 정도로 불안한 상태', category: '핵심', subcategory: '높은 에너지 + 부정' },
    { tag: '#감정/당황한', meaning: '예상치 못한 상황에 어떻게 해야 할지 몰라 당혹스러운 상태', category: '핵심', subcategory: '높은 에너지 + 부정' },
    { tag: '#감정/긴장한', meaning: '중요한 일을 앞두고 마음이 팽팽하게 조여드는 느낌', category: '핵심', subcategory: '높은 에너지 + 부정' },
    { tag: '#감정/초조한', meaning: '마음이 조급하고 안절부절못하는 상태', category: '핵심', subcategory: '높은 에너지 + 부정' },
    { tag: '#감정/조급한', meaning: '빨리 결과를 보고 싶어 서두르는 마음', category: '핵심', subcategory: '높은 에너지 + 부정' },
    { tag: '#감정/조마조마한', meaning: '결과가 어떻게 될지 몰라 마음을 졸이는 상태', category: '핵심', subcategory: '높은 에너지 + 부정' },
    { tag: '#감정/염려되는', meaning: '앞으로의 일이 걱정되어 마음을 쓰는 상태', category: '핵심', subcategory: '높은 에너지 + 부정' },
    { tag: '#감정/수치심', meaning: '창피하고 부끄러워 고개를 들 수 없는 마음', category: '핵심', subcategory: '높은 에너지 + 부정' },

    // 낮은 에너지 + 긍정 (11개)
    { tag: '#감정/만족스러운', meaning: '충분히 만족하고 흡족한 상태', category: '핵심', subcategory: '낮은 에너지 + 긍정' },
    { tag: '#감정/안도감', meaning: '걱정이 해소되어 마음이 놓이는 후련함', category: '핵심', subcategory: '낮은 에너지 + 긍정' },
    { tag: '#감정/감사한', meaning: '고마움을 느끼는 따뜻한 마음', category: '핵심', subcategory: '낮은 에너지 + 긍정' },
    { tag: '#감정/온화한', meaning: '부드럽고 따뜻하며 너그러운 마음가짐', category: '핵심', subcategory: '낮은 에너지 + 긍정' },
    { tag: '#감정/평온한', meaning: '마음이 고요하고 편안한 상태', category: '핵심', subcategory: '낮은 에너지 + 긍정' },
    { tag: '#감정/잔잔한', meaning: '고요하고 은은하게 평화로운 느낌', category: '핵심', subcategory: '낮은 에너지 + 긍정' },
    { tag: '#감정/홀가분', meaning: '부담이 없어져 가벼운 마음', category: '핵심', subcategory: '낮은 에너지 + 긍정' },
    { tag: '#감정/담담한', meaning: '감정의 동요 없이 차분하고 객관적인 상태', category: '핵심', subcategory: '낮은 에너지 + 긍정' },
    { tag: '#감정/느긋한', meaning: '서두르지 않고 여유롭게 편안한 마음', category: '핵심', subcategory: '낮은 에너지 + 긍정' },
    { tag: '#감정/달관한', meaning: '모든 것을 이해하고 받아들이는 성숙한 마음', category: '핵심', subcategory: '낮은 에너지 + 긍정' },
    { tag: '#감정/이완된', meaning: '긴장이 풀어져 편안하고 느슨한 상태', category: '핵심', subcategory: '낮은 에너지 + 긍정' },

    // 낮은 에너지 + 부정 (19개)
    { tag: '#감정/절망적인', meaning: '희망을 완전히 잃고 깊은 절망에 빠진 상태', category: '핵심', subcategory: '낮은 에너지 + 부정' },
    { tag: '#감정/우울한', meaning: '마음이 침체되고 어둡게 가라앉은 상태', category: '핵심', subcategory: '낮은 에너지 + 부정' },
    { tag: '#감정/공허함', meaning: '마음이 텅 비어 있는 듯한 허무한 느낌', category: '핵심', subcategory: '낮은 에너지 + 부정' },
    { tag: '#감정/침울한', meaning: '기분이 가라앉고 어둡게 침체된 상태', category: '핵심', subcategory: '낮은 에너지 + 부정' },
    { tag: '#감정/착잡한', meaning: '여러 부정적 감정이 뒤섞여 복잡하고 무거운 마음', category: '핵심', subcategory: '낮은 에너지 + 부정' },
    { tag: '#감정/씁쓸한', meaning: '실망과 아쉬움이 섞인 쓴맛 같은 기분', category: '핵심', subcategory: '낮은 에너지 + 부정' },
    { tag: '#감정/좌절한', meaning: '뜻대로 되지 않아 의욕을 잃고 포기하고 싶은 마음', category: '핵심', subcategory: '낮은 에너지 + 부정' },
    { tag: '#감정/체념한', meaning: '포기하고 받아들일 수밖에 없다고 체득한 상태', category: '핵심', subcategory: '낮은 에너지 + 부정' },
    { tag: '#감정/괴로운', meaning: '마음이 아프고 고통스러운 상태', category: '핵심', subcategory: '낮은 에너지 + 부정' },
    { tag: '#감정/슬픈', meaning: '마음이 아프고 눈물이 나는 서글픈 감정', category: '핵심', subcategory: '낮은 에너지 + 부정' },
    { tag: '#감정/실망스러운', meaning: '기대했던 것과 달라 마음이 상한 상태', category: '핵심', subcategory: '낮은 에너지 + 부정' },
    { tag: '#감정/막막한', meaning: '앞이 보이지 않아 답답하고 어찌할 바를 모르는 상태', category: '핵심', subcategory: '낮은 에너지 + 부정' },
    { tag: '#감정/피곤한', meaning: '몸과 마음이 지치고 기운이 없는 상태', category: '핵심', subcategory: '낮은 에너지 + 부정' },
    { tag: '#감정/답답한', meaning: '막혀있는 듯한 갑갑하고 뚫려나가지 않는 기분', category: '핵심', subcategory: '낮은 에너지 + 부정' },
    { tag: '#감정/죄책감', meaning: '잘못한 일에 대해 마음에 짐을 지고 있는 상태', category: '핵심', subcategory: '낮은 에너지 + 부정' },
    { tag: '#감정/미안한', meaning: '다른 사람에게 미안하고 죄송한 마음', category: '핵심', subcategory: '낮은 에너지 + 부정' },
    { tag: '#감정/후회스러운', meaning: '지나간 일을 돌이켜보며 아쉬워하는 마음', category: '핵심', subcategory: '낮은 에너지 + 부정' },
    { tag: '#감정/신경쓰이는', meaning: '마음에 걸려 계속 생각나고 거슬리는 상태', category: '핵심', subcategory: '낮은 에너지 + 부정' },
    { tag: '#감정/미운', meaning: '싫어하고 증오하는 마음', category: '핵심', subcategory: '낮은 에너지 + 부정' },
    { tag: '#감정/못마땅한', meaning: '마음에 들지 않아 불만스러운 상태', category: '핵심', subcategory: '낮은 에너지 + 부정' },

    // 중간/전환 감정 (5개)
    { tag: '#감정/애매한', meaning: '명확하지 않고 모호한 감정 상태', category: '핵심', subcategory: '중간/전환' },
    { tag: '#감정/뒤숭숭한', meaning: '마음이 어수선하고 정리되지 않아 복잡한 상태', category: '핵심', subcategory: '중간/전환' },
    { tag: '#감정/찜찜한', meaning: '개운하지 않고 뭔가 신경 쓰이는 기분', category: '핵심', subcategory: '중간/전환' },
    { tag: '#감정/뜨끔한', meaning: '순간적으로 찔리거나 당황하는 느낌', category: '핵심', subcategory: '중간/전환' },
    { tag: '#감정/민망한', meaning: '부끄럽고 어색해서 낯뜨거운 상태', category: '핵심', subcategory: '중간/전환' },
];

// 한국어 특유 감정 표현 (35개)
const koreanUniqueEmotions: EmotionTag[] = [
    // 관계 중심 감정 (8개)
    { tag: '#감정/서운한', meaning: '기대와 달라 마음이 언짢고 섭섭함 (실망보다 더 미묘하고 관계 중심적)', category: '한국어 특유', subcategory: '관계 중심', relatedEmotions: ['실망', '섭섭'] },
    { tag: '#감정/섭섭한', meaning: '배려받지 못해 허전하고 야속한 마음', category: '한국어 특유', subcategory: '관계 중심', relatedEmotions: ['서운', '아쉬움'] },
    { tag: '#감정/그리운', meaning: '보고 싶고 간절히 그리워하는 마음', category: '한국어 특유', subcategory: '관계 중심', relatedEmotions: ['그리움', '애틋함'] },
    { tag: '#감정/아쉬운', meaning: '충분하지 못하거나 놓쳐서 안타까운 마음', category: '한국어 특유', subcategory: '관계 중심', relatedEmotions: ['안타까움', '허전함'] },
    { tag: '#감정/부러운', meaning: '타인의 좋은 점을 선망하고 갖고 싶어함', category: '한국어 특유', subcategory: '관계 중심', relatedEmotions: ['선망', '질투'] },
    { tag: '#감정/고마운', meaning: '진심으로 감사하는 마음 (감사한보다 구어적)', category: '한국어 특유', subcategory: '관계 중심', relatedEmotions: ['감사', '고마움'] },
    { tag: '#감정/애틋한', meaning: '안쓰럽고 가엾어 마음이 끌리는 느낌', category: '한국어 특유', subcategory: '관계 중심', relatedEmotions: ['연민', '그리움'] },
    { tag: '#감정/야속한', meaning: '섭섭하고 원망스러운 마음', category: '한국어 특유', subcategory: '관계 중심', relatedEmotions: ['섭섭', '원망'] },

    // 긍정적 미묘함 (6개)
    { tag: '#감정/개운한', meaning: '후련하고 상쾌한 기분', category: '한국어 특유', subcategory: '긍정적 미묘함', relatedEmotions: ['상쾌', '홀가분'] },
    { tag: '#감정/든든한', meaning: '믿음직하고 안심되는 마음', category: '한국어 특유', subcategory: '긍정적 미묘함', relatedEmotions: ['안심', '신뢰'] },
    { tag: '#감정/흐뭇한', meaning: '만족스럽고 기분 좋은 마음', category: '한국어 특유', subcategory: '긍정적 미묘함', relatedEmotions: ['만족', '뿌듯'] },
    { tag: '#감정/알찬', meaning: '내실있고 충실한 만족감', category: '한국어 특유', subcategory: '긍정적 미묘함', relatedEmotions: ['만족', '뿌듯'] },
    { tag: '#감정/상큼한', meaning: '밝고 싱그러운 기분', category: '한국어 특유', subcategory: '긍정적 미묘함', relatedEmotions: ['상쾌', '활기'] },
    { tag: '#감정/포근한', meaning: '따뜻하고 편안한 느낌', category: '한국어 특유', subcategory: '긍정적 미묘함', relatedEmotions: ['온화', '평온'] },

    // 불편함의 미묘한 변주 (8개)
    { tag: '#감정/짜증나는', meaning: '신경에 거슬리고 화나는 마음 (신경질보다 일상적)', category: '한국어 특유', subcategory: '불편함의 변주', relatedEmotions: ['신경질', '화남'] },
    { tag: '#감정/귀찮은', meaning: '하기 싫고 번거로움', category: '한국어 특유', subcategory: '불편함의 변주', relatedEmotions: ['무기력', '피곤'] },
    { tag: '#감정/지겨운', meaning: '같은 것이 반복되어 싫증남', category: '한국어 특유', subcategory: '불편함의 변주', relatedEmotions: ['권태', '짜증'] },
    { tag: '#감정/역겨운', meaning: '메스껍고 매우 불쾌함', category: '한국어 특유', subcategory: '불편함의 변주', relatedEmotions: ['혐오', '불쾌'] },
    { tag: '#감정/원망스러운', meaning: '섭섭하고 야속한 마음', category: '한국어 특유', subcategory: '불편함의 변주', relatedEmotions: ['섭섭', '분노'] },
    { tag: '#감정/쪽팔리는', meaning: '창피하고 체면이 깎임 (수치심보다 구어적)', category: '한국어 특유', subcategory: '불편함의 변주', relatedEmotions: ['수치심', '민망'] },
    { tag: '#감정/어색한', meaning: '불편하고 낯간지러운 상태', category: '한국어 특유', subcategory: '불편함의 변주', relatedEmotions: ['민망', '불편'] },
    { tag: '#감정/쑥스러운', meaning: '부끄럽고 어색한 마음', category: '한국어 특유', subcategory: '불편함의 변주', relatedEmotions: ['민망', '부끄러움'] },

    // 체념과 무기력 (4개)
    { tag: '#감정/무기력한', meaning: '의욕이 전혀 없고 힘이 빠진 상태', category: '한국어 특유', subcategory: '체념과 무기력', relatedEmotions: ['피곤', '우울'] },
    { tag: '#감정/무감각한', meaning: '아무 감정도 느껴지지 않는 상태', category: '한국어 특유', subcategory: '체념과 무기력', relatedEmotions: ['공허', '우울'] },
    { tag: '#감정/허탈한', meaning: '기운이 쭉 빠지고 맥없는 상태', category: '한국어 특유', subcategory: '체념과 무기력', relatedEmotions: ['좌절', '실망'] },
    { tag: '#감정/맥빠지는', meaning: '기대했던 것이 어긋나 힘이 빠짐', category: '한국어 특유', subcategory: '체념과 무기력', relatedEmotions: ['허탈', '실망'] },

    // 복합 감정 (4개)
    { tag: '#감정/시원섭섭한', meaning: '끝나서 후련하면서도 아쉬운 복합감정', category: '한국어 특유', subcategory: '복합 감정', relatedEmotions: ['안도', '아쉬움'] },
    { tag: '#감정/싱숭생숭한', meaning: '마음이 들떠 안정되지 않는 상태', category: '한국어 특유', subcategory: '복합 감정', relatedEmotions: ['기대', '불안'] },
    { tag: '#감정/울컥한', meaning: '갑자기 감정이 북받쳐 오름', category: '한국어 특유', subcategory: '복합 감정', relatedEmotions: ['슬픔', '감동'] },
    { tag: '#감정/찔리는', meaning: '양심에 걸려 순간 당황스러움', category: '한국어 특유', subcategory: '복합 감정', relatedEmotions: ['죄책감', '수치심'] },

    // 신체화된 감정 표현 (5개)
    { tag: '#감정/가슴이뻐근한', meaning: '가슴이 답답하고 먹먹한 느낌', category: '한국어 특유', subcategory: '신체화된 표현', bodyPart: '가슴' },
    { tag: '#감정/속이쓰린', meaning: '속이 타는 듯 쓰라림', category: '한국어 특유', subcategory: '신체화된 표현', bodyPart: '위/속' },
    { tag: '#감정/목이메는', meaning: '슬픔이나 감동으로 목이 막힘', category: '한국어 특유', subcategory: '신체화된 표현', bodyPart: '목' },
    { tag: '#감정/뒷목이당기는', meaning: '화나고 답답해 뒷목이 뻐근함', category: '한국어 특유', subcategory: '신체화된 표현', bodyPart: '목/어깨' },
    { tag: '#감정/가슴이미어지는', meaning: '매우 슬프고 아픈 마음', category: '한국어 특유', subcategory: '신체화된 표현', bodyPart: '가슴' },
];

// 전체 감정 태그 배열
export const allEmotionTags: EmotionTag[] = [...coreEmotions, ...koreanUniqueEmotions];

// 카테고리별 감정 태그
export const emotionsByCategory = {
    core: coreEmotions,
    koreanUnique: koreanUniqueEmotions,
};

// 서브카테고리별 감정 태그
export const emotionsBySubcategory = allEmotionTags.reduce((acc, emotion) => {
    const key = emotion.subcategory || '기타';
    if (!acc[key]) {
        acc[key] = [];
    }
    acc[key].push(emotion);
    return acc;
}, {} as Record<string, EmotionTag[]>);

// 검색 함수
export const searchEmotions = (query: string): EmotionTag[] => {
    const lowerQuery = query.toLowerCase();
    return allEmotionTags.filter(emotion =>
        emotion.tag.toLowerCase().includes(lowerQuery) ||
        emotion.meaning.toLowerCase().includes(lowerQuery)
    );
};

// 태그 텍스트로 감정 찾기
export const findEmotionByTag = (tag: string): EmotionTag | undefined => {
    return allEmotionTags.find(emotion => emotion.tag === tag);
};
