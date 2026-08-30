import React from 'react';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import ErrorBoundary from './components/ErrorBoundary';
import Layout from './components/Layout';
import Dashboard from './pages/Dashboard';
import Events from './pages/Events';
import ReviewQueue from './pages/ReviewQueue';
import Recovery from './pages/Recovery';
import Audit from './pages/Audit';
import LiveTerminal from './pages/LiveTerminal';
import NotFound from './pages/NotFound';
import { ThemeProvider } from './context/ThemeContext';

function App() {
  return (
    <ErrorBoundary>
      <ThemeProvider>
        <Router>
          <Routes>
            <Route path="/" element={<Layout />}>
              <Route index element={<Dashboard />} />
              <Route path="events" element={<Events />} />
              <Route path="reviews" element={<ReviewQueue />} />
              <Route path="recovery" element={<Recovery />} />
              <Route path="audit" element={<Audit />} />
              <Route path="terminal" element={<LiveTerminal />} />
              <Route path="simulate" element={<LiveTerminal />} />
              <Route path="*" element={<NotFound />} />
            </Route>
          </Routes>
        </Router>
      </ThemeProvider>
    </ErrorBoundary>
  );
}

export default App;

