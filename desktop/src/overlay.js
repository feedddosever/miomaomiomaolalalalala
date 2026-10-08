// Draws one walk at a time across the see-through layer: a line of paw
// prints, and at the end of it as much of the kitty as it's brave enough
// to show. Ten levels, one for every three ticked quests:
//   1-2  a shadow slipping away (faint, then clearer)
//   3-6  peeking up from the bottom of the screen (ear tips, eyes, face)
//   7-10 sitting at the bottom of the screen (see-through, solid,
//        napping, and finally moved in with a ball of yarn)
// Also: the "arrival" sparkle when a level is reached, the gift walk
// when there's a new version, and the occasional meow.

const stage = document.getElementById('stage')
const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)')
let walking = false
let queued = null

const STEP_MS = 380
const PRINT_LIFE_MS = 5000

const LOOKS = [
  null,
  { kind: 'shadow', opacity: 0.16, blur: 4 },
  { kind: 'shadow', opacity: 0.34, blur: 2 },
  { kind: 'peek', rise: 34, opacity: 1 },
  { kind: 'peek', rise: 60, opacity: 1 },
  { kind: 'peek', rise: 92, opacity: 0.6 },
  { kind: 'peek', rise: 92, opacity: 1 },
  { kind: 'visit', opacity: 0.5 },
  { kind: 'visit', opacity: 1 },
  { kind: 'visit', opacity: 1, napChance: 0.7 },
  { kind: 'visit', opacity: 1, napChance: 0.5, yarn: true },
]

// What the name tag says the first time each level is reached.
const ARRIVAL_TAGS = [
  '',
  'was that {name}?',
  '{name} again?',
  'two little ears…',
  '{name} is peeking!',
  '{name} is getting braver',
  'hi, {name}!',
  '{name} came closer',
  '{name} is here',
  '{name} feels at home',
  '{name} lives here now',
]

const MEOW_WORDS = ['meow', 'mrrp?', 'meeow', 'mew!', 'mrrrow']

const PAW_INNER =
  '<ellipse cx="16" cy="20" rx="9" ry="7.5"/>' +
  '<ellipse cx="6.5" cy="11.5" rx="3.4" ry="4.2" transform="rotate(-18 6.5 11.5)"/>' +
  '<ellipse cx="14" cy="6.5" rx="3.4" ry="4.4" transform="rotate(-4 14 6.5)"/>' +
  '<ellipse cx="22" cy="6.8" rx="3.4" ry="4.4" transform="rotate(8 22 6.8)"/>' +
  '<ellipse cx="27" cy="12.5" rx="3.2" ry="4" transform="rotate(22 27 12.5)"/>'

// The same kitten as on the website (src/components/Kitten.jsx).
const HEAD =
  '<path class="k-fur" d="M-15,-16 L-21,-35 L-1,-23 Z"/>' +
  '<path class="k-inner" d="M-13,-18 L-17,-29 L-6,-22 Z"/>' +
  '<path class="k-fur" d="M15,-16 L21,-35 L1,-23 Z"/>' +
  '<path class="k-inner" d="M13,-18 L17,-29 L6,-22 Z"/>' +
  '<ellipse class="k-fur" cx="0" cy="0" rx="23" ry="20"/>' +
  '<g class="k-eyes"><ellipse cx="-7" cy="-3" rx="3" ry="3.6"/><ellipse cx="9" cy="-3" rx="3" ry="3.6"/></g>' +
  '<ellipse class="k-nose" cx="1" cy="5" rx="3" ry="2.2"/>' +
  '<path class="k-whisker" d="M6,7 Q18,5 27,8"/>' +
  '<path class="k-whisker" d="M6,10 Q18,12 26,15"/>' +
  '<path class="k-whisker" d="M-4,7 Q-14,6 -21,9"/>'

const HEAD_SVG = `<svg viewBox="-40 -40 80 80">${HEAD}<ellipse class="k-fur" cx="-9" cy="22" rx="8" ry="5.5"/></svg>`

// Sitting: tail, body, front paws, then the head on top.
const SITTING_SVG = `<svg viewBox="-45 -45 90 110">
  <path class="k-tail" d="M18,52 Q46,48 40,18"/>
  <path class="k-tail-fur" d="M18,52 Q46,48 40,18"/>
  <ellipse class="k-fur" cx="0" cy="34" rx="25" ry="24"/>
  <ellipse class="k-fur" cx="-10" cy="57" rx="8" ry="5"/>
  <ellipse class="k-fur" cx="10" cy="57" rx="8" ry="5"/>
  <g transform="translate(0,-2)">${HEAD}</g>
</svg>`

