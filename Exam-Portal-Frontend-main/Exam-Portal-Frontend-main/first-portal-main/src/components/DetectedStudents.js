/* eslint-disable */
// src/components/DetectedStudents.js
import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card, Button, Badge } from 'react-bootstrap';
import apiService from '../services/api'; 
import SharedAdminSidebar from './SharedAdminSidebar';
import ExportToolbar from './ExportToolbar';
import { prepareViolationsForExport, getExportFilename, filterByDateRange } from '../utils/exportUtils';

const DetectedStudents = () => {
  const [results, setResults] = useState([]);
  const [exportFilters, setExportFilters] = useState({ startDate: '', endDate: '', searchTerm: '' });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [searchTerm, setSearchTerm] = useState('');
  const [deletionRequests, setDeletionRequests] = useState([]);
  const [requestingIds, setRequestingIds] = useState({}); // tracks loading per result
  const navigate = useNavigate();
  const admin = apiService.getUser();

  useEffect(() => {
    fetchResults();
    fetchDeletionRequests();
    const interval = setInterval(() => {
      fetchResults();
      fetchDeletionRequests();
    }, 30000);
    return () => clearInterval(interval);
  }, []);

  const fetchResults = async () => {
    try {
      setLoading(true);
      const res = await apiService.getAdminResults();
      if (res.success) {
        const flagged = res.results.filter(r => r.violations && r.violations.length > 0);
        flagged.sort((a, b) => new Date(b.submitted_at) - new Date(a.submitted_at));
        setResults(flagged);
      } else {
        setError(res.message || 'Failed to fetch results');
      }
    } catch (err) {
      setError(err.message || 'Error connecting to server');
    } finally {
      setLoading(false);
    }
  };

  const fetchDeletionRequests = async () => {
    try {
      const res = await apiService.getAdminDeletionRequests();
      if (res.success) {
        setDeletionRequests(res.data || res.requests || []);
      }
    } catch (err) {
      console.warn('Could not fetch deletion requests', err);
    }
  };

  const getRequestStatus = (attemptId) => {
    const req = deletionRequests.find(
      r => String(r.target_id) === String(attemptId) && r.type === 'result'
    );
    return req ? req.status : null;
  };

  const handleClearData = async () => {
    if (window.confirm('Are you sure you want to delete all violation data? This cannot be undone.')) {
      try {
        setLoading(true);
        const res = await apiService.clearAllViolations();
        if (res.success) {
          setResults([]);
        } else {
          setError(res.message || 'Failed to clear data');
        }
      } catch (err) {
        setError(err.message || 'Error clearing data');
      } finally {
        setLoading(false);
      }
    }
  };

  const handleDelete = async (result) => {
    const id = result.attempt_id || result.id;
    const name = result.student_name;

    if (admin?.role === 'super_admin') {
      if (!window.confirm(`Delete all violation data for "${name}"? This cannot be undone.`)) return;
      setRequestingIds(prev => ({ ...prev, [id]: true }));
      setError('');
      try {
        const res = await apiService.deleteAdminResult(id);
        if (res.success) {
          setResults(prev => prev.filter(r => (r.attempt_id || r.id) !== id));
          setSuccess(`Violation record for "${name}" deleted.`);
        } else {
          setError(res.message || 'Failed to delete result');
        }
      } catch (err) {
        setError(err.message || 'Error deleting result');
      } finally {
        setRequestingIds(prev => ({ ...prev, [id]: false }));
      }
    } else {
      if (!window.confirm(`Request deletion of violation record for "${name}"? The Super Admin must approve this.`)) return;
      setRequestingIds(prev => ({ ...prev, [id]: true }));
      setError('');
      try {
        await apiService.submitDeletionRequest({
          type: 'result',
          target_id: id,
          student_name: name,
          student_email: result.student_email,
          reason: `Violation result for exam: ${result.exam_title}`
        });
        setSuccess(`Deletion request for "${name}"'s violation record sent to Super Admin.`);
        fetchDeletionRequests();
      } catch (err) {
        setError(err.message || 'Error submitting deletion request');
      } finally {
        setRequestingIds(prev => ({ ...prev, [id]: false }));
      }
    }
  };

  const searchFilteredResults = results.filter(r =>
    (r.student_name || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
    (r.student_email || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
    (r.exam_title || '').toLowerCase().includes(searchTerm.toLowerCase())
  );

  const finalFilteredResults = filterByDateRange(searchFilteredResults, exportFilters.startDate, exportFilters.endDate, 'submitted_at');
  const adminInitial = admin?.name?.charAt(0)?.toUpperCase() || 'A';

  const getStatusBadge = (status) => {
    if (!status) return null;
    const styles = {
      'Pending Approval': 'ep-badge-warning',
      'Approved': 'ep-badge-success',
      'Rejected': 'ep-badge-danger',
    };
    const styleClass = styles[status] || 'ep-badge-warning';
    return (
      <span className={`ep-badge ${styleClass}`} style={{ fontSize: 11.5 }}>
        {status === 'Pending Approval' ? '⏳ Pending Approval' : status === 'Approved' ? '✅ Approved' : '❌ Rejected'}
      </span>
    );
  };

  return (
    <div style={{ display: 'flex', minHeight: '100vh' }}>
      <SharedAdminSidebar active="detected-students" onLogout={() => apiService.logout()} />

      <main className="dashboard-main ep-page" style={{ flex: 1, minWidth: 0 }}>
        {/* Header */}
        <div className="ep-page-header">
          <div>
            <div className="ep-kicker">Security Center</div>
            <h1 style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <button onClick={() => navigate(-1)} style={{ fontSize: 20, cursor: 'pointer', border: 'none', background: 'none' }}>⬅️</button>
              Detected Students
            </h1>
            <p>Monitor integrity logs, visual snapshots, and student policy infractions.</p>
          </div>
          <div className="ep-user-chip">
            <div className="avatar">{adminInitial}</div>
            <div>
              <strong>{admin?.name || 'Administrator'}</strong>
              <span>{admin?.email}</span>
            </div>
          </div>
        </div>

        {/* Filters and Toolbar */}
        <div className="toolbar" style={{ marginBottom: 18 }}>
          <div className="pill-tabs" style={{ flex: 1, maxWidth: 460 }}>
            <input
              placeholder="🔍  Search by candidate name, email or exam title..."
              value={searchTerm}
              onChange={e => setSearchTerm(e.target.value)}
              className="ep-input"
              style={{ border: 'none', padding: '8px 14px' }}
            />
          </div>
          <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
            {results.length > 0 && (
              <ExportToolbar
                data={finalFilteredResults}
                prepareExportData={prepareViolationsForExport}
                filename={getExportFilename(admin?.role, 'violations')}
                title="Proctoring Violations Report"
                dateField="submitted_at"
                onFilterChange={(filters) => setExportFilters(filters)}
              />
            )}
            {results.length > 0 && admin?.role === 'super_admin' && (
              <button onClick={handleClearData} className="ep-btn ep-btn-outline" style={{ color: 'var(--ep-danger)', borderColor: 'var(--ep-danger-soft)' }}>
                🗑️ Clear All Logs
              </button>
            )}
          </div>
        </div>

        {/* Regular Admin Notes */}
        {admin?.role !== 'super_admin' && (
          <div className="ep-alert tips" style={{ background: 'var(--ep-info-soft)', color: '#0369a1', border: '1px solid #bae6fd', padding: 12, borderRadius: 10, fontSize: 13, marginBottom: 18 }}>
            <strong>ℹ️ Student Deletion Requests:</strong> Regular faculty admins request deletions of candidate results/violations. Final purging requires approval from the Super Admin.
          </div>
        )}

        {/* Alert Notifications */}
        {error && (
          <div className="ep-alert" style={{ background: 'var(--ep-danger-soft)', color: 'var(--ep-danger)', border: '1px solid #fecaca', padding: 14, borderRadius: 10, marginBottom: 18, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontSize: 13.5 }}>{error}</span>
            <button onClick={() => setError('')} style={{ background: 'none', border: 'none', color: 'var(--ep-danger)', fontSize: 18, fontWeight: 'bold' }}>×</button>
          </div>
        )}
        {success && (
          <div className="ep-alert" style={{ background: 'var(--ep-success-soft)', color: 'var(--ep-success)', border: '1px solid #bbf7d0', padding: 14, borderRadius: 10, marginBottom: 18, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontSize: 13.5 }}>{success}</span>
            <button onClick={() => setSuccess('')} style={{ background: 'none', border: 'none', color: 'var(--ep-success)', fontSize: 18, fontWeight: 'bold' }}>×</button>
          </div>
        )}

        {loading ? (
          <div style={{ padding: 40, textAlign: 'center', color: 'var(--ep-muted)' }}>
            <div className="spinner-border spinner-border-sm text-primary me-2" />
            Loading security flags...
          </div>
        ) : finalFilteredResults.length === 0 ? (
          <div className="ep-empty">
            <div style={{ fontSize: 56, marginBottom: 12 }}>🛡️</div>
            <h4>No Violations Detected</h4>
            <p>None of the active candidate attempts have triggered security flags.</p>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
            {finalFilteredResults.map((result) => {
              const id = result.attempt_id || result.id;
              const requestStatus = getRequestStatus(id);
              const isRequesting = requestingIds[id];

              return (
                <div className="ep-card" key={id} style={{ overflow: 'hidden' }}>
                  <div className="ep-card-head" style={{ background: 'var(--ep-danger-soft)', borderBottom: '1px solid #fecaca', padding: '16px 20px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 12 }}>
                    <div>
                      <h3 style={{ margin: 0, color: 'var(--ep-danger)', fontSize: 15, fontWeight: 800 }}>{result.student_name}</h3>
                      <p style={{ margin: '2px 0 0', color: 'var(--ep-danger)', opacity: 0.95, fontSize: 12 }}>{result.student_email} • Exam: <strong>{result.exam_title}</strong></p>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                      <span className="ep-badge ep-badge-danger" style={{ fontWeight: 800 }}>
                        🚨 {result.violations.length} Violation{result.violations.length !== 1 ? 's' : ''}
                      </span>

                      {admin?.role === 'super_admin' ? (
                        <button
                          disabled={isRequesting}
                          onClick={() => handleDelete(result)}
                          className="ep-btn ep-btn-outline"
                          style={{ padding: '6px 14px', fontSize: 12, color: 'var(--ep-danger)', borderColor: 'var(--ep-danger-soft)' }}
                        >
                          {isRequesting ? 'Deleting...' : 'Delete'}
                        </button>
                      ) : (
                        requestStatus === 'Pending Approval' ? (
                          getStatusBadge(requestStatus)
                        ) : requestStatus === 'Approved' ? (
                          getStatusBadge(requestStatus)
                        ) : (
                          <button
                            disabled={isRequesting}
                            onClick={() => handleDelete(result)}
                            className="ep-btn ep-btn-outline"
                            style={{ padding: '6px 14px', fontSize: 12, color: 'var(--ep-warning)', borderColor: 'var(--ep-warning-soft)' }}
                          >
                            {isRequesting ? 'Requesting...' : requestStatus === 'Rejected' ? '🔄 Re-request Delete' : '🗑️ Request Delete'}
                          </button>
                        )
                      )}
                    </div>
                  </div>
                  <div style={{ padding: 20 }}>
                    <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 14, color: 'var(--ep-ink)' }}>Proctoring Snapshot Stream</div>
                    <div className="ep-grid ep-grid-4" style={{ gap: 16 }}>
                      {result.violations.map((v, i) => (
                        <div key={i} style={{ background: 'var(--ep-surface-2)', borderRadius: 10, border: '1px solid var(--ep-line)', padding: 12 }}>
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                            <div style={{ fontWeight: 700, color: 'var(--ep-ink)', fontSize: 12.5 }}>{v.type}</div>
                            <div style={{ fontSize: 11, color: 'var(--ep-muted)' }}>
                              {new Date(v.timestamp).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                            </div>
                          </div>
                          {v.image ? (
                            <div style={{ width: '100%', height: 140, background: '#0f172a', borderRadius: 8, overflow: 'hidden' }}>
                              <img
                                src={v.image}
                                alt="Violation snapshots"
                                style={{ width: '100%', height: '100%', objectFit: 'contain' }}
                              />
                            </div>
                          ) : (
                            <div style={{ background: '#fff', border: '1px dashed var(--ep-line)', height: 140, display: 'grid', placeItems: 'center', borderRadius: 8, color: 'var(--ep-muted)', fontSize: 11.5 }}>
                              No snapshot captured
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </main>
    </div>
  );
};

export default DetectedStudents;
