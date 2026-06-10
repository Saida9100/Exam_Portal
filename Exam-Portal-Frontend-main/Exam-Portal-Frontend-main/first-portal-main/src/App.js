// src/App.js
import React, { useState, useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import LoginPage from './components/LoginPage';
import Dashboard from './components/Dashboard';
import ExamPortal from './components/ExamPortal';
import ExamDashboard from './components/ExamDashboard';
import ResultPage from './components/ResultPage';
import CreateExam from './components/CreateExam';
import StudentManagement from './components/StudentManagement';
import { AdminDashboard, ManageExams, ViewResults, AdminSettings, ManageAdmins } from './components/AdminDashboard';
import SuperAdminDashboard from './components/SuperAdminDashboard';
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
      
      console.log('🔍 App.js - Authentication Check:');
      
      if (token && user) {
        try {
          // SECURE SPOOF CHECK: Validate token cryptographically with backend
          const response = await apiService.verifyToken();
          
          if (response.success && response.user) {
            console.log('✅ Token Verified cryptographically! Role:', response.user.role);
            // Overwrite localStorage with real backend truth (destroys manual spoofing)
            localStorage.setItem('user', JSON.stringify(response.user));
            
            // ---------------------------------------------------------
            // INACTIVITY TRACKER: Expire session after 20 mins of no use
            // ---------------------------------------------------------
            let idleTimer;
            const IDLE_TIMEOUT_MS = 20 * 60 * 1000; 
            const handleIdleLogout = () => {
              console.warn('User inactive for 20 minutes. Session expired.');
              localStorage.removeItem('jwt_token');
              localStorage.removeItem('user');
              window.location.href = '/login';
            };
            const resetIdleTimer = () => {
              clearTimeout(idleTimer);
              idleTimer = setTimeout(handleIdleLogout, IDLE_TIMEOUT_MS);
            };
            const activeEvents = ['mousedown', 'mousemove', 'keydown', 'scroll', 'touchstart'];
            activeEvents.forEach(event => window.addEventListener(event, resetIdleTimer));
            resetIdleTimer();
            // ---------------------------------------------------------
            
            setAuthChecked(true);
            return () => {
              clearTimeout(idleTimer);
              activeEvents.forEach(event => window.removeEventListener(event, resetIdleTimer));
            };
          }
        } catch (error) {
          console.error('❌ Spoofed or Expired Token Detected! Logging out...');
          localStorage.removeItem('jwt_token');
          localStorage.removeItem('user');
        }
      } else {
        console.log('❌ No user authenticated');
      }
      setAuthChecked(true);
    };

    verifyAuth();
  }, []);

  if (!authChecked) {
    return (
      <div style={{
        display: 'flex',
        justifyContent: 'center',
        alignItems: 'center',
        height: '100vh',
        background: 'linear-gradient(135deg, #667eea, #764ba2)',
        color: '#fff'
      }}>
        <div style={{ textAlign: 'center' }}>
          <div style={{ fontSize: 40, marginBottom: 16 }}>⏳</div>
          <div style={{ fontSize: 18, fontWeight: 600 }}>Loading...</div>
        </div>
      </div>
    );
  }

  return (
    <Router>
      <div className="App">
        <Routes>
          {/* PUBLIC ROUTES */}
          <Route path="/login" element={<LoginPage />} />

          {/* STUDENT ROUTES */}
          <Route
            path="/dashboard"
            element={
              <ProtectedRoute allowedRoles={['student']}>
                <Dashboard />
              </ProtectedRoute>
            }
          />
          <Route
            path="/exams"
            element={
              <ProtectedRoute allowedRoles={['student']}>
                <ExamPortal />
              </ProtectedRoute>
            }
          />
          <Route
            path="/exam/:examId"
            element={
              <ProtectedRoute allowedRoles={['student']}>
                <ExamDashboard />
              </ProtectedRoute>
            }
          />
          <Route
            path="/result/:attemptId"
            element={
              <ProtectedRoute allowedRoles={['student']}>
                <ResultPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/results"
            element={
              <ProtectedRoute allowedRoles={['student']}>
                <ResultPage />
              </ProtectedRoute>
            }
          />

          {/* ADMIN ROUTES */}
          <Route
            path="/admin"
            element={
              <ProtectedRoute allowedRoles={['admin']}>
                <AdminDashboard />
              </ProtectedRoute>
            }
          />
          <Route
            path="/admin/create"
            element={
              <ProtectedRoute allowedRoles={['admin']}>
                <CreateExam />
              </ProtectedRoute>
            }
          />
          <Route
            path="/admin/exams"
            element={
              <ProtectedRoute allowedRoles={['admin']}>
                <ManageExams />
              </ProtectedRoute>
            }
          />
          <Route
            path="/admin/results"
            element={
              <ProtectedRoute allowedRoles={['admin']}>
                <ViewResults />
              </ProtectedRoute>
            }
          />
          <Route
            path="/admin/settings"
            element={
              <ProtectedRoute allowedRoles={['admin']}>
                <AdminSettings />
              </ProtectedRoute>
            }
          />
          <Route
            path="/admin/detected-students"
            element={
              <ProtectedRoute allowedRoles={['admin', 'super_admin']}>
                <DetectedStudents />
              </ProtectedRoute>
            }
          />
          <Route
            path="/admin/students"
            element={
              <ProtectedRoute allowedRoles={['admin']}>
                <StudentManagement />
              </ProtectedRoute>
            }
          />

          {/* SUPER ADMIN ROUTES */}
          <Route
            path="/superadmin"
            element={
              <ProtectedRoute allowedRoles={['super_admin']}>
                <SuperAdminDashboard />
              </ProtectedRoute>
            }
          />
          <Route
            path="/superadmin/create"
            element={
              <ProtectedRoute allowedRoles={['super_admin']}>
                <CreateExam />
              </ProtectedRoute>
            }
          />
          <Route
            path="/superadmin/exams"
            element={
              <ProtectedRoute allowedRoles={['super_admin']}>
                <ManageExams />
              </ProtectedRoute>
            }
          />
          <Route
            path="/superadmin/detected-students"
            element={
              <ProtectedRoute allowedRoles={['super_admin']}>
                <DetectedStudents />
              </ProtectedRoute>
            }
          />
          <Route
            path="/superadmin/results"
            element={
              <ProtectedRoute allowedRoles={['super_admin']}>
                <ViewResults />
              </ProtectedRoute>
            }
          />
          <Route
            path="/superadmin/settings"
            element={
              <ProtectedRoute allowedRoles={['super_admin']}>
                <AdminSettings />
              </ProtectedRoute>
            }
          />
          <Route
            path="/superadmin/students"
            element={
              <ProtectedRoute allowedRoles={['super_admin']}>
                <StudentManagement />
              </ProtectedRoute>
            }
          />
          <Route
            path="/superadmin/manage-admins"
            element={
              <ProtectedRoute allowedRoles={['super_admin']}>
                <ManageAdmins />
              </ProtectedRoute>
            }
          />

          {/* DEFAULT HOME ROUTE */}
          <Route
            path="/"
            element={
              (() => {
                // ✅ Check authentication directly from localStorage
                const token = localStorage.getItem('jwt_token');
                const user = localStorage.getItem('user');
                
                if (token && user) {
                  try {
                    const userData = JSON.parse(user);
                    const role = userData?.role;
                    
                    console.log('🏠 Home route - User authenticated, redirecting to:', role);
                    
                    if (role === 'super_admin') {
                      return <Navigate to="/superadmin" replace />;
                    } else if (role === 'admin') {
                      return <Navigate to="/admin" replace />;
                    } else if (role === 'student') {
                      return <Navigate to="/dashboard" replace />;
                    }
                  } catch (e) {
                    console.error('Error parsing user data:', e);
                  }
                }
                
                console.log('🏠 Home route - No user, redirecting to login');
                return <Navigate to="/login" replace />;
              })()
            }
          />

          {/* 404 ROUTE */}
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </div>
    </Router>
  );
}

export default App;
