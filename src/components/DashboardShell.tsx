// App shell: white-label header with tenant switcher, a collapsible icon-rail
// left nav, and the Q1-Q3 filters.
//   Desktop (>=900px): the sidebar is always present and collapses in place to
//     an icon-only rail; its toggle lives inside the sidebar.
//   Mobile (<900px): the sidebar is an off-canvas drawer (hidden by default),
//     opened from the header hamburger; the filters move to a floating control
//     so the header carries only Tenant + Export.

import { NavLink } from "react-router-dom";
import {
  useEffect,
  useRef,
  useState,
  type ComponentType,
  type ReactNode,
} from "react";
import { FilterBar, MobileFilters } from "./FilterBar";
import { useApp } from "@/state/AppContext";
import { dataSource } from "@/data/repository";
import { DEEP_DIVE_PAGES } from "@/config/defensiveDesign";
import { cn } from "@/lib/cn";

const DESKTOP_QUERY = "(min-width: 900px)";

/* ---- Nav icons ------------------------------------------------------------ */
function Icon({ children }: { children: ReactNode }) {
  return (
    <svg
      width="20"
      height="20"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.9}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
      className="shrink-0"
    >
      {children}
    </svg>
  );
}
const IconPanel = () => (
  <Icon>
    <rect x="3" y="3" width="18" height="18" rx="2" />
    <line x1="9" y1="3" x2="9" y2="21" />
  </Icon>
);
const IconMenu = () => (
  <Icon>
    <line x1="3" y1="6" x2="21" y2="6" />
    <line x1="3" y1="12" x2="21" y2="12" />
    <line x1="3" y1="18" x2="21" y2="18" />
  </Icon>
);
const IconGrid = () => (
  <Icon>
    <rect x="3" y="3" width="7" height="7" rx="1" />
    <rect x="14" y="3" width="7" height="7" rx="1" />
    <rect x="14" y="14" width="7" height="7" rx="1" />
    <rect x="3" y="14" width="7" height="7" rx="1" />
  </Icon>
);
const IconBuilding = () => (
  <Icon>
    <path d="M3 21h18" />
    <path d="M5 21V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2v16" />
    <path d="M9 8h1M9 12h1M9 16h1M14 8h1M14 12h1M14 16h1" />
  </Icon>
);
const IconChat = () => (
  <Icon>
    <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
  </Icon>
);
const IconTable = () => (
  <Icon>
    <rect x="3" y="3" width="18" height="18" rx="2" />
    <line x1="3" y1="9" x2="21" y2="9" />
    <line x1="3" y1="15" x2="21" y2="15" />
    <line x1="9" y1="3" x2="9" y2="21" />
  </Icon>
);

const SLUG_ICON: Record<string, ComponentType> = {
  construction: IconBuilding,
  "build-to-rent": IconBuilding,
  "build-to-sell": IconBuilding,
};

interface NavEntry {
  to: string;
  label: string;
  icon: ComponentType;
  end?: boolean;
}

// Nav model — sections mirror the sidebar groups.
const NAV_SECTIONS: { title: string; items: NavEntry[] }[] = [
  {
    title: "Overview",
    items: [{ to: "/", end: true, label: "Portfolio Metrics", icon: IconGrid }],
  },
  {
    title: "In-Depth View",
    items: [
      ...DEEP_DIVE_PAGES.map((p) => ({
        to: `/feed/${p.slug}`,
        label: p.title,
        icon: SLUG_ICON[p.slug] ?? IconBuilding,
      })),
      { to: "/qualitative", label: "Qualitative Feedback", icon: IconChat },
    ],
  },
  {
    title: "Raw Data",
    items: [{ to: "/raw", label: "Full Survey Data", icon: IconTable }],
  },
];

function NavItem({
  entry,
  showLabels,
  onNav,
}: {
  entry: NavEntry;
  showLabels: boolean;
  onNav: () => void;
}) {
  const IconC = entry.icon;
  return (
    <NavLink
      to={entry.to}
      end={entry.end}
      onClick={onNav}
      title={entry.label}
      className={({ isActive }) =>
        cn(
          "flex items-center rounded-md text-sm font-medium transition-colors",
          showLabels ? "gap-3 px-3 py-2" : "h-10 w-full justify-center",
          isActive
            ? "bg-brand text-brand-fg"
            : "text-muted hover:bg-canvas hover:text-ink"
        )
      }
    >
      <IconC />
      {showLabels && <span className="truncate">{entry.label}</span>}
    </NavLink>
  );
}

