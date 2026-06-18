// src/App.js
// ✅ ADDED: route for /superadmin/deletion-requests
import React, { useState, useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import LoginPage from './components/LoginPage';
import Dashboard from './components/Dashboard';
import ExamPortal from './components/ExamPortal';
import ExamDashboard from './components/ExamDashboard';
import ResultPage from './components/ResultPage';
import CreateExam from './components/CreateExam';
import StudentManagement from './components/StudentManagement';
import {
  AdminDashboard, ManageExams, ViewResults, AdminSettings, ManageAdmins,
} from './components/AdminDashboard';
import SuperAdminDashboard from './components/SuperAdminDashboard';
// ✅ NEW: dedicated deletion-requests page
import DeletionRequestsManager from './components/superadmin/DeletionRequestsManager';
import DetectedStudents from './components/DetectedStudents';
import ProtectedRoute from './components/ProtectedRoute';
import apiService from './services/api';

import './App.css';

function App() {
  const [authChecked, setAuthChecked] = useState(false);

  useEffect(() => {
    const verifyAuth = async () => {
      const token = localStorage.getItem('jwt_token');
      const user = localStorage.getItem('user');
      if (token && user) {
        try {
          const response = await apiService.verifyToken();
          if (response.success && response.user) {
            localStorage.setItem('user', JSON.stringify(response.user));

            let idleTimer;
            const IDLE_TIMEOUT_MS = 20 * 60 * 1000;
            const handleIdleLogout = () => {
              localStorage.removeItem('jwt_token');
              localStorage.removeItem('user');
              window.location.href = '/login';
            };
            const resetIdleTimer = () => {
              clearTimeout(idleTimer);
              idleTimer = setTimeout(handleIdleLogout, IDLE_TIMEOUT_MS);
            };
            const activeEvents = ['mousedown', 'mousemove', 'keydown', 'scroll', 'touchstart'];
            activeEvents.forEach((event) => window.addEventListener(event, resetIdleTimer));
            resetIdleTimer();
            setAuthChecked(true);
            return () => {
              clearTimeout(idleTimer);
              activeEvents.forEach((event) => window.removeEventListener(event, resetIdleTimer));
            };
          }
        } catch (error) {
          localStorage.removeItem('jwt_token');
          localStorage.removeItem('user');
        }
      }
      setAuthChecked(true);
    };
    verifyAuth();
  }, []);

  if (!authChecked) {
    return <div style={{ padding: 40, textAlign: 'center' }}>⏳ Loading…</div>;
  }

  return (
    <Router>
      <Routes>
        <Route path="/login" element={<LoginPage />} />
        <Route path="/dashboard" element={<ProtectedRoute><Dashboard /></ProtectedRoute>} />
        <Route path="/exams" element={<ProtectedRoute><ExamPortal /></ProtectedRoute>} />
        <Route path="/exam/:examId" element={<ProtectedRoute><ExamDashboard /></ProtectedRoute>} />
        <Route path="/results" element={<ProtectedRoute><ResultPage /></ProtectedRoute>} />
        <Route path="/result/:attemptId" element={<ProtectedRoute><ResultPage /></ProtectedRoute>} />
        <Route path="/admin" element={<ProtectedRoute><AdminDashboard /></ProtectedRoute>} />
        <Route path="/admin/exams" element={<ProtectedRoute><ManageExams /></ProtectedRoute>} />
        <Route path="/admin/create" element={<ProtectedRoute><CreateExam /></ProtectedRoute>} />
        <Route path="/admin/results" element={<ProtectedRoute><ViewResults /></ProtectedRoute>} />
        <Route path="/admin/students" element={<ProtectedRoute><StudentManagement /></ProtectedRoute>} />
        <Route path="/admin/settings" element={<ProtectedRoute><AdminSettings /></ProtectedRoute>} />
        <Route path="/superadmin" element={<ProtectedRoute><SuperAdminDashboard /></ProtectedRoute>} />
        <Route path="/superadmin/deletion-requests" element={<ProtectedRoute><DeletionRequestsManager /></ProtectedRoute>} />
        <Route path="/superadmin/manage-admins" element={<ProtectedRoute><ManageAdmins /></ProtectedRoute>} />
        <Route path="/superadmin/students" element={<ProtectedRoute><StudentManagement /></ProtectedRoute>} />
        <Route path="/superadmin/exams" element={<ProtectedRoute><ManageExams /></ProtectedRoute>} />
        <Route path="/superadmin/create" element={<ProtectedRoute><CreateExam /></ProtectedRoute>} />
        <Route path="/superadmin/detected-students" element={<ProtectedRoute><DetectedStudents /></ProtectedRoute>} />
        <Route path="/" element={<Navigate to="/login" replace />} />
        <Route path="*" element={<Navigate to="/login" replace />} />
      </Routes>
    </Router>
  );
}

export default App;
