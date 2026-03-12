import { GoogleGenerativeAI } from '@google/generative-ai';

const genAI = new GoogleGenerativeAI(import.meta.env.VITE_GEMINI_API_KEY ?? '');

/**
 * askAI — 현재 카드 문맥을 주입하여 Gemini에 질문
 * @param {object} currentCard - WordCard 데이터 객체
 * @param {string} userQuestion - 사용자 질문 텍스트
 * @returns {Promise<string>} AI 응답 텍스트
 */
export async function askAI(currentCard, userQuestion) {
  const model = genAI.getGenerativeModel({ model: 'models/gemini-3-flash-preview' });

  const prompt = `너는 객관적이고 정확한 일본어 교육 전문가다. 사용자가 현재 보고 있는 낱말 카드의 정보는 다음과 같다.
[일본어 표기: ${currentCard.hiragana}, 발음: ${currentCard.pron}, 한국어 뜻: ${currentCard.meaning}, 설명: ${currentCard.description ?? '없음'}, 태그: ${currentCard.tags?.join(', ') ?? '없음'}]
이 카드 정보의 문맥을 완벽히 숙지한 상태에서, 아래 사용자의 질문에 핵심만 간결하게 대답해라.
반드시 3~5문장 이내로 핵심만 아주 짧게 대답해라.
사용자 질문: ${userQuestion}`;

  const result = await model.generateContent(prompt);
  return result.response.text();
}
