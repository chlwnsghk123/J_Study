import { GoogleGenerativeAI } from '@google/generative-ai';

const genAI = new GoogleGenerativeAI(import.meta.env.VITE_GEMINI_API_KEY ?? '');

/**
 * askAI — 현재 카드 문맥 + 대화 히스토리를 주입하여 Gemini에 질문
 * @param {object} currentCard - WordCard 데이터 객체
 * @param {string} userQuestion - 사용자 질문 텍스트
 * @param {Array} history - 이전 대화 기록 [{role:'user'|'ai', text}]
 * @returns {Promise<string>} AI 응답 텍스트
 */
export async function askAI(currentCard, userQuestion, history = []) {
  const model = genAI.getGenerativeModel({ model: 'models/gemini-3-flash-preview' });

  // 대화 히스토리를 프롬프트에 포함
  let historyText = '';
  if (history.length > 0) {
    historyText = '\n\n이전 대화 기록:\n' + history.map((msg) =>
      msg.role === 'user' ? `사용자: ${msg.text}` : `AI: ${msg.text}`
    ).join('\n') + '\n';
  }

  const prompt = `너는 객관적이고 정확한 일본어 교육 전문가다. 사용자가 현재 보고 있는 낱말 카드의 정보는 다음과 같다.
[일본어 표기: ${currentCard.hiragana}, 발음: ${currentCard.pron}, 한국어 뜻: ${currentCard.meaning}, 설명: ${currentCard.description ?? '없음'}, 태그: ${currentCard.tags?.join(', ') ?? '없음'}]
이 카드 정보의 문맥을 완벽히 숙지한 상태에서, 아래 사용자의 질문에 핵심만 간결하게 대답해라.
반드시 3~5문장 이내로 핵심만 아주 짧게 대답해라.
일본어를 언급할 때는 반드시 한국어 발음도 함께 표기해라 (예: する(스루)).
응답은 깔끔하고 정갈한 형식으로 작성해라. 불필요한 반복이나 장황한 설명을 피해라.${historyText}
사용자 질문: ${userQuestion}`;

  const result = await model.generateContent(prompt);
  return result.response.text();
}

/**
 * generatePatternSentences — 패턴 + 기존 단어 80% 활용하여 예문 3~5개 생성
 * @param {object} pattern - patterns.js의 패턴 객체 (structure, hiragana, meaning 등)
 * @param {Array} existingWords - 기존 단어 배열 (verbs, adjectives, nouns 중 랜덤 추출된 것)
 * @param {number} count - 생성할 예문 수 (3~5)
 * @returns {Promise<Array>} sentences 스키마에 맞는 객체 배열
 */
export async function generatePatternSentences(pattern, existingWords, count = 5) {
  const model = genAI.getGenerativeModel({ model: 'models/gemini-3-flash-preview' });

  const wordList = existingWords.map((w) =>
    `${w.hiragana}(${w.pron}) — ${w.meaning}`
  ).join('\n');

  const prompt = `너는 일본어 교육 전문가다. 아래 문법 패턴과 단어 목록을 바탕으로 자연스럽고 문법적으로 완벽한 일본어 예문을 ${count}개 생성해라.

[패턴 정보]
- 패턴: ${pattern.hiragana} (${pattern.pron})
- 구조: ${pattern.structure}
- 의미: ${pattern.meaning}
- 설명: ${pattern.description}

[사용할 단어 목록 — 이 중 80% 이상을 반드시 활용]
${wordList}

[나머지 20%는 네가 문맥에 맞는 적절한 단어를 자유롭게 선택해라]

[출력 규칙]
1. 반드시 JSON 배열로만 응답해라. 다른 텍스트 없이 순수 JSON만 출력.
2. 각 객체는 아래 필드를 포함:
   - "pron": 전체 문장의 한국어 발음 표기 (예: "미즈오 쿠다사이")
   - "meaning": 한국어 뜻 (예: "물을 주세요")
   - "hiragana": 일본어 히라가나 표기 (예: "みずをください")
   - "example": 사용 상황 설명 (한국어, 10자 내외)
   - "description": 학습 포인트 (한국어, 핵심만 1~2문장)
3. OPIc IM1 수준에 맞는 실용적인 문장을 만들어라.
4. 각 문장은 서로 다른 상황/맥락을 다뤄라.
5. 정중체(です/ます)를 기본으로 하되, 패턴이 반말이면 반말로.

JSON 배열만 출력:`;

  const result = await model.generateContent(prompt);
  const text = result.response.text().trim();

  // JSON 파싱 (코드 블록 감싸기 제거)
  const jsonStr = text.replace(/^```json?\s*/i, '').replace(/\s*```$/i, '');
  const parsed = JSON.parse(jsonStr);

  if (!Array.isArray(parsed)) throw new Error('AI 응답이 배열이 아닙니다.');

  // 스키마 보정 및 필수 필드 검증
  return parsed.map((item) => ({
    pron:        item.pron        || '',
    meaning:     item.meaning     || '',
    hiragana:    item.hiragana    || '',
    example:     item.example     || '',
    description: item.description || '',
  }));
}
