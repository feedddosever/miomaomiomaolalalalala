// The panel under the menu bar paw: the first meeting with the kitty,
// then today's chest, its quests and the bonus, and now and then a
// strawberry cake. All data comes from the main process through
// window.kitty; this file only draws.

const app = document.getElementById('app')
const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches
let state = null
let error = null
let busy = false
let updateNote = ''

// Builds DOM without innerHTML for anything that came from the database,
// so a quest can never inject markup.
function h(tag, attrs = {}, ...children) {
  const el = document.createElement(tag)
  for (const [k, v] of Object.entries(attrs)) {
    if (v === false || v == null) continue
    if (k === 'class') el.className = v
    else if (k.startsWith('on')) el.addEventListener(k.slice(2), v)
    else el.setAttribute(k, v === true ? '' : v)
  }
  for (const c of children.flat()) {
    if (c == null || c === false) continue
    el.append(c instanceof Node ? c : document.createTextNode(String(c)))
  }
  return el
}

function svgNode(markup) {
  const t = document.createElement('template')
  t.innerHTML = markup.trim() // static markup only, never data
  return t.content.firstElementChild
}

const PAW_INNER =
  '<ellipse cx="16" cy="20" rx="9" ry="7.5"/>' +
  '<ellipse cx="6.5" cy="11.5" rx="3.4" ry="4.2" transform="rotate(-18 6.5 11.5)"/>' +
  '<ellipse cx="14" cy="6.5" rx="3.4" ry="4.4" transform="rotate(-4 14 6.5)"/>' +
  '<ellipse cx="22" cy="6.8" rx="3.4" ry="4.4" transform="rotate(8 22 6.8)"/>' +
  '<ellipse cx="27" cy="12.5" rx="3.2" ry="4" transform="rotate(22 27 12.5)"/>'
const PAW = `<svg viewBox="0 0 32 32" aria-hidden="true">${PAW_INNER}</svg>`

function playMeow(n = 1) {
  const audio = new Audio(`assets/sounds/meow-${n}.wav`)
  audio.volume = 0.6
  document.body.dataset.lastSound = `meow-${n}`
  audio.play().catch(() => {})
}

function chestSvg(open) {
  return `<svg class="chest ${open ? 'chest--open' : ''}" viewBox="0 0 280 240" aria-hidden="true">
    <ellipse class="chest__shadow" cx="140" cy="214" rx="92" ry="12"/>
    <rect class="chest__foot" x="40" y="188" width="200" height="18" rx="7"/>
    <rect class="chest__body" x="40" y="122" width="200" height="76" rx="10"/>
    <line class="chest__grain" x1="92" y1="126" x2="92" y2="194"/>
    <line class="chest__grain" x1="140" y1="126" x2="140" y2="194"/>
    <line class="chest__grain" x1="188" y1="126" x2="188" y2="194"/>
    <rect class="chest__bracket" x="44" y="124" width="15" height="15" rx="4"/>
    <rect class="chest__bracket" x="221" y="124" width="15" height="15" rx="4"/>
    <g class="chest__lid">
      <path class="chest__lid-shape" d="M46,122 L46,104 Q46,76 76,76 L204,76 Q234,76 234,104 L234,122 Z"/>
      <path class="chest__ear" d="M96,82 L84,40 L120,78 Z"/>
      <path class="chest__ear-inner" d="M97,74 L91,52 L109,72 Z"/>
      <path class="chest__ear" d="M184,82 L196,40 L160,78 Z"/>
      <path class="chest__ear-inner" d="M183,74 L189,52 L171,72 Z"/>
      <path class="chest__whisker" d="M118,108 Q96,102 78,106"/>
      <path class="chest__whisker" d="M118,114 Q94,114 76,116"/>
      <path class="chest__whisker" d="M162,108 Q184,102 202,106"/>
      <path class="chest__whisker" d="M162,114 Q186,114 204,116"/>
      <ellipse class="chest__nose" cx="140" cy="110" rx="6" ry="4.5"/>
    </g>
    <g class="chest__latch">
      <ellipse cx="140" cy="127" rx="11" ry="9"/>
      <ellipse cx="126" cy="115" rx="4.4" ry="5.4" transform="rotate(-16 126 115)"/>
      <ellipse cx="136" cy="108" rx="4.3" ry="5.6" transform="rotate(-4 136 108)"/>
      <ellipse cx="146" cy="108" rx="4.3" ry="5.6" transform="rotate(6 146 108)"/>
      <ellipse cx="155" cy="115" rx="4.2" ry="5.2" transform="rotate(18 155 115)"/>
    </g>
  </svg>`
}

