// Daily Chest Kitty: a paw in the menu bar that opens today's chest, and
// a see-through layer over the whole screen where the invisible kitty
// leaves paw prints. Everything is saved to the same database as the
// website, so a quest ticked here is ticked there too.

const path = require('path')
const fs = require('fs')
const { execFile } = require('child_process')
const {
  app,
  BrowserWindow,
  Tray,
  Menu,
  ipcMain,
  nativeImage,
  screen,
  shell,
  powerMonitor,
} = require('electron')
const { makeDb } = require('./db')
const { makeStore } = require('./store')
const {
  todayISO,
  localDayBounds,
  prettyDate,
  normalizeQuests,
  countDone,
  levelFor,
  progressFor,
  levelLine,
  TITLES,
  QUESTS_PER_LEVEL,
  cleanName,
  compareVersions,
} = require('./logic')

const IS_MAC = process.platform === 'darwin'
const TEST = process.env.KITTY_TEST === '1'
const env = (name, fallback) => Number(process.env[name]) || fallback
const MIN = 60 * 1000
const HOUR = 60 * MIN

// ---- config ----
function loadConfig() {
  const file = process.env.KITTY_CONFIG || path.join(__dirname, 'config.json')
  try {
    return JSON.parse(fs.readFileSync(file, 'utf8'))
  } catch {
    return {}
  }
}
const config = loadConfig()
const db = makeDb({ url: config.supabaseUrl, key: config.anonKey })
const WEBSITE = config.websiteUrl || 'https://miomaomiomaolalalalala.vercel.app'
// New versions are published as GitHub Releases of the project.
const UPDATE_URL =
  process.env.KITTY_UPDATE_URL ||
  config.updateUrl ||
  'https://api.github.com/repos/feedddosever/miomaomiomaolalalalala/releases/latest'

// Timings, all overridable so the tests don't have to wait for real.
const WALK_MIN_MS = env('KITTY_WALK_MIN_MS', 20 * MIN)
const WALK_MAX_MS = env('KITTY_WALK_MAX_MS', 40 * MIN)
const MEOW_AFTER_MS = env('KITTY_MEOW_AFTER_MS', 5 * MIN) // same app this long
const MEOW_GAP_MS = env('KITTY_MEOW_GAP_MS', 30 * MIN) // then quiet for at least this long
const MEOW_CHANCE = env('KITTY_MEOW_CHANCE', 0.5) // per check, once both have passed
const FRONT_POLL_MS = env('KITTY_POLL_MS', 30 * 1000)
const UPDATE_EVERY_MS = env('KITTY_UPDATE_EVERY_MS', 24 * HOUR)

// Never meow over a call.
const CALL_APPS = /zoom|teams|facetime|webex|skype|discord|whereby|gotomeeting|bluejeans|meet/i

if (!TEST && !app.requestSingleInstanceLock()) app.quit()

let tray = null
let panel = null
let overlay = null
let overlayReady = false
let store = null
let walkTimer = null
let lastWalkAt = 0
let lastState = null
let lastBlurHide = 0

// ---- state ----
// One read of everything the panel shows. Network errors come back as
// `error` alongside whatever is cached, never as a thrown exception.
async function readState() {
  const version = app.getVersion()
  const update = store.get('update')
  const state = {
    name: store.get('name'),
    titles: TITLES,
    paused: store.get('paused'),
    meows: store.get('meows'),
    openAtLogin: openAtLogin(),
    version,
    update: update && compareVersions(update.version, version) > 0 ? update : null,
    showCake: !!store.get('cakePending'),
    today: todayISO(),
    day: null,
    level: store.get('bestLevel') || 0,
    progress: null,
    perLevel: QUESTS_PER_LEVEL,
    levelLine: '',
    error: null,
  }
  try {
    const [kitty, day, rows] = await Promise.all([
      db.getKitty(),
      db.loadDay({ today: state.today, bounds: localDayBounds() }),
      db.allTreasureQuests(),
    ])
    state.day = shapeDay(day, state.today)
    if (kitty) {
      state.name = kitty.name
      if (kitty.name !== store.get('name')) store.set('name', kitty.name)
      // Only ticks made since the kitty was named make it braver.
      const bravery = Math.max(0, countDone(rows) - kitty.baselineDone)
      state.level = raiseLevel(levelFor(bravery))
      state.progress = progressFor(bravery, state.level)
    } else {
      // Not named yet (or renamed from scratch in the database).
      state.name = null
    }
  } catch (err) {
    state.error = err.message || 'Something went wrong.'
  }
  state.levelLine = levelLine(state.level, state.name)
  lastState = state
  return state
}

