import React from 'react'
import ReactDOM from 'react-dom/client'
import './styles/index.css'

// App is imported dynamically so that a module-level throw anywhere in its
// dependency tree (a misconfigured client, say) is catchable. A static
// import would blow up before any of this code runs, leaving a white page
// with the reason only in the console.
async function boot() {
  const root = document.getElementById('root')
  try {
    const [{ default: App }, { default: ErrorBoundary }] = await Promise.all([
      import('./App.jsx'),
      import('./components/ErrorBoundary.jsx'),
    ])
    ReactDOM.createRoot(root).render(
      <React.StrictMode>
        <ErrorBoundary>
          <App />
        </ErrorBoundary>
      </React.StrictMode>
    )
  } catch (err) {
    console.error('The Daily Chest failed to start:', err)
    root.innerHTML = `
      <div class="fatal">
        <h1>The Daily Chest couldn't start</h1>
        <p>Something went wrong before the app could load.</p>
        <pre></pre>
      </div>`
    root.querySelector('pre').textContent = String(err?.message ?? err)
  }
}

boot()
