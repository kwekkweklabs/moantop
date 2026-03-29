import { useRef, useEffect } from 'react'
import gsap from 'gsap'

type Gender = 'male' | 'female'

interface RobotFaceProps {
  gender: Gender
  hitCount: number
  soundType: 'moan' | 'speech'
}

const ACCENT = {
  male: '#60A5FA',
  female: '#F472B6',
} as const

type Els = {
  face: SVGSVGElement
  leftEye: SVGRectElement
  rightEye: SVGRectElement
  mouth: SVGRectElement
}

type AnimationBuilder = (els: Els) => gsap.core.Timeline

// helper: random in range
const r = (min: number, max: number) => min + Math.random() * (max - min)

// helper: random sign
const rs = () => (Math.random() > 0.5 ? 1 : -1)

// shared shake sequence, always violent, always looks like it got hit hard
function shake(tl: gsap.core.Timeline, face: SVGSVGElement, label?: string) {
  const count = 6 + Math.floor(Math.random() * 4)
  const startLabel = label ?? '>'
  for (let i = 0; i < count; i++) {
    const t = 1 - i / count // decay
    tl.to(face, {
      x: rs() * r(20, 40) * t,
      y: rs() * r(5, 15) * t,
      rotation: rs() * r(3, 10) * t,
      duration: 0.025 + Math.random() * 0.015,
      ease: 'none',
    }, i === 0 ? startLabel : '>')
  }
  tl.to(face, { x: 0, y: 0, rotation: 0, duration: 0.15, ease: 'elastic.out(1, 0.4)' })
}