function shapeDay(day, today) {
  if (day.kind === 'empty') return { kind: 'empty' }
  const row = day.kind === 'open' ? day.treasure : day.planned
  const date = row.date
  return {
    kind: day.kind, // 'open' | 'closed'
    date,
    missed: date !== today,
    prettyDate: prettyDate(date),
    // Quests stay hidden until the chest is opened, same as the website.
    quests: day.kind === 'open' ? normalizeQuests(row.quests) : [],
    bonusType: row.bonus_type,
    bonus: day.kind === 'open' ? row.bonus : null,
  }
}

// The kitty only ever gets braver. Returns the level to show, and the
// first time a new level is reached, the kitty arrives in its new form.
function raiseLevel(level) {
  const best = store.get('bestLevel') || 0
  if (level > best) {
    store.set('bestLevel', level)
    setTimeout(() => walk('levelup'), 1200)
    return level
  }
  return best
}

// ---- the paw-print layer ----
function createOverlay() {
  const { bounds } = screen.getPrimaryDisplay()
  overlay = new BrowserWindow({
    ...bounds,
    transparent: true,
    frame: false,
    hasShadow: false,
    resizable: false,
    movable: false,
    focusable: false,
    skipTaskbar: true,
    alwaysOnTop: true,
    show: false,
    enableLargerThanScreen: true,
    backgroundColor: '#00000000',
    ...(IS_MAC ? { type: 'panel' } : {}),
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
      backgroundThrottling: false,
      autoplayPolicy: 'no-user-gesture-required',
    },
  })
  // Clicks, scrolls and drags all go straight through to whatever is
  // underneath. The prints are never in the way.
  overlay.setIgnoreMouseEvents(true)
  overlay.setAlwaysOnTop(true, 'screen-saver')
  overlay.setVisibleOnAllWorkspaces(true, { visibleOnFullScreen: true })
  overlay.loadFile(path.join(__dirname, 'overlay.html'))
  overlay.once('ready-to-show', () => overlay.showInactive())
}

function fitOverlay() {
  if (!overlay || overlay.isDestroyed()) return
  overlay.setBounds(screen.getPrimaryDisplay().bounds)
}

function toOverlay(channel, extra = {}) {
  if (!overlay || overlay.isDestroyed() || !overlayReady) return false
  overlay.webContents.send(channel, {
    level: store.get('bestLevel') || 0,
    name: store.get('name') || '',
    ...extra,
  })
  return true
}

function walk(reason = 'idle') {
  // Pausing stops the walks, but never a level-up, a gift or the preview.
  const always = ['preview', 'levelup', 'gift', 'intro']
  if (store.get('paused') && !always.includes(reason)) return false
  const sent = toOverlay('kitty:walk', { reason })
  if (sent) lastWalkAt = Date.now()
  return sent
}

function scheduleWalks() {
  clearTimeout(walkTimer)
  const wait = WALK_MIN_MS + Math.random() * (WALK_MAX_MS - WALK_MIN_MS)
  walkTimer = setTimeout(() => {
    walk('idle')
    scheduleWalks()
  }, wait)
}

// ---- meows after a while in the same app ----
// Asks macOS which app is in front, using the built-in `lsappinfo`. That
// needs no special permission, and nothing is stored or sent anywhere:
// only "same app as 30 seconds ago, or not" matters.
let testFrontApp = null
function frontApp() {
  if (TEST) return Promise.resolve(testFrontApp)
  if (!IS_MAC) return Promise.resolve(null)
  return new Promise((resolve) => {
    execFile('/usr/bin/lsappinfo', ['front'], { timeout: 3000 }, (err, asn) => {
      const id = String(asn || '').trim()
      if (err || !id) return resolve(null)
      execFile('/usr/bin/lsappinfo', ['info', id], { timeout: 3000 }, (err2, info) => {
        const text = String(info || '')
        const bundle = text.match(/bundleID="([^"]+)"/i)?.[1]
        const name = text.match(/^"([^"]+)"/m)?.[1]
        resolve([bundle, name].filter(Boolean).join(' ') || id)
      })
    })
  })
}

