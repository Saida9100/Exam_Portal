/* eslint-disable */
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
    // Match by 'result' type — same type used in ViewResults so both pages stay in sync
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

    // Super Admin can delete directly
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
      // Regular Admin must request approval
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

  const getStatusBadge = (status) => {
    if (!status) return null;
    const colors = {
      'Pending Approval': { bg: '#fff3e0', color: '#e65100', border: '#ffcc80' },
      'Approved': { bg: '#e8f5e9', color: '#2e7d32', border: '#a5d6a7' },
      'Rejected': { bg: '#ffebee', color: '#c62828', border: '#ef9a9a' },
    };
    const style = colors[status] || colors['Pending Approval'];
    return (
      <span style={{
        fontSize: 11, fontWeight: 700, padding: '3px 10px', borderRadius: 20,
        background: style.bg, color: style.color, border: `1px solid ${style.border}`
      }}>
        {status === 'Pending Approval' ? '⏳ Pending Approval' : status === 'Approved' ? '✅ Approved' : '❌ Rejected'}
      </span>
    );
  };

  return (
    <div style={{ display: 'flex', minHeight: '100vh', background: '#f5f5f5' }}>
      <SharedAdminSidebar />

      <div style={{ flex: 1, padding: 32, marginLeft: '250px' }}>
        {/* Header */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 32 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 24, flex: 1 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
              <Button variant="link" onClick={() => navigate(-1)} style={{ padding: 0, color: '#333', textDecoration: 'none', fontSize: 24 }}>
                ⬅️
              </Button>
              <h2 style={{ margin: 0, fontWeight: 700, color: '#2D0040', whiteSpace: 'nowrap' }}>Detected Students</h2>
            </div>
            <div style={{ width: '100%', maxWidth: 500 }}>
              <input
                placeholder="🔍  Search by student, email or exam..."
                value={searchTerm}
                onChange={e => setSearchTerm(e.target.value)}
                style={{ padding: '8px 16px', borderRadius: 8, border: '1px solid #ccc', fontSize: 14, width: '100%', outline: 'none' }}
              />
            </div>
          </div>
          <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
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
              <Button variant="danger" onClick={handleClearData} style={{ borderRadius: 8, padding: '8px 16px', fontWeight: 600 }}>
                🗑️ Clear All Data
              </Button>
            )}
          </div>
        </div>

        {/* Info banner for regular admins */}
        {admin?.role !== 'super_admin' && (
          <div style={{ padding: '12px 20px', background: '#e8f0fe', borderLeft: '4px solid #3b5bdb', borderRadius: 8, marginBottom: 24, fontSize: 13, color: '#1a237e' }}>
            <strong>ℹ️ Note:</strong> As an Admin, you can <strong>request</strong> deletion of violation records. The Super Admin must approve before any data is removed.
          </div>
        )}

        {/* Alerts */}
        {error && (
          <div style={{ padding: 16, background: '#fff5f5', border: '1px solid #ffcdd2', color: '#c62828', borderRadius: 8, marginBottom: 24 }}>
            {error}
          </div>
        )}
        {success && (
          <div style={{ padding: 16, background: '#f0fdf4', border: '1px solid #bbf7d0', color: '#15803d', borderRadius: 8, marginBottom: 24, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span>{success}</span>
            <button onClick={() => setSuccess('')} style={{ background: 'none', border: 'none', fontSize: 18, cursor: 'pointer', color: '#15803d' }}>×</button>
          </div>
        )}

        {loading ? (
          <div style={{ textAlign: 'center', padding: 40, color: '#888' }}>Loading detected students...</div>
        ) : finalFilteredResults.length === 0 ? (
          <div style={{ textAlign: 'center', padding: 60, background: '#fff', borderRadius: 12, border: '1px solid #e0e0e0', color: '#888' }}>
            <div style={{ fontSize: 48, marginBottom: 16 }}>✅</div>
            <h4 style={{ color: '#333' }}>No Violations Detected!</h4>
            <p>None of the matching students have triggered any proctoring flags.</p>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
            {finalFilteredResults.map((result) => {
              const id = result.attempt_id || result.id;
              const requestStatus = getRequestStatus(id);
              const isRequesting = requestingIds[id];

              return (
                <Card key={id} style={{ borderRadius: 16, border: 'none', boxShadow: '0 4px 12px rgba(0,0,0,0.05)', overflow: 'hidden' }}>
                  <Card.Header style={{ background: '#fff5f5', borderBottom: '1px solid #ffcdd2', padding: 20 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <div>
                        <h5 style={{ margin: 0, color: '#b71c1c', fontWeight: 700 }}>{result.student_name}</h5>
                        <div style={{ color: '#d32f2f', fontSize: 13, marginTop: 4 }}>{result.student_email}</div>
                      </div>
                      <div style={{ textAlign: 'right', display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 8 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                          <Badge bg="danger" style={{ fontSize: 13, padding: '6px 12px', borderRadius: 20 }}>
                            {result.violations.length} Violations
                          </Badge>

                          {/* Delete / Request Delete button */}
                          {admin?.role === 'super_admin' ? (
                            <Button
                              variant="outline-danger"
                              size="sm"
                              disabled={isRequesting}
                              onClick={() => handleDelete(result)}
                              style={{ borderRadius: 6, fontWeight: 600, fontSize: 12 }}
                            >
                              {isRequesting ? 'Deleting...' : 'Delete'}
                            </Button>
                          ) : (
                            requestStatus === 'Pending Approval' ? (
                              <span style={{ fontSize: 11, fontWeight: 700, padding: '4px 12px', borderRadius: 20, background: '#fff3e0', color: '#e65100', border: '1px solid #ffcc80' }}>
                                ⏳ Pending Approval
                              </span>
                            ) : requestStatus === 'Approved' ? (
                              <span style={{ fontSize: 11, fontWeight: 700, padding: '4px 12px', borderRadius: 20, background: '#e8f5e9', color: '#2e7d32', border: '1px solid #a5d6a7' }}>
                                ✅ Delete Approved
                              </span>
                            ) : (
                              <Button
                                variant="outline-warning"
                                size="sm"
                                disabled={isRequesting}
                                onClick={() => handleDelete(result)}
                                style={{ borderRadius: 6, fontWeight: 600, fontSize: 12, color: '#e65100', borderColor: '#e65100' }}
                              >
                                {isRequesting ? 'Requesting...' : requestStatus === 'Rejected' ? '🔄 Re-request Delete' : '🗑️ Request Delete'}
                              </Button>
                            )
                          )}
                        </div>
                        <div style={{ fontSize: 12, color: '#888' }}>
                          Exam: {result.exam_title}
                        </div>
                      </div>
                    </div>
                  </Card.Header>
                  <Card.Body style={{ padding: 20 }}>
                    <div style={{ fontSize: 14, fontWeight: 600, marginBottom: 16, color: '#333' }}>
                      Violation Log
                    </div>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: 20 }}>
                      {result.violations.map((v, i) => (
                        <div key={i} style={{ background: '#fafafa', borderRadius: 12, border: '1px solid #eee', padding: 16 }}>
                          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 12 }}>
                            <div style={{ fontWeight: 600, color: '#2D0040', fontSize: 14 }}>{v.type}</div>
                            <div style={{ fontSize: 12, color: '#888' }}>
                              {new Date(v.timestamp).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                            </div>
                          </div>
                          {v.image ? (
                            <div style={{ width: '100%', height: 200, background: '#000', borderRadius: 8, overflow: 'hidden', position: 'relative' }}>
                              <img
                                src={v.image}
                                alt="Violation snapshot"
                                style={{ width: '100%', height: '100%', objectFit: 'contain' }}
                              />
                            </div>
                          ) : (
                            <div style={{ background: '#f5f5f5', padding: 20, textAlign: 'center', borderRadius: 8, color: '#888', fontSize: 12 }}>
                              No snapshot captured
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  </Card.Body>
                </Card>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
};

export default DetectedStudents;

