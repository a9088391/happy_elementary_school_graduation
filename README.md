# 愷妡的畢業舞台

一頁式畢業音樂網站：中央照片輪播、同步字幕、歌曲選單，以及目前播放歌曲的 MP3 / TXT 下載。

## 開發

```bash
npm install
npm run dev
```

## 新增歌曲與素材

- MP3 放到 `public/audio/`
- SRT 字幕放到 `public/subtitles/`
- TXT 歌詞放到 `public/lyrics/`
- 照片放到 `public/photos/`

每次 `npm run dev` 或 `npm run build` 會自動重新掃描素材並產生歌曲清單。

## Cloudflare Pages

- Build command: `npm run build`
- Output directory: `dist`
# happy_elementary_school_graduation
