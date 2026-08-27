import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import App from './App';
import { AuthInitializer } from './features/auth/AuthInitializer';
import { LoginPage } from './routes/LoginPage';
import { SignupPage } from './routes/SignupPage';
import { CheckEmailPage } from './routes/CheckEmailPage';
import { VerifyEmailPage } from './routes/VerifyEmailPage';
import { ProtectedRoute } from './routes/ProtectedRoute';
import { EventsListPage } from './routes/EventsListPage';
import { EventDetailPage } from './routes/EventDetailPage';
import { CreateEventPage } from './routes/CreateEventPage';
import { EditEventPage } from './routes/EditEventPage';
import './index.css';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 1,
      refetchOnWindowFocus: false,
      staleTime: 1000 * 60 * 5,
    },
  },
});

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <AuthInitializer>
          <Routes>
            <Route path="/" element={<App />}>
              <Route index element={<Navigate to="/events" replace />} />
              <Route path="login" element={<LoginPage />} />
              <Route path="signup" element={<SignupPage />} />
              <Route path="check-email" element={<CheckEmailPage />} />
              <Route path="verify-email" element={<VerifyEmailPage />} />
              <Route element={<ProtectedRoute />}>
                <Route path="events" element={<EventsListPage />} />
                <Route path="events/new" element={<CreateEventPage />} />
                <Route path="events/:id" element={<EventDetailPage />} />
                <Route path="events/:id/edit" element={<EditEventPage />} />
              </Route>
              <Route path="*" element={<Navigate to="/events" replace />} />
            </Route>
          </Routes>
        </AuthInitializer>
      </BrowserRouter>
    </QueryClientProvider>
  </React.StrictMode>
);
