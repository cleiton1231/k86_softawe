import { useEffect, useRef, useState } from "react";
import { DeviceProvider } from "../hid/device-context";
import Dashboard from "../pages/Dashboard";
import PlaceholderPage from "../pages/PlaceholderPage";
import ScreenPage from "../pages/Screen";
import { routes, type RouteId } from "./routes";

export default function App() {
  const [routeId, setRouteId] = useState<RouteId>("dashboard");
  const mainRef = useRef<HTMLElement>(null);
  const focusAfterNavigation = useRef(false);
  const activeRoute =
    routes.find((route) => route.id === routeId) ?? routes[0];

  useEffect(() => {
    if (!focusAfterNavigation.current) return;
    focusAfterNavigation.current = false;
    mainRef.current?.focus();
  }, [routeId]);

  return (
    <DeviceProvider>
      <div className="app-shell">
        <a className="skip-link" href="#conteudo">
          Pular para o conteúdo
        </a>

        <aside className="sidebar">
          <div className="brand">
            <span className="brand-mark" aria-hidden="true">
              K86
            </span>
            <div>
              <h1>K86 Studio</h1>
              <p>local-first, sem telemetria</p>
            </div>
          </div>

          <nav className="app-nav" aria-label="Navegação principal">
            <p className="nav-label">Seções</p>
            <ul className="nav-list">
              {routes.map((route, index) => (
                <li key={route.id}>
                  <a
                    className="nav-link"
                    href={`#${route.id}`}
                    aria-current={route.id === routeId ? "page" : undefined}
                    onClick={(event) => {
                      event.preventDefault();
                      focusAfterNavigation.current = true;
                      setRouteId(route.id);
                    }}
                  >
                    <span className="nav-index" aria-hidden="true">
                      {String(index + 1).padStart(2, "0")}
                    </span>
                    <span>{route.label}</span>
                  </a>
                </li>
              ))}
            </ul>
          </nav>

          <div className="sidebar-meta">
            <p>Fase 2 · tela</p>
            <p>GPL-3.0-or-later</p>
          </div>
        </aside>

        <div className="app-body">
          <main
            id="conteudo"
            ref={mainRef}
            className="app-main"
            tabIndex={-1}
          >
            {activeRoute.id === "dashboard" ? (
              <Dashboard />
            ) : activeRoute.id === "screen" ? (
              <ScreenPage onNavigate={setRouteId} />
            ) : (
              <PlaceholderPage
                title={activeRoute.label}
                description={activeRoute.description}
              />
            )}
          </main>

          <footer className="app-footer">
            <p>Configurador independente</p>
            <p>Sem telemetria · GPL-3.0-or-later</p>
          </footer>
        </div>
      </div>
    </DeviceProvider>
  );
}
