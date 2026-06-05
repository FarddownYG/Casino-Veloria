import { Route, Routes } from 'react-router-dom';
import { AgeGate } from '@/components/AgeGate';
import { CookieConsent } from '@/components/CookieConsent';
import { Toaster } from '@/components/ui/toast';
import { Layout } from '@/components/Layout';
import { ProtectedRoute } from '@/components/ProtectedRoute';
import Landing from '@/pages/Landing';
import Login from '@/pages/Login';
import Register from '@/pages/Register';
import Lobby from '@/pages/Lobby';
import Roulette from '@/pages/Roulette';
import Blackjack from '@/pages/Blackjack';
import Poker from '@/pages/Poker';
import Leaderboard from '@/pages/Leaderboard';
import Loans from '@/pages/Loans';
import Referral from '@/pages/Referral';
import Profile from '@/pages/Profile';
import Settings from '@/pages/Settings';
import PrivacyPolicy from '@/pages/PrivacyPolicy';
import NotFound from '@/pages/NotFound';

export default function App() {
  return (
    <AgeGate>
      <Routes>
        <Route path="/" element={<Landing />} />
        <Route path="/login" element={<Login />} />
        <Route path="/register" element={<Register />} />
        <Route path="/privacy" element={<PrivacyPolicy />} />

        <Route
          element={
            <ProtectedRoute>
              <Layout />
            </ProtectedRoute>
          }
        >
          <Route path="/lobby" element={<Lobby />} />
          <Route path="/roulette" element={<Roulette />} />
          <Route path="/blackjack" element={<Blackjack />} />
          <Route path="/poker" element={<Poker />} />
          <Route path="/leaderboard" element={<Leaderboard />} />
          <Route path="/loans" element={<Loans />} />
          <Route path="/referral" element={<Referral />} />
          <Route path="/profile/:username" element={<Profile />} />
          <Route path="/settings" element={<Settings />} />
        </Route>

        <Route path="*" element={<NotFound />} />
      </Routes>

      <CookieConsent />
      <Toaster />
    </AgeGate>
  );
}