const animations: AnimationBuilder[] = [
  // 0: hard smack, scale punch + wide mouth + heavy shake
  ({ face, leftEye, rightEye, mouth }) => {
    const dir = rs()
    const tl = gsap.timeline()
    // initial impact
    tl.to(face, { scale: 1.15, x: dir * r(25, 40), rotation: dir * r(6, 12), transformOrigin: 'center center', duration: 0.06, ease: 'power4.out' })
    tl.to([leftEye, rightEye], { scaleY: 0.08, transformOrigin: 'center', duration: 0.05 }, '<')
    tl.to(mouth, { attr: { height: 22, y: 127 }, duration: 0.06 }, '<')
    // violent shake
    shake(tl, face)
    tl.to(face, { scale: 1, duration: 0.12, ease: 'elastic.out(1, 0.5)' }, '-=0.15')
    // eyes flutter
    tl.to([leftEye, rightEye], { scaleY: 0.4, duration: 0.05 }, '-=0.2')
    tl.to([leftEye, rightEye], { scaleY: 0.1, duration: 0.04 })
    tl.to([leftEye, rightEye], { scaleY: 1, duration: 0.15, ease: 'back.out(2)' })
    tl.to(mouth, { attr: { height: 4, y: 136 }, duration: 0.2, ease: 'power2.inOut' }, '-=0.15')
    return tl
  },

  // 1: surprised jump + shake on landing
  ({ face, leftEye, rightEye, mouth }) => {
    const tl = gsap.timeline()
    tl.to(face, { y: r(-25, -35), scale: 1.1, transformOrigin: 'center center', duration: 0.08, ease: 'power4.out' })
    tl.to([leftEye, rightEye], { scaleY: 1.4, scaleX: 1.3, transformOrigin: 'center', duration: 0.08 }, '<')
    tl.to(mouth, { attr: { height: 26, y: 125, rx: 10 }, duration: 0.08 }, '<')
    tl.to({}, { duration: 0.1 })
    // slam down
    tl.to(face, { y: 8, scale: 0.93, duration: 0.06, ease: 'power4.in' })
    // rattle on impact
    shake(tl, face)
    tl.to(face, { scale: 1, duration: 0.12, ease: 'elastic.out(1, 0.5)' }, '-=0.15')
    tl.to([leftEye, rightEye], { scaleY: 0.1, scaleX: 1, duration: 0.05 }, '-=0.3')
    tl.to([leftEye, rightEye], { scaleY: 1, duration: 0.2, ease: 'back.out(3)' })
    tl.to(mouth, { attr: { height: 4, y: 136, rx: 1 }, duration: 0.2, ease: 'power2.inOut' }, '-=0.15')
    return tl
  },

  // 2: wink + lean + shaky recovery
  ({ face, leftEye, rightEye, mouth }) => {
    const side = rs()
    const winkEye = side > 0 ? rightEye : leftEye
    const openEye = side > 0 ? leftEye : rightEye
    const tl = gsap.timeline()
    tl.to(face, { rotation: side * r(10, 18), x: side * r(15, 30), scale: 1.06, transformOrigin: 'center center', duration: 0.08, ease: 'power3.out' })
    tl.to(winkEye, { scaleY: 0.06, transformOrigin: 'center', duration: 0.06 }, '<')
    tl.to(openEye, { scaleY: 0.8, scaleX: 1.15, transformOrigin: 'center', duration: 0.08 }, '<')
    tl.to(mouth, { attr: { height: 12, y: 132, width: 34, x: 83 }, duration: 0.08 }, '<')
    tl.to({}, { duration: 0.15 })
    // shake back to center
    shake(tl, face)
    tl.to(face, { scale: 1, duration: 0.1, ease: 'elastic.out(1, 0.6)' }, '-=0.15')
    tl.to([leftEye, rightEye], { scaleY: 1, scaleX: 1, duration: 0.15, ease: 'back.out(2)' }, '-=0.15')
    tl.to(mouth, { attr: { height: 4, y: 136, width: 40, x: 80 }, duration: 0.15 }, '-=0.15')
    return tl
  },

  // 3: absolute meltdown rattle, extra long and violent
  ({ face, leftEye, rightEye, mouth }) => {
    const tl = gsap.timeline()
    tl.to([leftEye, rightEye], { scaleY: 0.04, transformOrigin: 'center', duration: 0.04 })
    tl.to(mouth, { attr: { height: 30, y: 123, rx: 12 }, duration: 0.05 }, '<')
    tl.to(face, { scale: 1.12, transformOrigin: 'center center', duration: 0.04 }, '<')
    // double shake for extra violence
    const count = 10 + Math.floor(Math.random() * 5)
    for (let i = 0; i < count; i++) {
      const t = 1 - i / count
      tl.to(face, {
        x: rs() * r(25, 50) * t,
        y: rs() * r(8, 20) * t,
        rotation: rs() * r(5, 14) * t,
        duration: 0.02 + Math.random() * 0.015,
        ease: 'none',
      })
    }
    tl.to(face, { x: 0, y: 0, rotation: 0, scale: 1, duration: 0.2, ease: 'elastic.out(1, 0.4)' })
    tl.to([leftEye, rightEye], { scaleY: 1, duration: 0.2, ease: 'back.out(2)' }, '-=0.15')
    tl.to(mouth, { attr: { height: 4, y: 136, rx: 1 }, duration: 0.25, ease: 'power2.inOut' }, '-=0.15')
    return tl
  },

  // 4: squish + pop + shake on bounce
  ({ face, leftEye, rightEye, mouth }) => {
    const tl = gsap.timeline()
    // squish flat
    tl.to(face, { scaleY: 0.65, scaleX: 1.2, transformOrigin: 'center bottom', duration: 0.06, ease: 'power3.in' })
    tl.to([leftEye, rightEye], { scaleY: 0.15, transformOrigin: 'center', duration: 0.05 }, '<')
    tl.to(mouth, { attr: { height: 14, y: 131 }, duration: 0.05 }, '<')
    // pop up tall
    tl.to(face, { scaleY: 1.18, scaleX: 0.88, y: -15, duration: 0.08, ease: 'power4.out' })
    tl.to(mouth, { attr: { height: 22, y: 127 }, duration: 0.06 }, '<')
    tl.to([leftEye, rightEye], { scaleY: 1.35, transformOrigin: 'center', duration: 0.06 }, '<')
    // slam back and shake
    tl.to(face, { scaleY: 0.92, scaleX: 1.05, y: 5, duration: 0.05, ease: 'power3.in' })
    shake(tl, face)
    tl.to(face, { scaleY: 1, scaleX: 1, scale: 1, duration: 0.12, ease: 'elastic.out(1, 0.5)' }, '-=0.15')
    tl.to([leftEye, rightEye], { scaleY: 1, duration: 0.15, ease: 'back.out(2)' }, '-=0.15')
    tl.to(mouth, { attr: { height: 4, y: 136 }, duration: 0.2, ease: 'power2.inOut' }, '-=0.15')
    return tl
  },

  // 5: spin slap, big rotation + violent directional shake
  ({ face, leftEye, rightEye, mouth }) => {
    const dir = rs()
    const tl = gsap.timeline()
    // slap sends it spinning
    tl.to(face, { rotation: dir * r(18, 30), x: dir * r(20, 35), scale: 1.08, transformOrigin: 'center center', duration: 0.08, ease: 'power3.out' })
    tl.to([leftEye, rightEye], { scaleY: 0.08, scaleX: 1.2, transformOrigin: 'center', duration: 0.06 }, '<')
    tl.to(mouth, { attr: { height: 20, y: 128, rx: 8 }, duration: 0.06 }, '<')
    // rattle while recovering
    shake(tl, face)
    tl.to(face, { scale: 1, duration: 0.12, ease: 'elastic.out(1, 0.5)' }, '-=0.15')
    tl.to([leftEye, rightEye], { scaleY: 1, scaleX: 1, duration: 0.2, ease: 'back.out(2)' }, '-=0.15')
    tl.to(mouth, { attr: { height: 4, y: 136, rx: 1 }, duration: 0.2, ease: 'power2.inOut' }, '-=0.15')
    return tl
  },
]

