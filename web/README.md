# MoanTop

Prank website that uses your microphone to detect physical smacks on the laptop, then plays moaning sounds with animated robot face reactions.

Live at [moantop.xyz](https://moantop.xyz)

## Tech Stack

- React 19 + TanStack Start (SSR via Nitro)
- TanStack Router (file-based)
- Tailwind CSS 4 + HeroUI v3
- GSAP (robot face animations)
- Web Audio API (mic input, sound playback)
- Vite 7, TypeScript, Bun

## How It Works

1. User grants microphone access
2. FFT analyser monitors low-frequency energy spikes (physical impacts vs voice)
3. On detected smack: plays randomized moan/speech audio, triggers GSAP animation on the robot face
4. Gender toggle switches between male/female sound banks
5. Streak system alternates between moans and speeches to keep it varied

## Project Structure

```
src/
  components/
    MoanMac.tsx        # Core app: mic detection, audio playback, UI
    RobotFace.tsx      # SVG robot face with GSAP hit animations
    ErrorPage.tsx      # Error boundary UI
    NotFoundPage.tsx   # 404 page
  routes/
    __root.tsx         # Root layout, meta tags, structured data
    index.tsx          # Home page with SEO/OG tags
  providers/           # Theme, Lenis smooth scroll
  env.ts               # Type-safe env vars (t3-env)
  config.ts            # App config, social links
public/
  assets/sounds/       # Audio files (male/, female/)
  og.png               # Open Graph image for social sharing
  manifest.json        # PWA manifest
```

## Setup

```bash
cp .env.example .env
bun install
bun dev
```

Dev server runs on port 3200.

## Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `VITE_APP_NAME` | No | App display name |
| `VITE_APP_URL` | No | App base URL |
| `VITE_DEBUG` | No | Set "true" to show debug overlay (mic levels, hit logs) |
| `VITE_API_URL` | No | Backend API URL (unused currently) |
| `VITE_API_KEY` | No | API key (unused currently) |

All env vars are optional. The app runs with zero config.

## Commands

```bash
bun dev        # Dev server (port 3200)
bun build      # Production build
bun preview    # Preview production build
bun lint       # ESLint
bun check      # Prettier + ESLint fix
bun test       # Vitest
```

## Deployment (Vercel)

Push to main. Nitro auto-detects the Vercel environment and outputs the correct format. No `vercel.json` needed.

Build output goes to `.output/`.

## Audio Files

Sound banks live in `public/assets/sounds/{female,male}/`. Each gender has:
- `moan-1.mp3` through `moan-3.mp3`
- `speech-1.mp3` through `speech-N.mp3`

To add sounds, drop mp3 files in the right folder and update the `SOUND_BANK` constant in `MoanMac.tsx`.

## Detection Tuning

Key constants in `MoanMac.tsx`:
- `SPIKE_FACTOR` (2): how many times above running average triggers a hit
- `MIN_THRESHOLD` (30): absolute floor so silence doesn't false-trigger
- `VOICE_RATIO` (1.2): mid-freq to low-freq ratio to filter out voice
- `SMACK_COOLDOWN` (350ms): minimum gap between triggers
