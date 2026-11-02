// Tiny settings file in the app's own folder
// (~/Library/Application Support/Daily Chest Kitty/kitty.json on a Mac).
// Holds things that belong to this Mac only: the cached name for when
// the internet is down, how brave the kitty has ever been, switches, and
// what the update check last found.

const fs = require('fs')
const path = require('path')

const DEFAULTS = {
  name: null, // cached copy of the name in the database
  bestLevel: 0, // never goes down, even if a quest is unticked
  paused: false, // paw prints switched off from the panel
  meows: true, // meow now and then after 5 minutes in one app
  openAtLoginSet: false, // whether we've applied the first-run default
  lastRunVersion: null, // to notice that an update was installed
  cakePending: false, // a strawberry cake is waiting to be eaten
  lastUpdateCheck: 0, // ms timestamp of the last daily check
  update: null, // { version, url } when a newer version exists
  announcedUpdate: null, // version the kitty already walked over about
}

function makeStore(dir) {
  const file = path.join(dir, 'kitty.json')
  let data = { ...DEFAULTS }
  try {
    data = { ...DEFAULTS, ...JSON.parse(fs.readFileSync(file, 'utf8')) }
  } catch {
    /* first run, or an unreadable file: start fresh */
  }

  function save() {
    try {
      fs.mkdirSync(dir, { recursive: true })
      fs.writeFileSync(file, JSON.stringify(data, null, 2))
    } catch {
      /* not worth crashing a cat over */
    }
  }

  return {
    get: (k) => data[k],
    set(k, v) {
      data[k] = v
      save()
    },
  }
}

module.exports = { makeStore }
