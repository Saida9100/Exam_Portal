import React from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import apiService from '../services/api';

const SharedAdminSidebar = ({ active, onLogout }) => {
  const navigate = useNavigate();
  const location = useLocation();
  const currentUser = apiService.getUser();
  const isSuperAdmin = currentUser?.role === 'super_admin';
  const basePath = isSuperAdmin ? '/superadmin' : '/admin';

  // Determine active from location if not provided
  let activeKey = active;
  if (!activeKey) {
    const path = location.pathname;
    if (path === basePath) activeKey = 'dashboard';
    else if (path.includes('/create')) activeKey = 'create';
    else if (path.includes('/exams')) activeKey = 'exams';
    else if (path.includes('/students')) activeKey = 'students';
    else if (path.includes('/manage-admins')) activeKey = 'manage-admins';
    else if (path.includes('/results')) activeKey = 'results';
    else if (path.includes('/settings')) activeKey = 'settings';
  }

  const menuItems = [
    { key: 'dashboard', label: 'Dashboard', icon: '🏠', path: basePath },
    { key: 'create', label: 'Create Exam', icon: '➕', path: `${basePath}/create` },
    { key: 'exams', label: 'Manage Exams', icon: '📝', path: `${basePath}/exams` },
    ...(isSuperAdmin ? [{ key: 'manage-admins', label: 'Manage Admins', icon: '🛡️', path: `${basePath}/manage-admins` }] : []),
    { key: 'students', label: 'Student Accounts', icon: '👥', path: `${basePath}/students` },
    { key: 'results', label: 'View Results', icon: '📊', path: `${basePath}/results` },
    { key: 'settings', label: 'Settings', icon: '⚙️', path: `${basePath}/settings` },
  ];

  return (
    <div className="sidebar" style={{ width: 260, minWidth: 260, flexShrink: 0, minHeight: '100vh', display: 'flex', flexDirection: 'column' }}>
      <div style={{ padding: '24px 20px', borderBottom: '1px solid rgba(255,255,255,0.1)', textAlign: 'center' }}>
        {isSuperAdmin ? (
          <>
            <h2 style={{ color: '#fff', fontSize: 20, fontWeight: 700, margin: 0, letterSpacing: 1, whiteSpace: 'nowrap' }}>
              Super Admin Panel
            </h2>
            <span style={{ color: '#CE93D8', fontSize: 11 }}>ExamPortal</span>
          </>
        ) : (
          <>
            <h2 style={{ color: '#fff', fontSize: 20, fontWeight: 700, margin: 0, letterSpacing: 1, whiteSpace: 'nowrap' }}>
              Admin Panel
            </h2>
            <span style={{ color: '#CE93D8', fontSize: 11 }}>ExamPortal</span>
          </>
        )}
      </div>

      <div style={{ padding: '16px 0', flex: 1 }}>
        {menuItems.map(item => (
          <div
            key={item.key}
            className={`sidebar-item ${activeKey === item.key ? 'active' : ''}`}
            onClick={() => navigate(item.path)}
            style={{
              display: 'flex', alignItems: 'center', gap: 12,
              padding: '12px 24px', margin: '4px 12px', borderRadius: 10,
              cursor: 'pointer',
              color: activeKey === item.key ? '#fff' : 'rgba(255,255,255,0.7)',
              background: activeKey === item.key ? 'rgba(255,255,255,0.15)' : 'transparent',
              fontWeight: activeKey === item.key ? 600 : 400,
              fontSize: 14, transition: 'all 0.2s ease',
            }}
            onMouseEnter={e => {
              if (activeKey !== item.key) e.currentTarget.style.background = 'rgba(255,255,255,0.08)';
            }}
            onMouseLeave={e => {
              if (activeKey !== item.key) e.currentTarget.style.background = 'transparent';
            }}
          >
            <span style={{ fontSize: 18 }}>{item.icon}</span>
            <span>{item.label}</span>
          </div>
        ))}
      </div>

      <div style={{ padding: '16px 12px', borderTop: '1px solid rgba(255,255,255,0.1)' }}>
        <div
          onClick={() => navigate(`${basePath}/settings`)}
          style={{
            display: 'flex', alignItems: 'center', gap: 12,
            padding: '12px 24px', borderRadius: 10, cursor: 'pointer',
            color: 'rgba(255,255,255,0.7)', fontSize: 14, transition: 'all 0.2s ease',
            marginBottom: 4
          }}
          onMouseEnter={e => e.currentTarget.style.background = 'rgba(255,255,255,0.1)'}
          onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
        >
          <span style={{ fontSize: 18 }}>🔑</span>
          <span>Change Password</span>
        </div>
        <div
          onClick={onLogout || (() => apiService.logout())}
          style={{
            display: 'flex', alignItems: 'center', gap: 12,
            padding: '12px 24px', borderRadius: 10, cursor: 'pointer',
            color: 'rgba(255,255,255,0.7)', fontSize: 14, transition: 'all 0.2s ease',
          }}
          onMouseEnter={e => e.currentTarget.style.background = 'rgba(255,60,60,0.15)'}
          onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
        >
          <span style={{ fontSize: 18 }}>🚪</span>
          <span>Logout</span>
        </div>
      </div>
    </div>
  );
};

export default SharedAdminSidebar;
