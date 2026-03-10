/**
 * Google Cloud TTS REST API 클라이언트
 *
 * - 음성 모델: ja-JP-Neural2-B (고정)
 * - 자동 재생: 1.0x 속도
 * - 천천히 듣기: 0.7x 속도
 * - 메모리 캐시: 키 = `${text}|${rate}`
 * - 프리패치: prefetch(texts, rate) — 백그라운드에서 미리 요청
 */

const API_URL = 'https://texttospeech.googleapis.com/v1/text:synthesize';
const VOICE   = { languageCode: 'ja-JP', name: 'ja-JP-Neural2-B' };

// 인메모리 캐시 (Base64 문자열)
const audioCache = new Map();

// 현재 재생 중인 Audio 인스턴스 (중복 재생 방지)
let currentAudio = null;

function getApiKey() {
  return import.meta.env.VITE_GOOGLE_TTS_API_KEY;
}

function cleanText(text) {
  return text.replace(/[〜～\[\]]/g, '').trim();
}

/**
 * TTS 오디오 Base64를 API에서 가져오거나 캐시에서 반환
 */
export async function fetchAudio(text, rate = 1.0) {
  const clean = cleanText(text);
  if (!clean) return null;

  const key = `${clean}|${rate}`;
  if (audioCache.has(key)) return audioCache.get(key);

  const apiKey = getApiKey();
  if (!apiKey) {
    console.warn('[TTS] VITE_GOOGLE_TTS_API_KEY가 설정되지 않았습니다.');
    return null;
  }

  const res = await fetch(`${API_URL}?key=${apiKey}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      input: { text: clean },
      voice: VOICE,
      audioConfig: { audioEncoding: 'MP3', speakingRate: rate },
    }),
  });

  if (!res.ok) {
    console.warn(`[TTS] API 오류: ${res.status}`);
    return null;
  }

  const data = await res.json();
  const b64  = data.audioContent;
  if (b64) audioCache.set(key, b64);
  return b64 ?? null;
}

/**
 * Base64 오디오를 재생하고 Audio 인스턴스 반환
 */
export function playBase64(base64) {
  if (currentAudio) {
    currentAudio.pause();
    currentAudio.currentTime = 0;
  }
  const audio = new Audio(`data:audio/mp3;base64,${base64}`);
  currentAudio = audio;
  audio.play().catch(() => {});
  return audio;
}

/**
 * 텍스트를 TTS로 재생 (캐시 우선)
 * @returns {Promise<HTMLAudioElement | null>}
 */
export async function speak(text, rate = 1.0) {
  try {
    const b64 = await fetchAudio(text, rate);
    if (!b64) return null;
    return playBase64(b64);
  } catch (e) {
    console.warn('[TTS] speak 실패:', e);
    return null;
  }
}

/**
 * 현재 재생 중인 오디오 정지
 */
export function stopAudio() {
  if (currentAudio) {
    currentAudio.pause();
    currentAudio.currentTime = 0;
    currentAudio = null;
  }
}

/**
 * 다음 카드들을 백그라운드에서 미리 캐싱 (네트워크 유휴 시 실행)
 * @param {string[]} texts - hiragana 텍스트 배열
 */
export function prefetch(texts) {
  const rates = [1.0, 0.7];
  texts.forEach((text) => {
    if (!text) return;
    rates.forEach((rate) => {
      const key = `${cleanText(text)}|${rate}`;
      if (!audioCache.has(key)) {
        fetchAudio(text, rate).catch(() => {});
      }
    });
  });
}