// ---------------- screens ----------------

function render() {
  app.replaceChildren()
  if (!state) {
    app.append(h('p', { class: 'loading' }, 'Looking for the kitty…'))
    return
  }
  if (!state.name) {
    if (state.error) return renderOffline()
    return renderIntro()
  }
  if (state.showCake && !cake.finished) return renderCake()
  renderMain()
}

function renderOffline() {
  app.append(
    h(
      'div',
      { class: 'naming' },
      h('h1', {}, 'The kitty is hiding'),
      h('p', {}, state.error),
      h('button', { class: 'btn', onclick: refresh }, 'Try again')
    )
  )
}

// ---- the first meeting ----
// Paw prints → "who's here?" → "meeeoow!" → a name → a title.
const intro = {
  step: 'meet', // 'meet' | 'title'
  shown: { me: false, cat: false, ask: false },
  started: false,
  name: '',
  titleIndex: 0,
}

function startIntroTimeline() {
  if (intro.started) return
  intro.started = true
  const t = reduceMotion ? [200, 500, 800] : [1700, 3000, 4300]
  setTimeout(() => {
    intro.shown.me = true
    if (intro.step === 'meet') render()
  }, t[0])
  setTimeout(() => {
    intro.shown.cat = true
    playMeow(1)
    if (intro.step === 'meet') render()
  }, t[1])
  setTimeout(() => {
    intro.shown.ask = true
    if (intro.step === 'meet') render()
  }, t[2])
}

function renderIntro() {
  if (intro.step === 'title') return renderTitlePicker()
  startIntroTimeline()

  const prints = h('div', { class: `intro__prints ${intro.started && intro.shown.me ? 'is-settled' : ''}` })
  for (let i = 0; i < 5; i++) {
    const p = svgNode(PAW)
    p.setAttribute('class', 'intro__paw')
    p.style.setProperty('--i', i)
    prints.append(p)
  }

  const chat = h(
    'div',
    { class: 'chat' },
    intro.shown.me && h('p', { class: 'bubble bubble--me' }, "who's here?"),
    intro.shown.cat && h('p', { class: 'bubble bubble--cat' }, 'meeeoow!')
  )

  const wrap = h('div', { class: 'intro' }, prints, chat)

  if (intro.shown.ask) {
    const input = h('input', {
      type: 'text',
      maxlength: '30',
      placeholder: 'Biscuit? Mochi? Pumpkin?',
      'aria-label': "The kitty's name",
      autocomplete: 'off',
      spellcheck: 'false',
      value: intro.name,
      // Keep what's typed if the panel redraws (it does when reopened).
      oninput: (e) => {
        intro.name = e.target.value
      },
    })
    const msg = h('p', { class: 'error', hidden: true })
    const form = h(
      'form',
      {
        class: 'intro__ask',
        onsubmit: (e) => {
          e.preventDefault()
          const name = input.value.replace(/\s+/g, ' ').trim()
          if (!name) {
            msg.textContent = 'They need at least one letter.'
            msg.hidden = false
            return
          }
          intro.name = name
          intro.step = 'title'
          render()
        },
      },
      h('p', { class: 'intro__question' }, 'Oh, a kitty! What would you like to call them?'),
      input,
      h('button', { class: 'btn', type: 'submit' }, 'Next'),
      msg
    )
    wrap.append(form)
    setTimeout(() => input.focus(), 50)
  }
  app.append(wrap)
}

