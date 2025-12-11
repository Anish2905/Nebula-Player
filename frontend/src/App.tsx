import { BrowserRouter, Routes, Route, useNavigate, useLocation } from 'react-router-dom';
import { useEffect, useState } from 'react';
import HomePage from './pages/HomePage';
import DetailPage from './pages/DetailPage';
import PlayerPage from './pages/PlayerPage';
import SearchPage from './pages/SearchPage';
import SettingsPage from './pages/SettingsPage';
import WelcomePage from './pages/WelcomePage';
import ConversionProgress from './components/ConversionProgress';
import Layout from './components/Layout';
import { settingsApi } from './api/client';
import './index.css';

function AuthCheck({ children }: { children: React.ReactNode }) {
  const navigate = useNavigate();
  const location = useLocation();
  const [checking, setChecking] = useState(true);

  useEffect(() => {
    const checkSetup = async () => {
      if (location.pathname === '/welcome') {
        setChecking(false);
        return;
      }

      try {
        const res = await settingsApi.getScanPaths();
        if (res.data.data.length === 0) {
          navigate('/welcome');
        }
      } catch (err) {
        console.error(err);
      } finally {
        setChecking(false);
      }
    };
    checkSetup();
  }, [navigate, location.pathname]);

  if (checking) return null; // Or a loading spinner
  return <>{children}</>;
}

function App() {
  return (
    <BrowserRouter>
      <Layout>
        <AuthCheck>
          <Routes>
            <Route path="/" element={<HomePage />} />
            <Route path="/welcome" element={<WelcomePage />} />
            <Route path="/media/:id" element={<DetailPage />} />
            <Route path="/play/:id" element={<PlayerPage />} />
            <Route path="/search" element={<SearchPage />} />
            <Route path="/settings" element={<SettingsPage />} />
          </Routes>
        </AuthCheck>
        {/* Floating conversion progress panel */}
        <ConversionProgress />
      </Layout>
    </BrowserRouter>
  );
}

export default App;