// default SVG attr values for clean reset
const DEFAULTS = {
  face: { x: 0, y: 0, scale: 1, scaleX: 1, scaleY: 1, rotation: 0 },
  eyes: { scaleX: 1, scaleY: 1 },
  mouth: { attr: { height: 4, y: 136, rx: 1, width: 40, x: 80 } },
} as const

// mouth flap sequence for speech, rapid open/close like talking
function mouthFlap(tl: gsap.core.Timeline, mouth: SVGRectElement) {
  const cycles = 5 + Math.floor(Math.random() * 4) // 5-8 flaps
  for (let i = 0; i < cycles; i++) {
    const openH = 10 + Math.random() * 14 // varied mouth openness
    const closeH = 2 + Math.random() * 4
    const speed = 0.06 + Math.random() * 0.04
    tl.to(mouth, { attr: { height: openH, y: 136 - openH / 2 }, duration: speed, ease: 'power2.out' })
    tl.to(mouth, { attr: { height: closeH, y: 136 - closeH / 2 }, duration: speed * 0.7, ease: 'power2.in' })
  }
  // settle closed
  tl.to(mouth, { attr: { height: 4, y: 136, rx: 1 }, duration: 0.12, ease: 'power2.inOut' })
}

export default function RobotFace({ gender, hitCount, soundType }: RobotFaceProps) {
  const faceRef = useRef<SVGSVGElement>(null)
  const leftEyeRef = useRef<SVGRectElement>(null)
  const rightEyeRef = useRef<SVGRectElement>(null)
  const mouthRef = useRef<SVGRectElement>(null)
  const tlRef = useRef<gsap.core.Timeline | null>(null)
  const lastAnimRef = useRef(-1)

  const accent = ACCENT[gender]

  useEffect(() => {
    if (hitCount === 0) return
    const f = faceRef.current
    const le = leftEyeRef.current
    const re = rightEyeRef.current
    const m = mouthRef.current
    if (!f || !le || !re || !m) return

    // kill and hard reset everything
    if (tlRef.current) {
      tlRef.current.kill()
    }
    gsap.set(f, { ...DEFAULTS.face, transformOrigin: 'center center' })
    gsap.set([le, re], { ...DEFAULTS.eyes, transformOrigin: 'center' })
    gsap.set(m, DEFAULTS.mouth)

    // pick random variant, no repeats
    let idx: number
    do {
      idx = Math.floor(Math.random() * animations.length)
    } while (idx === lastAnimRef.current && animations.length > 1)
    lastAnimRef.current = idx

    const tl = animations[idx]({ face: f, leftEye: le, rightEye: re, mouth: m })

    // for speech sounds, append mouth flapping after the hit reaction
    if (soundType === 'speech') {
      mouthFlap(tl, m)
    }

    tlRef.current = tl

    return () => {
      tl.kill()
    }
  }, [hitCount, soundType])

  return (
    <svg
      ref={faceRef}
      viewBox="0 0 200 200"
      className="w-72 h-72 sm:w-96 sm:h-96 md:w-[28rem] md:h-[28rem]"
    >
      {/* head outline */}
      <rect
        x="30"
        y="30"
        width="140"
        height="140"
        rx="20"
        fill="none"
        stroke={accent}
        strokeWidth="2"
      />

      {/* left eye */}
      <rect
        ref={leftEyeRef}
        x="58"
        y="72"
        width="28"
        height="28"
        fill={accent}
      />

      {/* right eye */}
      <rect
        ref={rightEyeRef}
        x="114"
        y="72"
        width="28"
        height="28"
        fill={accent}
      />

      {/* mouth */}
      <rect
        ref={mouthRef}
        x="80"
        y="136"
        width="40"
        height="4"
        rx="1"
        fill={accent}
      />
    </svg>
  )
}
