// src/components/ProtectedRoute.js
import React from 'react';
import { Navigate } from 'react-router-dom';
import apiService from '../services/api';

const ProtectedRoute = ({ children, allowedRoles }) => {
  const isAuthenticated = apiService.isAuthenticated();
  const user = apiService.getUser();
  const userRole = user?.role;

  console.log('🔐 ProtectedRoute Check:');
  console.log('  - isAuthenticated:', isAuthenticated);
  console.log('  - userRole:', userRole);
  console.log('  - allowedRoles:', allowedRoles);

  // NOT AUTHENTICATED
  if (!isAuthenticated || !user) {
    console.log('❌ Not authenticated - redirecting to /login');
    return <Navigate to="/login" replace />;
  }

  // CHECK ROLE-BASED ACCESS
  if (allowedRoles && allowedRoles.length > 0) {
    if (!allowedRoles.includes(userRole)) {
      console.log('❌ Role not allowed');
      
      if (userRole === 'admin' || userRole === 'super_admin') {
        return <Navigate to="/admin" replace />;
      } else if (userRole === 'student') {
        return <Navigate to="/dashboard" replace />;
      } else {
        return <Navigate to="/login" replace />;
      }
    }
  }

  console.log('✅ Access granted');
  return children;
};

export default ProtectedRoute;
