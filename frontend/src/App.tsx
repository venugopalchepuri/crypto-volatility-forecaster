import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom';
import { AppShell } from './components/layout/AppShell';
import { SystemProvider } from './context/SystemContext';
import { BacktestPage } from './pages/BacktestPage';
import { DataExplorerPage } from './pages/DataExplorerPage';
import { ForecastPage } from './pages/ForecastPage';
import { MarketPage } from './pages/MarketPage';
import { ModelsPage } from './pages/ModelsPage';
import { OverviewPage } from './pages/OverviewPage';
import { SentimentPage } from './pages/SentimentPage';
import { SystemPage } from './pages/SystemPage';

export function App() {
  return (
    <SystemProvider>
      <BrowserRouter>
        <AppShell>
          <Routes>
            <Route path="/" element={<OverviewPage />} />
            <Route path="/market" element={<MarketPage />} />
            <Route path="/forecast" element={<ForecastPage />} />
            <Route path="/sentiment" element={<SentimentPage />} />
            <Route path="/models" element={<ModelsPage />} />
            <Route path="/backtest" element={<BacktestPage />} />
            <Route path="/data" element={<DataExplorerPage />} />
            <Route path="/system" element={<SystemPage />} />
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </AppShell>
      </BrowserRouter>
    </SystemProvider>
  );
}

export default App;
