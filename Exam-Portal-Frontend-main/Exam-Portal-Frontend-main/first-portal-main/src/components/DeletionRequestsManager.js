/* eslint-disable */
// src/components/DeletionRequestsManager.js
import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom'; 
import { Modal, Button } from 'react-bootstrap';
import apiService from '../services/api';
import SharedAdminSidebar from './SharedAdminSidebar';

const TYPE_META = {
  student: { label: 'Student', icon: '👤', color: 'var(--ep-info)', bg: 'var(--ep-info-soft)' },
  exam:    { label: 'Exam',    icon: '📝', color: 'var(--ep-brand)', bg: 'var(--ep-brand-soft)' },
  result:  { label: 'Result',  icon: '📊', color: 'var(--ep-success)', bg: 'var(--ep-success-soft)' },
};

const STATUS_META = {
  'Pending Approval': { color: 'var(--ep-warning)', bg: 'var(--ep-warning-soft)', icon: '⏳' },
  'Approved':         { color: 'var(--ep-success)', bg: 'var(--ep-success-soft)', icon: '✅' },
  'Rejected':         { color: 'var(--ep-danger)', bg: 'var(--ep-danger-soft)', icon: '❌' },
};

const TypeBadge = ({ type }) => {
  const m = TYPE_META[type] || { label: type, icon: '📦', color: 'var(--ep-muted)', bg: 'var(--ep-surface-2)' };
  return (
    <span className="ep-badge" style={{ background: m.bg, color: m.color, fontWeight: 700, fontSize: 11.5 }}>
      <span>{m.icon}</span>&nbsp;{m.label}
    </span>
  );
};

const StatusBadge = ({ status }) => {
  const m = STATUS_META[status] || { color: 'var(--ep-muted)', bg: 'var(--ep-surface-2)', icon: '•' };
  return (
    <span className="ep-badge" style={{ background: m.bg, color: m.color, fontWeight: 700, fontSize: 11.5 }}>
      <span>{m.icon}</span>&nbsp;{status}
    </span>
  );
};

