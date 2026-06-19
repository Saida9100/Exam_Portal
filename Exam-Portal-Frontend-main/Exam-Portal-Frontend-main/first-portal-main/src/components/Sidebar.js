// src/components/Sidebar.js
// ✅ ENHANCED: Added "🔬 Live Test" link so students can verify their
//    camera/mic/face-detection BEFORE starting the exam.

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
      setOldPw(''); setNewPw(''); setConfirmPw('');
      setTimeout(() => { setShowPwModal(false); setPwMsg({ type: '', text: '' }); }, 1800);
    } catch (err) {
      setPwMsg({ type: 'error', text: err.message || 'Failed to change password.' });
    } finally { setPwLoading(false); }
  };

  const menuItems = [
    { key: 'dashboard', label: 'Dashboard', path: '/dashboard', icon: '🏠' },
    { key: 'exams',     label: 'Exams',     path: '/exams',     icon: '📝' },
    { key: 'results',   label: 'Results',   path: '/results',   icon: '📊' },
    // ✅ NEW: Live tech-check link
    { key: 'live-test', label: '🔬 Live Test', path: '/live-testing', icon: '🔬', highlight: true },
  ];

  const itemStyle = (key, highlight) => ({
    display: 'flex', alignItems: 'center', gap: 12,
    padding: '12px 24px', margin: '4px 12px', borderRadius: 10,
    cursor: 'pointer',
    color: active === key
      ? '#fff'
      : (highlight ? '#ffd54f' : 'rgba(255,255,255,0.7)'),
    background: active === key
      ? 'rgba(255,255,255,0.15)'
      : (highlight ? 'rgba(255,213,79,0.08)' : 'transparent'),
    fontWeight: active === key ? 600 : (highlight ? 600 : 400),
    fontSize: 14, transition: 'all 0.2s ease',
    border: highlight && active !== key ? '1px solid rgba(255,213,79,0.2)' : 'none',
  });

  return (
    <>
      {/* Brand Header */}
      <div style={{
        padding: '20px 24px',
        borderBottom: '1px solid rgba(255,255,255,0.1)',
      }}>
        <h2 style={{ margin: 0, color: '#fff', fontSize: 20, fontWeight: 800 }}>ExamPortal</h2>
        <div style={{ color: 'rgba(255,255,255,0.6)', fontSize: 11, marginTop: 4, fontWeight: 600, letterSpacing: 1 }}>
          {user?.role === 'admin' || user?.role === 'super_admin' ? 'ADMIN' : 'STUDENT'}
        </div>
      </div>

      {/* Menu Items */}
      <div style={{ flex: 1, paddingTop: 12 }}>
        {menuItems.map((item) => (
          <div
            key={item.key}
            onClick={() => navigate(item.path)}
            style={itemStyle(item.key, item.highlight)}
            onMouseEnter={(e) => {
              if (active !== item.key) {
                e.currentTarget.style.background = item.highlight
                  ? 'rgba(255,213,79,0.15)'
                  : 'rgba(255,255,255,0.08)';
              }
            }}
            onMouseLeave={(e) => {
              if (active !== item.key) {
                e.currentTarget.style.background = item.highlight
                  ? 'rgba(255,213,79,0.08)'
                  : 'transparent';
              }
            }}
          >
            <span style={{ fontSize: 18 }}>{item.icon}</span>
            <span>{item.label}</span>
          </div>
        ))}
      </div>

      {/* User Info Section */}
      <div style={{
        padding: '16px 24px',
        borderTop: '1px solid rgba(255,255,255,0.1)',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 12 }}>
          <div style={{
            width: 36, height: 36, borderRadius: '50%',
            background: 'linear-gradient(135deg, #5B0A7B, #7B1FA2)',
            color: '#fff', display: 'flex', alignItems: 'center',
            justifyContent: 'center', fontWeight: 700,
          }}>{user?.name?.charAt(0)?.toUpperCase() || 'U'}</div>
          <div style={{ minWidth: 0, flex: 1 }}>
            <div style={{ color: '#fff', fontSize: 13, fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis' }}>
              {user?.name || 'User'}
            </div>
            <div style={{ color: 'rgba(255,255,255,0.6)', fontSize: 11, overflow: 'hidden', textOverflow: 'ellipsis' }}>
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
          onMouseEnter={(e) => { e.currentTarget.style.background = 'rgba(100,100,255,0.12)'; e.currentTarget.style.color = '#fff'; }}
          onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = 'rgba(255,255,255,0.7)'; }}
        >
          <span>🔒</span><span>Change Password</span>
        </div>

        {/* Logout Button */}
        <div
          onClick={handleLogout}
          style={{
            display: 'flex', alignItems: 'center', gap: 12,
            padding: '10px 16px', borderRadius: 8, cursor: 'pointer',
            color: 'rgba(255,255,255,0.7)', fontSize: 13, transition: 'all 0.2s ease',
            border: '1px solid rgba(255,255,255,0.1)',
          }}
          onMouseEnter={(e) => { e.currentTarget.style.background = 'rgba(255,0,0,0.1)'; e.currentTarget.style.borderColor = 'rgba(255,0,0,0.3)'; e.currentTarget.style.color = '#fff'; }}
          onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.borderColor = 'rgba(255,255,255,0.1)'; e.currentTarget.style.color = 'rgba(255,255,255,0.7)'; }}
        >
          <span>🚪</span><span>Logout</span>
        </div>
      </div>

      {/* Change Password Modal */}
      {showPwModal && (
        <div style={{
          position: 'fixed', inset: 0,
          background: 'rgba(0,0,0,0.5)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          zIndex: 1000,
        }}>
          <div style={{
            background: '#fff', borderRadius: 14, padding: 24,
            width: '90%', maxWidth: 380,
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
              <h3 style={{ margin: 0, color: '#2c2c54', fontSize: 18 }}>🔒 Change Password</h3>
              <button
                onClick={() => setShowPwModal(false)}
                style={{ background: 'none', border: 'none', fontSize: 22, cursor: 'pointer', color: '#aaa' }}
              >×</button>
            </div>
            <div style={{ color: '#666', fontSize: 13, marginBottom: 16 }}>Update your account password</div>

            {pwMsg.text && (
              <div style={{
                padding: 10, marginBottom: 12,
                background: pwMsg.type === 'error' ? '#ffebee' : '#e8f5e9',
                color: pwMsg.type === 'error' ? '#c62828' : '#2e7d32',
                borderRadius: 8, fontSize: 13,
              }}>{pwMsg.text}</div>
            )}

            {[
              { label: 'Current Password', val: oldPw, set: setOldPw },
              { label: 'New Password', val: newPw, set: setNewPw },
              { label: 'Confirm New Password', val: confirmPw, set: setConfirmPw },
            ].map(({ label, val, set }) => (
              <div key={label} style={{ marginBottom: 12 }}>
                <label style={{ fontSize: 12, color: '#555', fontWeight: 600 }}>{label}</label>
                <input
                  type="password"
                  value={val}
                  onChange={(e) => set(e.target.value)}
                  placeholder={label}
                  style={{
                    width: '100%', padding: '10px 12px', marginTop: 4,
                    borderRadius: 8, border: '2px solid #e0e0e0', fontSize: 14,
                    outline: 'none', boxSizing: 'border-box',
                  }}
                />
              </div>
            ))}

            <button
              onClick={handleChangePassword}
              disabled={pwLoading}
              style={{
                width: '100%', padding: '12px', borderRadius: 10,
                background: 'linear-gradient(135deg, #5B0A7B, #7B1FA2)',
                color: '#fff', border: 'none', fontWeight: 700, fontSize: 14,
                cursor: pwLoading ? 'not-allowed' : 'pointer',
                opacity: pwLoading ? 0.6 : 1,
              }}
            >{pwLoading ? 'Updating...' : 'Update Password'}</button>
          </div>
        </div>
      )}
    </>
  );
};

export default Sidebar;
