// Tiny settings file in the app's own folder
// (~/Library/Application Support/Daily Chest Kitty/kitty.json on a Mac).
// Holds things that belong to this Mac only: the cached name for when
// the internet is down, how brave the kitty has ever been, and switches.

const fs = require('fs')
const path = require('path')

const DEFAULTS = {
  name: null, // cached copy of the name in the database
  bestStage: 0, // never goes down, even if a quest is unticked
  paused: false, // paw prints switched off from the menu
  openAtLoginSet: false, // whether we've applied the first-run default
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
