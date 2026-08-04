/**
 * 浏览器端语音朗读（Web Speech API，零服务端成本）。
 * 用于卡片「朗读」按钮与英文单词发音按钮。
 *
 * v2 改进（用户反馈"语音太机械化"）：
 *  - 自动挑选该语种下更自然的音色（Google / Microsoft Natural / Samantha 等），
 *    避开各系统默认的机械音。
 *  - 英文默认放慢到 0.9 倍速、语气平稳，更接近真人朗读；中文保持 1.0。
 *  - 支持显式 lang（'en-US' 念英文 / 'zh-CN' 念中文 / 'auto' 按字符比例自动判断）。
 *
 * 设计要点：
 *  - 仅在浏览器环境且 speechSynthesis 可用时启用（supported=false 时调用方应隐藏按钮）。
 *  - 朗读前 cancel 旧任务，避免排队叠加。
 *  - 监听 utterance 的 onend 同步 speaking 状态；卸载时 cancel，防止离开页面后还在念。
 *  - 音色列表异步加载（voiceschanged），首次可能为空，下一句会自动用上。
 */
import { useCallback, useEffect, useState } from 'react';

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

export function useSpeech() {
  const [speaking, setSpeaking] = useState(false);
  const [voices, setVoices] = useState<SpeechSynthesisVoice[]>([]);
  const supported =
    typeof window !== 'undefined' && typeof window.speechSynthesis !== 'undefined';

  useEffect(() => {
    if (!supported) return;
    const load = () => setVoices(window.speechSynthesis.getVoices());
    load();
    window.speechSynthesis.addEventListener('voiceschanged', load);
    return () => {
      window.speechSynthesis.removeEventListener('voiceschanged', load);
      window.speechSynthesis.cancel();
    };
  }, [supported]);

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

  const speak = useCallback(
    (text: string, opts: SpeakOptions = {}) => {
      if (!supported || !text.trim()) return;
      window.speechSynthesis.cancel();
      const lang = opts.lang && opts.lang !== 'auto' ? opts.lang : detectLang(text);
      const u = new SpeechSynthesisUtterance(text);
      u.lang = lang;
      const v = pickVoice(lang);
      if (v) u.voice = v;
      // 去机械化：英文略放慢、语气自然；中文保持平稳。
      u.rate = opts.rate ?? (lang === 'en-US' ? 0.9 : 1.0);
      u.pitch = opts.pitch ?? 1.0;
      u.onend = () => setSpeaking(false);
      u.onerror = () => setSpeaking(false);
      setSpeaking(true);
      window.speechSynthesis.speak(u);
    },
    [supported, pickVoice],
  );

  const stop = useCallback(() => {
    if (!supported) return;
    window.speechSynthesis.cancel();
    setSpeaking(false);
  }, [supported]);

  return { supported, speaking, speak, stop };
}
