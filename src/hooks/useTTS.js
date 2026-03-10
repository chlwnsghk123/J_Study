import { useEffect, useRef } from 'react';
import { speak, stopAudio } from '../lib/googleTTS';

/**
 * useTTS — Google Cloud TTS 기반 자동 재생 훅
 *
 * @param {string}  text    - 읽을 텍스트 (hiragana 필드)
 * @param {boolean} enabled - true가 될 때 1.0x 속도로 자동 재생
 *
 * - 카드가 바뀌거나 컴포넌트 unmount 시 자동 정지
 * - 〜/～/[] 패턴 기호는 내부적으로 제거 후 발화
 */
export function useTTS(text, enabled) {
  const cancelledRef = useRef(false);

  useEffect(() => {
    if (!enabled || !text) return;

    cancelledRef.current = false;

    speak(text, 1.0).then((audio) => {
      // 컴포넌트가 이미 unmount되었거나 카드가 바뀐 경우 중지
      if (cancelledRef.current && audio) {
        audio.pause();
        audio.currentTime = 0;
      }
    });

    return () => {
      cancelledRef.current = true;
      stopAudio();
    };
  }, [enabled, text]);
}

/**
 * speakText — 수동 재생용 (replay 버튼)
 *
 * @param {string} text
 * @param {object} opts
 * @param {number} opts.rate - 재생 속도 (기본 0.7)
 */
export function speakText(text, { rate = 0.7 } = {}) {
  if (!text) return;
  speak(text, rate);
}
