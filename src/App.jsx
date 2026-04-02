import TallyPanel from './TallyPanel.jsx';

export default function App() {
  return (
    <div className="app">
      <header className="header">
        <div className="header-brand">
          <img
            className="header-logo header-logo--trivision"
            src="/trivision-logo.png"
            alt="Trivision.AI"
          />
          <p className="sub">Tally integration</p>
        </div>
        <div className="toolbar page-switch" role="navigation" aria-label="Main">
          <span className="btn primary tally-only-nav" aria-current="page">
            Tally Services
          </span>
        </div>
      </header>

      <TallyPanel />

      <footer className="footer">
        <p className="footer-copyright">Trivision.AI © 2026</p>
      </footer>
    </div>
  );
}
