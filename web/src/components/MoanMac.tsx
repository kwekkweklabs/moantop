import { useState, useRef, useEffect, useCallback } from 'react'
import RobotFace from './RobotFace'
import { cnm } from '@/utils/style'
import { env } from '@/env'

type Gender = 'male' | 'female'

const DEBUG = env.VITE_DEBUG === 'true'
// spike detection: trigger when low-freq jumps this many times above running average
const SPIKE_FACTOR = 2
// minimum absolute floor so silence doesn't trigger (0-255 scale)
const MIN_THRESHOLD = 30
// how fast the running average adapts (lower = slower, more stable)
const AVG_SMOOTHING = 0.05
// ratio: if mid-freq exceeds this fraction of low-freq, it's voice
const VOICE_RATIO = 1.2
// cooldown between triggers
const SMACK_COOLDOWN = 350

const SOUND_BANK: Record<Gender, { moans: string[]; speeches: string[] }> = {
  female: {
    moans: ['moan-1.mp3', 'moan-2.mp3', 'moan-3.mp3'],
    speeches: ['speech-1.mp3', 'speech-2.mp3', 'speech-3.mp3', 'speech-4.mp3', 'speech-5.mp3'],
  },
  male: {
    moans: ['moan-1.mp3', 'moan-2.mp3', 'moan-3.mp3'],
    speeches: ['speech-1.mp3', 'speech-2.mp3', 'speech-3.mp3'],
  },
}
// max consecutive plays of the same type before forcing a switch (3 or 4, randomized)
const STREAK_MIN = 3

