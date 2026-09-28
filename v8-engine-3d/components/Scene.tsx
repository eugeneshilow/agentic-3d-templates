'use client'

import { useEffect, useRef, type CSSProperties } from 'react'

import { initEngineScene } from '@/lib/engine-scene'

// The full-screen V8 scene. This component renders the overlay (panels,
// buttons, charts, loader, help dialog) as plain markup; lib/engine-scene.ts
// builds the three.js engine into #viewport and wires the overlay by id.
// The engine is created once on mount and fully disposed on unmount.

const PAUSE_ICON = (
  <svg viewBox="0 0 16 16">
    <path d="M5 3v10M11 3v10" strokeWidth="2.5" />
  </svg>
)

const phaseVar = (color: string) => ({ '--c': color }) as CSSProperties

export function EngineScene() {
  const rootRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const root = rootRef.current
    if (!root) return
    return initEngineScene(root)
  }, [])

  return (
    <div ref={rootRef}>
      <div
        id="viewport"
        role="img"
        aria-label="Interactive 3D model of a V8 engine. Rotate with a mouse or one finger, zoom with the wheel or two fingers."
      />
      <div className="vignette" />
      <div id="labels">
        <svg id="leader-lines" aria-hidden="true" />
      </div>
      <div className="ui">
        <header className="topbar">
          <div className="brand">
            <svg className="brand-symbol" viewBox="0 0 30 30" fill="none" aria-hidden="true">
              <path d="M2 6 10 23h5L7 6H2Zm13 0 8 17 7-17h-5l-2 7-3-7h-5Z" fill="currentColor" />
            </svg>
            MECHANICS
            <span className="brand-divider" />
            <span className="brand-sub">INTERACTIVE ATLAS</span>
          </div>
          <div className="top-actions">
            <span className="live">
              <i />
              LIVE MODEL
            </span>
            <button
              className="auto-button"
              id="auto"
              aria-pressed="false"
              title="Cycles through the views and orbits the camera"
            >
              <svg viewBox="0 0 20 20">
                <path d="m8 5 7 5-7 5Z" />
                <path d="M3 5v10" />
              </svg>
              Auto tour
            </button>
            <button
              className="icon-button fullscreen-button"
              id="fullscreen"
              aria-label="Full screen"
            >
              <svg viewBox="0 0 20 20">
                <path d="M7 3H3v4m10-4h4v4M3 13v4h4m10-4v4h-4" />
              </svg>
            </button>
            <button className="icon-button" id="help" aria-label="About the model and controls">
              <svg viewBox="0 0 20 20">
                <circle cx="10" cy="10" r="7" />
                <path d="M8 7.5c0-2 4-2 4 .3 0 1.5-2 1.2-2 3M10 14h.01" />
              </svg>
            </button>
          </div>
        </header>
        <section className="hero">
          <div className="eyebrow">Anatomy of power</div>
          <h1>
            V<span>8</span>
          </h1>
          <p>
            Eight cylinders. One rhythm.
            <br />
            <span>Engineering in every motion.</span>
          </p>
          <div className="specs">
            <div>
              <b>90°</b>
              <small>BANK ANGLE</small>
            </div>
            <div>
              <b>
                5.0<span style={{ fontSize: 10, color: '#737b84' }}> L</span>
              </b>
              <small>DISPLACEMENT</small>
            </div>
            <div>
              <b>16</b>
              <small>VALVES</small>
            </div>
          </div>
        </section>
        <div className="model-index">01 / ENGINE SERIES</div>
        <nav className="mode-nav panel" aria-label="Display mode">
          <button data-mode="assembled" aria-pressed="false">
            <svg viewBox="0 0 16 16">
              <path d="m8 1 6 3.5v7L8 15l-6-3.5v-7Z M2 4.5 8 8l6-3.5M8 8v7" />
            </svg>
            Assembled
          </button>
          <button data-mode="cutaway" className="active" aria-pressed="true">
            <svg viewBox="0 0 16 16">
              <path d="m8 1 6 3.5v7L8 15l-6-3.5v-7ZM8 1v14M2 4.5 8 8" />
            </svg>
            Cutaway
          </button>
          <button data-mode="exploded" aria-pressed="false">
            <svg viewBox="0 0 16 16">
              <path d="m8 1 6 3-6 3-6-3Zm-6 7 6 3 6-3M2 12l6 3 6-3" />
            </svg>
            Exploded view
          </button>
          <button data-mode="single" aria-pressed="false">
            <svg viewBox="0 0 16 16">
              <ellipse cx="8" cy="3" rx="4" ry="2" />
              <path d="M4 3v8c0 3 8 3 8 0V3M8 13v3" />
            </svg>
            Single cylinder
          </button>
        </nav>
        <details className="telemetry panel" id="telemetry" open>
          <summary>
            <span>
              Telemetry <span style={{ color: '#616b75' }}>/</span>{' '}
              <span id="mobile-phase">Cylinder 01</span>
            </span>
          </summary>
          <div className="telemetry-content">
            <div className="phase-overview">
              <div className="panel-heading">
                <span className="eyebrow">Working cycle</span>
                <span className="micro-badge" id="cylinder-badge">
                  CYL. 01
                </span>
              </div>
              <div className="phase-title">
                <i className="phase-dot" id="phase-dot" />
                <span id="phase-name">Power</span>
              </div>
              <p className="phase-description" id="phase-description">
                Combustion energy turns
                <br />
                into crankshaft rotation.
              </p>
              <div className="cycle-strip" aria-label="Jump to a stroke">
                <button data-phase="0" style={phaseVar('var(--blue)')} aria-label="Intake" />
                <button data-phase="1" style={phaseVar('var(--yellow)')} aria-label="Compression" />
                <button
                  data-phase="2"
                  style={phaseVar('var(--red)')}
                  className="active"
                  aria-label="Power"
                />
                <button data-phase="3" style={phaseVar('var(--gray)')} aria-label="Exhaust" />
              </div>
            </div>
            <div className="chart-block">
              <div className="chart-title">
                <span>Cylinder pressure</span>
                <b id="pressure-value">— bar</b>
              </div>
              <canvas
                className="chart"
                id="pressure-chart"
                aria-label="Modeled pressure across the working cycle, from 0 to 720 degrees"
              />
              <div className="axis">
                <span>0°</span>
                <span>180°</span>
                <span>360°</span>
                <span>540°</span>
                <span>720°</span>
              </div>
            </div>
            <div className="chart-block">
              <div className="chart-title">
                <span>Valve timing</span>
                <b id="angle-value">360°</b>
              </div>
              <canvas
                className="chart"
                id="valve-chart"
                aria-label="Intake and exhaust valve lift across the working cycle"
              />
              <div className="chart-legend">
                <span>
                  <i style={phaseVar('var(--blue)')} />
                  Intake
                </span>
                <span>
                  <i style={phaseVar('var(--red)')} />
                  Exhaust
                </span>
              </div>
            </div>
            <div className="telemetry-footer">
              <span>
                CYCLE <b>720°</b>
              </span>
              <span>
                TIMING <b>2 : 1</b>
              </span>
              <span>PRESSURE MODEL</span>
            </div>
          </div>
        </details>
        <div className="view-note">
          <div className="eyebrow" id="mode-index">
            02 / INSIDE
          </div>
          <strong id="mode-title">Everything hidden under the metal.</strong>
          <span id="mode-description">
            A lengthwise cut through the block reveals
            <br />
            the engine kinematics.
          </span>
        </div>
        <div className="orbit-hint">
          <svg viewBox="0 0 20 20">
            <rect x="6" y="2" width="8" height="13" rx="4" />
            <path d="M10 3v4M3 10l-2 2 2 2m14-4 2 2-2 2M7 18h6" />
          </svg>
          <span>Rotate · Zoom · Explore</span>
        </div>
        <nav className="camera-row panel" aria-label="Camera">
          <span className="camera-icon">
            <svg
              width="15"
              height="15"
              viewBox="0 0 20 20"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.2"
            >
              <path d="M3 5h4l1-2h4l1 2h4v11H3Z" />
              <circle cx="10" cy="10" r="3" />
            </svg>
          </span>
          <button data-camera="general" className="active" aria-pressed="true">
            Overview
          </button>
          <button data-camera="front" aria-pressed="false">
            Front
          </button>
          <button data-camera="side" aria-pressed="false">
            Side
          </button>
          <button data-camera="top" aria-pressed="false">
            Top
          </button>
          <button data-camera="cylinder" aria-pressed="false">
            Cylinder
          </button>
        </nav>
        <div className="orientation" aria-hidden="true">
          <svg viewBox="0 0 50 50">
            <path d="m24 29 17 8M24 29V9M24 29 7 39" fill="none" stroke="#697780" />
            <circle cx="24" cy="29" r="2" fill="#aaa" />
            <text x="42" y="43" fill="#bc705e" fontSize="8">
              X
            </text>
            <text x="22" y="7" fill="#9ba58e" fontSize="8">
              Y
            </text>
            <text x="0" y="45" fill="#7f9db3" fontSize="8">
              Z
            </text>
          </svg>
        </div>
        <section className="dashboard panel" aria-label="Engine controls">
          <div className="rpm-control">
            <div>
              <div className="rpm-label">ENGINE SPEED</div>
              <div className="rpm-number">
                <span id="rpm-value">1,200</span>
                <small>rpm</small>
              </div>
            </div>
            <div className="slider-wrap">
              <input
                id="rpm"
                type="range"
                min="700"
                max="6000"
                step="50"
                defaultValue="1200"
                aria-label="Engine speed"
                aria-valuetext="1200 revolutions per minute"
              />
              <div className="rpm-scale">
                <span>700</span>
                <span>3,000</span>
                <span>6,000</span>
              </div>
            </div>
          </div>
          <div className="firing">
            <div className="firing-title">
              <span className="eyebrow">Firing order</span>
              <small>STEP 90°</small>
            </div>
            <div className="firing-order" id="firing-order" aria-label="Select a cylinder" />
          </div>
          <div className="playback">
            <button className="play-button" id="play" aria-label="Pause the engine">
              {PAUSE_ICON}
            </button>
            <button className="time-button" id="time-scale" title="Change the time scale">
              <span className="time-prefix">Time </span>
              <span id="time-value">×0.05</span>
              <small id="time-caption">Slowed down 20×</small>
            </button>
            <button
              className="step-button"
              id="step"
              aria-label="Next firing, then pause"
              title="Next firing"
            >
              <svg viewBox="0 0 16 16">
                <path d="m3 3 7 5-7 5Zm10 0v10" />
              </svg>
            </button>
          </div>
        </section>
        <footer className="footer">
          <span>
            V8 / CROSS-PLANE <span className="desktop-only">· PROCEDURAL MODEL</span> ·{' '}
            <a className="credit" href="https://vibecoding.tech" target="_blank" rel="noopener">
              made with AI agents · vibecoding.tech
            </a>
          </span>
          <span>
            <span className="shortcuts">
              <kbd>SPACE</kbd>pause <kbd>R</kbd>reset
            </span>
            <span id="fps">WEBGL</span>
          </span>
        </footer>
      </div>
      <div className="notice" id="notice" role="status" />
      <div className="loading" id="loading">
        <div className="loading-mark">
          V<span>8</span>
        </div>
        <div className="loading-line" id="loading-line" />
        <div id="loading-text">ASSEMBLING THE ENGINE</div>
        <button className="retry-button" id="retry">
          Retry
        </button>
      </div>
      <dialog id="help-dialog">
        <button className="close" id="close-help" aria-label="Close">
          ×
        </button>
        <div className="eyebrow" style={{ marginBottom: 12 }}>
          Mechanics / 01
        </div>
        <h2>Explore it from the inside.</h2>
        <p>
          A procedural teaching model of a V8: a 90° bank angle, a cross-plane crankshaft, one
          camshaft per bank and two valves per cylinder.
        </p>
        <div className="help-row">
          <span>Rotate</span>Mouse / one finger
        </div>
        <div className="help-row">
          <span>Zoom</span>Wheel / two fingers
        </div>
        <div className="help-row">
          <span>Pause / next firing</span>Space / →
        </div>
        <div className="help-row">
          <span>Reset camera and speed</span>R
        </div>
        <p>
          Click a cylinder number to follow its cycle. The colored bars under the stroke name stop
          the engine on that stroke.
        </p>
        <p>
          By default time runs 20× slower. The time switch cycles through ×0.01, ×0.05, ×0.2 and ×1.
          Pressure is an illustrative model, not test data. The exploded view widens the gaps so you
          can study the parts.
        </p>
        <p style={{ fontSize: 10, marginBottom: 0 }}>
          Geometry and lighting are generated in code with{' '}
          <a href="https://threejs.org/" target="_blank" rel="noopener noreferrer">
            three.js
          </a>
          . No models, no textures.
        </p>
      </dialog>
      <noscript>
        <div
          style={{
            position: 'fixed',
            inset: 0,
            zIndex: 99,
            background: '#101113',
            display: 'grid',
            placeItems: 'center',
            color: '#eee',
          }}
        >
          Turn on JavaScript to use the interactive model.
        </div>
      </noscript>
    </div>
  )
}
