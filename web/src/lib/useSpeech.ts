/**
 * 浏览器端语音朗读（Web Speech API 为主，服务端 TTS 兜底）。
 * 用于卡片「朗读」按钮与英文单词发音按钮。
 *
 * v3 改动（修手机端"语音不能用"）：
 *  - iOS Safari 兼容：避免 cancel() 后立即 speak()（iOS 会丢弃这次朗读），改用短延时；
 *    onend/onerror 在 iOS 经常不回调 → 加 watchdog 定时器强制收尾，避免按钮卡在"暂停"。
 *  - 服务端兜底：Web Speech 不可用或失败时，调 /api/v1/tts（Workers AI MeloTTS）
 *    拿到 base64 MP3，用 <audio> 播放，iPhone 也能稳定出声。
 *  - 不再因 !supported 隐藏按钮：只要浏览器环境就渲染，失败走服务端或提示。
 *
 * 设计要点：
 *  - supported 指浏览器 Web Speech 是否可用；即使为 false，服务端兜底仍可发声。
 *  - 朗读前 finish() 收尾，避免排队叠加（跨 tick 处理以兼容 iOS）。
 *  - 卸载时 cancel，防止离开页面后还在念。
 */
import { useCallback, useEffect, useRef, useState } from 'react';
import { apiPost } from '../api/client';
import { useToast } from '../components/Toast';

export type SpeechLang = 'auto' | 'en-US' | 'zh-CN';

interface SpeakOptions {
  lang?: SpeechLang;
  rate?: number;
  pitch?: number;
}

// 同语种下按名称特征挑"自然"音色，避开机械默认音。顺序即优先级。
const EN_VOICE_PREF = [
  'Google US English',
  'Google UK English',
  'Microsoft Aria Online (Natural) - English (United States)',
  'Microsoft Zira Online (Natural) - English (United States)',
  'Samantha',
  'Microsoft Zira',
  'English',
];
const ZH_VOICE_PREF = [
  'Google 普通话（中国大陆）',
  'Microsoft Xiaoxiao Online (Natural) - Chinese (Mainland)',
  'Microsoft Huihui Online (Natural) - Chinese (Mainland)',
  'Microsoft Huihui',
  'Ting-Ting',
  'Chinese',
];

/** 按字符比例自动判断语种：英文字母多 → 英文，否则中文。 */
function detectLang(text: string): 'en-US' | 'zh-CN' {
  const ascii = (text.match(/[A-Za-z]/g) ?? []).length;
  const cjk = (text.match(/[一-鿿]/g) ?? []).length;
  return ascii >= cjk ? 'en-US' : 'zh-CN';
}

/** iOS Safari 检测：其 Web Speech 行为异常，需要跨 tick 的 speak 与 watchdog 兜底。 */
function isIOS(): boolean {
  if (typeof navigator === 'undefined') return false;
  return /iPad|iPhone|iPod/.test(navigator.userAgent) && !('MSStream' in window);
}

