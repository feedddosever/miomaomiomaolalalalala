// The panel under the menu bar paw: name the kitty on the first run, then
// today's chest, its quests and the bonus. All data comes from the main
// process through window.kitty; this file only draws.

const app = document.getElementById('app')
let state = null
let error = null
let busy = false

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

const PAW =
  '<svg viewBox="0 0 32 32" aria-hidden="true"><ellipse cx="16" cy="20" rx="9" ry="7.5"/>' +
  '<ellipse cx="6.5" cy="11.5" rx="3.4" ry="4.2" transform="rotate(-18 6.5 11.5)"/>' +
  '<ellipse cx="14" cy="6.5" rx="3.4" ry="4.4" transform="rotate(-4 14 6.5)"/>' +
  '<ellipse cx="22" cy="6.8" rx="3.4" ry="4.4" transform="rotate(8 22 6.8)"/>' +
  '<ellipse cx="27" cy="12.5" rx="3.2" ry="4" transform="rotate(22 27 12.5)"/></svg>'

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

function svgNode(markup) {
  const t = document.createElement('template')
  t.innerHTML = markup.trim() // static markup only, never data
  return t.content.firstElementChild
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
    return renderNaming()
  }
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

function renderNaming() {
  const input = h('input', {
    type: 'text',
    maxlength: '40',
    placeholder: 'Biscuit? Mochi? Sir Whiskers?',
    'aria-label': "The kitty's name",
    autocomplete: 'off',
    spellcheck: 'false',
  })
  const button = h('button', { class: 'btn', type: 'submit' }, "That's their name")
  const msg = h('p', { class: 'error', hidden: true })

  const form = h(
    'form',
    {
      onsubmit: async (e) => {
        e.preventDefault()
        if (busy) return
        const name = input.value.trim()
        if (!name) {
          msg.textContent = 'They need at least one letter.'
          msg.hidden = false
          return
        }
        busy = true
        button.disabled = true
        button.textContent = 'Writing it on the bowl…'
        const res = await window.kitty.setName(name)
        busy = false
        if (res.ok) {
          state = res.state
          render()
        } else {
          button.disabled = false
          button.textContent = "That's their name"
          msg.textContent = res.error
          msg.hidden = false
        }
      },
    },
    input,
    button,
    msg
  )

  const paw = svgNode(PAW)
  paw.setAttribute('width', '34')
  paw.setAttribute('height', '34')
  paw.style.fill = 'var(--caramel-deep)'

  app.append(
    h(
      'div',
      { class: 'naming' },
      paw,
      h('h1', {}, 'Someone small has moved in'),
      h(
        'p',
        {},
        "They're shy, so for now you'll only see their paw prints on your screen. Every quest you tick makes them a little braver."
      ),
      h('p', {}, 'What would you like to call them?'),
      form
    )
  )
  setTimeout(() => input.focus(), 50)
}

function renderMain() {
  const s = state
  app.append(
    h(
      'header',
      { class: 'top' },
      h('div', { class: 'top__text' }, h('h1', {}, s.name), h('p', { class: 'top__line' }, s.stageLine)),
      h('button', { class: 'icon-btn', title: 'Close', 'aria-label': 'Close', onclick: () => window.kitty.hide() }, '×')
    )
  )

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
  return h(
    'footer',
    { class: 'foot' },
    sw('Paw prints on the screen', !state.paused, async (on) => {
      const r = await window.kitty.setSettings({ paused: !on })
      state.paused = r.paused
      render()
    }),
    sw('Start when the Mac starts', state.openAtLogin, async (on) => {
      const r = await window.kitty.setSettings({ openAtLogin: on })
      state.openAtLogin = r.openAtLogin
      render()
    }),
    h(
      'div',
      { class: 'foot__row' },
      h('button', { class: 'btn btn--ghost', onclick: () => window.kitty.preview() }, `Let ${state.name} walk by`),
      h('button', { class: 'btn btn--ghost', onclick: () => window.kitty.openWebsite() }, 'Website'),
      h('button', { class: 'btn btn--ghost', onclick: () => window.kitty.quit() }, 'Quit')
    )
  )
}

// ---------------- actions ----------------

async function refresh() {
  error = null
  const next = await window.kitty.getState()
  state = next
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