function titleOptions() {
  // Every title, and the plain name at the end for anyone who'd rather not.
  return [...state.titles, '']
}

function fullName() {
  const title = titleOptions()[intro.titleIndex]
  return title ? `${intro.name} ${title}` : intro.name
}

function renderTitlePicker() {
  const options = titleOptions()
  const move = (by) => {
    intro.titleIndex = (intro.titleIndex + by + options.length) % options.length
    render()
  }
  const surprise = () => {
    // Any title but the one already showing (and not the plain name).
    let next = intro.titleIndex
    while (next === intro.titleIndex) next = Math.floor(Math.random() * state.titles.length)
    intro.titleIndex = next
    render()
  }
  const msg = h('p', { class: 'error', hidden: true })
  const confirm = h('button', { class: 'btn' }, "That's them!")
  confirm.addEventListener('click', async () => {
    if (busy) return
    busy = true
    confirm.disabled = true
    confirm.textContent = 'Writing it on the bowl…'
    const res = await window.kitty.setName(fullName())
    busy = false
    if (res.ok) {
      state = res.state
      render()
    } else {
      confirm.disabled = false
      confirm.textContent = "That's them!"
      msg.textContent = res.error
      msg.hidden = false
    }
  })

  const title = options[intro.titleIndex]
  app.append(
    h(
      'div',
      { class: 'naming' },
      h('h1', {}, `${intro.name}…`),
      h('p', {}, 'And what are they like?'),
      h(
        'div',
        { class: 'carousel', role: 'group', 'aria-label': 'Choose a title' },
        h('button', { class: 'carousel__arrow', 'aria-label': 'Previous title', onclick: () => move(-1) }, '‹'),
        h(
          'p',
          { class: 'carousel__name', 'aria-live': 'polite' },
          intro.name,
          title ? h('span', { class: 'carousel__title' }, ` ${title}`) : h('span', { class: 'carousel__plain' }, ' (no title)')
        ),
        h('button', { class: 'carousel__arrow', 'aria-label': 'Next title', onclick: () => move(1) }, '›')
      ),
      h(
        'div',
        { class: 'carousel__dots', 'aria-hidden': 'true' },
        options.map((_, i) => h('span', { class: i === intro.titleIndex ? 'is-on' : '' }))
      ),
      h('button', { class: 'btn btn--ghost', onclick: surprise }, '🎲 Surprise me'),
      confirm,
      msg,
      h(
        'button',
        {
          class: 'link-btn',
          onclick: () => {
            intro.step = 'meet'
            render()
          },
        },
        '← change the name'
      )
    )
  )
}

// ---- the strawberry cake, after an update ----
const cake = { bites: 0, finished: false }
const BITES = 8
// Bite marks eaten in from the right, ending in the middle.
const BITE_SPOTS = [
  [176, 92, 26],
  [170, 132, 26],
  [150, 70, 28],
  [140, 116, 30],
  [118, 86, 32],
  [100, 128, 32],
  [76, 82, 36],
  [58, 120, 40],
]

