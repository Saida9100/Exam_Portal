// src/components/Sidebar.js
import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import apiService from '../services/api';

const Sidebar = ({ active }) => {
  const navigate = useNavigate();
  const user = apiService.getUser();

  const [showPwModal, setShowPwModal] = useState(false);
  const [oldPw, setOldPw] = useState('');
  const [newPw, setNewPw] = useState('');
  const [confirmPw, setConfirmPw] = useState('');
  const [pwLoading, setPwLoading] = useState(false);
  const [pwMsg, setPwMsg] = useState({ type: '', text: '' });

  const handleLogout = () => apiService.logout();

  const handleChangePassword = async (e) => {
    e.preventDefault();
    setPwMsg({ type: '', text: '' });
    if (!oldPw || !newPw || !confirmPw) return setPwMsg({ type: 'error', text: 'All fields are required.' });
    if (newPw !== confirmPw) return setPwMsg({ type: 'error', text: 'New passwords do not match.' });
    if (newPw.length < 6) return setPwMsg({ type: 'error', text: 'Password must be at least 6 characters.' });

    setPwLoading(true);
    try {
      await apiService.changePassword(oldPw, newPw);
      setPwMsg({ type: 'success', text: '✅ Password changed successfully!' });
      setOldPw('');
      setNewPw('');
      setConfirmPw('');
      setTimeout(() => {
        setShowPwModal(false);
        setPwMsg({ type: '', text: '' });
      }, 1800);
    } catch (err) {
      setPwMsg({ type: 'error', text: err.message || 'Failed to change password.' });
    } finally {
      setPwLoading(false);
    }
  };

  const menuItems = [
    { key: 'dashboard', label: 'Dashboard', path: '/dashboard', icon: '🏠' },
    { key: 'exams', label: 'Exams', path: '/exams', icon: '📝' },
    { key: 'results', label: 'Results', path: '/results', icon: '📊' },
  ];

  const initial = user?.name?.charAt(0)?.toUpperCase() || user?.email?.charAt(0)?.toUpperCase() || 'U';

  return (
    <>
      <aside className="sidebar">
        <div className="sb-brand">
          <div className="sb-logo">EP</div>
          <div className="sb-brand-text">
            ExamPortal
            <small>{user?.role === 'student' ? 'Student Workspace' : 'Portal'}</small>
          </div>
        </div>

        <div className="sb-section">Main Menu</div>
        <nav style={{ display: 'grid', gap: 4 }}>
          {menuItems.map((item) => (
            <button
              type="button"
              key={item.key}
              onClick={() => navigate(item.path)}
              className={`sb-link ${active === item.key ? 'active' : ''}`}
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
                {user?.name || 'User'}
              </div>
              <div style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{user?.email || ''}</div>
            </div>
          </div>

          <button
            type="button"
            className="sb-action password"
            onClick={() => {
              setShowPwModal(true);
              setPwMsg({ type: '', text: '' });
            }}
          >
            <span>🔒</span>
            <span>Change Password</span>
          </button>

          <button type="button" className="sb-action danger" onClick={handleLogout}>
            <span>🚪</span>
            <span>Logout</span>
          </button>
        </div>
      </aside>

      {showPwModal && (
        <div style={{
          position: 'fixed', inset: 0,
          background: 'rgba(15,23,42,0.55)',
          backdropFilter: 'blur(4px)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          zIndex: 1000, padding: 20,
        }}>
          <div style={{
            background: '#fff', borderRadius: 16, padding: 24,
            width: '100%', maxWidth: 390, boxShadow: 'var(--ep-shadow-lg)',
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 14 }}>
              <div>
                <h3 style={{ margin: 0, color: 'var(--ep-ink)', fontSize: 18, fontWeight: 800 }}>Change Password</h3>
                <div style={{ color: 'var(--ep-muted)', fontSize: 13, marginTop: 3 }}>Update your account password</div>
              </div>
              <button
                type="button"
                onClick={() => setShowPwModal(false)}
                style={{ background: 'none', border: 'none', fontSize: 24, cursor: 'pointer', color: 'var(--ep-muted)', lineHeight: 1 }}
              >×</button>
            </div>

            {pwMsg.text && (
              <div style={{
                padding: 11, marginBottom: 13,
                background: pwMsg.type === 'error' ? 'var(--ep-danger-soft)' : 'var(--ep-success-soft)',
                color: pwMsg.type === 'error' ? '#991b1b' : '#166534',
                borderRadius: 10, fontSize: 13,
              }}>{pwMsg.text}</div>
            )}

            <form onSubmit={handleChangePassword}>
              {[
                { label: 'Current Password', val: oldPw, set: setOldPw },
                { label: 'New Password', val: newPw, set: setNewPw },
                { label: 'Confirm New Password', val: confirmPw, set: setConfirmPw },
              ].map(({ label, val, set }) => (
                <div className="ep-field" key={label}>
                  <label>{label}</label>
                  <input
                    type="password"
                    value={val}
                    onChange={(e) => set(e.target.value)}
                    placeholder={label}
                    disabled={pwLoading}
                  />
                </div>
              ))}

              <button type="submit" className="ep-btn ep-btn-primary ep-btn-block" disabled={pwLoading}>
                {pwLoading ? 'Updating...' : 'Update Password'}
              </button>
            </form>
          </div>
        </div>
      )}
    </>
  );
};

export default Sidebar;
