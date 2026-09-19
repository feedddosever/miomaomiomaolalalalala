import { Component } from 'react'

/**
 * Last line of defence: a render error anywhere below this used to leave
 * a blank page with the reason only in the console. Show it instead.
 */
export default class ErrorBoundary extends Component {
  constructor(props) {
    super(props)
    this.state = { error: null }
  }

  static getDerivedStateFromError(error) {
    return { error }
  }

  componentDidCatch(error, info) {
    console.error('The Daily Chest hit an error:', error, info)
  }

  render() {
    if (!this.state.error) return this.props.children
    return (
      <div className="fatal">
        <h1>Something broke</h1>
        <p>The app hit an error it couldn't recover from. Reloading often clears it.</p>
        <pre>{String(this.state.error?.message ?? this.state.error)}</pre>
        <button type="button" className="btn btn--primary" onClick={() => window.location.reload()}>
          Reload
        </button>
      </div>
    )
  }
}