function cakeSvg() {
  const holes = BITE_SPOTS.slice(0, cake.bites)
    .map(([x, y, r]) => `<circle cx="${x}" cy="${y}" r="${r}" fill="#000"/>`)
    .join('')
  return `<svg class="cake" viewBox="0 0 220 180" aria-hidden="true">
    <defs><mask id="bites"><rect width="220" height="180" fill="#fff"/>${holes}</mask></defs>
    <ellipse cx="110" cy="160" rx="96" ry="14" fill="#fffaf2" stroke="#e3cba5" stroke-width="2"/>
    ${cake.bites >= BITES ? '' : `<g mask="url(#bites)">
      <rect x="34" y="96" width="152" height="54" rx="8" fill="#f6dfb5" stroke="#4a2f23" stroke-width="2"/>
      <rect x="35" y="90" width="150" height="11" fill="#f7a8bd"/>
      <rect x="34" y="62" width="152" height="32" rx="8" fill="#f6dfb5" stroke="#4a2f23" stroke-width="2"/>
      <path d="M34,70 Q34,56 48,56 L172,56 Q186,56 186,70 L186,74 Q178,86 170,74 Q160,90 150,74 Q140,84 128,74 Q116,92 104,74 Q92,84 80,74 Q68,90 58,74 Q48,84 34,76 Z" fill="#fff7f2" stroke="#e9c9c0" stroke-width="2"/>
      ${[70, 110, 150]
        .map(
          (x) => `<g transform="translate(${x} 48)">
          <path d="M-12,-4 Q0,-12 12,-4 Q12,12 0,20 Q-12,12 -12,-4 Z" fill="#e2384b" stroke="#a51f31" stroke-width="1.5"/>
          <path d="M-8,-7 L0,-2 L8,-7 L4,-12 L0,-8 L-4,-12 Z" fill="#4c9a3f"/>
          <circle cx="-4" cy="3" r="1" fill="#ffd66b"/><circle cx="4" cy="2" r="1" fill="#ffd66b"/><circle cx="0" cy="10" r="1" fill="#ffd66b"/>
        </g>`
        )
        .join('')}
    </g>`}
    ${cake.bites >= BITES ? '<g fill="#f6dfb5"><circle cx="80" cy="152" r="3"/><circle cx="96" cy="156" r="2"/><circle cx="128" cy="150" r="2.5"/><circle cx="140" cy="157" r="2"/><circle cx="112" cy="154" r="1.8" fill="#e2384b"/></g>' : ''}
  </svg>`
}

function crumbs(x, y) {
  const layer = document.querySelector('.cake-stage')
  if (!layer) return
  const nom = h('span', { class: 'nom' }, ['nom', 'nom nom', 'mmm', 'om nom'][cake.bites % 4])
  nom.style.left = `${x}px`
  nom.style.top = `${y - 10}px`
  layer.append(nom)
  setTimeout(() => nom.remove(), 900)
  for (let i = 0; i < 7; i++) {
    const c = h('span', { class: 'crumb' })
    const angle = (Math.PI * 2 * i) / 7 + Math.random()
    c.style.left = `${x}px`
    c.style.top = `${y}px`
    c.style.setProperty('--dx', `${Math.cos(angle) * (20 + Math.random() * 25)}px`)
    c.style.setProperty('--dy', `${Math.sin(angle) * 20 + 30}px`)
    layer.append(c)
    setTimeout(() => c.remove(), 800)
  }
}

function renderCake() {
  const eaten = cake.bites >= BITES
  const stage = h('button', {
    class: 'cake-stage',
    'aria-label': eaten ? 'The cake is all gone' : `Strawberry cake, take a bite (${BITES - cake.bites} bites left)`,
    disabled: eaten,
    onclick: (e) => {
      if (cake.bites >= BITES) return
      const r = stage.getBoundingClientRect()
      cake.bites += 1
      stage.querySelector('svg').replaceWith(svgNode(cakeSvg()))
      stage.setAttribute('aria-label', `Strawberry cake, take a bite (${BITES - cake.bites} bites left)`)
      // A keyboard "click" has no position: crumble from the middle.
      const keyboard = e.detail === 0
      crumbs(keyboard ? r.width / 2 : e.clientX - r.left, keyboard ? r.height / 2 : e.clientY - r.top)
      if (cake.bites >= BITES) {
        setTimeout(() => {
          playMeow(1)
          render()
        }, 450)
      }
    },
  })
  stage.append(svgNode(cakeSvg()))

  app.append(
    h(
      'div',
      { class: 'naming cake-screen' },
      h('h1', {}, eaten ? 'All gone!' : `${state.name} brought you something`),
      h(
        'p',
        {},
        eaten
          ? ''
          : "There's a new version of the app, and to celebrate, a strawberry cake. Tap it to eat it."
      ),
      stage,
      eaten && h('p', { class: 'bubble bubble--cat bubble--solo' }, 'meeeow!'),
      eaten && h('p', {}, `That's ${state.name} saying thank you.`),
      eaten &&
        h(
          'button',
          {
            class: 'btn',
            onclick: async () => {
              await window.kitty.cakeDone()
              cake.finished = true
              state.showCake = false
              render()
            },
          },
          "You're welcome!"
        )
    )
  )
}