const YARN_SVG = `<svg viewBox="-20 -20 40 40">
  <circle r="15" fill="#c98a86" stroke="#4a2f23" stroke-width="2"/>
  <path d="M-12,-6 Q0,-14 12,-6 M-14,2 Q0,-6 14,2 M-11,9 Q0,2 11,9" fill="none" stroke="#a5605c" stroke-width="1.6"/>
  <path d="M14,6 Q26,10 30,2" fill="none" stroke="#c98a86" stroke-width="2"/>
</svg>`

function el(cls, html) {
  const d = document.createElement('div')
  d.className = cls
  if (html) d.innerHTML = html // static markup above, never data
  return d
}

const rand = (a, b) => a + Math.random() * (b - a)
const clamp = (v, a, b) => Math.max(a, Math.min(b, v))
const wait = (ms) => new Promise((r) => setTimeout(r, ms))
const fill = (text, name) => text.replace('{name}', name || 'the kitty')

// A gentle curve across part of the screen, from one side, ending
// somewhere in the lower two thirds where the kitty can show up. The
// intro walk heads up towards the menu bar instead.
function makePath(towardMenuBar = false) {
  const W = window.innerWidth
  const H = window.innerHeight
  const fromLeft = towardMenuBar ? true : Math.random() < 0.5
  const x0 = fromLeft ? rand(-20, W * 0.1) : rand(W * 0.9, W + 20)
  const y0 = towardMenuBar ? rand(H * 0.6, H * 0.85) : rand(H * 0.4, H * 0.92)
  const x1 = towardMenuBar ? W * 0.82 : fromLeft ? rand(W * 0.45, W * 0.8) : rand(W * 0.2, W * 0.55)
  const y1 = towardMenuBar ? H * 0.1 : clamp(y0 + rand(-H * 0.25, H * 0.12), H * 0.3, H * 0.9)
  const mx = (x0 + x1) / 2 + rand(-80, 80)
  const my = (y0 + y1) / 2 + rand(-H * 0.12, H * 0.12)
  const length = Math.hypot(x1 - x0, y1 - y0)
  const steps = clamp(Math.round(length / 62), 9, towardMenuBar ? 26 : 22)
  const points = []
  for (let i = 0; i < steps; i++) {
    const t = i / (steps - 1)
    const x = (1 - t) ** 2 * x0 + 2 * (1 - t) * t * mx + t ** 2 * x1
    const y = (1 - t) ** 2 * y0 + 2 * (1 - t) * t * my + t ** 2 * y1
    // Direction of travel at this point, from the curve's derivative.
    const dx = 2 * (1 - t) * (mx - x0) + 2 * t * (x1 - mx)
    const dy = 2 * (1 - t) * (my - y0) + 2 * t * (y1 - my)
    const angle = Math.atan2(dy, dx)
    // Left, right, left: each print sits a little to one side.
    const side = i % 2 === 0 ? -1 : 1
    points.push({
      x: x + Math.cos(angle + Math.PI / 2) * 9 * side,
      y: y + Math.sin(angle + Math.PI / 2) * 9 * side,
      rot: (angle * 180) / Math.PI + 90,
    })
  }
  return { points, end: { x: x1, y: y1 }, dirX: fromLeft ? 1 : -1 }
}

async function printTrail(points) {
  const still = reduceMotion.matches
  points.forEach((p, i) => {
    const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg')
    svg.setAttribute('viewBox', '0 0 32 32')
    svg.setAttribute('class', 'print')
    svg.innerHTML = PAW_INNER
    svg.style.left = `${p.x}px`
    svg.style.top = `${p.y}px`
    svg.style.setProperty('--rot', `${p.rot}deg`)
    svg.style.animationDelay = still ? '0ms' : `${i * STEP_MS}ms`
    stage.append(svg)
    setTimeout(() => svg.remove(), (still ? 0 : i * STEP_MS) + PRINT_LIFE_MS + 200)
  })
  await wait(still ? 600 : (points.length - 1) * STEP_MS + 400)
}

