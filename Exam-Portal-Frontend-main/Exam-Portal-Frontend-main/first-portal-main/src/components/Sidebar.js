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

  const handleLogout = () => {
    apiService.logout();
  };

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
      setOldPw(''); setNewPw(''); setConfirmPw('');
      setTimeout(() => { setShowPwModal(false); setPwMsg({ type: '', text: '' }); }, 1800);
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

  return (
    <>
      <div className="sidebar">
        {/* Brand Header */}
        <div className="sidebar-brand" style={{
          padding: '24px 20px',
          borderBottom: '1px solid rgba(255,255,255,0.1)',
          textAlign: 'center'
        }}>
          <h2 style={{ color: '#fff', fontSize: 20, fontWeight: 700, margin: 0, letterSpacing: 1 }}>
            ExamPortal
          </h2>
          <p style={{ color: 'rgba(255,255,255,0.6)', fontSize: 11, margin: '4px 0 0 0', textTransform: 'uppercase', letterSpacing: 1 }}>
            {user?.role === 'admin' || user?.role === 'super_admin' ? 'Admin' : 'Student'}
          </p>
        </div>

        {/* Menu Items */}
        <div style={{ padding: '16px 0', flex: 1 }}>
          {menuItems.map(item => (
            <div
              key={item.key}
              className={`sidebar-item ${active === item.key ? 'active' : ''}`}
              onClick={() => navigate(item.path)}
              style={{
                display: 'flex', alignItems: 'center', gap: 12,
                padding: '12px 24px', margin: '4px 12px', borderRadius: 10,
                cursor: 'pointer',
                color: active === item.key ? '#fff' : 'rgba(255,255,255,0.7)',
                background: active === item.key ? 'rgba(255,255,255,0.15)' : 'transparent',
                fontWeight: active === item.key ? 600 : 400,
                fontSize: 14, transition: 'all 0.2s ease',
              }}
              onMouseEnter={e => {
                if (active !== item.key) e.currentTarget.style.background = 'rgba(255,255,255,0.08)';
              }}
              onMouseLeave={e => {
                if (active !== item.key) e.currentTarget.style.background = 'transparent';
              }}
            >
              <span style={{ fontSize: 18 }}>{item.icon}</span>
              <span>{item.label}</span>
            </div>
          ))}
        </div>

        {/* User Info Section */}
        <div style={{ padding: '12px 20px', borderTop: '1px solid rgba(255,255,255,0.1)', background: 'rgba(0,0,0,0.1)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12 }}>
            <div style={{
              width: 36, height: 36, borderRadius: '50%',
              background: 'rgba(255,255,255,0.2)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              color: '#fff', fontWeight: 700, fontSize: 14
            }}>
              {user?.name?.charAt(0)?.toUpperCase() || 'U'}
            </div>
            <div style={{ flex: 1, overflow: 'hidden' }}>
              <div style={{ color: '#fff', fontSize: 13, fontWeight: 600, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                {user?.name || 'User'}
              </div>
              <div style={{ color: 'rgba(255,255,255,0.5)', fontSize: 11, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                {user?.email || ''}
              </div>
            </div>
          </div>

          {/* Change Password Button */}
          <div
            onClick={() => { setShowPwModal(true); setPwMsg({ type: '', text: '' }); }}
            style={{
              display: 'flex', alignItems: 'center', gap: 12,
              padding: '10px 16px', borderRadius: 8, cursor: 'pointer',
              color: 'rgba(255,255,255,0.7)', fontSize: 13, transition: 'all 0.2s ease',
              border: '1px solid rgba(255,255,255,0.1)', marginBottom: 8,
            }}
            onMouseEnter={e => { e.currentTarget.style.background = 'rgba(100,100,255,0.12)'; e.currentTarget.style.color = '#fff'; }}
            onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = 'rgba(255,255,255,0.7)'; }}
          >
            <span style={{ fontSize: 16 }}>🔒</span>
            <span>Change Password</span>
          </div>

          {/* Logout Button */}
          <div
            onClick={handleLogout}
            style={{
              display: 'flex', alignItems: 'center', gap: 12,
              padding: '10px 16px', borderRadius: 8, cursor: 'pointer',
              color: 'rgba(255,255,255,0.7)', fontSize: 13, transition: 'all 0.2s ease',
              border: '1px solid rgba(255,255,255,0.1)'
            }}
            onMouseEnter={e => { e.currentTarget.style.background = 'rgba(255,0,0,0.1)'; e.currentTarget.style.borderColor = 'rgba(255,0,0,0.3)'; e.currentTarget.style.color = '#fff'; }}
            onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.borderColor = 'rgba(255,255,255,0.1)'; e.currentTarget.style.color = 'rgba(255,255,255,0.7)'; }}
          >
            <span style={{ fontSize: 16 }}>🚪</span>
            <span>Logout</span>
          </div>
        </div>
      </div>

      {/* Change Password Modal */}
      {showPwModal && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.55)', zIndex: 9999, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <div style={{ background: '#fff', borderRadius: 16, padding: 32, width: 380, boxShadow: '0 20px 60px rgba(0,0,0,0.3)', position: 'relative' }}>
            <button
              onClick={() => setShowPwModal(false)}
              style={{ position: 'absolute', top: 14, right: 18, background: 'none', border: 'none', fontSize: 22, cursor: 'pointer', color: '#aaa' }}
            >×</button>
            <div style={{ textAlign: 'center', marginBottom: 20 }}>
              <div style={{ fontSize: 36, marginBottom: 8 }}>🔒</div>
              <h4 style={{ margin: 0, fontWeight: 700, color: '#2D0040' }}>Change Password</h4>
              <p style={{ margin: '4px 0 0', color: '#888', fontSize: 13 }}>Update your account password</p>
            </div>
            {pwMsg.text && (
              <div style={{
                padding: '10px 14px', borderRadius: 8, marginBottom: 14, fontSize: 13, fontWeight: 600,
                background: pwMsg.type === 'success' ? '#e8f5e9' : '#ffebee',
                color: pwMsg.type === 'success' ? '#2e7d32' : '#c62828',
                border: `1px solid ${pwMsg.type === 'success' ? '#4caf50' : '#f44336'}`
              }}>
                {pwMsg.text}
              </div>
            )}
            <form onSubmit={handleChangePassword}>
              {[
                { label: 'Current Password', val: oldPw, set: setOldPw },
                { label: 'New Password', val: newPw, set: setNewPw },
                { label: 'Confirm New Password', val: confirmPw, set: setConfirmPw }
              ].map(({ label, val, set }) => (
                <div key={label} style={{ marginBottom: 14 }}>
                  <label style={{ fontSize: 12, fontWeight: 600, color: '#555', display: 'block', marginBottom: 4 }}>{label}</label>
                  <input
                    type="password"
                    value={val}
                    onChange={e => set(e.target.value)}
                    placeholder={label}
                    style={{ width: '100%', padding: '10px 12px', borderRadius: 8, border: '2px solid #e0e0e0', fontSize: 14, outline: 'none', boxSizing: 'border-box' }}
                    onFocus={e => e.target.style.borderColor = '#667eea'}
                    onBlur={e => e.target.style.borderColor = '#e0e0e0'}
                  />
                </div>
              ))}
              <button
                type="submit"
                disabled={pwLoading}
                style={{ width: '100%', padding: '12px 0', background: 'linear-gradient(135deg,#667eea,#764ba2)', color: '#fff', border: 'none', borderRadius: 10, fontWeight: 700, fontSize: 15, cursor: pwLoading ? 'not-allowed' : 'pointer', marginTop: 4 }}
              >
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