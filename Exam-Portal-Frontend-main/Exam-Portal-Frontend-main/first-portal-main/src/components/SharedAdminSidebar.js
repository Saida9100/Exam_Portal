import React from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import apiService from '../services/api';

const SharedAdminSidebar = ({ active, onLogout }) => {
  const navigate = useNavigate();
  const location = useLocation();
  const currentUser = apiService.getUser();
  const isSuperAdmin = currentUser?.role === 'super_admin';
  const basePath = isSuperAdmin ? '/superadmin' : '/admin';

  let activeKey = active;
  if (!activeKey) {
    const path = location.pathname;
    if (path === basePath) activeKey = 'dashboard';
    else if (path.includes('/deletion-requests')) activeKey = 'deletion-requests';
    else if (path.includes('/detected-students')) activeKey = 'detected-students';
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
    ...(isSuperAdmin ? [
      { key: 'deletion-requests', label: 'Deletion Requests', icon: '🔔', path: `${basePath}/deletion-requests` },
      { key: 'detected-students', label: 'Detected Students', icon: '🚨', path: `${basePath}/detected-students` },
    ] : [
      { key: 'detected-students', label: 'Detected Students', icon: '🚨', path: `${basePath}/detected-students` },
    ]),
    { key: 'settings', label: 'Settings', icon: '⚙️', path: `${basePath}/settings` },
  ];

  const initial = currentUser?.name?.charAt(0)?.toUpperCase() || currentUser?.email?.charAt(0)?.toUpperCase() || 'A';

  return (
    <aside className="sidebar">
      <div className="sb-brand">
        <div className="sb-logo">EP</div>
        <div className="sb-brand-text">
          {isSuperAdmin ? 'Super Admin' : 'Admin Panel'}
          <small>ExamPortal</small>
        </div>
      </div>

      <div className="sb-section">Workspace</div>
      <nav style={{ display: 'grid', gap: 4 }}>
        {menuItems.map((item) => (
          <button
            type="button"
            key={item.key}
            className={`sb-link ${activeKey === item.key ? 'active' : ''}`}
            onClick={() => navigate(item.path)}
          >
            <span className="sb-icon">{item.icon}</span>
            <span>{item.label}</span>
          </button>
        ))}
      </nav>

      <div className="sb-footer">
        <div className="sb-user">
          <div className="avatar">{initial}</div>
          <div style={{ minWidth: 0 }}>
            <div style={{ color: '#fff', fontWeight: 700, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {currentUser?.name || (isSuperAdmin ? 'Super Admin' : 'Admin')}
            </div>
            <div style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {currentUser?.email || ''}
            </div>
          </div>
        </div>

        <button type="button" className="sb-action" onClick={() => navigate(`${basePath}/settings`)}>
          <span>🔑</span>
          <span>Change Password</span>
        </button>
        <button type="button" className="sb-action danger" onClick={onLogout || (() => apiService.logout())}>
          <span>🚪</span>
          <span>Logout</span>
        </button>
      </div>
    </aside>
  );
};

export default SharedAdminSidebar;
