// Daily Chest Kitty: a paw in the menu bar that opens today's chest, and
// a see-through layer over the whole screen where the invisible kitty
// leaves paw prints. Everything is saved to the same database as the
// website, so a quest ticked here is ticked there too.

const path = require('path')
const fs = require('fs')
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
  stageFor,
  stageLine,
  cleanName,
} = require('./logic')

const IS_MAC = process.platform === 'darwin'
const TEST = process.env.KITTY_TEST === '1'

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

// Minutes between unprompted walks. Overridable so tests don't wait.
const WALK_MIN_MS = Number(process.env.KITTY_WALK_MIN_MS) || 20 * 60 * 1000
const WALK_MAX_MS = Number(process.env.KITTY_WALK_MAX_MS) || 40 * 60 * 1000

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
  const state = {
    name: store.get('name'),
    paused: store.get('paused'),
    openAtLogin: openAtLogin(),
    today: todayISO(),
    day: null,
    stage: store.get('bestStage'),
    stageLine: '',
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
      state.stage = raiseStage(stageFor(Math.max(0, countDone(rows) - kitty.baselineDone)))
    } else {
      // Not named yet (or renamed from scratch in the database).
      state.name = null
    }
  } catch (err) {
    state.error = err.message || 'Something went wrong.'
  }
  state.stageLine = stageLine(state.stage, state.name)
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

// The kitty only ever gets braver. Returns the stage to show and fires
// the "look who's here" walk the first time a new stage is reached.
function raiseStage(stage) {
  const best = store.get('bestStage') || 0
  if (stage > best) {
    store.set('bestStage', stage)
    setTimeout(() => walk('stageup'), 1200)
    return stage
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

function walk(reason = 'idle') {
  if (!overlay || overlay.isDestroyed() || !overlayReady) return false
  if (store.get('paused') && reason !== 'preview') return false
  lastWalkAt = Date.now()
  overlay.webContents.send('kitty:walk', {
    reason,
    stage: store.get('bestStage') || 0,
    name: store.get('name') || '',
  })
  return true
}

function scheduleWalks() {
  clearTimeout(walkTimer)
  const wait = WALK_MIN_MS + Math.random() * (WALK_MAX_MS - WALK_MIN_MS)
  walkTimer = setTimeout(() => {
    walk('idle')
    scheduleWalks()
  }, wait)
}

// ---- the panel under the menu bar paw ----
function createPanel() {
  panel = new BrowserWindow({
    width: 360,
    height: 560,
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
}

function contextMenu() {
  return Menu.buildFromTemplate([
    { label: "Open today's chest", click: showPanel },
    {
      label: 'Pause paw prints',
      type: 'checkbox',
      checked: !!store.get('paused'),
      click: (item) => setPaused(item.checked),
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
        const state = await readState()
        // A ticked quest gets a little walk as a thank-you.
        if (nowDone) walk('tick')
        return { ok: true, state }
      } catch (err) {
        return { ok: false, error: err.message, state: await readState() }
      }
    })
  )

  ipcMain.handle('settings:set', (_e, { paused, openAtLogin: wantLogin }) => {
    if (typeof paused === 'boolean') setPaused(paused)
    if (typeof wantLogin === 'boolean' && IS_MAC) setOpenAtLogin(wantLogin)
    return { paused: store.get('paused'), openAtLogin: openAtLogin() }
  })

  ipcMain.handle('app:website', () => shell.openExternal(WEBSITE))
  // Only real web links leave the app (an Instagram bonus, say).
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

  setupIpc()
  createOverlay()
  createPanel()
  if (!TEST) createTray()

  screen.on('display-metrics-changed', fitOverlay)
  screen.on('display-added', fitOverlay)
  screen.on('display-removed', fitOverlay)

  // Coming back to the Mac: the kitty noticed.
  powerMonitor.on('unlock-screen', () => {
    if (Date.now() - lastWalkAt > 10 * 60 * 1000) setTimeout(() => walk('idle'), 4000)
  })

  const state = await readState()
  const whenPanelLoaded = (fn) =>
    panel.webContents.isLoading() ? panel.webContents.once('did-finish-load', fn) : fn()
  // First run: there's no name yet, so open the panel and ask for one.
  if (!state.name) whenPanelLoaded(showPanel)
  else setTimeout(() => walk('idle'), 8000)
  if (TEST) whenPanelLoaded(() => panel.show())
  scheduleWalks()

  // Keep the stage and the day fresh without anyone opening the panel.
  setInterval(() => readState().catch(() => {}), 10 * 60 * 1000)
})

app.on('window-all-closed', (e) => e.preventDefault())

// Hooks for the automated tests only.
if (TEST) {
  globalThis.kittyTest = {
    walk: (reason) => walk(reason),
    readState: () => readState(),
    lastState: () => lastState,
    store: () => ({ bestStage: store.get('bestStage'), name: store.get('name'), paused: store.get('paused') }),
  }
}
