# Brand assets

| File | Use |
|------|-----|
| `potato-train.png` | Full logo (source) |
| `potato-train-icon.png` | 128×128 icon / favicon-style |
| `potato-train-mark.png` | Transparent mark for banners |
| `readme-banner.png` | GitHub README hero (1280×400) |
| `readme-banner-compact.png` | Smaller hero |
| `fonts/PressStart2P-Regular.ttf` | Wordmark font |

## Typography

GitHub Markdown **cannot** load custom CSS fonts. The README wordmark is **baked into** `readme-banner.png` using **[Press Start 2P](https://fonts.google.com/specimen/Press+Start+2P)** (SIL Open Font License) — a pixel/arcade face that matches the pixel-art logo.

“Ready Player 2” style = same retro game vibe; Press Start 2P is the free OFL font used for the title.

### Regenerate banner

```bash
# from monorepo root (ImageMagick + font)
magick potato-train.png -fuzz 8% -transparent white -resize 300x300 assets/potato-train-mark.png
magick -size 1280x400 xc:'#0b1220' \
  \( assets/potato-train-mark.png \) -geometry +48+50 -compose over -composite \
  -font assets/fonts/PressStart2P-Regular.ttf -fill '#fff7ed' -pointsize 48 \
  -annotate +400+155 'POTATO' \
  -fill '#f59e0b' -pointsize 48 \
  -annotate +400+225 'TRAIN' \
  -fill '#94a3b8' -pointsize 13 \
  -annotate +400+295 'typed Choo-shaped framework' \
  -fill '#64748b' -pointsize 11 \
  -annotate +400+335 'createApp  .  features  .  patch  .  emit' \
  PNG32:assets/readme-banner.png
```

## Font license

Press Start 2P © The Press Start 2P Project Authors — [OFL](https://scripts.sil.org/OFL).  
Reserved Font Name “Press Start 2P”.
