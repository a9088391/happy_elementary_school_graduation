import { mkdir, readdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const publicDir = path.join(root, 'public');
const srcDir = path.join(root, 'src');

const mediaDirs = {
  audio: path.join(publicDir, 'audio'),
  lyrics: path.join(publicDir, 'lyrics'),
  subtitles: path.join(publicDir, 'subtitles'),
  photos: path.join(publicDir, 'photos'),
};

const lyricOverrides = new Map([
  ['愷妡在光的路上', '愷妡的光在路上.txt'],
]);

const audioExts = new Set(['.mp3', '.m4a', '.wav', '.flac']);
const lyricExts = new Set(['.txt']);
const subtitleExts = new Set(['.srt']);
const photoExts = new Set(['.jpg', '.jpeg', '.png', '.webp', '.gif']);

async function listFiles(dir, extSet) {
  await mkdir(dir, { recursive: true });
  const entries = await readdir(dir, { withFileTypes: true });
  return entries
    .filter((entry) => entry.isFile() && extSet.has(path.extname(entry.name).toLowerCase()))
    .map((entry) => entry.name)
    .sort((a, b) => a.localeCompare(b, 'zh-Hant', { numeric: true }));
}

function stem(fileName) {
  return fileName.replace(path.extname(fileName), '');
}

function baseStem(name) {
  return name.replace(/\s-\s\d+$/, '');
}

function publicUrl(folder, fileName) {
  return `/${folder}/${encodeURIComponent(fileName)}`;
}

function displayTitle(fileName) {
  return stem(fileName);
}

const audioFiles = await listFiles(mediaDirs.audio, audioExts);
const lyricFiles = await listFiles(mediaDirs.lyrics, lyricExts);
const subtitleFiles = await listFiles(mediaDirs.subtitles, subtitleExts);
const photoFiles = await listFiles(mediaDirs.photos, photoExts);

const lyricSet = new Set(lyricFiles);
const subtitleSet = new Set(subtitleFiles);

const tracks = audioFiles.map((audioFile, index) => {
  const audioStem = stem(audioFile);
  const exactLyrics = `${audioStem}.txt`;
  const fallbackLyrics = `${baseStem(audioStem)}.txt`;
  const overrideLyrics = lyricOverrides.get(audioStem);
  const lyricsFile = overrideLyrics && lyricSet.has(overrideLyrics)
    ? overrideLyrics
    : lyricSet.has(exactLyrics)
      ? exactLyrics
      : lyricSet.has(fallbackLyrics)
        ? fallbackLyrics
        : null;

  const subtitleFile = subtitleSet.has(`${audioStem}.srt`) ? `${audioStem}.srt` : null;

  return {
    id: `track-${index + 1}`,
    title: displayTitle(audioFile),
    artist: '畢業紀念歌曲',
    audioFile,
    audioUrl: publicUrl('audio', audioFile),
    lyricsFile,
    lyricsUrl: lyricsFile ? publicUrl('lyrics', lyricsFile) : null,
    subtitleFile,
    subtitleUrl: subtitleFile ? publicUrl('subtitles', subtitleFile) : null,
  };
});

const manifest = {
  generatedAt: new Date().toISOString(),
  tracks,
  photos: photoFiles.map((fileName) => ({
    fileName,
    url: publicUrl('photos', fileName),
  })),
};

await mkdir(srcDir, { recursive: true });
await writeFile(
  path.join(srcDir, 'media-manifest.json'),
  `${JSON.stringify(manifest, null, 2)}\n`,
  'utf8',
);

console.log(`Generated ${tracks.length} tracks and ${photoFiles.length} photos.`);
