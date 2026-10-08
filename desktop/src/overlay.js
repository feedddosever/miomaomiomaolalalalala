// Draws one walk at a time across the see-through layer: a line of paw
// prints, and at the end of it as much of the kitty as it's brave enough
// to show (nothing, a shadow, a peek, or a proper visit).

const stage = document.getElementById('stage')
const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)')
let walking = false
let queued = null

const STEP_MS = 380
const PRINT_LIFE_MS = 5000

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

function el(cls, html) {
  const d = document.createElement('div')
  d.className = cls
  if (html) d.innerHTML = html // static markup above, never data
  return d
}

const rand = (a, b) => a + Math.random() * (b - a)
const clamp = (v, a, b) => Math.max(a, Math.min(b, v))
const wait = (ms) => new Promise((r) => setTimeout(r, ms))

// A gentle curve across part of the screen, from one side, ending
// somewhere in the lower two thirds where the kitty can show up.
function makePath() {
  const W = window.innerWidth
  const H = window.innerHeight
  const fromLeft = Math.random() < 0.5
  const x0 = fromLeft ? rand(-20, W * 0.1) : rand(W * 0.9, W + 20)
  const y0 = rand(H * 0.4, H * 0.92)
  const x1 = fromLeft ? rand(W * 0.45, W * 0.8) : rand(W * 0.2, W * 0.55)
  const y1 = clamp(y0 + rand(-H * 0.25, H * 0.12), H * 0.3, H * 0.9)
  // Control point pushed off the straight line, for a wander rather than a march.
  const mx = (x0 + x1) / 2 + rand(-80, 80)
  const my = (y0 + y1) / 2 + rand(-H * 0.12, H * 0.12)
  const length = Math.hypot(x1 - x0, y1 - y0)
  const steps = clamp(Math.round(length / 62), 9, 22)
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
  tag.style.left = `${clamp(x, 90, window.innerWidth - 90)}px`
  tag.style.top = `${clamp(y, 40, window.innerHeight - 10)}px`
  stage.append(tag)
  requestAnimationFrame(() => tag.classList.add('is-shown'))
  setTimeout(() => tag.classList.remove('is-shown'), ms)
  setTimeout(() => tag.remove(), ms + 800)
}

// Stage 1: a blurred shadow slips away from the end of the trail.
async function shadow(end, dirX) {
  const cat = el('cat cat--shadow', HEAD_SVG)
  cat.style.left = `${end.x}px`
  cat.style.top = `${end.y - 60}px`
  cat.style.setProperty('--slip', `${dirX * 170}px`)
  stage.append(cat)
  await wait(1900)
  cat.remove()
}

// Stage 2: ears and eyes come up from the bottom edge, look, and duck.
async function peek(x, ms) {
  const cat = el('cat cat--peek', HEAD_SVG)
  cat.style.left = `${clamp(x, 70, window.innerWidth - 70)}px`
  stage.append(cat)
  await wait(60)
  cat.classList.add('is-up')
  await wait(ms)
  cat.classList.remove('is-up')
  await wait(1000)
  cat.remove()
}

// Stage 3: the whole kitty sits at the bottom of the screen for a while,
// and on a quiet walk sometimes falls asleep there.
async function visit(x, ms, nap) {
  const cat = el('cat cat--visit', SITTING_SVG)
  cat.style.left = `${clamp(x, 80, window.innerWidth - 80)}px`
  stage.append(cat)
  await wait(60)
  cat.classList.add('is-here')
  if (nap) {
    await wait(2500)
    cat.classList.add('cat--asleep')
    const z = el('zzz')
    z.textContent = 'z z'
    cat.append(z)
  }
  await wait(ms)
  cat.classList.remove('is-here')
  await wait(800)
  cat.remove()
}

async function walk({ reason = 'idle', stage: level = 0, name = '' } = {}) {
  if (walking) {
    // A stage-up never gets lost: it plays right after this walk.
    if (reason === 'stageup') queued = { reason, stage: level, name }
    return
  }
  walking = true
  try {
    const { points, end, dirX } = makePath()
    const special = reason === 'stageup' || reason === 'hello'
    await printTrail(points)

    const H = window.innerHeight
    if (reason === 'hello' && name) showTag(`${name} was here`, end.x, end.y - 24, 3500)

    if (level === 1) {
      if (reason === 'stageup' && name) showTag(`was that ${name}?`, end.x, end.y - 70, 3200)
      await shadow(end, dirX)
    } else if (level === 2) {
      if (reason === 'stageup' && name) showTag(`${name} is getting braver`, end.x, H - 110, 4200)
      await peek(end.x, special ? 5000 : 3500)
    } else if (level >= 3) {
      if (reason === 'stageup' && name) showTag(`${name} lives here now`, end.x, H - 165, 5000)
      const nap = reason === 'idle' && Math.random() < 0.5
      await visit(end.x, special ? 9000 : nap ? 14000 : 6500, nap)
    } else {
      await wait(1500)
    }
  } finally {
    walking = false
    if (queued) {
      const next = queued
      queued = null
      setTimeout(() => walk(next), 1500)
    }
  }
}

window.kitty.onWalk(walk)
window.kitty.overlayReady()