export function useSpeech() {
  const [speaking, setSpeaking] = useState(false);
  const [voices, setVoices] = useState<SpeechSynthesisVoice[]>([]);
  const webSpeechSupported =
    typeof window !== 'undefined' && 'speechSynthesis' in window;
  const { showToast } = useToast();

  const audioRef = useRef<HTMLAudioElement | null>(null);
  const watchdogRef = useRef<number | null>(null);

  useEffect(() => {
    if (!webSpeechSupported) return;
    const load = () => setVoices(window.speechSynthesis.getVoices());
    load();
    window.speechSynthesis.addEventListener('voiceschanged', load);
    return () => {
      window.speechSynthesis.removeEventListener('voiceschanged', load);
      window.speechSynthesis.cancel();
    };
  }, [webSpeechSupported]);

  const clearWatchdog = useCallback(() => {
    if (watchdogRef.current != null) {
      window.clearTimeout(watchdogRef.current);
      watchdogRef.current = null;
    }
  }, []);

  /** 收尾：清 watchdog、停 Web Speech、停 <audio>。 */
  const finish = useCallback(() => {
    clearWatchdog();
    setSpeaking(false);
    if (webSpeechSupported) {
      try {
        window.speechSynthesis.cancel();
      } catch {
        /* ignore */
      }
    }
    if (audioRef.current) {
      try {
        audioRef.current.pause();
      } catch {
        /* ignore */
      }
      audioRef.current = null;
    }
  }, [webSpeechSupported, clearWatchdog]);

  const pickVoice = useCallback(
    (lang: 'en-US' | 'zh-CN'): SpeechSynthesisVoice | undefined => {
      const prefix = lang.slice(0, 2).toLowerCase();
      const pool = voices.filter((v) => v.lang.toLowerCase().startsWith(prefix));
      if (pool.length === 0) return undefined;
      const pref = lang === 'en-US' ? EN_VOICE_PREF : ZH_VOICE_PREF;
      for (const name of pref) {
        const hit = pool.find((v) => v.name.includes(name));
        if (hit) return hit;
      }
      return pool[0];
    },
    [voices],
  );

  /** 服务端 TTS 兜底：fetch /api/v1/tts → base64 MP3 → <audio> 播放。 */
  const playServer = useCallback(
    async (text: string, lang: 'en-US' | 'zh-CN') => {
      const res = await apiPost<{ audio: string }>('/api/v1/tts', { text, lang }, 10000);
      if (!res.audio) throw new Error('empty-audio');
      const bin = atob(res.audio);
      const bytes = new Uint8Array(bin.length);
      for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
      const blob = new Blob([bytes], { type: 'audio/mpeg' });
      const url = URL.createObjectURL(blob);
      const audio = new Audio(url);
      audioRef.current = audio;
      setSpeaking(true);
      try {
        await new Promise<void>((resolve, reject) => {
          audio.onended = () => {
            URL.revokeObjectURL(url);
            resolve();
          };
          audio.onerror = () => {
            URL.revokeObjectURL(url);
            reject(new Error('audio-error'));
          };
          audio.play().catch(reject);
        });
      } finally {
        setSpeaking(false);
        audioRef.current = null;
      }
    },
    [],
  );

  const speak = useCallback(
    async (text: string, opts: SpeakOptions = {}) => {
      if (!text.trim()) return;
      finish();
      const lang = opts.lang && opts.lang !== 'auto' ? opts.lang : detectLang(text);

      // 优先：浏览器 Web Speech API
      if (webSpeechSupported) {
        try {
          const u = new SpeechSynthesisUtterance(text);
          u.lang = lang;
          const v = pickVoice(lang);
          if (v) u.voice = v;
          // 去机械化：英文略放慢、语气自然；中文保持平稳。
          u.rate = opts.rate ?? (lang === 'en-US' ? 0.9 : 1.0);
          u.pitch = opts.pitch ?? 1.0;
          u.onend = finish;
          u.onerror = finish;
          setSpeaking(true);
          // iOS 经常不回调 onend → watchdog 兜底（长文本 15s+ 截断也覆盖）
          clearWatchdog();
          watchdogRef.current = window.setTimeout(finish, Math.min(30000, text.length * 80 + 2500));
          // iOS：cancel 后需跨 tick 再 speak，否则本次朗读被丢弃
          const fire = () => {
            try {
              window.speechSynthesis.speak(u);
            } catch {
              /* ignore */
            }
          };
          if (isIOS()) window.setTimeout(fire, 60);
          else fire();
          return;
        } catch {
          // 落到服务端兜底
        }
      }

      // 兜底：服务端 TTS
      try {
        await playServer(text, lang);
      } catch {
        setSpeaking(false);
        showToast('语音暂不可用，请检查网络后重试', 'error');
      }
    },
    [webSpeechSupported, pickVoice, playServer, finish, clearWatchdog, showToast],
  );

  const stop = useCallback(() => {
    finish();
  }, [finish]);

  return { supported: webSpeechSupported, speaking, speak, stop };
}