const DeletionRequestsManager = () => {
  const navigate = useNavigate();
  const [tab, setTab] = useState('pending'); // pending | approved | rejected | all
  const [requests, setRequests] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [confirmModal, setConfirmModal] = useState(null); // { id, action, name, type }
  const [actionLoading, setActionLoading] = useState(false);

  const fetchRequests = async () => {
    try {
      setLoading(true);
      setError('');
      const res = await apiService.getSuperAdminDeletionRequests();
      if (res.success) {
        setRequests(res.requests || []);
      }
    } catch (e) {
      setError(e.message || 'Failed to load deletion requests');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchRequests();
    const t = setInterval(fetchRequests, 30000);
    return () => clearInterval(t);
  }, []);

  const handleAction = async (id, action, type) => {
    setActionLoading(true);
    try {
      await apiService.processDeletionRequest(id, action);
      setSuccess(
        action === 'approve'
          ? `✅ ${TYPE_META[type]?.label || type} deletion approved and processed.`
          : `❌ Request rejected.`
      );
      fetchRequests();
    } catch (e) {
      setError(e.message || `Failed to ${action} request`);
    } finally {
      setActionLoading(false);
      setConfirmModal(null);
    }
  };

  const filtered = requests.filter((r) => {
    if (tab === 'pending') return r.status === 'Pending Approval';
    if (tab === 'approved') return r.status === 'Approved';
    if (tab === 'rejected') return r.status === 'Rejected';
    return true;
  });

  const pendingCount = requests.filter((r) => r.status === 'Pending Approval').length;
  const superAdmin = apiService.getUser();
  const email = superAdmin?.email || 'Super Admin';
  const name = superAdmin?.name || 'Super Admin';
  const initial = superAdmin?.name ? superAdmin.name.charAt(0).toUpperCase() : 'S';

  const tabBtnStyle = (t) => ({
    padding: '10px 24px', borderRadius: '8px', fontWeight: '700', fontSize: '13.5px',
    border: 'none', cursor: 'pointer', transition: 'all 0.15s',
    background: tab === t ? '#fff' : 'transparent',
    color: tab === t ? '#4f46e5' : '#64748b',
    boxShadow: tab === t ? '0 4px 12px rgba(79, 70, 229, 0.08)' : 'none',
  });

  return (
    <div style={{ display: 'flex', minHeight: '100vh', background: '#f8fafc' }}>
      <SharedAdminSidebar onLogout={() => apiService.logout()} admin={superAdmin} />

      <main className="dashboard-main ep-page" style={{ flex: 1, minWidth: 0 }}>
        {/* Header */}
        <div className="ep-page-header">
          <div>
            <div className="ep-kicker">Platform Audit</div>
            <h1>
              Deletion Requests
              {pendingCount > 0 && (
                <span className="ep-badge ep-badge-danger" style={{ marginLeft: 12, verticalAlign: 'middle', fontSize: 13, fontWeight: 800 }}>
                  ⏳ {pendingCount} Pending Action
                </span>
              )}
            </h1>
            <p>Review and approve deletion requests submitted by administrators.</p>
          </div>
          <div className="ep-user-chip">
            <div className="avatar">{initial}</div>
            <div>
              <strong>{name}</strong>
              <span>{email}</span>
            </div>
          </div>
        </div>

        {/* Alerts */}
        {success && (
          <div className="ep-alert" style={{ background: 'var(--ep-success-soft)', color: 'var(--ep-success)', border: '1px solid #bbf7d0', padding: 14, borderRadius: 10, marginBottom: 18, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontSize: 13.5 }}>{success}</span>
            <button onClick={() => setSuccess('')} style={{ background: 'none', border: 'none', color: 'var(--ep-success)', fontSize: 18, fontWeight: 'bold' }}>×</button>
          </div>
        )}
        {error && (
          <div className="ep-alert" style={{ background: 'var(--ep-danger-soft)', color: 'var(--ep-danger)', border: '1px solid #fecaca', padding: 14, borderRadius: 10, marginBottom: 18, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontSize: 13.5 }}>{error}</span>
            <button onClick={() => setError('')} style={{ background: 'none', border: 'none', color: 'var(--ep-danger)', fontSize: 18, fontWeight: 'bold' }}>×</button>
          </div>
        )}

        {/* Tabs and Actions */}
        <div className="toolbar" style={{ marginBottom: 18 }}>
          <div className="pill-tabs" style={{ background: '#e2e8f0', padding: 4, borderRadius: 10, display: 'inline-flex', gap: 4 }}>
            <button style={tabBtnStyle('pending')} onClick={() => setTab('pending')}>
              ⏳ Pending ({requests.filter((r) => r.status === 'Pending Approval').length})
            </button>
            <button style={tabBtnStyle('approved')} onClick={() => setTab('approved')}>
              ✅ Approved ({requests.filter((r) => r.status === 'Approved').length})
            </button>
            <button style={tabBtnStyle('rejected')} onClick={() => setTab('rejected')}>
              ❌ Rejected ({requests.filter((r) => r.status === 'Rejected').length})
            </button>
            <button style={tabBtnStyle('all')} onClick={() => setTab('all')}>
              📋 All ({requests.length})
            </button>
          </div>
          <button onClick={fetchRequests} className="ep-btn ep-btn-outline" style={{ padding: '8px 16px', fontSize: 13 }}>
            🔄 Refresh
          </button>
        </div>

        {/* List */}
        {loading ? (
          <div style={{ padding: 40, textAlign: 'center', color: 'var(--ep-muted)' }}>
            <div className="spinner-border spinner-border-sm text-primary me-2" />
            Loading audit requests...
          </div>
        ) : filtered.length === 0 ? (
          <div className="ep-empty">
            <div style={{ fontSize: 48, marginBottom: 8 }}>📭</div>
            <h4>No requests found</h4>
            <p>There are no {tab === 'pending' ? 'pending' : tab} deletion requests to manage.</p>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            {filtered.map((req) => (
              <div className="ep-card" key={req.id} style={{
                padding: 20,
                display: 'grid',
                gridTemplateColumns: '1fr auto',
                gap: 16,
                alignItems: 'center',
              }}>
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
                    <TypeBadge type={req.type} />
                    <StatusBadge status={req.status} />
                    {req.has_violations && (
                      <span className="ep-badge ep-badge-danger" style={{ fontWeight: 800 }}>
                        ⚠️ Violations Captured
                      </span>
                    )}
                  </div>
                  <div style={{ marginTop: 10, fontSize: 16, fontWeight: 700, color: 'var(--ep-ink)' }}>
                    {req.display_name || `${req.type} ID: #${req.target_id}`}
                  </div>
                  {req.display_subtitle && (
                    <div style={{ fontSize: 13, color: 'var(--ep-muted)', marginTop: 2 }}>
                      {req.display_subtitle}
                    </div>
                  )}
                  {req.reason && (
                    <div style={{
                      marginTop: 10, padding: '10px 14px',
                      background: 'var(--ep-surface-2)', borderRadius: 10,
                      fontSize: 12.5, color: 'var(--ep-ink-2)',
                      borderLeft: '3px solid var(--ep-brand)',
                      border: '1px solid var(--ep-line)',
                      borderLeftColor: 'var(--ep-brand)'
                    }}>
                      <strong>Reason for request:</strong> {req.reason}
                    </div>
                  )}
                  <div style={{ marginTop: 10, fontSize: 11.5, color: 'var(--ep-muted)' }}>
                    Requested by <strong>{req.requested_by_name || req.requested_by_email || `User ID #${req.requested_by}`}</strong>
                    {' • '}
                    {new Date(req.created_at).toLocaleString('en-IN', {
                      day: '2-digit', month: 'short', year: 'numeric',
                      hour: '2-digit', minute: '2-digit',
                    })}
                  </div>
                </div>

                {/* Actions */}
                {req.status === 'Pending Approval' ? (
                  <div style={{ display: 'flex', gap: 8 }}>
                    <button
                      onClick={() => setConfirmModal({
                        id: req.id, action: 'reject',
                        name: req.display_name, type: req.type,
                      })}
                      className="ep-btn ep-btn-outline"
                      style={{ padding: '8px 16px', fontSize: 13, color: 'var(--ep-danger)', borderColor: 'var(--ep-danger-soft)' }}
                    >
                      ❌ Reject
                    </button>
                    <button
                      onClick={() => setConfirmModal({
                        id: req.id, action: 'approve',
                        name: req.display_name, type: req.type,
                      })}
                      className="ep-btn ep-btn-primary"
                      style={{ padding: '8px 16px', fontSize: 13, background: 'var(--ep-success)' }}
                    >
                      ✅ Approve
                    </button>
                  </div>
                ) : (
                  <div className="ep-badge ep-badge-muted" style={{ padding: '8px 14px', fontSize: 12 }}>
                    {req.status === 'Approved' ? '✓ Approved' : '✗ Declined'}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </main>

      {/* Confirm modal */}
      <Modal show={!!confirmModal} onHide={() => setConfirmModal(null)} centered>
        <Modal.Header closeButton
          style={{ background: confirmModal?.action === 'approve' ? 'var(--ep-success-soft)' : 'var(--ep-danger-soft)',
                   borderBottom: 'none' }}>
          <Modal.Title style={{ color: confirmModal?.action === 'approve' ? 'var(--ep-success)' : 'var(--ep-danger)', fontSize: 18, fontWeight: 800 }}>
            {confirmModal?.action === 'approve' ? '✅ Confirm Deletion Approval' : '❌ Reject Deletion Request'}
          </Modal.Title>
        </Modal.Header>
        <Modal.Body style={{ fontSize: 14.5, padding: '20px 24px', color: 'var(--ep-ink)' }}>
          {confirmModal?.action === 'approve' ? (
            <>
              Are you sure you want to <strong style={{ color: 'var(--ep-danger)' }}>permanently delete</strong>{' '}
              <strong>{confirmModal?.name}</strong>?
              <div style={{
                marginTop: 12, padding: '10px 14px',
                background: 'var(--ep-warning-soft)', color: 'var(--ep-warning)',
                borderRadius: 8, fontSize: 12.5, fontWeight: 600
              }}>
                ⚠️ This action is final and destructive. It will automatically cascade-delete all related results, answers, and violation data.
              </div>
            </>
          ) : (
            <>
              Are you sure you want to <strong>reject</strong> the deletion request for{' '}
              <strong>{confirmModal?.name}</strong>?
              <div style={{
                marginTop: 12, padding: '10px 14px',
                background: 'var(--ep-surface-2)', color: 'var(--ep-ink-2)',
                borderRadius: 8, fontSize: 12.5,
              }}>
                The requesting faculty administrator will see this refusal state on their request dashboard.
              </div>
            </>
          )}
        </Modal.Body>
        <Modal.Footer style={{ borderTop: 'none', padding: '12px 24px 20px' }}>
          <Button variant="light" onClick={() => setConfirmModal(null)}
            style={{ borderRadius: 10, fontWeight: 600, fontSize: 13.5 }}>
            Cancel
          </Button>
          <Button
            onClick={() => handleAction(confirmModal.id, confirmModal.action, confirmModal.type)}
            style={{
              borderRadius: 10, fontWeight: 700, padding: '8px 24px', fontSize: 13.5,
              background: confirmModal?.action === 'approve'
                ? 'var(--ep-success)'
                : 'var(--ep-danger)',
              border: 'none', color: '#fff',
            }}
          >
            {actionLoading ? 'Processing…' : (confirmModal?.action === 'approve' ? 'Yes, Approve & Delete' : 'Yes, Reject')}
          </Button>
        </Modal.Footer>
      </Modal>
    </div>
  );
};

export default DeletionRequestsManager;
