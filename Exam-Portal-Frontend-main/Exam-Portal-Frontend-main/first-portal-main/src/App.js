// src/App.js
// ✅ FIXED: protected routes now have allowedRoles specified,
//          and super_admin routes are properly accessible

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
import DeletionRequestsManager from './components/DeletionRequestsManager';
import DetectedStudents from './components/DetectedStudents';
import ProtectedRoute from './components/ProtectedRoute';
import apiService from './services/api';

import './App.css';
import './styles/modern-ui.css';

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
            // Setup idle timer
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
    return (
      <div style={{
        height: '100vh',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        background: '#f5f7fb', flexDirection: 'column', gap: 16,
      }}>
        <div style={{ fontSize: 48 }}>⏳</div>
        <div style={{ color: '#555', fontSize: 16 }}>Loading…</div>
      </div>
    );
  }

  // ✅ FIX: home route redirects based on role
  const user = apiService.getUser();
  const role = user?.role;

  return (
    <Router>
      <Routes>
        {/* PUBLIC */}
        <Route path="/login" element={<LoginPage />} />

        {/* STUDENT */}
        <Route path="/dashboard" element={
          <ProtectedRoute allowedRoles={['student']}>
            <Dashboard />
          </ProtectedRoute>
        } />
        <Route path="/exams" element={
          <ProtectedRoute allowedRoles={['student']}>
            <ExamPortal />
          </ProtectedRoute>
        } />
        <Route path="/exam/:examId" element={
          <ProtectedRoute allowedRoles={['student']}>
            <ExamDashboard />
          </ProtectedRoute>
        } />
        <Route path="/results" element={
          <ProtectedRoute allowedRoles={['student']}>
            <ResultPage />
          </ProtectedRoute>
        } />
        <Route path="/result/:attemptId" element={
          <ProtectedRoute allowedRoles={['student']}>
            <ResultPage />
          </ProtectedRoute>
        } />
        {/* ADMIN */}
        <Route path="/admin" element={
          <ProtectedRoute allowedRoles={['admin', 'super_admin']}>
            <AdminDashboard />
          </ProtectedRoute>
        } />
        <Route path="/admin/exams" element={
          <ProtectedRoute allowedRoles={['admin', 'super_admin']}>
            <ManageExams />
          </ProtectedRoute>
        } />
        <Route path="/admin/create" element={
          <ProtectedRoute allowedRoles={['admin', 'super_admin']}>
            <CreateExam />
          </ProtectedRoute>
        } />
        <Route path="/admin/results" element={
          <ProtectedRoute allowedRoles={['admin', 'super_admin']}>
            <ViewResults />
          </ProtectedRoute>
        } />
        <Route path="/admin/students" element={
          <ProtectedRoute allowedRoles={['admin', 'super_admin']}>
            <StudentManagement />
          </ProtectedRoute>
        } />
        <Route path="/admin/settings" element={
          <ProtectedRoute allowedRoles={['admin', 'super_admin']}>
            <AdminSettings />
          </ProtectedRoute>
        } />
        <Route path="/admin/detected-students" element={
          <ProtectedRoute allowedRoles={['admin', 'super_admin']}>
            <DetectedStudents />
          </ProtectedRoute>
        } />

        {/* SUPER ADMIN ONLY */}
        <Route path="/superadmin" element={
          <ProtectedRoute allowedRoles={['super_admin']}>
            <SuperAdminDashboard />
          </ProtectedRoute>
        } />
        <Route path="/superadmin/deletion-requests" element={
          <ProtectedRoute allowedRoles={['super_admin']}>
            <DeletionRequestsManager />
          </ProtectedRoute>
        } />
        <Route path="/superadmin/manage-admins" element={
          <ProtectedRoute allowedRoles={['super_admin']}>
            <ManageAdmins />
          </ProtectedRoute>
        } />
        <Route path="/superadmin/students" element={
          <ProtectedRoute allowedRoles={['super_admin']}>
            <StudentManagement />
          </ProtectedRoute>
        } />
        <Route path="/superadmin/exams" element={
          <ProtectedRoute allowedRoles={['super_admin']}>
            <ManageExams />
          </ProtectedRoute>
        } />
        <Route path="/superadmin/create" element={
          <ProtectedRoute allowedRoles={['super_admin']}>
            <CreateExam />
          </ProtectedRoute>
        } />
        <Route path="/superadmin/detected-students" element={
          <ProtectedRoute allowedRoles={['super_admin']}>
            <DetectedStudents />
          </ProtectedRoute>
        } />

        {/* HOME → role-based redirect */}
        <Route path="/" element={
          role === 'super_admin' ? <Navigate to="/superadmin" replace /> :
          role === 'admin' ? <Navigate to="/admin" replace /> :
          role === 'student' ? <Navigate to="/dashboard" replace /> :
          <Navigate to="/login" replace />
        } />

        {/* 404 → login */}
        <Route path="*" element={<Navigate to="/login" replace />} />
      </Routes>
    </Router>
  );
}

export default App;
