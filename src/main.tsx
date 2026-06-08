import React, { useEffect, useMemo, useRef, useState } from 'react';
import { createRoot } from 'react-dom/client';
import {
  Download,
  Headphones,
  Image as ImageIcon,
  Lightbulb,
  Music2,
  Pause,
  Play,
  Repeat,
  Repeat1,
  Search,
  Shuffle,
  SkipBack,
  SkipForward,
  Sparkles,
} from 'lucide-react';
import manifest from './media-manifest.json';
import './styles.css';

type Track = {
  id: string;
  title: string;
  artist: string;
  audioFile: string;
  audioUrl: string;
  lyricsFile: string | null;
  lyricsUrl: string | null;
  subtitleFile: string | null;
  subtitleUrl: string | null;
};

type Photo = {
  fileName: string;
  url: string;
};

type Caption = {
  start: number;
  end: number;
  text: string;
};

type PlaybackMode = 'stop' | 'repeat-all' | 'shuffle' | 'repeat-one';

const tracks = manifest.tracks as Track[];
const photos = manifest.photos as Photo[];

const playbackModeLabels: Record<PlaybackMode, string> = {
  stop: '播完停止',
  'repeat-all': '連續播放',
  shuffle: '隨機播放',
  'repeat-one': '單曲重複',
};

function parseTimestamp(value: string) {
  const match = value.match(/(\d{2}):(\d{2}):(\d{2}),(\d{3})/);
  if (!match) return 0;
  const [, hours, minutes, seconds, millis] = match;
  return Number(hours) * 3600 + Number(minutes) * 60 + Number(seconds) + Number(millis) / 1000;
}

function parseSrt(source: string): Caption[] {
  return source
    .replace(/\r/g, '')
    .split('\n\n')
    .map((block) => {
      const lines = block.split('\n').filter(Boolean);
      const timingIndex = lines.findIndex((line) => line.includes('-->'));
      if (timingIndex === -1) return null;
      const [start, end] = lines[timingIndex].split('-->').map((part) => parseTimestamp(part.trim()));
      const text = lines.slice(timingIndex + 1).join('\n').trim();
      return text ? { start, end, text } : null;
    })
    .filter((caption): caption is Caption => Boolean(caption));
}

function formatTime(value: number) {
  if (!Number.isFinite(value)) return '0:00';
  const minutes = Math.floor(value / 60);
  const seconds = Math.floor(value % 60);
  return `${minutes}:${seconds.toString().padStart(2, '0')}`;
}

function randomPhotoIndex(currentIndex: number) {
  if (photos.length <= 1) return currentIndex;
  const nextIndex = Math.floor(Math.random() * (photos.length - 1));
  return nextIndex >= currentIndex ? nextIndex + 1 : nextIndex;
}

function randomTrackId(currentTrackId: string) {
  if (tracks.length <= 1) return currentTrackId;
  const currentIndex = tracks.findIndex((track) => track.id === currentTrackId);
  const nextIndex = Math.floor(Math.random() * (tracks.length - 1));
  return nextIndex >= currentIndex ? tracks[nextIndex + 1].id : tracks[nextIndex].id;
}

function randomAnyTrackId() {
  if (!tracks.length) return '';
  return tracks[Math.floor(Math.random() * tracks.length)].id;
}

