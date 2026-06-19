// src/components/ProtectedRoute.js
// ✅ FIXED: super_admin now redirects to /superadmin (not /admin)

import React from 'react';
import { Navigate } from 'react-router-dom';
import apiService from '../services/api';

const ProtectedRoute = ({ children, allowedRoles }) => {
  const isAuthenticated = apiService.isAuthenticated();
  const user = apiService.getUser();
  const userRole = user?.role;

  // NOT AUTHENTICATED → login
  if (!isAuthenticated || !user) {
    return <Navigate to="/login" replace />;
  }

  // CHECK ROLE-BASED ACCESS (only if allowedRoles is specified)
  if (allowedRoles && allowedRoles.length > 0) {
    if (!allowedRoles.includes(userRole)) {
      // ✅ FIX: route to the correct dashboard based on role
      if (userRole === 'super_admin') {
        return <Navigate to="/superadmin" replace />;
      } else if (userRole === 'admin') {
        return <Navigate to="/admin" replace />;
      } else if (userRole === 'student') {
        return <Navigate to="/dashboard" replace />;
      } else {
        return <Navigate to="/login" replace />;
      }
    }
  }

  return children;
};

export default ProtectedRoute;