export function DashboardShell({ children }: { children: ReactNode }) {
  const { tenant, tenants, setTenantId } = useApp();

  // Layout mode + sidebar state. On desktop sidebarOpen = expanded vs icon-rail
  // (always visible); on mobile it = drawer open vs hidden. Crossing 900px
  // resets it (expanded on desktop, closed on mobile).
  const [isDesktop, setIsDesktop] = useState(() =>
    typeof window !== "undefined" ? window.matchMedia(DESKTOP_QUERY).matches : true
  );
  const [sidebarOpen, setSidebarOpen] = useState(isDesktop);
  useEffect(() => {
    const mq = window.matchMedia(DESKTOP_QUERY);
    const handler = () => {
      setIsDesktop(mq.matches);
      setSidebarOpen(mq.matches);
    };
    mq.addEventListener("change", handler);
    return () => mq.removeEventListener("change", handler);
  }, []);

  // Labels show when the desktop sidebar is expanded, or always in the mobile
  // drawer (a collapsed rail makes no sense on a phone).
  const showLabels = isDesktop ? sidebarOpen : true;
  const closeOnMobileNav = () => {
    if (!isDesktop) setSidebarOpen(false);
  };

  // Demo placeholder (investor-pitch trigger): the Export button is visually
  // active but gated — clicking raises a governance toast instead of exporting.
  const [toastVisible, setToastVisible] = useState(false);
  const toastTimer = useRef<ReturnType<typeof setTimeout>>();
  const showLockedToast = () => {
    setToastVisible(true);
    clearTimeout(toastTimer.current);
    toastTimer.current = setTimeout(() => setToastVisible(false), 3500);
  };
  useEffect(() => () => clearTimeout(toastTimer.current), []);

  return (
    <div className="flex min-h-screen">
      {/* Backdrop (mobile drawer) */}
      {!isDesktop && sidebarOpen && (
        <div
          className="fixed inset-0 z-30 bg-black/40"
          onClick={() => setSidebarOpen(false)}
          aria-hidden
        />
      )}

      {/* Sidebar — collapsible rail on desktop, off-canvas drawer on mobile */}
      <aside
        className={cn(
          "z-40 shrink-0 border-r border-line bg-surface py-4 transition-all duration-200",
          isDesktop
            ? sidebarOpen
              ? "w-60 px-3"
              : "w-16 px-2"
            : cn(
                "fixed inset-y-0 left-0 w-60 overflow-y-auto px-3",
                sidebarOpen ? "translate-x-0 shadow-xl" : "-translate-x-full"
              )
        )}
      >
        {/* Sidebar header: brand + collapse toggle */}
        <div
          className={cn(
            "flex items-start",
            showLabels ? "justify-between px-2" : "justify-center"
          )}
        >
          {showLabels && (
            <div className="min-w-0">
              {/* Phase-2 platform name placeholder (styling/logo TBD by others) */}
              <p className="text-xl font-bold text-ink">SOSC_int</p>
              <p className="mt-1 text-xs font-semibold uppercase tracking-wider text-muted">
                Portfolio Monitoring
              </p>
              <p className="mt-0.5 truncate text-lg font-semibold text-brand">
                {tenant?.branding?.logoText ?? tenant?.name ?? "Platform"}
              </p>
            </div>
          )}
          <button
            onClick={() => setSidebarOpen((o) => !o)}
            aria-label={sidebarOpen ? "Collapse sidebar" : "Expand sidebar"}
            title={sidebarOpen ? "Collapse sidebar" : "Expand sidebar"}
            className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-md text-muted hover:bg-canvas hover:text-ink"
          >
            <IconPanel />
          </button>
        </div>

        <nav className="mt-5 space-y-1">
          {NAV_SECTIONS.map((section, si) => (
            <div key={section.title} className={cn(si > 0 && "pt-3")}>
              {showLabels ? (
                <p className="px-3 pb-1 text-[11px] font-semibold uppercase text-muted/70">
                  {section.title}
                </p>
              ) : (
                si > 0 && <div className="mx-2 mb-1 border-t border-line/70" />
              )}
              <div className="space-y-1">
                {section.items.map((entry) => (
                  <NavItem
                    key={entry.to}
                    entry={entry}
                    showLabels={showLabels}
                    onNav={closeOnMobileNav}
                  />
                ))}
              </div>
            </div>
          ))}
          {/* KPI Engine / Configuration hidden for now (client request). The
              /engine route still exists, so it can be re-exposed by restoring
              a nav entry — nothing was removed from the engine itself. */}
        </nav>
      </aside>

      {/* Main */}
      <div className="flex min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-20 border-b border-line bg-surface/90 backdrop-blur">
          <div className="flex flex-wrap items-center justify-between gap-3 px-4 py-3 md:px-6">
            <div className="flex min-w-0 items-center gap-2 md:gap-3">
              {/* Mobile-only hamburger to open the drawer (desktop toggles from
                  inside the sidebar). */}
              {!isDesktop && (
                <button
                  onClick={() => setSidebarOpen((o) => !o)}
                  aria-label="Open sidebar"
                  className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-md border border-line text-muted hover:bg-canvas hover:text-ink"
                >
                  <IconMenu />
                </button>
              )}
              <label className="flex min-w-0 items-center text-xs font-medium text-muted">
                <span className="hidden sm:inline">Tenant</span>
                <select
                  value={tenant?.id ?? ""}
                  onChange={(e) => setTenantId(e.target.value)}
                  className="ml-0 h-9 min-w-0 max-w-[10rem] rounded-md border border-line bg-surface px-2 text-sm font-medium text-ink focus:outline-none focus:ring-2 focus:ring-brand/40 sm:ml-2"
                >
                  {tenants.map((t) => (
                    <option key={t.id} value={t.id}>
                      {t.name}
                    </option>
                  ))}
                </select>
              </label>
              {isDesktop && <DataSourceBadge />}
            </div>
            {/* Q1-Q3 dropdowns (desktop) + Export, bottom-aligned so the button
                sits on the dropdown baseline. On mobile the dropdowns move to
                the floating filter control. */}
            <div className="flex flex-wrap items-end justify-end gap-3">
              {isDesktop && <FilterBar />}
              {/* Global export — demo placeholder, gated until Phase 2 */}
              <button
                onClick={showLockedToast}
                title="Download Report"
                className="inline-flex h-9 items-center gap-1.5 rounded-md bg-brand px-3 text-sm font-medium text-brand-fg shadow-sm hover:opacity-90"
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                  <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                  <polyline points="7 10 12 15 17 10" />
                  <line x1="12" y1="15" x2="12" y2="3" />
                </svg>
                Export PDF
              </button>
            </div>
          </div>
        </header>

        <main className="flex-1 px-4 py-6 md:px-6">{children}</main>
      </div>

      {/* Floating filter control (narrow screens only) */}
      {!isDesktop && <MobileFilters />}

      {/* Corner governance toast */}
      <div
        aria-live="polite"
        className={cn(
          "fixed bottom-5 right-5 z-50 transition-all duration-300",
          toastVisible
            ? "translate-y-0 opacity-100"
            : "pointer-events-none translate-y-3 opacity-0"
        )}
      >
        <div className="flex items-center gap-2.5 rounded-lg border border-line bg-ink px-4 py-3 text-sm font-medium text-surface shadow-lg">
          <span aria-hidden>🔒</span>
          Feature locked for Phase 2 Production Launch
        </div>
      </div>
    </div>
  );
}

function DataSourceBadge() {
  const live = dataSource === "supabase";
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium",
        live ? "bg-green/10 text-green" : "bg-amber/10 text-amber"
      )}
      title={
        live
          ? "Connected to Supabase (RLS-protected Stream A)"
          : "Running on built-in seed data — set VITE_SUPABASE_URL to go live"
      }
    >
      <span
        className={cn("h-2 w-2 rounded-full", live ? "bg-green" : "bg-amber")}
      />
      {live ? "Live" : "Seed data"}
    </span>
  );
}
