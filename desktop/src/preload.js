// The only doorway between the windows and the app. The windows can ask
// for these few things and nothing else: no Node, no files, no network.
const { contextBridge, ipcRenderer } = require('electron')

contextBridge.exposeInMainWorld('kitty', {
  getState: () => ipcRenderer.invoke('state:get'),
  setName: (name) => ipcRenderer.invoke('kitty:setName', name),
  openChest: () => ipcRenderer.invoke('chest:open'),
  toggleQuest: (date, index) => ipcRenderer.invoke('quest:toggle', { date, index }),
  setSettings: (s) => ipcRenderer.invoke('settings:set', s),
  openWebsite: () => ipcRenderer.invoke('app:website'),
  openUrl: (url) => ipcRenderer.invoke('app:openUrl', url),
  quit: () => ipcRenderer.invoke('app:quit'),
  hide: () => ipcRenderer.invoke('app:hide'),
  preview: () => ipcRenderer.invoke('kitty:preview'),
  onRefresh: (fn) => ipcRenderer.on('kitty:refresh', () => fn()),
  // overlay only
  onWalk: (fn) => ipcRenderer.on('kitty:walk', (_e, data) => fn(data)),
  overlayReady: () => ipcRenderer.send('overlay:ready'),
})
