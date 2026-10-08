// Packages the app for Apple Silicon Macs (darwin-arm64) and zips it,
// together with install instructions. Runs on any OS: it downloads the
// macOS build of Electron and assembles the .app around it. The result
// is unsigned (that needs a paid Apple developer account); the install
// instructions cover the one-time step macOS asks for.
import fs from 'node:fs'
import path from 'node:path'
import { execFileSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'
import { packager } from '@electron/packager'

const here = path.dirname(fileURLToPath(import.meta.url))
const root = path.resolve(here, '..')
const pkg = JSON.parse(fs.readFileSync(path.join(root, 'package.json'), 'utf8'))
const dist = path.join(root, 'dist')
const NAME = 'Daily Chest Kitty'

if (!fs.existsSync(path.join(root, 'src/config.json'))) {
  console.error('src/config.json is missing: run `npm run config` first')
  process.exit(1)
}

fs.rmSync(dist, { recursive: true, force: true })

const [appDir] = await packager({
  dir: root,
  out: dist,
  name: NAME,
  platform: 'darwin',
  arch: 'arm64',
  electronVersion: pkg.devDependencies.electron,
  appVersion: pkg.version,
  appBundleId: 'com.dailychest.kitty',
  appCategoryType: 'public.app-category.lifestyle',
  icon: path.join(root, 'src/assets/icon.icns'),
  asar: true,
  prune: true,
  overwrite: true,
  darwinDarkModeSupport: true,
  // The app has no runtime dependencies: Electron and the packager are
  // build tools only, so node_modules stays out entirely.
  ignore: [/^\/scripts($|\/)/, /^\/dist($|\/)/, /^\/node_modules($|\/)/, /^\/README\.md$/, /^\/INSTALL\.txt$/, /^\/\.gitignore$/, /^\/package-lock\.json$/],
  extendInfo: {
    // A menu bar app: no Dock icon, no app switcher entry.
    LSUIElement: true,
    LSMinimumSystemVersion: '12.0',
    NSHumanReadableCopyright: 'Made with paws & patience',
  },
})

// Ship just the app and the instructions.
const stage = path.join(dist, 'package')
fs.mkdirSync(stage, { recursive: true })
fs.renameSync(path.join(appDir, `${NAME}.app`), path.join(stage, `${NAME}.app`))
fs.copyFileSync(path.join(root, 'INSTALL.txt'), path.join(stage, 'How to install.txt'))

const zipName = `Daily-Chest-Kitty-${pkg.version}-mac-apple-silicon.zip`
// -y keeps symlinks as symlinks: Electron's frameworks depend on them.
execFileSync('zip', ['-qry', path.join(dist, zipName), `${NAME}.app`, 'How to install.txt'], { cwd: stage })
console.log('built', path.join(dist, zipName))
