// src/components/superadmin/DeletionRequestsManager.js
//
// ✅ NEW: A dedicated, full-page UI for the Super Admin to manage all
//    pending deletion requests (students, exams, results).
//
//    Includes:
//      • Pending tab (needs action)
//      • Approved tab (history)
//      • Rejected tab (history)
//      • Approve / Reject buttons per row
//      • Inline confirm dialog before destructive actions
//      • Type, target, requester, reason, timestamp

import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { Modal, Button } from 'react-bootstrap';
import apiService from '../services/api';
import SharedAdminSidebar from './SharedAdminSidebar';;

const TYPE_META = {
  student: { label: 'Student', icon: '👤', color: '#1565c0', bg: '#e3f2fd' },
  exam:    { label: 'Exam',    icon: '📝', color: '#7B1FA2', bg: '#f3eafd' },
  result:  { label: 'Result',  icon: '📊', color: '#2e7d32', bg: '#e8f5e9' },
};

const STATUS_META = {
  'Pending Approval': { color: '#e65100', bg: '#fff3e0', icon: '⏳' },
  'Approved':         { color: '#2e7d32', bg: '#e8f5e9', icon: '✅' },
  'Rejected':         { color: '#c62828', bg: '#ffebee', icon: '❌' },
};

const TypeBadge = ({ type }) => {
  const m = TYPE_META[type] || { label: type, icon: '📦', color: '#555', bg: '#eee' };
  return (
    <span style={{
      background: m.bg, color: m.color,
      padding: '4px 10px', borderRadius: 999,
      fontSize: 12, fontWeight: 700,
      display: 'inline-flex', alignItems: 'center', gap: 6,
    }}>
      <span>{m.icon}</span><span>{m.label}</span>
    </span>
  );
};