let inFront = { app: null, since: 0 }
let lastMeowAt = 0
let testIdleSeconds = 0

async function watchFrontApp() {
  const now = Date.now()
  const current = await frontApp()
  if (!current) return
  if (current !== inFront.app) inFront = { app: current, since: now }
  // Away from the keyboard: the five minutes start again on return.
  const idle = TEST ? testIdleSeconds : powerMonitor.getSystemIdleTime()
  if (idle > 60) {
    inFront.since = now
    return
  }
  if (!store.get('meows') || CALL_APPS.test(current)) return
  if (now - inFront.since < MEOW_AFTER_MS) return
  if (now - lastMeowAt < MEOW_GAP_MS) return
  if (Math.random() > MEOW_CHANCE) return
  lastMeowAt = now
  inFront.since = now
  toOverlay('kitty:meow')
}

// ---- the daily update check ----
async function checkForUpdate({ force = false } = {}) {
  if (!force && Date.now() - (store.get('lastUpdateCheck') || 0) < UPDATE_EVERY_MS) {
    return { checked: false }
  }
  try {
    const res = await fetch(UPDATE_URL, {
      headers: { Accept: 'application/vnd.github+json', 'User-Agent': 'DailyChestKitty' },
      signal: AbortSignal.timeout(15000),
    })
    // Only a real answer counts as today's check; offline, it tries again
    // with the next hourly tick.
    if (res.status === 404) {
      store.set('lastUpdateCheck', Date.now())
      return { checked: true, update: null } // nothing published yet
    }
    if (!res.ok) return { checked: false, error: `GitHub said ${res.status}` }
    const release = await res.json()
    store.set('lastUpdateCheck', Date.now())
    const version = String(release.tag_name || '').replace(/^v/i, '')
    if (!version || release.draft || release.prerelease) return { checked: true, update: null }
    if (compareVersions(version, app.getVersion()) <= 0) {
      store.set('update', null)
      return { checked: true, update: null }
    }
    const update = { version, url: release.html_url || WEBSITE }
    store.set('update', update)
    showUpdateBadge()
    // Tell the person once per version, with a walk across the screen.
    if (store.get('announcedUpdate') !== version) {
      store.set('announcedUpdate', version)
      setTimeout(() => walk('gift'), 1500)
    }
    return { checked: true, update }
  } catch (err) {
    return { checked: false, error: err.message }
  }
}

function showUpdateBadge() {
  const update = store.get('update')
  const waiting = update && compareVersions(update.version, app.getVersion()) > 0
  if (tray && IS_MAC) tray.setTitle(waiting ? ' 🎁' : '')
}

// ---- the panel under the menu bar paw ----
function createPanel() {
  panel = new BrowserWindow({
    width: 360,
    height: 580,
    show: false,
    frame: false,
    resizable: false,
    movable: false,
    minimizable: false,
    maximizable: false,
    fullscreenable: false,
    skipTaskbar: true,
    alwaysOnTop: true,
    backgroundColor: '#fbf2e4',
    ...(IS_MAC ? { roundedCorners: true } : {}),
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
      autoplayPolicy: 'no-user-gesture-required',
    },
  })
  panel.loadFile(path.join(__dirname, 'panel.html'))
  panel.on('blur', () => {
    if (!TEST && !panel.webContents.isDevToolsOpened()) {
      panel.hide()
      lastBlurHide = Date.now()
    }
  })
}

function positionPanel() {
  const { width } = panel.getBounds()
  const area = screen.getPrimaryDisplay().workArea
  let x = area.x + area.width - width - 12
  let y = area.y + 6
  if (tray) {
    const t = tray.getBounds()
    if (t.width > 0) {
      x = Math.round(t.x + t.width / 2 - width / 2)
      y = Math.round(t.y + t.height + 4)
    }
  }
  x = Math.max(area.x + 8, Math.min(x, area.x + area.width - width - 8))
  panel.setPosition(x, Math.max(y, area.y + 4), false)
}

