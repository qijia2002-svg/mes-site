/**
 * 卡片「朗读」按钮：用浏览器 Web Speech API 念出传入文本。
 * 仅在前端实现，不新增任何后端端点。图标走项目锁定的 Icon 体系（play/pause），禁 emoji。
 *
 * v2：新增 lang 透传（默认 auto 自动判语种），供调用方指定英文/中文朗读。
 */
import { Icon } from './Icon';
import { useSpeech, type SpeechLang } from '../lib/useSpeech';

export function VoiceButton({
  text,
  className,
  lang = 'auto',
}: {
  text: string;
  className?: string;
  lang?: SpeechLang;
}) {
  const { speaking, speak, stop } = useSpeech();
  if (!text.trim()) return null;
  return (
    <button
      type="button"
      className={`icon-btn voice-btn${className ? ' ' + className : ''}`}
      aria-label={speaking ? '停止朗读' : '朗读卡片内容'}
      aria-pressed={speaking}
      onClick={() => (speaking ? stop() : speak(text, { lang }))}
    >
      <Icon name={speaking ? 'pause' : 'play'} size={16} />
    </button>
  );
}