const StatusBadge = ({ status }) => {
  const m = STATUS_META[status] || { color: '#555', bg: '#eee', icon: '•' };
  return (
    <span style={{
      background: m.bg, color: m.color,
      padding: '4px 10px', borderRadius: 999,
      fontSize: 12, fontWeight: 700,
      display: 'inline-flex', alignItems: 'center', gap: 6,
    }}>
      <span>{m.icon}</span><span>{status}</span>
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

  const fetchRequests = useCallback(async () => {
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
  }, []);

  useEffect(() => {
    fetchRequests();
    // refresh every 30s so the badge stays current
    const t = setInterval(fetchRequests, 30000);
    return () => clearInterval(t);
  }, [fetchRequests]);

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

  const tabStyle = (t) => ({
    padding: '10px 22px',
    borderRadius: 10,
    fontWeight: 700,
    fontSize: 14,
    border: 'none',
    cursor: 'pointer',
    transition: 'all 0.2s',
    background: tab === t ? 'linear-gradient(135deg, #5B0A7B, #7B1FA2)' : '#f0f0f5',
    color: tab === t ? '#fff' : '#555',
    boxShadow: tab === t ? '0 4px 14px rgba(91,10,123,0.3)' : 'none',
    position: 'relative',
  });

  const superAdmin = apiService.getUser();
  const email = superAdmin?.email || 'Super Admin';
  const initial = superAdmin?.name ? superAdmin.name.charAt(0).toUpperCase() : 'S';

  return (
    <div style={{ minHeight: '100vh', background: '#f5f7fb' }}>
      <SharedAdminSidebar
        onLogout={() => apiService.logout()}
        admin={superAdmin}
      />

      <div style={{ marginLeft: 260, padding: '24px 28px' }}>
        {/* Header */}
        <div style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          marginBottom: 24,
        }}>
          <div>
            <h1 style={{ margin: 0, color: '#2c2c54', fontSize: 26, fontWeight: 800 }}>
              🔔 Deletion Requests
              {pendingCount > 0 && (
                <span style={{
                  marginLeft: 14, background: '#e53935', color: '#fff',
                  padding: '4px 12px', borderRadius: 999,
                  fontSize: 14, fontWeight: 700,
                  verticalAlign: 'middle',
                }}>
                  {pendingCount} pending
                </span>
              )}
            </h1>
            <div style={{ color: '#7a7a93', fontSize: 13, marginTop: 4 }}>
              Review and approve deletion requests submitted by admins.
            </div>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <span style={{ fontSize: 13, color: '#555' }}>{email}</span>
            <div style={{
              width: 40, height: 40, borderRadius: '50%',
              background: 'linear-gradient(135deg, #5B0A7B, #7B1FA2)',
              color: '#fff', display: 'flex', alignItems: 'center',
              justifyContent: 'center', fontWeight: 700,
            }}>{initial}</div>
          </div>
        </div>

        {/* Alerts */}
        {success && (
          <div style={{
            background: '#e8f5e9', color: '#2e7d32',
            padding: '12px 16px', borderRadius: 10,
            marginBottom: 16, display: 'flex', justifyContent: 'space-between',
            alignItems: 'center', fontSize: 14,
          }}>
            <span>{success}</span>
            <button onClick={() => setSuccess('')}
              style={{ background: 'none', border: 'none', color: '#2e7d32',
                       fontSize: 20, cursor: 'pointer', lineHeight: 1 }}>×</button>
          </div>
        )}
        {error && (
          <div style={{
            background: '#ffebee', color: '#c62828',
            padding: '12px 16px', borderRadius: 10,
            marginBottom: 16, display: 'flex', justifyContent: 'space-between',
            alignItems: 'center', fontSize: 14,
          }}>
            <span>{error}</span>
            <button onClick={() => setError('')}
              style={{ background: 'none', border: 'none', color: '#c62828',
                       fontSize: 20, cursor: 'pointer', lineHeight: 1 }}>×</button>
          </div>
        )}

        {/* Tabs */}
        <div style={{ display: 'flex', gap: 8, marginBottom: 18, flexWrap: 'wrap' }}>
          <button style={tabStyle('pending')} onClick={() => setTab('pending')}>
            ⏳ Pending ({requests.filter((r) => r.status === 'Pending Approval').length})
          </button>
          <button style={tabStyle('approved')} onClick={() => setTab('approved')}>
            ✅ Approved ({requests.filter((r) => r.status === 'Approved').length})
          </button>
          <button style={tabStyle('rejected')} onClick={() => setTab('rejected')}>
            ❌ Rejected ({requests.filter((r) => r.status === 'Rejected').length})
          </button>
          <button style={tabStyle('all')} onClick={() => setTab('all')}>
            📋 All ({requests.length})
          </button>
          <button onClick={fetchRequests}
            style={{
              padding: '10px 16px', borderRadius: 10,
              background: '#fff', border: '1.5px solid #e0e0e0',
              color: '#555', fontWeight: 600, fontSize: 13, cursor: 'pointer',
            }}
          >🔄 Refresh</button>
        </div>

        {/* List */}
        {loading ? (
          <div style={{
            padding: 60, textAlign: 'center', color: '#888', fontSize: 15,
            background: '#fff', borderRadius: 14,
          }}>Loading requests…</div>
        ) : filtered.length === 0 ? (
          <div style={{
            padding: 60, textAlign: 'center', background: '#fff',
            borderRadius: 14, border: '1px solid #ece9f4',
          }}>
            <div style={{ fontSize: 40, marginBottom: 10 }}>📭</div>
            <div style={{ color: '#888', fontSize: 15 }}>
              No {tab === 'pending' ? 'pending' : tab} requests.
            </div>
          </div>
        ) : (
          <div style={{ display: 'grid', gap: 14 }}>
            {filtered.map((req) => (
              <div key={req.id} style={{
                background: '#fff', borderRadius: 14,
                padding: 20, border: '1px solid #ece9f4',
                boxShadow: '0 2px 10px rgba(91,10,123,0.04)',
                display: 'grid',
                gridTemplateColumns: '1fr auto',
                gap: 16, alignItems: 'center',
              }}>
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
                    <TypeBadge type={req.type} />
                    <StatusBadge status={req.status} />
                    {req.has_violations && (
                      <span style={{
                        background: '#fff8e1', color: '#e65100',
                        padding: '4px 10px', borderRadius: 999,
                        fontSize: 12, fontWeight: 700,
                      }}>⚠️ Has violations</span>
                    )}
                  </div>
                  <div style={{ marginTop: 10, fontSize: 16, fontWeight: 700, color: '#2c2c54' }}>
                    {req.display_name || `${req.type} #${req.target_id}`}
                  </div>
                  {req.display_subtitle && (
                    <div style={{ fontSize: 13, color: '#666', marginTop: 2 }}>
                      {req.display_subtitle}
                    </div>
                  )}
                  {req.reason && (
                    <div style={{
                      marginTop: 10, padding: '8px 12px',
                      background: '#fafafa', borderRadius: 8,
                      fontSize: 13, color: '#555',
                      borderLeft: '3px solid #7B1FA2',
                    }}>
                      <strong>Reason:</strong> {req.reason}
                    </div>
                  )}
                  <div style={{ marginTop: 8, fontSize: 12, color: '#888' }}>
                    Requested by <strong>{req.requested_by_name || req.requested_by_email || `User #${req.requested_by}`}</strong>
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
                      style={{
                        padding: '10px 20px', borderRadius: 10,
                        background: '#fff', color: '#c62828',
                        border: '2px solid #ffcdd2',
                        fontWeight: 700, fontSize: 13, cursor: 'pointer',
                        transition: 'all 0.2s',
                      }}
                      onMouseEnter={(e) => { e.currentTarget.style.background = '#ffebee'; }}
                      onMouseLeave={(e) => { e.currentTarget.style.background = '#fff'; }}
                    >
                      ❌ Reject
                    </button>
                    <button
                      onClick={() => setConfirmModal({
                        id: req.id, action: 'approve',
                        name: req.display_name, type: req.type,
                      })}
                      style={{
                        padding: '10px 20px', borderRadius: 10,
                        background: 'linear-gradient(135deg, #2e7d32, #66bb6a)',
                        color: '#fff', border: 'none',
                        fontWeight: 700, fontSize: 13, cursor: 'pointer',
                        transition: 'all 0.2s',
                        boxShadow: '0 2px 10px rgba(46,125,50,0.25)',
                      }}
                    >
                      ✅ Approve
                    </button>
                  </div>
                ) : (
                  <div style={{
                    padding: '8px 14px', borderRadius: 10,
                    background: '#fafafa', color: '#888',
                    fontSize: 12, fontWeight: 600,
                  }}>
                    {req.status === 'Approved' ? '✓ Processed' : '✗ Declined'}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Confirm modal */}
      <Modal show={!!confirmModal} onHide={() => !actionLoading && setConfirmModal(null)} centered>
        <Modal.Header closeButton={!actionLoading}
          style={{ background: confirmModal?.action === 'approve' ? '#e8f5e9' : '#ffebee',
                   borderBottom: 'none' }}>
          <Modal.Title style={{ color: confirmModal?.action === 'approve' ? '#2e7d32' : '#c62828' }}>
            {confirmModal?.action === 'approve' ? '✅ Confirm Approval' : '❌ Confirm Rejection'}
          </Modal.Title>
        </Modal.Header>
        <Modal.Body style={{ fontSize: 15, padding: '20px 24px' }}>
          {confirmModal?.action === 'approve' ? (
            <>
              Are you sure you want to <strong style={{ color: '#c62828' }}>permanently delete</strong>{' '}
              <strong>{confirmModal?.name}</strong>?
              <div style={{
                marginTop: 12, padding: '10px 14px',
                background: '#fff8e1', color: '#e65100',
                borderRadius: 8, fontSize: 13,
              }}>
                ⚠️ This action cannot be undone. All related data will be removed.
              </div>
            </>
          ) : (
            <>
              Are you sure you want to <strong>reject</strong> the deletion request for{' '}
              <strong>{confirmModal?.name}</strong>?
              <div style={{
                marginTop: 12, padding: '10px 14px',
                background: '#f5f5f5', color: '#555',
                borderRadius: 8, fontSize: 13,
              }}>
                The requesting admin will be able to see this rejection in their dashboard.
              </div>
            </>
          )}
        </Modal.Body>
        <Modal.Footer style={{ borderTop: 'none', padding: '12px 24px 20px' }}>
          <Button variant="light" onClick={() => setConfirmModal(null)} disabled={actionLoading}
            style={{ borderRadius: 10, fontWeight: 600 }}>
            Cancel
          </Button>
          <Button
            onClick={() => handleAction(confirmModal.id, confirmModal.action, confirmModal.type)}
            disabled={actionLoading}
            style={{
              borderRadius: 10, fontWeight: 700, padding: '8px 24px',
              background: confirmModal?.action === 'approve'
                ? 'linear-gradient(135deg, #2e7d32, #66bb6a)'
                : 'linear-gradient(135deg, #c62828, #f44336)',
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