function showPanel() {
  positionPanel()
  // A menu bar app isn't the active app until asked; without this the
  // panel opens but typing the kitty's name goes nowhere.
  if (IS_MAC) app.focus({ steal: true })
  panel.show()
  panel.focus()
  panel.webContents.send('kitty:refresh')
}

function togglePanel() {
  if (panel.isVisible()) return panel.hide()
  // Clicking the paw while the panel is open first blurs it (which hides
  // it), then arrives here: don't pop it straight back open.
  if (Date.now() - lastBlurHide < 300) return
  showPanel()
}

function setOpenAtLogin(on) {
  try {
    app.setLoginItemSettings({ openAtLogin: !!on })
  } catch {
    /* some macOS setups refuse; the switch just stays as it was */
  }
}

function openAtLogin() {
  try {
    return IS_MAC ? app.getLoginItemSettings().openAtLogin : false
  } catch {
    return false
  }
}

// ---- menu bar paw ----
function createTray() {
  const icon = nativeImage.createFromPath(path.join(__dirname, 'assets', 'trayTemplate.png'))
  if (IS_MAC) icon.setTemplateImage(true)
  tray = new Tray(icon)
  tray.setToolTip('Daily Chest Kitty')
  tray.on('click', togglePanel)
  tray.on('right-click', () => tray.popUpContextMenu(contextMenu()))
  showUpdateBadge()
}

function contextMenu() {
  return Menu.buildFromTemplate([
    { label: "Open today's chest", click: showPanel },
    {
      label: 'Paw prints',
      type: 'checkbox',
      checked: !store.get('paused'),
      click: (item) => setPaused(!item.checked),
    },
    {
      label: 'Meows',
      type: 'checkbox',
      checked: !!store.get('meows'),
      click: (item) => store.set('meows', item.checked),
    },
    { label: 'Open the website', click: () => shell.openExternal(WEBSITE) },
    { type: 'separator' },
    { label: 'Quit', click: () => app.quit() },
  ])
}

function setPaused(paused) {
  store.set('paused', !!paused)
  if (!paused) scheduleWalks()
}

// ---- talking to the windows ----
// A tick and the next tick go one after another, never at the same time,
// so two quick taps can't race each other to the database.
let writeQueue = Promise.resolve()
function queued(fn) {
  const run = writeQueue.then(fn, fn)
  writeQueue = run.catch(() => {})
  return run
}