function showTag(text, x, y, ms) {
  const tag = el('tag')
  tag.textContent = text
  tag.style.left = `${clamp(x, 110, window.innerWidth - 110)}px`
  tag.style.top = `${clamp(y, 40, window.innerHeight - 10)}px`
  stage.append(tag)
  requestAnimationFrame(() => tag.classList.add('is-shown'))
  setTimeout(() => tag.classList.remove('is-shown'), ms)
  setTimeout(() => tag.remove(), ms + 800)
}

// Sparkles and a soft glow where the kitty is materialising.
function sparkle(x, y) {
  const burst = el('burst')
  burst.style.left = `${x}px`
  burst.style.top = `${y}px`
  burst.append(el('glow'))
  for (let i = 0; i < 12; i++) {
    const s = el('sparkle')
    s.style.setProperty('--a', `${i * 30 + rand(-8, 8)}deg`)
    s.style.setProperty('--d', `${rand(46, 78)}px`)
    s.style.animationDelay = `${rand(0, 180)}ms`
    burst.append(s)
  }
  stage.append(burst)
  setTimeout(() => burst.remove(), 2200)
}

// ---- how much of the kitty shows ----

async function shadow(look, end, dirX, arriving) {
  const cat = el('cat cat--shadow', HEAD_SVG)
  cat.style.left = `${end.x}px`
  cat.style.top = `${end.y - 60}px`
  cat.style.setProperty('--op', look.opacity)
  cat.style.setProperty('--blur', `${look.blur}px`)
  cat.style.setProperty('--slip', `${dirX * 170}px`)
  if (arriving) cat.classList.add('is-arriving')
  stage.append(cat)
  await wait(arriving ? 3200 : 1900)
  cat.remove()
}

async function peek(look, x, ms, arriving) {
  const cat = el('cat cat--peek', HEAD_SVG)
  cat.style.left = `${clamp(x, 70, window.innerWidth - 70)}px`
  cat.style.setProperty('--rise', `${look.rise}px`)
  cat.style.opacity = look.opacity
  if (arriving) cat.classList.add('is-arriving')
  stage.append(cat)
  await wait(60)
  cat.classList.add('is-up')
  await wait(ms)
  cat.classList.remove('is-up')
  await wait(1000)
  cat.remove()
}

async function visit(look, x, ms, nap, arriving) {
  const left = clamp(x, 90, window.innerWidth - 90)
  const cat = el('cat cat--visit', SITTING_SVG)
  cat.style.left = `${left}px`
  cat.style.setProperty('--op', look.opacity)
  if (arriving) cat.classList.add('is-arriving')
  stage.append(cat)
  let yarn = null
  if (look.yarn) {
    yarn = el('yarn', YARN_SVG)
    const side = left > window.innerWidth / 2 ? -1 : 1
    yarn.style.left = `${left + side * 95}px`
    yarn.style.setProperty('--from', `${side * 260}px`)
    stage.append(yarn)
  }
  await wait(60)
  cat.classList.add('is-here')
  yarn?.classList.add('is-here')
  if (nap) {
    await wait(2500)
    cat.classList.add('cat--asleep')
    const z = el('zzz')
    z.textContent = 'z z'
    cat.append(z)
  }
  await wait(ms)
  cat.classList.remove('is-here')
  yarn?.classList.remove('is-here')
  await wait(800)
  cat.remove()
  yarn?.remove()
}

// Shows the kitty as it is at this level. `arriving` plays the
// materialising sparkle (only when a level is reached).
async function appear(level, end, dirX, { arriving = false, linger = false, napOk = false } = {}) {
  const look = LOOKS[Math.max(0, Math.min(10, level))]
  if (!look) return wait(1200)
  const H = window.innerHeight
  if (look.kind === 'shadow') {
    if (arriving) sparkle(end.x, end.y - 30)
    return shadow(look, end, dirX, arriving)
  }
  if (look.kind === 'peek') {
    if (arriving) sparkle(clamp(end.x, 70, window.innerWidth - 70), H - look.rise / 2 - 10)
    return peek(look, end.x, arriving || linger ? 5000 : 3500, arriving)
  }
  const nap = napOk && Math.random() < (look.napChance || 0)
  if (arriving) sparkle(clamp(end.x, 90, window.innerWidth - 90), H - 80)
  return visit(look, end.x, arriving || linger ? 9000 : nap ? 14000 : 6500, nap, arriving)
}

