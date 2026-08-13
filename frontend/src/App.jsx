import { BrowserRouter, Routes, Route } from 'react-router-dom';
import ErrorBoundary from './components/ErrorBoundary';
import Layout from './components/Layout';
import LibraryPage from './pages/LibraryPage';
import RecentPage from './pages/RecentPage';
import SearchPage from './pages/SearchPage';
import ActivityPage from './pages/ActivityPage';
import AnalyticsPage from './pages/AnalyticsPage';
import SettingsPage from './pages/SettingsPage';
import ShortcutsPage from './pages/ShortcutsPage';
import SupportPage from './pages/SupportPage';
import PaperDetailPage from './pages/PaperDetailPage';
import CompareModal from './components/CompareModal';
import { useAppStore } from './store/appStore';
import { applyAppearance } from './appearance';

function Shell() {
  const compareOpen = useAppStore((s) => s.compareOpen);
  return (
    <Layout>
      <Routes>
        <Route path="/" element={<LibraryPage />} />
        <Route path="/recent" element={<RecentPage />} />
        <Route path="/search" element={<SearchPage />} />
        <Route path="/activity" element={<ActivityPage />} />
        <Route path="/analytics" element={<AnalyticsPage />} />
        <Route path="/settings" element={<SettingsPage />} />
        <Route path="/shortcuts" element={<ShortcutsPage />} />
        <Route path="/support" element={<SupportPage />} />
        <Route path="/paper/:id" element={<PaperDetailPage />} />
      </Routes>
      {compareOpen && <CompareModal />}
    </Layout>
  );
}

export default function App() {
  applyAppearance();
  return (
    <ErrorBoundary>
      <BrowserRouter>
        <Shell />
      </BrowserRouter>
    </ErrorBoundary>
  );
}