function setupIpc() {
  ipcMain.handle('state:get', () => readState())

  ipcMain.handle('kitty:setName', (_e, raw) =>
    queued(async () => {
      const name = cleanName(raw)
      if (!name) return { ok: false, error: 'They need at least one letter.' }
      try {
        // The first time, remember how many quests were already ticked, so
        // the kitty starts shy and grows braver from here on.
        const existing = await db.getKitty()
        const baseline = existing ? undefined : countDone(await db.allTreasureQuests())
        const saved = await db.setKitty(name, baseline)
        store.set('name', saved.name)
        setTimeout(() => walk('hello'), 900)
        return { ok: true, state: await readState() }
      } catch (err) {
        return { ok: false, error: err.message }
      }
    })
  )

  ipcMain.handle('chest:open', () =>
    queued(async () => {
      try {
        const day = await db.loadDay({ today: todayISO(), bounds: localDayBounds() })
        if (day.kind === 'closed') await db.openChest(day.planned)
        return { ok: true, state: await readState() }
      } catch (err) {
        return { ok: false, error: err.message }
      }
    })
  )

  ipcMain.handle('quest:toggle', (_e, { date, index }) =>
    queued(async () => {
      try {
        const row = await db.toggleQuest(date, index)
        const nowDone = normalizeQuests(row.quests)[index]?.done
        const before = store.get('bestLevel') || 0
        const state = await readState()
        // A ticked quest gets a little walk as a thank-you, unless it just
        // made the kitty braver: then the arrival is the thank-you.
        if (nowDone && state.level === before) walk('tick')
        return { ok: true, state }
      } catch (err) {
        return { ok: false, error: err.message, state: await readState() }
      }
    })
  )

  ipcMain.handle('settings:set', (_e, { paused, meows, openAtLogin: wantLogin }) => {
    if (typeof paused === 'boolean') setPaused(paused)
    if (typeof meows === 'boolean') store.set('meows', meows)
    if (typeof wantLogin === 'boolean' && IS_MAC) setOpenAtLogin(wantLogin)
    return { paused: store.get('paused'), meows: store.get('meows'), openAtLogin: openAtLogin() }
  })

  ipcMain.handle('cake:done', () => {
    store.set('cakePending', false)
    return true
  })

  ipcMain.handle('update:check', async () => {
    const res = await checkForUpdate({ force: true })
    return { ...res, state: await readState() }
  })

  ipcMain.handle('app:website', () => shell.openExternal(WEBSITE))
  // Only real web links leave the app (an Instagram bonus, a new version).
  ipcMain.handle('app:openUrl', (_e, url) => {
    if (typeof url === 'string' && /^https:\/\//i.test(url)) return shell.openExternal(url)
    return null
  })
  ipcMain.handle('app:quit', () => app.quit())
  ipcMain.handle('app:hide', () => panel?.hide())
  ipcMain.handle('kitty:preview', () => walk('preview'))

  ipcMain.on('overlay:ready', () => {
    overlayReady = true
  })
}

// ---- start ----
app.whenReady().then(async () => {
  if (IS_MAC) app.dock?.hide()
  store = makeStore(process.env.KITTY_DATA_DIR || app.getPath('userData'))

  // On first run, start with the Mac. They can switch it off in the panel.
  if (IS_MAC && !store.get('openAtLoginSet')) {
    setOpenAtLogin(true)
    store.set('openAtLoginSet', true)
  }

  // Just updated? Then there's a strawberry cake waiting.
  const version = app.getVersion()
  const lastRun = store.get('lastRunVersion')
  if (lastRun && compareVersions(version, lastRun) > 0) store.set('cakePending', true)
  if (lastRun !== version) store.set('lastRunVersion', version)

  setupIpc()
  createOverlay()
  createPanel()
  if (!TEST) createTray()

  screen.on('display-metrics-changed', fitOverlay)
  screen.on('display-added', fitOverlay)
  screen.on('display-removed', fitOverlay)

  // Coming back to the Mac: the kitty noticed.
  powerMonitor.on('unlock-screen', () => {
    if (Date.now() - lastWalkAt > 10 * MIN) setTimeout(() => walk('idle'), 4000)
  })

  const state = await readState()
  const whenPanelLoaded = (fn) =>
    panel.webContents.isLoading() ? panel.webContents.once('did-finish-load', fn) : fn()
  const whenOverlayReady = (fn) => {
    const t = setInterval(() => {
      if (overlayReady) {
        clearInterval(t)
        fn()
      }
    }, 100)
  }
  if (!state.name) {
    // First run: paw prints cross the screen, then the panel opens and
    // the kitty is introduced.
    whenOverlayReady(() => walk('intro'))
    whenPanelLoaded(() => setTimeout(showPanel, TEST ? 0 : 2500))
  } else if (state.showCake) {
    whenPanelLoaded(showPanel)
  } else {
    setTimeout(() => walk('idle'), 8000)
  }
  if (TEST) whenPanelLoaded(() => panel.show())
  scheduleWalks()

  setInterval(() => watchFrontApp().catch(() => {}), FRONT_POLL_MS)
  // The update check runs at most once a day; this just looks hourly
  // whether a day has passed.
  setTimeout(() => checkForUpdate().catch(() => {}), TEST ? 500 : 20 * 1000)
  setInterval(() => checkForUpdate().catch(() => {}), TEST ? 1000 : HOUR)

  // Keep the level and the day fresh without anyone opening the panel.
  setInterval(() => readState().catch(() => {}), 10 * MIN)
})

app.on('window-all-closed', (e) => e.preventDefault())

// Hooks for the automated tests only.
if (TEST) {
  globalThis.kittyTest = {
    walk: (reason) => walk(reason),
    readState: () => readState(),
    lastState: () => lastState,
    store: () => ({
      bestLevel: store.get('bestLevel'),
      name: store.get('name'),
      paused: store.get('paused'),
      meows: store.get('meows'),
      cakePending: store.get('cakePending'),
      update: store.get('update'),
      lastRunVersion: store.get('lastRunVersion'),
    }),
    setFrontApp: (id) => {
      testFrontApp = id
    },
    setIdle: (s) => {
      testIdleSeconds = s
    },
    watchFrontApp: () => watchFrontApp(),
  }
}