function tagSpot(level, end) {
  const look = LOOKS[Math.max(0, Math.min(10, level))]
  const H = window.innerHeight
  if (!look) return { x: end.x, y: end.y - 24 }
  if (look.kind === 'shadow') return { x: end.x, y: end.y - 70 }
  if (look.kind === 'peek') return { x: end.x, y: H - look.rise - 30 }
  return { x: end.x, y: H - 170 }
}

// Prints that would land under a peeking or sitting kitty are left out,
// so a see-through kitty never has a smudge on its face.
function underKitty(p, level, end) {
  const look = LOOKS[Math.max(0, Math.min(10, level))]
  if (!look || look.kind === 'shadow') return false
  const H = window.innerHeight
  const top = look.kind === 'visit' ? H - 165 : H - look.rise - 10
  return p.y > top && Math.abs(p.x - end.x) < 75
}

async function walk({ reason = 'idle', level = 0, name = '' } = {}) {
  if (walking) {
    // A level-up or a gift never gets lost: it plays right after this walk.
    // So does the first hello, unless something more important is waiting.
    if (reason === 'levelup' || reason === 'gift') queued = { reason, level, name }
    else if (reason === 'hello' && !queued) queued = { reason, level, name }
    return
  }
  walking = true
  try {
    const { points, end, dirX } = makePath(reason === 'intro')
    await printTrail(reason === 'intro' ? points : points.filter((p) => !underKitty(p, level, end)))
    if (reason === 'intro') return await wait(1500)

    const spot = tagSpot(level, end)
    if (reason === 'hello' && name) showTag(`${name} was here`, end.x, end.y - 24, 3500)
    if (reason === 'gift') showTag(`🎁 ${fill('{name} wants to bring you something new', name)}`, spot.x, spot.y, 6000)
    if (reason === 'levelup') {
      const text = ARRIVAL_TAGS[Math.max(0, Math.min(10, level))]
      if (text) showTag(fill(text, name), spot.x, spot.y, 4500)
    }
    await appear(level, end, dirX, {
      arriving: reason === 'levelup',
      linger: reason === 'hello' || reason === 'gift',
      napOk: reason === 'idle',
    })
  } finally {
    walking = false
    if (queued) {
      const next = queued
      queued = null
      setTimeout(() => walk(next), 1500)
    }
  }
}

// ---- meows ----
function playMeow() {
  const n = 2 + Math.floor(Math.random() * 4) // meow-2 … meow-5
  const audio = new Audio(`assets/sounds/meow-${n}.wav`)
  audio.volume = 0.55
  document.body.dataset.lastSound = `meow-${n}`
  audio.play().catch(() => {})
}

async function meow({ level = 0 } = {}) {
  const W = window.innerWidth
  const H = window.innerHeight
  const x = rand(W * 0.15, W * 0.85)
  playMeow()
  const look = LOOKS[Math.max(0, Math.min(10, level))]
  const bubbleY = look?.kind === 'visit' ? H - 175 : look?.kind === 'peek' ? H - look.rise - 34 : H - 70
  const bubble = el('meow')
  bubble.textContent = MEOW_WORDS[Math.floor(Math.random() * MEOW_WORDS.length)]
  bubble.style.left = `${clamp(x, 60, W - 60)}px`
  bubble.style.top = `${bubbleY}px`
  stage.append(bubble)
  requestAnimationFrame(() => bubble.classList.add('is-shown'))
  setTimeout(() => bubble.classList.remove('is-shown'), 2600)
  setTimeout(() => bubble.remove(), 3300)
  // Whoever is meowing shows as much of themselves as they dare.
  if (!walking && look && look.kind !== 'shadow') {
    walking = true
    try {
      await appear(level, { x, y: H * 0.8 }, 1, { linger: false })
    } finally {
      walking = false
    }
  } else if (!walking && !look) {
    // Level 0: just three little prints next to the voice.
    const prints = [0, 1, 2].map((i) => ({ x: x - 50 + i * 30, y: H - 40 - (i % 2) * 12, rot: 90 }))
    printTrail(prints)
  }
}

window.kitty.onWalk(walk)
window.kitty.onMeow(meow)
window.kitty.overlayReady()
