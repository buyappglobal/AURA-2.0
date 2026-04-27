import { useEffect } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { doc, getDocFromServer } from 'firebase/firestore';
import { db, handleFirestoreError, OperationType } from './firebase';
import DisplayRotativa from './components/DisplayRotativa';
import AdminDashboard from './components/AdminDashboard';
import Login from './components/Login';
import ErrorBoundary from './components/ErrorBoundary';

import AuraSoundscape from './components/AuraSoundscape';
import SuperAdmin from './components/SuperAdmin';
import Changelog from './components/Changelog';
import AuraAgent from './components/AuraAgent';
import HubResolver from './components/HubResolver';

export default function App() {
  useEffect(() => {
    async function testConnection() {
      const testPath = 'test/connection';
      try {
        await getDocFromServer(doc(db, testPath));
      } catch (error) {
        if(error instanceof Error && error.message.includes('the client is offline')) {
          console.error("Please check your Firebase configuration. ");
        } else {
          handleFirestoreError(error, OperationType.GET, testPath);
        }
      }
    }
    testConnection();
  }, []);

  return (
    <ErrorBoundary>
      <BrowserRouter>
        <Routes>
          {/* Web Original (Home) */}
          <Route path="/" element={<AuraSoundscape />} />
          
          {/* Display Rotativa (Independiente) */}
          <Route path="/view" element={<AuraSoundscape />} />
          
          {/* Admin Routes */}
          <Route path="/admin" element={<AdminDashboard />} />
          <Route path="/admin/login" element={<Login />} />
          <Route path="/admin/super" element={<SuperAdmin />} />
          <Route path="/admin/changelog" element={<Changelog />} />

          {/* Hub Slugs */}
          <Route path="/hub/:slug" element={<HubResolver />} />
          <Route path="/:slug" element={<HubResolver />} />
          
          {/* Fallback */}
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </BrowserRouter>
    </ErrorBoundary>
  );
}