function App() {
  const [selectedTrackId, setSelectedTrackId] = useState(tracks[0]?.id ?? '');
  const [trackQuery, setTrackQuery] = useState('');
  const [playbackMode, setPlaybackMode] = useState<PlaybackMode>('shuffle');
  const [captions, setCaptions] = useState<Caption[]>([]);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [photoIndex, setPhotoIndex] = useState(() => randomPhotoIndex(-1));
  const audioRef = useRef<HTMLAudioElement>(null);
  const pendingAutoplayRef = useRef(false);
  const hasStartedPlaybackRef = useRef(false);

  useEffect(() => {
    document.body.classList.remove('lights-off');
    return () => document.body.classList.remove('lights-off');
  }, []);

  const selectedTrack = useMemo(
    () => tracks.find((track) => track.id === selectedTrackId) ?? tracks[0],
    [selectedTrackId],
  );

  const activeCaption = useMemo(
    () => captions.find((caption) => currentTime >= caption.start && currentTime <= caption.end),
    [captions, currentTime],
  );

  const filteredTracks = useMemo(() => {
    const query = trackQuery.trim().toLocaleLowerCase('zh-Hant');
    if (!query) return tracks;
    return tracks.filter((track) => track.title.toLocaleLowerCase('zh-Hant').includes(query));
  }, [trackQuery]);

  useEffect(() => {
    if (!selectedTrack?.subtitleUrl) {
      setCaptions([]);
      return;
    }

    let active = true;
    fetch(selectedTrack.subtitleUrl)
      .then((response) => response.text())
      .then((source) => {
        if (active) setCaptions(parseSrt(source));
      })
      .catch(() => {
        if (active) setCaptions([]);
      });

    return () => {
      active = false;
    };
  }, [selectedTrack]);

  useEffect(() => {
    if (!photos.length || !isPlaying) return;
    const timer = window.setInterval(() => {
      setPhotoIndex((index) => randomPhotoIndex(index));
    }, 4200);
    return () => window.clearInterval(timer);
  }, [isPlaying]);

  useEffect(() => {
    setCurrentTime(0);
    setDuration(0);
    setIsPlaying(false);
    setPhotoIndex(() => randomPhotoIndex(-1));

    if (!pendingAutoplayRef.current) return;
    const frameId = window.requestAnimationFrame(() => {
      void audioRef.current?.play();
    });
    return () => window.cancelAnimationFrame(frameId);
  }, [selectedTrackId]);

  function togglePlay() {
    const audio = audioRef.current;
    if (!audio) return;
    if (audio.paused) {
      if (!hasStartedPlaybackRef.current && playbackMode === 'shuffle') {
        const randomId = randomAnyTrackId();
        pendingAutoplayRef.current = true;
        if (randomId === selectedTrackId) {
          audio.currentTime = 0;
          void audio.play();
          return;
        }
        setSelectedTrackId(randomId);
        return;
      }
      void audio.play();
    } else {
      audio.pause();
    }
  }

  function seekTo(nextTime: number) {
    const audio = audioRef.current;
    if (!audio || !Number.isFinite(nextTime) || !duration) return;
    const clampedTime = Math.max(0, Math.min(duration, nextTime));
    audio.currentTime = clampedTime;
    setCurrentTime(clampedTime);
  }

  function getSeekTimeFromPointer(event: React.PointerEvent<HTMLDivElement>) {
    if (!duration) return;
    const rect = event.currentTarget.getBoundingClientRect();
    const ratio = Math.max(0, Math.min(1, (event.clientX - rect.left) / rect.width));
    return ratio * duration;
  }

  function adjustSeek(seconds: number) {
    seekTo(currentTime + seconds);
  }

  function selectTrack(id: string) {
    pendingAutoplayRef.current = true;
    if (id === selectedTrackId) {
      const audio = audioRef.current;
      if (!audio) return;
      audio.currentTime = 0;
      void audio.play();
      return;
    }
    setSelectedTrackId(id);
  }

  function playNextTrack() {
    if (playbackMode === 'shuffle') {
      pendingAutoplayRef.current = true;
      setSelectedTrackId(randomTrackId(selectedTrackId));
      return;
    }

    const currentIndex = tracks.findIndex((track) => track.id === selectedTrackId);
    const nextIndex = currentIndex === -1 ? 0 : (currentIndex + 1) % tracks.length;
    selectTrack(tracks[nextIndex].id);
  }

  function playPreviousTrack() {
    if (playbackMode === 'shuffle') {
      pendingAutoplayRef.current = true;
      setSelectedTrackId(randomTrackId(selectedTrackId));
      return;
    }

    const currentIndex = tracks.findIndex((track) => track.id === selectedTrackId);
    const previousIndex = currentIndex <= 0 ? tracks.length - 1 : currentIndex - 1;
    selectTrack(tracks[previousIndex].id);
  }

  function handleTrackEnded() {
    const audio = audioRef.current;
    if (playbackMode === 'repeat-one') {
      if (!audio) return;
      audio.currentTime = 0;
      void audio.play();
      return;
    }

    if (playbackMode === 'shuffle') {
      playNextTrack();
      return;
    }

    if (playbackMode === 'repeat-all') {
      playNextTrack();
      return;
    }

    setIsPlaying(false);
  }

  function toggleLights() {
    document.body.classList.toggle('lights-off');
  }

  if (!selectedTrack) {
    return (
      <main className="empty-state">
        <Music2 aria-hidden="true" />
        <h1>還沒有歌曲</h1>
        <p>請把 MP3 放進 public/audio 後重新啟動網站。</p>
      </main>
    );
  }

  const progress = duration ? (currentTime / duration) * 100 : 0;
  const activePhoto = photos[photoIndex % Math.max(photos.length, 1)];

  return (
    <main className="app-shell">
      <section className="hero">
        <div className="hero-copy">
          <span className="eyebrow">
            <Sparkles size={16} aria-hidden="true" />
            Graduation Stage
          </span>
          <h1>愷妡的畢業舞台</h1>
          <p>把小學最後一頁，唱成閃閃發光的新開始。</p>
        </div>
        <div className="hero-status">
          <Headphones size={18} aria-hidden="true" />
          <span>{tracks.length} 首歌曲</span>
        </div>
        <button
          type="button"
          className="light-toggle"
          onClick={toggleLights}
          aria-label="開關燈"
        >
          <Lightbulb size={18} aria-hidden="true" />
          開關燈
        </button>
      </section>

      <section className="player-layout" aria-label="音樂播放區">
        <aside className="track-panel" aria-label="歌曲選單">
          <div className="panel-heading">
            <Music2 size={18} aria-hidden="true" />
            <h2>歌曲選單</h2>
          </div>
          <div className="track-tools">
            <label className="track-select-wrap">
              <span className="sr-only">選擇歌曲</span>
              <select
                className="track-select"
                value={selectedTrack.id}
                onChange={(event) => selectTrack(event.target.value)}
              >
                {tracks.map((track, index) => (
                  <option key={track.id} value={track.id}>
                    {String(index + 1).padStart(2, '0')} · {track.title}
                  </option>
                ))}
              </select>
            </label>
            <label className="track-search">
              <Search size={16} aria-hidden="true" />
              <span className="sr-only">搜尋歌曲</span>
              <input
                type="search"
                value={trackQuery}
                placeholder="搜尋歌曲"
                onChange={(event) => setTrackQuery(event.target.value)}
              />
            </label>
          </div>
          <div className="track-list">
            {filteredTracks.map((track) => {
              const trackIndex = tracks.findIndex((item) => item.id === track.id);
              return (
                <button
                  className={`track-button ${track.id === selectedTrack.id ? 'is-active' : ''}`}
                  key={track.id}
                  type="button"
                  onClick={() => selectTrack(track.id)}
                >
                  <span className="track-number">{String(trackIndex + 1).padStart(2, '0')}</span>
                  <span className="track-meta">
                    <span className="track-title">{track.title}</span>
                    <span className="track-subtitle">
                      {track.subtitleUrl ? '同步字幕' : '無字幕'} · {track.lyricsUrl ? '歌詞下載' : '無歌詞'}
                    </span>
                  </span>
                </button>
              );
            })}
            {!filteredTracks.length && <div className="track-empty">找不到歌曲</div>}
          </div>
        </aside>

        <section className="stage-panel">
          <div className="stage-frame">
            {activePhoto ? (
              <>
                <img className="stage-photo-backdrop" src={activePhoto.url} alt="" aria-hidden="true" />
                <img className="stage-photo" src={activePhoto.url} alt={activePhoto.fileName} />
              </>
            ) : (
              <div className="stage-placeholder" role="img" aria-label="照片輪播預留區">
                <ImageIcon size={58} aria-hidden="true" />
                <span>照片輪播</span>
              </div>
            )}
            <div className="stage-lights" aria-hidden="true" />
            <div className="caption-box" aria-live="polite">
              {activeCaption?.text ?? (isPlaying ? '♪' : '選一首歌開始播放')}
            </div>
          </div>

          <div className="now-playing">
            <div>
              <p className="label">Now Playing</p>
              <h2>{selectedTrack.title}</h2>
            </div>
            <span>{selectedTrack.artist}</span>
          </div>

          <audio
            ref={audioRef}
            src={selectedTrack.audioUrl}
            preload="metadata"
            onPlay={() => {
              pendingAutoplayRef.current = false;
              hasStartedPlaybackRef.current = true;
              setIsPlaying(true);
            }}
            onPause={() => setIsPlaying(false)}
            onEnded={handleTrackEnded}
            onTimeUpdate={(event) => setCurrentTime(event.currentTarget.currentTime)}
            onLoadedMetadata={(event) => {
              setDuration(event.currentTarget.duration);
              if (pendingAutoplayRef.current) {
                void event.currentTarget.play();
              }
            }}
          />

          <div className="controls">
            <button type="button" className="icon-button" onClick={playPreviousTrack} aria-label="上一首">
              <SkipBack size={20} aria-hidden="true" />
            </button>
            <button type="button" className="play-button" onClick={togglePlay} aria-label={isPlaying ? '暫停' : '播放'}>
              {isPlaying ? <Pause size={28} aria-hidden="true" /> : <Play size={28} aria-hidden="true" />}
            </button>
            <button type="button" className="icon-button" onClick={playNextTrack} aria-label="下一首">
              <SkipForward size={20} aria-hidden="true" />
            </button>
          </div>

          <div className="mode-controls" aria-label="播放模式">
            <button
              type="button"
              className={`mode-button ${playbackMode === 'stop' ? 'is-active' : ''}`}
              onClick={() => setPlaybackMode('stop')}
              aria-pressed={playbackMode === 'stop'}
            >
              播完停止
            </button>
            <button
              type="button"
              className={`mode-button ${playbackMode === 'repeat-all' ? 'is-active' : ''}`}
              onClick={() => setPlaybackMode('repeat-all')}
              aria-pressed={playbackMode === 'repeat-all'}
            >
              <Repeat size={16} aria-hidden="true" />
              連續播放
            </button>
            <button
              type="button"
              className={`mode-button ${playbackMode === 'shuffle' ? 'is-active' : ''}`}
              onClick={() => setPlaybackMode('shuffle')}
              aria-pressed={playbackMode === 'shuffle'}
            >
              <Shuffle size={16} aria-hidden="true" />
              隨機播放
            </button>
            <button
              type="button"
              className={`mode-button ${playbackMode === 'repeat-one' ? 'is-active' : ''}`}
              onClick={() => setPlaybackMode('repeat-one')}
              aria-pressed={playbackMode === 'repeat-one'}
            >
              <Repeat1 size={16} aria-hidden="true" />
              單曲重複
            </button>
          </div>
          <p className="mode-status">目前模式：{playbackModeLabels[playbackMode]}</p>

          <div className="timeline">
            <span>{formatTime(currentTime)}</span>
            <div
              className={`timeline-track ${duration ? '' : 'is-disabled'}`}
              role="slider"
              aria-label="播放進度"
              aria-valuemin={0}
              aria-valuemax={Math.round(duration || 0)}
              aria-valuenow={Math.round(currentTime)}
              tabIndex={duration ? 0 : -1}
              onPointerDown={(event) => {
                const nextTime = getSeekTimeFromPointer(event);
                if (nextTime === undefined) return;
                event.currentTarget.setPointerCapture(event.pointerId);
                seekTo(nextTime);
              }}
              onPointerMove={(event) => {
                if (!event.currentTarget.hasPointerCapture(event.pointerId)) return;
                const nextTime = getSeekTimeFromPointer(event);
                if (nextTime !== undefined) seekTo(nextTime);
              }}
              onPointerUp={(event) => event.currentTarget.releasePointerCapture(event.pointerId)}
              onKeyDown={(event) => {
                if (event.key === 'ArrowLeft') adjustSeek(-5);
                if (event.key === 'ArrowRight') adjustSeek(5);
                if (event.key === 'Home') seekTo(0);
                if (event.key === 'End') seekTo(duration);
              }}
              style={{ '--progress': `${progress}%` } as React.CSSProperties}
            >
              <span className="timeline-fill" />
            </div>
            <span>{formatTime(duration)}</span>
          </div>

          <div className="download-row" aria-label="下載目前播放檔案">
            <a href={selectedTrack.audioUrl} download={selectedTrack.audioFile} className="download-button">
              <Download size={18} aria-hidden="true" />
              下載 MP3
            </a>
            {selectedTrack.lyricsUrl ? (
              <a href={selectedTrack.lyricsUrl} download={selectedTrack.lyricsFile ?? undefined} className="download-button secondary">
                <Download size={18} aria-hidden="true" />
                下載歌詞 TXT
              </a>
            ) : (
              <span className="download-disabled">沒有 TXT 歌詞</span>
            )}
          </div>
        </section>
      </section>
    </main>
  );
}

createRoot(document.getElementById('root')!).render(<App />);
