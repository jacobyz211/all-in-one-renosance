# Universal Media Addon for Resonance

All-in-one music addon for the Resonance music app.

## Sources
| Source | What it provides |
|---|---|
| **HiFi** | Lossless FLAC streaming (your own instances) |
| **SoundCloud** | Free music fallback |
| **Internet Archive** | Millions of free audio recordings |
| **LibriVox** | Public-domain audiobooks |
| **Podcast Index** | Podcast search + episode streams |
| **Taddy** | Additional podcast search |
| **Radio Browser** | 30,000+ live radio stations |

## Requirements
- [Bun](https://bun.sh) v1.x+

## Build
```bash
bun install
bun run build
# Output: dist/universal.js
```

## Deploy to Vercel
1. Push to GitHub
2. Import into Vercel — `vercel.json` handles the rest
3. Addon URL: `https://your-project.vercel.app/universal.js`

## Install in Resonance
Settings → Addons → Install from URL → paste your Vercel URL

## Config Fields
| Field | Required |
|---|---|
| HiFi Instance URLs (comma-separated) | ✅ |
| SoundCloud Client ID | Optional |
| Podcast Index API Key | Optional |
| Podcast Index API Secret | Optional |
| Taddy API Key | Optional |
| Taddy User ID | Optional |
