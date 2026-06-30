import { Routes, Route, Navigate } from "react-router-dom";
import { AppProvider, useApp } from "./state/AppContext";
import { DashboardShell } from "./components/DashboardShell";
import { OverviewPage } from "./pages/OverviewPage";
import { DeepDivePage } from "./pages/DeepDivePage";
import { QualitativePage } from "./pages/QualitativePage";

function ErrorBanner() {
  const { error } = useApp();
  if (!error) return null;
  return (
    <div className="mb-4 rounded-md border border-red/30 bg-red/10 px-4 py-3 text-sm text-red">
      Data error: {error}
    </div>
  );
}

export default function App() {
  return (
    <AppProvider>
      <DashboardShell>
        <ErrorBanner />
        <Routes>
          <Route path="/" element={<OverviewPage />} />
          <Route path="/feed/:slug" element={<DeepDivePage />} />
          <Route path="/qualitative" element={<QualitativePage />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </DashboardShell>
    </AppProvider>
  );
}