export default function MoanMac() {
  const [gender, setGender] = useState<Gender>(
    () => (typeof window !== 'undefined' && (localStorage.getItem('moan-gender') as Gender)) || 'female',
  )
  const [hitCount, setHitCount] = useState(0)
  const [soundType, setSoundType] = useState<'moan' | 'speech'>('moan')
  const [isListening, setIsListening] = useState(false)
  const [micError, setMicError] = useState(false)
  const [paused, setPaused] = useState(false)
  const [debugLog, setDebugLog] = useState<string[]>([])

  const pausedRef = useRef(false)
  const buffersRef = useRef<Map<string, AudioBuffer>>(new Map())
  const recentMoansRef = useRef<string[]>([])
  const lastSpeechRef = useRef('')
  const speechActiveRef = useRef(false)
  const cooldownRef = useRef(false)
  const lastTypeRef = useRef<'moan' | 'speech'>('moan')
  const streakRef = useRef(0)
  const streakCapRef = useRef(STREAK_MIN + Math.round(Math.random()))
  const analyserRef = useRef<AnalyserNode | null>(null)
  const rafRef = useRef<number>(0)
  const streamRef = useRef<MediaStream | null>(null)
  const audioCtxRef = useRef<AudioContext | null>(null)
  const activeSoundsRef = useRef<{ source: AudioBufferSourceNode; gain: GainNode; type: 'moan' | 'speech' }[]>([])
  const rapidCountRef = useRef(0)
  const lastHitRef = useRef(0)
  const handleSpankRef = useRef<() => void>(() => {})
  const monitorGenRef = useRef(0)

  const log = useCallback((msg: string) => {
    if (!DEBUG) return
    const ts = new Date().toLocaleTimeString('en-US', {
      hour12: false,
      fractionalSecondDigits: 1,
    })
    setDebugLog((prev) => [`[${ts}] ${msg}`, ...prev].slice(0, 15))
  }, [])

  // fade out active sounds. moans only by default, pass true to kill everything
  const duckActive = useCallback((all = false) => {
    const ctx = audioCtxRef.current
    if (!ctx) return
    const now = ctx.currentTime
    const keep: typeof activeSoundsRef.current = []
    for (const entry of activeSoundsRef.current) {
      if (!all && entry.type === 'speech') {
        keep.push(entry)
        continue
      }
      entry.gain.gain.cancelScheduledValues(now)
      entry.gain.gain.setValueAtTime(entry.gain.gain.value, now)
      entry.gain.gain.linearRampToValueAtTime(0, now + 0.08)
      try { entry.source.stop(now + 0.08) } catch {}
    }
    activeSoundsRef.current = keep
  }, [])

  const playBuffer = useCallback(
    (key: string, opts?: { volume?: number; rate?: number; type?: 'moan' | 'speech'; onEnded?: () => void }) => {
      const ctx = audioCtxRef.current
      const buffer = buffersRef.current.get(key)
      if (!ctx || !buffer) return

      const source = ctx.createBufferSource()
      source.buffer = buffer
      source.playbackRate.value = opts?.rate ?? 1

      const gain = ctx.createGain()
      gain.gain.value = opts?.volume ?? 1

      source.connect(gain)
      gain.connect(ctx.destination)

      const entry = { source, gain, type: opts?.type ?? 'moan' as const }
      activeSoundsRef.current.push(entry)

      const cleanup = () => {
        activeSoundsRef.current = activeSoundsRef.current.filter((e) => e !== entry)
        opts?.onEnded?.()
      }
      source.onended = cleanup
      source.start(0)
    },
    [],
  )

  // pick a moan avoiding the last 2 played
  const pickMoan = useCallback((g: Gender): string => {
    const moans = SOUND_BANK[g].moans
    const recent = recentMoansRef.current
    const pool = moans.filter((m) => !recent.includes(m))
    const pick =
      pool.length > 0
        ? pool[Math.floor(Math.random() * pool.length)]
        : moans[Math.floor(Math.random() * moans.length)]

    recent.push(pick)
    if (recent.length > 2) recent.shift()
    return `${g}/${pick}`
  }, [])

  const pickSpeech = useCallback((g: Gender): string => {
    const speeches = SOUND_BANK[g].speeches
    const pool = speeches.filter((s) => s !== lastSpeechRef.current)
    const pick = pool[Math.floor(Math.random() * pool.length)]
    lastSpeechRef.current = pick
    return `${g}/${pick}`
  }, [])

  const handleSpank = useCallback(() => {
    const now = Date.now()
    const gap = now - lastHitRef.current
    lastHitRef.current = now
    rapidCountRef.current = gap < 600 ? rapidCountRef.current + 1 : 1

    // interrupt everything, including speeches
    duckActive(true)
    speechActiveRef.current = false

    const baseVol = gender === 'male' ? 0.85 : 0.7
    const vol = baseVol + Math.random() * (1 - baseVol)
    const rate = 0.95 + Math.random() * 0.1

    // decide type: force switch after 3-4 consecutive of the same, otherwise 50/50
    let type: 'moan' | 'speech'
    if (streakRef.current >= streakCapRef.current) {
      type = lastTypeRef.current === 'moan' ? 'speech' : 'moan'
    } else {
      type = Math.random() < 0.5 ? 'moan' : 'speech'
    }
    // speech can't overlap, fall back to moan if one is still playing
    if (type === 'speech' && speechActiveRef.current) type = 'moan'

    // update streak tracking
    if (type === lastTypeRef.current) {
      streakRef.current++
    } else {
      lastTypeRef.current = type
      streakRef.current = 1
      streakCapRef.current = STREAK_MIN + Math.round(Math.random())
    }

    if (type === 'speech') {
      speechActiveRef.current = true
      const speech = pickSpeech(gender)
      playBuffer(speech, {
        volume: vol,
        rate,
        type: 'speech',
        onEnded: () => {
          speechActiveRef.current = false
        },
      })
      log(`#${rapidCountRef.current} ${speech.split('/').pop()} v=${vol.toFixed(2)}`)
    } else {
      const moan = pickMoan(gender)
      playBuffer(moan, { volume: vol, rate, type: 'moan' })
      log(`#${rapidCountRef.current} ${moan.split('/').pop()} v=${vol.toFixed(2)}`)
    }

    setSoundType(type)
    setHitCount((c) => c + 1)
  }, [gender, duckActive, pickMoan, pickSpeech, playBuffer, log])

  useEffect(() => {
    handleSpankRef.current = handleSpank
  }, [handleSpank])

  const loadSounds = useCallback(
    async (ctx: AudioContext) => {
      const files = (['female', 'male'] as const).flatMap((g) => [
        ...SOUND_BANK[g].moans.map((f) => `${g}/${f}`),
        ...SOUND_BANK[g].speeches.map((f) => `${g}/${f}`),
      ])

      await Promise.all(
        files.map(async (file) => {
          try {
            const res = await fetch(`/assets/sounds/${file}`)
            const raw = await res.arrayBuffer()
            buffersRef.current.set(file, await ctx.decodeAudioData(raw))
          } catch {
            log(`load failed: ${file}`)
          }
        }),
      )
      log(`loaded ${buffersRef.current.size}/${files.length} sounds`)
    },
    [log],
  )

  const startMonitor = useCallback(() => {
    // each call gets a unique generation id, stale loops self-terminate
    const gen = ++monitorGenRef.current

    const freqData = new Uint8Array(256)
    const LOW_END = 4
    const MID_END = 16
    let runningAvg = MIN_THRESHOLD
    let warmup = 30 // ~0.5s at 60fps to calibrate before detecting

    const loop = () => {
      if (monitorGenRef.current !== gen) return

      const analyser = analyserRef.current
      if (!analyser) return

      analyser.getByteFrequencyData(freqData)

      let lowSum = 0
      for (let i = 0; i < LOW_END; i++) lowSum += freqData[i]
      const lowAvg = lowSum / LOW_END

      // asymmetric smoothing: decay fast so avg recovers after speaker feedback
      const alpha = lowAvg < runningAvg ? 0.15 : AVG_SMOOTHING
      runningAvg = runningAvg * (1 - alpha) + lowAvg * alpha

      if (warmup > 0) {
        warmup--
        rafRef.current = requestAnimationFrame(loop)
        return
      }

      if (!cooldownRef.current && !pausedRef.current) {
        const isSpike = lowAvg > MIN_THRESHOLD && lowAvg > runningAvg * SPIKE_FACTOR

        if (isSpike) {
          let midSum = 0
          for (let i = LOW_END; i < MID_END; i++) midSum += freqData[i]
          const midAvg = midSum / (MID_END - LOW_END)

          if (midAvg < lowAvg * VOICE_RATIO) {
            handleSpankRef.current()
            cooldownRef.current = true
            setTimeout(() => {
              cooldownRef.current = false
            }, SMACK_COOLDOWN)
          }
        }
      }

      rafRef.current = requestAnimationFrame(loop)
    }

    rafRef.current = requestAnimationFrame(loop)
  }, [])

  const startListening = useCallback(async () => {
    // clean up any previous failed attempt
    cancelAnimationFrame(rafRef.current)
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((t) => t.stop())
      streamRef.current = null
    }
    if (audioCtxRef.current) {
      audioCtxRef.current.close().catch(() => {})
      audioCtxRef.current = null
    }
    analyserRef.current = null
    setMicError(false)

    try {
      log('requesting mic...')
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      streamRef.current = stream

      const ctx = new AudioContext()
      audioCtxRef.current = ctx

      const source = ctx.createMediaStreamSource(stream)
      const analyser = ctx.createAnalyser()
      analyser.fftSize = 512
      source.connect(analyser)
      analyserRef.current = analyser

      await loadSounds(ctx)

      setIsListening(true)
      localStorage.setItem('moan-mic-granted', '1')
      log('mic active, listening for smacks')
      startMonitor()
    } catch (err) {
      console.error('mic init failed:', err)
      log(`mic error: ${err instanceof Error ? err.message : 'denied'}`)
      setMicError(true)
      localStorage.removeItem('moan-mic-granted')
    }
  }, [loadSounds, log, startMonitor])

  // auto-start if mic was previously granted
  const startedRef = useRef(false)
  useEffect(() => {
    if (startedRef.current) return
    if (typeof window !== 'undefined' && localStorage.getItem('moan-mic-granted') === '1') {
      startedRef.current = true
      startListening()
    }
  }, [startListening])

  useEffect(() => {
    return () => {
      cancelAnimationFrame(rafRef.current)
      streamRef.current?.getTracks().forEach((t) => t.stop())
      audioCtxRef.current?.close()
    }
  }, [])

  const togglePause = useCallback(() => {
    setPaused((prev) => {
      const next = !prev
      pausedRef.current = next
      if (next) duckActive(true)
      return next
    })
  }, [duckActive])

  const accent = gender === 'female' ? 'text-pink-400' : 'text-blue-400'
  const accentBorder = gender === 'female' ? 'border-pink-400/30' : 'border-blue-400/30'
  const accentBg = gender === 'female' ? 'hover:bg-pink-400/10' : 'hover:bg-blue-400/10'

  return (
    <div className="h-dvh w-screen bg-black flex flex-col items-center justify-center overflow-hidden select-none relative">
      {/* logo */}
      <h1 className={cnm('absolute top-8 text-3xl sm:text-4xl font-bold tracking-[-0.06em] transition-colors', accent)}>
        MOANTOP.XYZ
      </h1>

      {/* pause/play toggle */}
      {isListening && (
        <button
          onClick={togglePause}
          className="absolute top-8 right-8 text-neutral-600 hover:text-neutral-400 transition-colors"
          aria-label={paused ? 'Resume' : 'Pause'}
        >
          {paused ? (
            <svg viewBox="0 0 24 24" fill="currentColor" className="w-6 h-6">
              <path d="M8 5v14l11-7z" />
            </svg>
          ) : (
            <svg viewBox="0 0 24 24" fill="currentColor" className="w-6 h-6">
              <path d="M6 19h4V5H6v14zm8-14v14h4V5h-4z" />
            </svg>
          )}
        </button>
      )}

      {/* paused overlay */}
      {paused && (
        <div
          className="absolute inset-0 bg-black/60 flex items-center justify-center z-10 cursor-pointer"
          onClick={togglePause}
        >
          <span className="text-neutral-500 text-4xl sm:text-5xl font-bold tracking-[0.2em] font-mono">
            PAUSED
          </span>
        </div>
      )}

      <RobotFace gender={gender} hitCount={hitCount} soundType={soundType} />

      {!isListening && (
        <>
          <button
            onClick={() => {
              startedRef.current = true
              startListening()
            }}
            className={cnm(
              'mt-10 px-8 py-4 rounded-none text-base sm:text-lg font-mono tracking-wider uppercase transition-colors',
              gender === 'female'
                ? 'bg-pink-400 text-black hover:bg-pink-300'
                : 'bg-blue-400 text-black hover:bg-blue-300',
              micError && 'bg-red-500 text-white hover:bg-red-400',
            )}
          >
            {micError ? 'Retry' : 'Smack Me'}
          </button>
          {!micError && (
            <p className="mt-3 text-xs font-mono text-neutral-500 animate-pulse">click this first!</p>
          )}
        </>
      )}

      {DEBUG && isListening && (
        <p className={cnm('mt-6 text-xs font-mono tracking-widest opacity-30', accent)}>
          listening...
        </p>
      )}

      {/* gender toggle */}
      <button
        onClick={() => {
          duckActive(true)
          recentMoansRef.current = []
          lastSpeechRef.current = ''
          streakRef.current = 0
          setGender((prev) => {
            const next = prev === 'male' ? 'female' : 'male'
            localStorage.setItem('moan-gender', next)
            return next
          })
        }}
        className={cnm(
          'absolute bottom-12 px-5 py-2.5 border rounded-none text-sm sm:text-base font-mono tracking-wider uppercase transition-colors',
          accentBorder,
          accent,
          accentBg,
        )}
      >
        {gender === 'female' ? '♀' : '♂'}
      </button>

      {/* github */}
      <a
        href="https://github.com/kelvinkn17/moantop"
        target="_blank"
        rel="noopener noreferrer"
        className="absolute bottom-4 flex items-center gap-1.5 text-neutral-600 hover:text-neutral-400 transition-colors"
      >
        <svg viewBox="0 0 16 16" fill="currentColor" className="w-4 h-4">
          <path d="M8 0C3.58 0 0 3.58 0 8c0 3.54 2.29 6.53 5.47 7.59.4.07.55-.17.55-.38 0-.19-.01-.82-.01-1.49-2.01.37-2.53-.49-2.69-.94-.09-.23-.48-.94-.82-1.13-.28-.15-.68-.52-.01-.53.63-.01 1.08.58 1.23.82.72 1.21 1.87.87 2.33.66.07-.52.28-.87.51-1.07-1.78-.2-3.64-.89-3.64-3.95 0-.87.31-1.59.82-2.15-.08-.2-.36-1.02.08-2.12 0 0 .67-.21 2.2.82.64-.18 1.32-.27 2-.27s1.36.09 2 .27c1.53-1.04 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12.51.56.82 1.27.82 2.15 0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48 0 1.07-.01 1.93-.01 2.2 0 .21.15.46.55.38A8.01 8.01 0 0016 8c0-4.42-3.58-8-8-8z" />
        </svg>
        <span className="text-xs font-mono">kelvinkn17/moantop</span>
      </a>

      {DEBUG && (
        <div className="absolute top-4 left-4 max-w-xs">
          {debugLog.map((entry, i) => (
            <p key={`${entry}-${i}`} className="text-[10px] font-mono text-neutral-500 leading-relaxed">
              {entry}
            </p>
          ))}
        </div>
      )}
    </div>
  )
}