// ---- the everyday panel ----
function renderMain() {
  const s = state
  const progress =
    s.progress == null
      ? null
      : h(
          'div',
          {
            class: 'progress',
            role: 'img',
            'aria-label': `${s.progress} of ${s.perLevel} ticks until ${s.name} gets braver`,
            title: `Every ${s.perLevel} ticked quests, ${s.name} gets a little braver`,
          },
          Array.from({ length: s.perLevel }, (_, i) => {
            const p = svgNode(PAW)
            p.setAttribute('class', `progress__paw ${i < s.progress ? 'is-on' : ''}`)
            return p
          })
        )

  app.append(
    h(
      'header',
      { class: 'top' },
      h('div', { class: 'top__text' }, h('h1', {}, s.name), h('p', { class: 'top__line' }, s.levelLine), progress),
      h('button', { class: 'icon-btn', title: 'Close', 'aria-label': 'Close', onclick: () => window.kitty.hide() }, '×')
    )
  )

  if (s.update) {
    app.append(
      h(
        'section',
        { class: 'gift' },
        h('p', { class: 'gift__title' }, `🎁 ${s.name} wants to bring you something new`),
        h('p', { class: 'gift__text' }, `Version ${s.update.version} is ready. It installs the same way as the first time.`),
        h('button', { class: 'btn', onclick: () => window.kitty.openUrl(s.update.url) }, 'Get it')
      )
    )
  }

  if (s.error || error) {
    app.append(
      h(
        'p',
        { class: 'error' },
        error || s.error,
        ' ',
        h('button', { class: 'link-btn', onclick: refresh }, 'Try again')
      )
    )
  }

  if (s.day) app.append(renderDay(s.day))
  app.append(renderFooter())
}

function renderDay(day) {
  const wrap = h('section', { class: 'chest-wrap' })

  if (day.kind === 'empty') {
    const btn = h('button', { class: 'chest-btn chest-btn--empty', disabled: true, 'aria-label': 'No chest today' })
    btn.append(svgNode(chestSvg(false)))
    wrap.append(btn, h('p', { class: 'chest-hint' }, 'Nothing planned for today yet.'))
    return wrap
  }

  if (day.missed) {
    wrap.append(h('p', { class: 'missed' }, `${day.kind === 'open' ? 'From' : 'Still waiting from'} ${day.prettyDate}`))
  }

  const open = day.kind === 'open'
  const btn = h('button', {
    class: 'chest-btn',
    disabled: open,
    'aria-label': open ? 'Chest, already opened' : `Tap to open ${day.missed ? 'the chest you missed' : "today's chest"}`,
    onclick: open ? null : () => openChest(btn),
  })
  btn.append(svgNode(chestSvg(open)))
  wrap.append(btn, h('p', { class: 'chest-hint' }, open ? 'Opened' : 'Tap the chest'))

  if (!open) return wrap

  const frag = h('div', { style: 'display:contents' }, wrap)
  if (day.quests.length) frag.append(renderQuests(day))
  const bonus = renderBonus(day.bonusType, day.bonus)
  if (bonus) frag.append(bonus)
  return frag
}

function renderQuests(day) {
  const list = h('ul', { class: 'quests' })
  day.quests.forEach((q, i) => {
    if (!q.text) return
    const btn = h('button', {
      class: 'paw-btn',
      'aria-pressed': q.done ? 'true' : 'false',
      'aria-label': q.done ? 'Mark as not done' : 'Mark as done',
      onclick: () => toggle(day.date, i),
    })
    btn.append(svgNode(PAW))
    list.append(h('li', { class: `quest ${q.done ? 'quest--done' : ''}` }, btn, h('span', { class: 'quest__text' }, q.text)))
  })
  return h('section', { class: 'card' }, h('h2', {}, day.missed ? 'Quests' : "Today's quests"), list)
}

