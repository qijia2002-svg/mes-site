/**
 * 英文单词发音按钮：点一下用浏览器 TTS 以 en-US 朗读该英文词，
 * 让用户知道怎么读（核心诉求：语音主要给英文发音用）。零服务端成本。
 *
 * 仅作「发音」用途，不读中文解释；若浏览器不支持语音则整体不渲染。
 */
import { Icon } from './Icon';
import { useSpeech } from '../lib/useSpeech';

export function WordSpeaker({
  word,
  showText = false,
  className,
}: {
  word: string;
  showText?: boolean;
  className?: string;
}) {
  const { supported, speaking, speak, stop } = useSpeech();
  if (!supported || !word.trim()) return null;
  return (
    <button
      type="button"
      className={`icon-btn word-speaker${className ? ' ' + className : ''}`}
      aria-label={`朗读英文：${word}`}
      aria-pressed={speaking}
      onClick={(e) => {
        e.stopPropagation();
        if (speaking) stop();
        else speak(word, { lang: 'en-US' });
      }}
    >
      <Icon name={speaking ? 'pause' : 'play'} size={16} />
      {showText && <span className="word-speaker-text">{word}</span>}
    </button>
  );
}
