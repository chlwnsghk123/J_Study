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