function renderBonus(type, bonus) {
  if (!bonus || typeof bonus !== 'object') return null
  if (type === 'instagram' && bonus.url) {
    return h(
      'section',
      { class: 'bonus' },
      h('div', { class: 'bonus__label' }, 'Bonus find'),
      h('p', { style: 'margin:4px 0 6px' }, bonus.caption || 'A little something for you'),
      h('button', { class: 'link-btn', onclick: () => window.kitty.openUrl(bonus.url) }, 'Open on Instagram')
    )
  }
  if (type !== 'recipe') return null
  const details = h('details', { class: 'bonus' }, h('summary', {}, bonus.title || 'A recipe'))
  if (Array.isArray(bonus.ingredients) && bonus.ingredients.length) {
    details.append(h('h3', {}, 'Ingredients'), h('ul', {}, bonus.ingredients.map((x) => h('li', {}, x))))
  }
  if (Array.isArray(bonus.instructions) && bonus.instructions.length) {
    details.append(h('h3', {}, 'Steps'), h('ol', {}, bonus.instructions.map((x) => h('li', {}, x))))
  }
  return h('div', {}, h('div', { class: 'bonus__label' }, 'Bonus recipe'), details)
}

function renderFooter() {
  const sw = (label, checked, onChange) =>
    h(
      'div',
      { class: 'toggle' },
      h('span', {}, label),
      h('button', {
        class: 'switch',
        role: 'switch',
        'aria-checked': checked ? 'true' : 'false',
        'aria-label': label,
        onclick: () => onChange(!checked),
      })
    )
  const save = async (patch) => {
    const r = await window.kitty.setSettings(patch)
    Object.assign(state, r)
    render()
  }
  return h(
    'footer',
    { class: 'foot' },
    sw('Paw prints on the screen', !state.paused, (on) => save({ paused: !on })),
    sw('Meows now and then', state.meows, (on) => save({ meows: on })),
    sw('Start when the Mac starts', state.openAtLogin, (on) => save({ openAtLogin: on })),
    h(
      'div',
      { class: 'foot__row' },
      h('button', { class: 'btn btn--ghost', onclick: () => window.kitty.preview() }, 'Walk by'),
      h('button', { class: 'btn btn--ghost', onclick: () => window.kitty.openWebsite() }, 'Website'),
      h('button', { class: 'btn btn--ghost', onclick: () => window.kitty.quit() }, 'Quit')
    ),
    h(
      'p',
      { class: 'foot__meta' },
      `Version ${state.version} · `,
      h('button', { class: 'link-btn', onclick: checkUpdates }, 'Check for updates'),
      updateNote && h('span', { class: 'foot__note' }, ` ${updateNote}`)
    )
  )
}

// ---------------- actions ----------------

async function refresh() {
  error = null
  state = await window.kitty.getState()
  render()
}

async function checkUpdates() {
  updateNote = 'Looking…'
  render()
  const res = await window.kitty.checkUpdates()
  state = res.state
  updateNote = res.error
    ? "Couldn't check just now."
    : res.update
    ? `${state.name} found version ${res.update.version}!`
    : 'You have the newest version.'
  render()
}

async function openChest(btn) {
  if (busy) return
  busy = true
  btn.querySelector('svg')?.classList.add('chest--open')
  const res = await window.kitty.openChest()
  busy = false
  if (res.ok) state = res.state
  else error = res.error
  render()
}

async function toggle(date, index) {
  const day = state?.day
  if (!day?.quests?.[index]) return
  // Show the tick straight away; the main process saves it in order.
  day.quests[index].done = !day.quests[index].done
  render()
  const res = await window.kitty.toggleQuest(date, index)
  if (res.state) state = res.state
  error = res.ok ? null : res.error
  render()
}

document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape') window.kitty.hide()
})

window.kitty.onRefresh(refresh)
refresh()
