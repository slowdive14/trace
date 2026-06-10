// 무드미터 사분면 키 (에너지 × 긍부정) + 복합/중간
export type QuadrantKey = 'highNegative' | 'highPositive' | 'lowNegative' | 'lowPositive' | 'complex';

// 감정 태그 데이터 구조
export interface EmotionTag {
    tag: string;
    emoji: string;
    meaning: string;
    category: string;
    subcategory?: string;
    relatedEmotions?: string[];
    bodyPart?: string;
    quadrant: QuadrantKey; // 에너지×긍부정 분류 (모든 감정 단일 기준)
    group?: string;        // 사분면 내 소그룹 (스캔 편의용 라벨)
}

// 핵심 감정 매트릭스 - emoji/quadrant는 아래에서 주입
const coreEmotionsBase: Omit<EmotionTag, 'emoji' | 'quadrant'>[] = [
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

// 한국어 특유 감정 표현 - emoji/quadrant는 아래에서 주입
const koreanUniqueEmotionsBase: Omit<EmotionTag, 'emoji' | 'quadrant'>[] = [
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

// 확장 감정 표현 (어휘 보강) - emoji/quadrant는 아래에서 주입
const additionalEmotionsBase: Omit<EmotionTag, 'emoji' | 'quadrant'>[] = [
    // 외로움 계열
    { tag: '#감정/외로운', meaning: '곁에 아무도 없는 듯 쓸쓸하고 허전한 마음', category: '확장', subcategory: '외로움', relatedEmotions: ['쓸쓸', '고독'] },
    { tag: '#감정/쓸쓸한', meaning: '허전하고 적막하여 외로운 느낌', category: '확장', subcategory: '외로움', relatedEmotions: ['외로움', '적적'] },
    { tag: '#감정/고독한', meaning: '홀로 떨어져 있는 고요하고 깊은 외로움', category: '확장', subcategory: '외로움', relatedEmotions: ['외로움', '쓸쓸'] },
    { tag: '#감정/적적한', meaning: '조용하고 외로워 마음이 적막한 상태', category: '확장', subcategory: '외로움', relatedEmotions: ['쓸쓸', '허전'] },
    { tag: '#감정/허전한', meaning: '무언가 빠진 듯 텅 비고 서운한 느낌', category: '확장', subcategory: '외로움', relatedEmotions: ['공허', '서운'] },
    // 설렘/기대 계열
    { tag: '#감정/설레는', meaning: '기대와 두근거림으로 마음이 들뜬 상태', category: '확장', subcategory: '설렘', relatedEmotions: ['두근거림', '기대'] },
    { tag: '#감정/두근거리는', meaning: '기대나 끌림으로 가슴이 콩닥거리는 느낌', category: '확장', subcategory: '설렘', relatedEmotions: ['설렘', '긴장'] },
    { tag: '#감정/들뜬', meaning: '마음이 달뜨고 붕 뜬 듯 흥분된 상태', category: '확장', subcategory: '설렘', relatedEmotions: ['설렘', '신남'] },
    { tag: '#감정/기대되는', meaning: '좋은 일이 생길 것 같아 기다려지는 마음', category: '확장', subcategory: '설렘', relatedEmotions: ['설렘', '희망'] },
    // 사랑/애정
    { tag: '#감정/사랑스러운', meaning: '아끼고 싶을 만큼 사랑이 가는 마음', category: '확장', subcategory: '사랑', relatedEmotions: ['애정', '다정'] },
    { tag: '#감정/다정한', meaning: '따뜻하고 정겨워 살가운 마음', category: '확장', subcategory: '사랑', relatedEmotions: ['온화', '포근'] },
    { tag: '#감정/반한', meaning: '강하게 끌리고 매료된 상태', category: '확장', subcategory: '사랑', relatedEmotions: ['설렘', '황홀'] },
    // 자부심 계열
    { tag: '#감정/자랑스러운', meaning: '내세우고 싶을 만큼 떳떳하고 뿌듯한 마음', category: '확장', subcategory: '자부심', relatedEmotions: ['뿌듯', '의기양양'] },
    { tag: '#감정/의기양양한', meaning: '뜻을 이뤄 우쭐하고 당당한 기세', category: '확장', subcategory: '자부심', relatedEmotions: ['뿌듯', '우쭐'] },
    { tag: '#감정/우쭐한', meaning: '은근히 뽐내고 싶어 들뜬 마음', category: '확장', subcategory: '자부심', relatedEmotions: ['의기양양', '뿌듯'] },
    // 질투/시기/공포
    { tag: '#감정/질투나는', meaning: '남이 가진 것이 샘나고 시기심이 이는 상태', category: '확장', subcategory: '질투', relatedEmotions: ['부러움', '시기'] },
    { tag: '#감정/약오르는', meaning: '분하고 화가 약이 올라 들끓는 느낌', category: '확장', subcategory: '질투', relatedEmotions: ['분함', '짜증'] },
    { tag: '#감정/오싹한', meaning: '소름이 끼치고 섬뜩한 무서움', category: '확장', subcategory: '공포', relatedEmotions: ['두려움', '섬뜩'] },
    { tag: '#감정/섬뜩한', meaning: '갑자기 무섭고 소름이 돋는 느낌', category: '확장', subcategory: '공포', relatedEmotions: ['오싹', '두려움'] },
    // 감격/뭉클
    { tag: '#감정/뭉클한', meaning: '가슴이 찡하게 감동이 차오르는 느낌', category: '확장', subcategory: '감격', relatedEmotions: ['감동', '찡함'] },
    { tag: '#감정/감격스러운', meaning: '벅찬 감동으로 가슴이 북받치는 상태', category: '확장', subcategory: '감격', relatedEmotions: ['벅참', '뭉클'] },
    { tag: '#감정/충만한', meaning: '마음이 가득 차 흡족하고 벅찬 느낌', category: '확장', subcategory: '감격', relatedEmotions: ['만족', '벅참'] },
    { tag: '#감정/찡한', meaning: '코끝이 시큰하게 감동·연민이 이는 느낌', category: '확장', subcategory: '감격', relatedEmotions: ['뭉클', '울컥'] },
    // 권태/지루
    { tag: '#감정/따분한', meaning: '재미없고 심심해 지루한 상태', category: '확장', subcategory: '권태', relatedEmotions: ['지겨움', '심심'] },
    { tag: '#감정/심심한', meaning: '할 게 없어 무료하고 따분한 느낌', category: '확장', subcategory: '권태', relatedEmotions: ['따분', '무료'] },
    { tag: '#감정/권태로운', meaning: '모든 게 시들하고 싫증나 나른한 상태', category: '확장', subcategory: '권태', relatedEmotions: ['지겨움', '무기력'] },
    // 측은/안쓰러움
    { tag: '#감정/안쓰러운', meaning: '가엾고 딱해 마음이 쓰이는 느낌', category: '확장', subcategory: '연민', relatedEmotions: ['측은', '짠함'] },
    { tag: '#감정/측은한', meaning: '불쌍하고 가여워 마음이 아픈 상태', category: '확장', subcategory: '연민', relatedEmotions: ['안쓰러움', '연민'] },
    { tag: '#감정/짠한', meaning: '안쓰럽고 가슴이 찡하게 아린 마음', category: '확장', subcategory: '연민', relatedEmotions: ['안쓰러움', '뭉클'] },
    // 기타
    { tag: '#감정/부끄러운', meaning: '수줍고 창피해 낯이 뜨거운 마음', category: '확장', subcategory: '기타', relatedEmotions: ['민망', '쑥스러움'] },
    { tag: '#감정/후련한', meaning: '막힌 게 뚫려 시원하고 개운한 느낌', category: '확장', subcategory: '기타', relatedEmotions: ['개운', '홀가분'] },
    { tag: '#감정/나른한', meaning: '노곤하고 졸린 듯 편안한 느낌', category: '확장', subcategory: '기타', relatedEmotions: ['이완', '느긋'] },
    { tag: '#감정/차분한', meaning: '들뜸 없이 가라앉아 고요한 마음', category: '확장', subcategory: '기타', relatedEmotions: ['평온', '담담'] },
    { tag: '#감정/멋쩍은', meaning: '어색하고 겸연쩍어 쑥스러운 느낌', category: '확장', subcategory: '기타', relatedEmotions: ['어색', '민망'] },
    { tag: '#감정/시큰둥한', meaning: '관심 없고 떨떠름한 무덤덤한 태도', category: '확장', subcategory: '기타', relatedEmotions: ['무감각', '못마땅'] },
    { tag: '#감정/얼떨떨한', meaning: '갑작스러워 어리둥절하고 멍한 상태', category: '확장', subcategory: '기타', relatedEmotions: ['당황', '뒤숭숭'] },
];

// 감정별 이모지 매핑 (빠른 시각 식별용)
const emojiByTag: Record<string, string> = {
    // 높은 에너지 + 긍정
    '#감정/환희': '🤩', '#감정/황홀': '😍', '#감정/벅찬': '🥹', '#감정/짜릿한': '⚡',
    '#감정/통쾌한': '😆', '#감정/신나는': '🤸', '#감정/활기찬': '💪', '#감정/힘이남': '🔋',
    '#감정/상쾌한': '😎', '#감정/용기있는': '🦁', '#감정/재미있는': '😂', '#감정/호기심': '🤔',
    '#감정/뿌듯한': '😊',
    // 높은 에너지 + 부정
    '#감정/화난': '😠', '#감정/격노한': '🤬', '#감정/분개': '😤', '#감정/분통': '💢',
    '#감정/억울한': '😣', '#감정/불안한': '😰', '#감정/두려운': '😨', '#감정/경악': '😱',
    '#감정/신경질나는': '😖', '#감정/진땀나는': '😅', '#감정/당황한': '😳', '#감정/긴장한': '😬',
    '#감정/초조한': '😟', '#감정/조급한': '⏰', '#감정/조마조마한': '😧', '#감정/염려되는': '😦',
    '#감정/수치심': '🫣',
    // 낮은 에너지 + 긍정
    '#감정/만족스러운': '😌', '#감정/안도감': '😮‍💨', '#감정/감사한': '🙏', '#감정/온화한': '🤗',
    '#감정/평온한': '🍃', '#감정/잔잔한': '🌊', '#감정/홀가분': '🎈', '#감정/담담한': '😐',
    '#감정/느긋한': '🛋️', '#감정/달관한': '🧘', '#감정/이완된': '💆',
    // 낮은 에너지 + 부정
    '#감정/절망적인': '😩', '#감정/우울한': '😔', '#감정/공허함': '🕳️', '#감정/침울한': '😞',
    '#감정/착잡한': '😕', '#감정/씁쓸한': '😒', '#감정/좌절한': '😫', '#감정/체념한': '🤷',
    '#감정/괴로운': '💔', '#감정/슬픈': '😢', '#감정/실망스러운': '🫤', '#감정/막막한': '😶‍🌫️',
    '#감정/피곤한': '😪', '#감정/답답한': '🫠', '#감정/죄책감': '😓', '#감정/미안한': '🙇',
    '#감정/후회스러운': '😞', '#감정/신경쓰이는': '🤨', '#감정/미운': '😒', '#감정/못마땅한': '😑',
    // 중간/전환
    '#감정/애매한': '😶', '#감정/뒤숭숭한': '😵‍💫', '#감정/찜찜한': '🙄', '#감정/뜨끔한': '😯',
    '#감정/민망한': '🫨',
    // 한국어 특유 - 관계 중심
    '#감정/서운한': '🥺', '#감정/섭섭한': '😔', '#감정/그리운': '🌙', '#감정/아쉬운': '😞',
    '#감정/부러운': '👀', '#감정/고마운': '🙏', '#감정/애틋한': '🥹', '#감정/야속한': '😒',
    // 한국어 특유 - 긍정적 미묘함
    '#감정/개운한': '🚿', '#감정/든든한': '🛡️', '#감정/흐뭇한': '😄', '#감정/알찬': '✅',
    '#감정/상큼한': '🍋', '#감정/포근한': '🧸',
    // 한국어 특유 - 불편함의 변주
    '#감정/짜증나는': '😤', '#감정/귀찮은': '🥱', '#감정/지겨운': '😴', '#감정/역겨운': '🤢',
    '#감정/원망스러운': '😠', '#감정/쪽팔리는': '🙈', '#감정/어색한': '😬', '#감정/쑥스러운': '☺️',
    // 한국어 특유 - 체념과 무기력
    '#감정/무기력한': '🪫', '#감정/무감각한': '😶', '#감정/허탈한': '😵', '#감정/맥빠지는': '😮‍💨',
    // 한국어 특유 - 복합 감정
    '#감정/시원섭섭한': '🥲', '#감정/싱숭생숭한': '🌸', '#감정/울컥한': '😭', '#감정/찔리는': '😬',
    // 한국어 특유 - 신체화된 표현
    '#감정/가슴이뻐근한': '🫀', '#감정/속이쓰린': '🔥', '#감정/목이메는': '😢',
    '#감정/뒷목이당기는': '🤯', '#감정/가슴이미어지는': '💔',
    // 확장 - 외로움
    '#감정/외로운': '🥺', '#감정/쓸쓸한': '🍂', '#감정/고독한': '🌑', '#감정/적적한': '🤍', '#감정/허전한': '🫥',
    // 확장 - 설렘
    '#감정/설레는': '💓', '#감정/두근거리는': '💗', '#감정/들뜬': '🎊', '#감정/기대되는': '🌠',
    // 확장 - 사랑
    '#감정/사랑스러운': '🥰', '#감정/다정한': '💞', '#감정/반한': '💘',
    // 확장 - 자부심
    '#감정/자랑스러운': '🦚', '#감정/의기양양한': '🏆', '#감정/우쭐한': '😼',
    // 확장 - 질투/공포
    '#감정/질투나는': '😤', '#감정/약오르는': '😾', '#감정/오싹한': '🥶', '#감정/섬뜩한': '👻',
    // 확장 - 감격
    '#감정/뭉클한': '🫶', '#감정/감격스러운': '🙌', '#감정/충만한': '🌟', '#감정/찡한': '🥹',
    // 확장 - 권태
    '#감정/따분한': '😑', '#감정/심심한': '🥱', '#감정/권태로운': '😮‍💨',
    // 확장 - 연민
    '#감정/안쓰러운': '🫂', '#감정/측은한': '😢', '#감정/짠한': '😞',
    // 확장 - 기타
    '#감정/부끄러운': '😳', '#감정/후련한': '🌬️', '#감정/나른한': '😴', '#감정/차분한': '🍵',
    '#감정/멋쩍은': '😅', '#감정/시큰둥한': '😒', '#감정/얼떨떨한': '😵',
};

// 핵심 감정: subcategory → 사분면
const subcatToQuadrant: Record<string, QuadrantKey> = {
    '높은 에너지 + 긍정': 'highPositive',
    '높은 에너지 + 부정': 'highNegative',
    '낮은 에너지 + 긍정': 'lowPositive',
    '낮은 에너지 + 부정': 'lowNegative',
    '중간/전환': 'complex',
};

// 한국어 특유·확장 감정의 사분면 (subcategory로 안 갈리는 것들 — 단어별 직접 지정)
const quadrantByTag: Record<string, QuadrantKey> = {
    // 관계 중심
    '#감정/서운한': 'lowNegative', '#감정/섭섭한': 'lowNegative', '#감정/그리운': 'complex', '#감정/아쉬운': 'lowNegative',
    '#감정/부러운': 'lowNegative', '#감정/고마운': 'lowPositive', '#감정/애틋한': 'complex', '#감정/야속한': 'lowNegative',
    // 긍정적 미묘함
    '#감정/개운한': 'lowPositive', '#감정/든든한': 'lowPositive', '#감정/흐뭇한': 'lowPositive', '#감정/알찬': 'lowPositive',
    '#감정/상큼한': 'highPositive', '#감정/포근한': 'lowPositive',
    // 불편함의 변주
    '#감정/짜증나는': 'highNegative', '#감정/귀찮은': 'lowNegative', '#감정/지겨운': 'lowNegative', '#감정/역겨운': 'highNegative',
    '#감정/원망스러운': 'lowNegative', '#감정/쪽팔리는': 'highNegative', '#감정/어색한': 'lowNegative', '#감정/쑥스러운': 'lowNegative',
    // 체념과 무기력
    '#감정/무기력한': 'lowNegative', '#감정/무감각한': 'complex', '#감정/허탈한': 'lowNegative', '#감정/맥빠지는': 'lowNegative',
    // 복합 감정
    '#감정/시원섭섭한': 'complex', '#감정/싱숭생숭한': 'complex', '#감정/울컥한': 'complex', '#감정/찔리는': 'complex',
    // 신체화된 표현
    '#감정/가슴이뻐근한': 'lowNegative', '#감정/속이쓰린': 'lowNegative', '#감정/목이메는': 'complex',
    '#감정/뒷목이당기는': 'highNegative', '#감정/가슴이미어지는': 'lowNegative',
    // 확장 - 외로움
    '#감정/외로운': 'lowNegative', '#감정/쓸쓸한': 'lowNegative', '#감정/고독한': 'lowNegative', '#감정/적적한': 'lowNegative', '#감정/허전한': 'lowNegative',
    // 확장 - 설렘
    '#감정/설레는': 'highPositive', '#감정/두근거리는': 'highPositive', '#감정/들뜬': 'highPositive', '#감정/기대되는': 'highPositive',
    // 확장 - 사랑
    '#감정/사랑스러운': 'lowPositive', '#감정/다정한': 'lowPositive', '#감정/반한': 'highPositive',
    // 확장 - 자부심
    '#감정/자랑스러운': 'highPositive', '#감정/의기양양한': 'highPositive', '#감정/우쭐한': 'highPositive',
    // 확장 - 질투/공포
    '#감정/질투나는': 'highNegative', '#감정/약오르는': 'highNegative', '#감정/오싹한': 'highNegative', '#감정/섬뜩한': 'highNegative',
    // 확장 - 감격
    '#감정/뭉클한': 'lowPositive', '#감정/감격스러운': 'highPositive', '#감정/충만한': 'lowPositive', '#감정/찡한': 'complex',
    // 확장 - 권태
    '#감정/따분한': 'lowNegative', '#감정/심심한': 'lowNegative', '#감정/권태로운': 'lowNegative',
    // 확장 - 연민
    '#감정/안쓰러운': 'complex', '#감정/측은한': 'lowNegative', '#감정/짠한': 'complex',
    // 확장 - 기타
    '#감정/부끄러운': 'lowNegative', '#감정/후련한': 'lowPositive', '#감정/나른한': 'lowPositive', '#감정/차분한': 'lowPositive',
    '#감정/멋쩍은': 'complex', '#감정/시큰둥한': 'complex', '#감정/얼떨떨한': 'complex',
};

// 사분면 내 소그룹 (스캔 편의용) — 비슷한 결의 감정끼리 묶음
const groupByTag: Record<string, string> = {
    // 활기 · 긍정
    '#감정/환희': '환희·흥분', '#감정/황홀': '환희·흥분', '#감정/벅찬': '환희·흥분', '#감정/짜릿한': '환희·흥분', '#감정/통쾌한': '환희·흥분', '#감정/신나는': '환희·흥분', '#감정/감격스러운': '환희·흥분',
    '#감정/활기찬': '활력', '#감정/힘이남': '활력', '#감정/상쾌한': '활력', '#감정/상큼한': '활력', '#감정/용기있는': '활력',
    '#감정/재미있는': '즐거움·흥미', '#감정/호기심': '즐거움·흥미',
    '#감정/설레는': '설렘', '#감정/두근거리는': '설렘', '#감정/들뜬': '설렘', '#감정/기대되는': '설렘', '#감정/반한': '설렘',
    '#감정/뿌듯한': '자부심', '#감정/자랑스러운': '자부심', '#감정/의기양양한': '자부심', '#감정/우쭐한': '자부심',
    // 활기 · 부정
    '#감정/화난': '분노', '#감정/격노한': '분노', '#감정/분개': '분노', '#감정/분통': '분노', '#감정/억울한': '분노', '#감정/약오르는': '분노', '#감정/질투나는': '분노',
    '#감정/불안한': '불안·긴장', '#감정/긴장한': '불안·긴장', '#감정/초조한': '불안·긴장', '#감정/조급한': '불안·긴장', '#감정/조마조마한': '불안·긴장', '#감정/염려되는': '불안·긴장', '#감정/진땀나는': '불안·긴장',
    '#감정/두려운': '공포·충격', '#감정/경악': '공포·충격', '#감정/당황한': '공포·충격', '#감정/오싹한': '공포·충격', '#감정/섬뜩한': '공포·충격',
    '#감정/신경질나는': '짜증·역겨움', '#감정/짜증나는': '짜증·역겨움', '#감정/역겨운': '짜증·역겨움',
    '#감정/수치심': '수치', '#감정/쪽팔리는': '수치',
    '#감정/뒷목이당기는': '신체',
    // 차분 · 긍정
    '#감정/만족스러운': '만족·평온', '#감정/평온한': '만족·평온', '#감정/잔잔한': '만족·평온', '#감정/담담한': '만족·평온', '#감정/차분한': '만족·평온',
    '#감정/안도감': '안도·홀가분', '#감정/홀가분': '안도·홀가분', '#감정/후련한': '안도·홀가분', '#감정/개운한': '안도·홀가분',
    '#감정/감사한': '따뜻함·감사', '#감정/온화한': '따뜻함·감사', '#감정/포근한': '따뜻함·감사', '#감정/다정한': '따뜻함·감사', '#감정/사랑스러운': '따뜻함·감사', '#감정/고마운': '따뜻함·감사',
    '#감정/느긋한': '여유·이완', '#감정/달관한': '여유·이완', '#감정/이완된': '여유·이완', '#감정/나른한': '여유·이완',
    '#감정/흐뭇한': '충족·뿌듯', '#감정/든든한': '충족·뿌듯', '#감정/알찬': '충족·뿌듯', '#감정/충만한': '충족·뿌듯', '#감정/뭉클한': '충족·뿌듯',
    // 차분 · 부정
    '#감정/절망적인': '우울·침체', '#감정/우울한': '우울·침체', '#감정/공허함': '우울·침체', '#감정/침울한': '우울·침체', '#감정/괴로운': '우울·침체', '#감정/슬픈': '우울·침체', '#감정/막막한': '우울·침체', '#감정/측은한': '우울·침체',
    '#감정/씁쓸한': '실망·아쉬움', '#감정/착잡한': '실망·아쉬움', '#감정/실망스러운': '실망·아쉬움', '#감정/좌절한': '실망·아쉬움', '#감정/서운한': '실망·아쉬움', '#감정/섭섭한': '실망·아쉬움', '#감정/아쉬운': '실망·아쉬움', '#감정/야속한': '실망·아쉬움', '#감정/부러운': '실망·아쉬움',
    '#감정/외로운': '외로움', '#감정/쓸쓸한': '외로움', '#감정/고독한': '외로움', '#감정/적적한': '외로움', '#감정/허전한': '외로움',
    '#감정/죄책감': '자책', '#감정/미안한': '자책', '#감정/후회스러운': '자책', '#감정/신경쓰이는': '자책', '#감정/부끄러운': '자책',
    '#감정/체념한': '무기력·체념', '#감정/무기력한': '무기력·체념', '#감정/허탈한': '무기력·체념', '#감정/맥빠지는': '무기력·체념', '#감정/피곤한': '무기력·체념',
    '#감정/답답한': '권태·싫증', '#감정/귀찮은': '권태·싫증', '#감정/지겨운': '권태·싫증', '#감정/따분한': '권태·싫증', '#감정/심심한': '권태·싫증', '#감정/권태로운': '권태·싫증',
    '#감정/미운': '미움·불만', '#감정/못마땅한': '미움·불만', '#감정/원망스러운': '미움·불만',
    '#감정/어색한': '어색함', '#감정/쑥스러운': '어색함',
    '#감정/가슴이뻐근한': '신체', '#감정/속이쓰린': '신체', '#감정/가슴이미어지는': '신체',
};

// 소그룹 표시 순서
const GROUP_ORDER = [
    '환희·흥분', '활력', '즐거움·흥미', '설렘', '자부심',
    '분노', '불안·긴장', '공포·충격', '짜증·역겨움', '수치',
    '만족·평온', '안도·홀가분', '따뜻함·감사', '여유·이완', '충족·뿌듯',
    '우울·침체', '실망·아쉬움', '외로움', '자책', '무기력·체념', '권태·싫증', '미움·불만', '어색함', '신체',
    '기타',
];
const GROUP_RANK: Record<string, number> = {};
GROUP_ORDER.forEach((g, i) => { GROUP_RANK[g] = i; });

const attachMeta = (emotions: Omit<EmotionTag, 'emoji' | 'quadrant'>[]): EmotionTag[] =>
    emotions.map((e) => ({
        ...e,
        emoji: emojiByTag[e.tag] ?? '🏷️',
        quadrant: quadrantByTag[e.tag] ?? subcatToQuadrant[e.subcategory ?? ''] ?? 'complex',
        group: groupByTag[e.tag] ?? '기타',
    }));

const coreEmotions: EmotionTag[] = attachMeta(coreEmotionsBase);
const koreanUniqueEmotions: EmotionTag[] = attachMeta(koreanUniqueEmotionsBase);
const additionalEmotions: EmotionTag[] = attachMeta(additionalEmotionsBase);

// 전체 감정 태그 배열
export const allEmotionTags: EmotionTag[] = [...coreEmotions, ...koreanUniqueEmotions, ...additionalEmotions];

// 카테고리별 감정 태그
export const emotionsByCategory = {
    core: coreEmotions,
    koreanUnique: koreanUniqueEmotions,
    additional: additionalEmotions,
};

// 사분면별 감정 태그 (통합 분류 — 무드미터·피커의 단일 기준)
export const emotionsByQuadrant: Record<QuadrantKey, EmotionTag[]> = {
    highNegative: [], highPositive: [], lowNegative: [], lowPositive: [], complex: [],
};
allEmotionTags.forEach((e) => emotionsByQuadrant[e.quadrant].push(e));
// 사분면 안에서 소그룹끼리 인접하도록 정렬 (Array.sort 안정 정렬로 그룹 내 순서 유지)
(Object.keys(emotionsByQuadrant) as QuadrantKey[]).forEach((k) => {
    emotionsByQuadrant[k].sort((a, b) => (GROUP_RANK[a.group ?? '기타'] ?? 999) - (GROUP_RANK[b.group ?? '기타'] ?? 999));
});

// 서브카테고리별 감정 태그
export const emotionsBySubcategory = allEmotionTags.reduce((acc, emotion) => {
    const key = emotion.subcategory || '기타';
    if (!acc[key]) {
        acc[key] = [];
    }
    acc[key].push(emotion);
    return acc;
}, {} as Record<string, EmotionTag[]>);

// 검색 함수 (이름·뜻·연관 감정(동의어)까지 매칭)
export const searchEmotions = (query: string): EmotionTag[] => {
    const lowerQuery = query.toLowerCase().trim();
    if (!lowerQuery) return [];
    return allEmotionTags.filter(emotion =>
        emotion.tag.toLowerCase().includes(lowerQuery) ||
        emotion.meaning.toLowerCase().includes(lowerQuery) ||
        (emotion.relatedEmotions || []).some(r => r.toLowerCase().includes(lowerQuery))
    );
};

// 태그 텍스트로 감정 찾기
export const findEmotionByTag = (tag: string): EmotionTag | undefined => {
    return allEmotionTags.find(emotion => emotion.tag === tag);
};

// 긍/부정 판별 (사분면 기준 — 복합/중간은 중립). 색약 대응: 긍정=파랑, 부정=주황
export const isPositiveEmotion = (tag: EmotionTag): boolean =>
    tag.quadrant === 'highPositive' || tag.quadrant === 'lowPositive';

export const isNegativeEmotion = (tag: EmotionTag): boolean =>
    tag.quadrant === 'highNegative' || tag.quadrant === 'lowNegative';

// 텍스트에서 감정 태그 추출 및 분류
export const analyzeEmotionsInText = (text: string): {
    positive: EmotionTag[];
    negative: EmotionTag[];
    neutral: EmotionTag[];
    all: EmotionTag[];
} => {
    const emotionTagPattern = /#감정\/[^\s#]+/g;
    const matches = text.match(emotionTagPattern) || [];

    const result = {
        positive: [] as EmotionTag[],
        negative: [] as EmotionTag[],
        neutral: [] as EmotionTag[],
        all: [] as EmotionTag[]
    };

    matches.forEach(tag => {
        const emotion = findEmotionByTag(tag);
        if (emotion) {
            result.all.push(emotion);
            if (isPositiveEmotion(emotion)) {
                result.positive.push(emotion);
            } else if (isNegativeEmotion(emotion)) {
                result.negative.push(emotion);
            } else {
                result.neutral.push(emotion);
            }
        }
    });

    return result;
};

// 태그에서 표시용 이름만 추출 (#감정/평온한 → 평온한)
export const getEmotionName = (tag: string): string => tag.replace('#감정/', '');

// 무드미터 4사분면 (에너지 × 긍부정)
// 색상은 적록색약 대응: 긍정=파랑 계열, 부정=주황/호박 계열, 에너지는 아이콘(⚡/🌙)으로 구분
export interface MoodQuadrant {
    key: 'highNegative' | 'highPositive' | 'lowNegative' | 'lowPositive';
    label: string;       // 짧은 라벨
    energyIcon: string;  // ⚡ 활기 / 🌙 차분
    sampleEmoji: string; // 사분면 대표 이모지
    emotions: EmotionTag[];
    // Tailwind 클래스
    chipBg: string;      // 선택 안 된 칩 배경
    chipText: string;
    cellBg: string;      // 2x2 셀 기본 배경
    cellActiveBg: string;// 2x2 셀 선택 배경
    border: string;
}

export const moodMeterQuadrants: MoodQuadrant[] = [
    {
        key: 'highNegative',
        label: '활기 · 부정',
        energyIcon: '⚡',
        sampleEmoji: '😠',
        emotions: emotionsByQuadrant.highNegative,
        chipBg: 'bg-orange-500/15 hover:bg-orange-500/30',
        chipText: 'text-orange-200',
        cellBg: 'bg-orange-500/10',
        cellActiveBg: 'bg-orange-500/30 ring-2 ring-orange-400',
        border: 'border-orange-500/40',
    },
    {
        key: 'highPositive',
        label: '활기 · 긍정',
        energyIcon: '⚡',
        sampleEmoji: '🤩',
        emotions: emotionsByQuadrant.highPositive,
        chipBg: 'bg-blue-500/15 hover:bg-blue-500/30',
        chipText: 'text-blue-200',
        cellBg: 'bg-blue-500/10',
        cellActiveBg: 'bg-blue-500/30 ring-2 ring-blue-400',
        border: 'border-blue-500/40',
    },
    {
        key: 'lowNegative',
        label: '차분 · 부정',
        energyIcon: '🌙',
        sampleEmoji: '😔',
        emotions: emotionsByQuadrant.lowNegative,
        chipBg: 'bg-amber-600/15 hover:bg-amber-600/30',
        chipText: 'text-amber-200',
        cellBg: 'bg-amber-600/10',
        cellActiveBg: 'bg-amber-600/30 ring-2 ring-amber-500',
        border: 'border-amber-600/40',
    },
    {
        key: 'lowPositive',
        label: '차분 · 긍정',
        energyIcon: '🌙',
        sampleEmoji: '😌',
        emotions: emotionsByQuadrant.lowPositive,
        chipBg: 'bg-teal-500/15 hover:bg-teal-500/30',
        chipText: 'text-teal-200',
        cellBg: 'bg-teal-500/10',
        cellActiveBg: 'bg-teal-500/30 ring-2 ring-teal-400',
        border: 'border-teal-500/40',
    },
];

// 복합·중간 감정 (4사분면에 딱 안 들어가는 것 — 피커의 5번째 그룹)
export const complexEmotions: EmotionTag[] = emotionsByQuadrant.complex;
// 하위 호환 별칭
export const neutralEmotions: EmotionTag[] = complexEmotions;

// 태그 → 무드미터 사분면 키 (복합/중간은 null 반환 → 4사분면 집계에서 제외)
export const getMoodQuadrantKey = (tag: string): MoodQuadrant['key'] | null => {
    const q = findEmotionByTag(tag)?.quadrant;
    return q && q !== 'complex' ? q : null;
};
