/* eslint-disable */
// src/components/StudentManagement.js
import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import apiService from '../services/api';
import SharedAdminSidebar from './SharedAdminSidebar';
import ExportToolbar from './ExportToolbar';
import { prepareStudentsForExport, getExportFilename, filterByDateRange } from '../utils/exportUtils';

// Password generator
const generatePassword = (name) => {
  if (!name || name.trim() === '') name = 'student';
  const nameBase = name.trim().split(' ')[0].toLowerCase().replace(/[^a-z]/g, '').substring(0, 4);
  const uppercase = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
  const digits = '0123456789';
  const specials = '!@#$%^&*';
  const parts = [
    nameBase,
    uppercase[Math.floor(Math.random() * uppercase.length)],
    digits[Math.floor(Math.random() * digits.length)],
    specials[Math.floor(Math.random() * specials.length)],
    digits[Math.floor(Math.random() * digits.length)],
  ];
  const lowercase = 'abcdefghijklmnopqrstuvwxyz';
  while (parts.join('').length < 8) {
    parts.push(lowercase[Math.floor(Math.random() * lowercase.length)]);
  }
  for (let i = parts.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [parts[i], parts[j]] = [parts[j], parts[i]];
  }
  const pw = parts.join('');
  const ok = pw.length >= 8 && /[A-Z]/.test(pw) && /[a-z]/.test(pw) && /[0-9]/.test(pw) && /[!@#$%^&*]/.test(pw);
  return ok ? pw : generatePassword(name + 'a');
};

const StatusPill = ({ status }) => {
  const meta = {
    'Pending Approval': { className: 'ep-badge-warning', icon: '⏳' },
    'Approved': { className: 'ep-badge-success', icon: '✅' },
    'Rejected': { className: 'ep-badge-danger', icon: '❌' },
  }[status] || { className: '', icon: '•' };
  return (
    <span className={`ep-badge ${meta.className}`}>
      <span>{meta.icon}</span>&nbsp;{status}
    </span>
  );
};

const StudentManagement = () => {
  const navigate = useNavigate();
  const admin = apiService.getUser();
  const fileRef = useRef();

  const [tab, setTab] = useState('list');
  const [students, setStudents] = useState([]);
  const [loading, setLoading] = useState(false);
  const [actionLoading, setActionLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [searchTerm, setSearchTerm] = useState('');

  const [form, setForm] = useState({ name: '', email: '', password: '' });
  const [autoPass, setAutoPass] = useState(true);

  const [bulkText, setBulkText] = useState('');
  const [bulkPreview, setBulkPreview] = useState([]);
  const [bulkResult, setBulkResult] = useState(null);

  const [resetModal, setResetModal] = useState({ isOpen: false, id: null, name: '', newPassword: '' });
  const [adminsList, setAdminsList] = useState([]);
  const [selectedAdminId, setSelectedAdminId] = useState('');
  const [selectedFilterAdminId, setSelectedFilterAdminId] = useState('');
  const [exportFilters, setExportFilters] = useState({ startDate: '', endDate: '', searchTerm: '' });

  // my own deletion requests
  const [myRequests, setMyRequests] = useState([]);
  const [requestStatusFilter, setRequestStatusFilter] = useState('');

  const fetchStudents = async () => {
    setLoading(true);
    try {
      const res = await apiService.getStudents();
      setStudents(res.students || []);
    } catch (e) { setError(e.message); }
    finally { setLoading(false); }
  };

  const fetchMyRequests = async () => {
    try {
      const res = await apiService.getAdminDeletionRequests();
      if (res.success) setMyRequests(res.requests || []);
    } catch (e) { console.error(e); }
  };

  useEffect(() => {
    fetchStudents();
    fetchMyRequests();
    if (admin?.role === 'super_admin') {
      apiService.getAdmins()
        .then((res) => setAdminsList((res.admins || []).filter((a) => a.role === 'admin')))
        .catch(console.error);
    }
  }, [admin?.role]);

  const handleDelete = async (id, name, email) => {
    if (admin?.role === 'super_admin') {
      if (!window.confirm(`Delete student "${name}"? This cannot be undone.`)) return;
      setError('');
      try {
        await apiService.deleteStudent(id);
        setSuccess(`Student "${name}" deleted.`);
        fetchStudents();
      } catch (e) { setError(e.message); }
    } else {
      const reason = window.prompt(
        `Request deletion of student "${name}"?\n\nThe Super Admin must approve this.\n\nOptional reason:`,
        ''
      );
      if (reason === null) return;
      setError('');
      try {
        await apiService.submitDeletionRequest({
          type: 'student',
          target_id: id,
          student_name: name,
          student_email: email,
          reason: reason || null,
        });
        setSuccess(`Deletion request for "${name}" sent to Super Admin.`);
        fetchMyRequests();
      } catch (e) { setError(e.message); }
    }
  };

  const handleClearData = async () => {
    if (admin?.role !== 'super_admin') return setError('Only Super Admins can perform bulk deletions.');
    if (!window.confirm('Are you sure you want to delete all students? This cannot be undone.')) return;
    try {
      setLoading(true);
      await Promise.all(students.map((s) => apiService.deleteStudent(s.id)));
      setStudents([]);
      setSuccess('All students deleted successfully.');
    } catch (err) {
      setError('Failed to clear students: ' + err.message);
    } finally { setLoading(false); }
  };

  const handleSingleCreate = async (e) => {
    e.preventDefault();
    setError(''); setSuccess('');
    if (!form.name || !form.email || !form.password) return setError('All fields are required.');
    if (admin?.role === 'super_admin' && !selectedAdminId) return setError('Please assign the student to an Admin.');
    setActionLoading(true);
    try {
      const res = await apiService.request('/api/admin/students/create', {
        method: 'POST',
        body: JSON.stringify({
          email: form.email.trim().toLowerCase(),
          password: form.password,
          first_name: form.name.trim().split(' ')[0],
          last_name: form.name.trim().split(' ').slice(1).join(' ') || null,
          admin_id: selectedAdminId || admin?.id,
        }),
      });
      if (res.success) {
        setSuccess(`✅ Student "${form.name}" created!\n📧 ${form.email}\n🔑 ${form.password}`);
        setForm({ name: '', email: '', password: '' });
        fetchStudents();
      } else {
        setError(res.message || 'Failed to create student.');
      }
    } catch (e) { setError(e.message || 'Failed to create student.'); }
    setActionLoading(false);
  };

  const handleResetPassword = async (e) => {
    e.preventDefault();
    if (!resetModal.newPassword) return setError('Please enter a new password.');
    try {
      setActionLoading(true);
      await apiService.updateStudent(resetModal.id, { password: resetModal.newPassword });
      setSuccess(`✅ Password for "${resetModal.name}" updated.`);
      setResetModal({ isOpen: false, id: null, name: '', newPassword: '' });
    } catch (err) { setError(err.message || 'Failed to update password.'); }
    finally { setActionLoading(false); }
  };

  const parseBulkText = (text) => {
    const lines = text.split('\n').map((l) => l.trim()).filter(Boolean);
    setBulkPreview(lines.map((line, i) => {
      const parts = line.split(',').map((p) => p.trim());
      if (parts.length >= 2) {
        return {
          name: parts[0], email: parts[1],
          password: parts[2] || generatePassword(parts[0]),
          _line: i + 1, _valid: !!(parts[0] && parts[1]),
        };
      }
      return { name: line, email: '', password: '', _line: i + 1, _valid: false };
    }));
  };

  const handleCSVUpload = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      const text = ev.target.result;
      const lines = text.split('\n').filter(Boolean);
      const startIdx = lines[0]?.toLowerCase().includes('name') ? 1 : 0;
      const dataLines = lines.slice(startIdx).join('\n');
      setBulkText(dataLines);
      parseBulkText(dataLines);
    };
    reader.readAsText(file);
  };

  const handleBulkCreate = async () => {
    setError(''); setSuccess(''); setBulkResult(null);
    const validStudents = bulkPreview.filter((s) => s._valid)
      .map(({ name, email, password }) => ({
        email: email.toLowerCase(), password,
        first_name: name.trim().split(' ')[0],
        last_name: name.trim().split(' ').slice(1).join(' ') || null,
      }));
    if (!validStudents.length) return setError('No valid student records found.');
    if (admin?.role === 'super_admin' && !selectedAdminId) return setError('Please assign the students to an Admin.');
    setActionLoading(true);
    try {
      const csvContent = [
        'email,password,first_name,last_name',
        ...validStudents.map((s) => `${s.email},${s.password},"${s.first_name}","${s.last_name || ''}"`),
      ].join('\n');
      const csvBlob = new Blob([csvContent], { type: 'text/csv' });
      const csvFile = new File([csvBlob], 'students.csv', { type: 'text/csv' });
      const targetAdmin = selectedAdminId || admin?.id;
      const data = await apiService.bulkCreateStudents(csvFile, targetAdmin);
      if (data.success) {
        setBulkResult(data.data);
        const created = data.data?.summary?.created ?? validStudents.length;
        const createdRows = data.data?.created || [];
        const sentCount = createdRows.filter((r) => r.email_sent).length;
        setSuccess(`✅ ${created} student(s) created successfully! 📨 ${sentCount}/${created} credentials email(s) sent.`);
        fetchStudents();
        setTimeout(() => { setBulkText(''); setBulkPreview([]); }, 3000);
      } else {
        setError(data.message || 'Failed to create students');
      }
    } catch (e) { setError(e.message || 'Failed to create students'); }
    setActionLoading(false);
  };

  const adminFilteredStudents = selectedFilterAdminId
    ? students.filter((s) => String(s.admin_id) === String(selectedFilterAdminId))
    : students;
  const searchFilteredStudents = adminFilteredStudents.filter((s) =>
    (s.name || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
    (s.email || '').toLowerCase().includes(searchTerm.toLowerCase())
  );
  const finalFilteredStudents = filterByDateRange(searchFilteredStudents, exportFilters.startDate, exportFilters.endDate, 'created_at');

  const filteredRequests = requestStatusFilter
    ? myRequests.filter((r) => r.status === requestStatusFilter)
    : myRequests;

  const pendingCount = myRequests.filter((r) => r.status === 'Pending Approval').length;
  const adminInitial = admin?.name?.charAt(0)?.toUpperCase() || 'A';

  return (
    <div style={{ display: 'flex', minHeight: '100vh' }}>
      <SharedAdminSidebar active="students" onLogout={() => apiService.logout()} />

      <main className="dashboard-main ep-page" style={{ flex: 1, minWidth: 0 }}>
        {/* Header */}
        <div className="ep-page-header">
          <div>
            <div className="ep-kicker">Manage Candidates</div>
            <h1>Student Accounts</h1>
            <p>
              Showing {students.length} student{students.length === 1 ? '' : 's'}
              {pendingCount > 0 && (
                <span className="ep-badge ep-badge-warning" style={{ marginLeft: 10 }}>
                  ⏳ {pendingCount} Pending Request{pendingCount > 1 ? 's' : ''}
                </span>
              )}
            </p>
          </div>
          <div className="ep-user-chip">
            <div className="avatar">{adminInitial}</div>
            <div>
              <strong>{admin?.name || 'Administrator'}</strong>
              <span>{admin?.email}</span>
            </div>
          </div>
        </div>

        {success && (
          <div className="ep-alert" style={{ background: 'var(--ep-success-soft)', color: 'var(--ep-success)', border: '1px solid #bbf7d0', padding: 14, borderRadius: 10, marginBottom: 18, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontSize: 13.5, whiteSpace: 'pre-line' }}>{success}</span>
            <button onClick={() => setSuccess('')} style={{ background: 'none', border: 'none', color: 'var(--ep-success)', fontSize: 18, fontWeight: 'bold' }}>×</button>
          </div>
        )}
        {error && (
          <div className="ep-alert" style={{ background: 'var(--ep-danger-soft)', color: 'var(--ep-danger)', border: '1px solid #fecaca', padding: 14, borderRadius: 10, marginBottom: 18, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontSize: 13.5 }}>{error}</span>
            <button onClick={() => setError('')} style={{ background: 'none', border: 'none', color: 'var(--ep-danger)', fontSize: 18, fontWeight: 'bold' }}>×</button>
          </div>
        )}

        {/* Toolbar Tabs */}
        <div className="toolbar" style={{ marginBottom: 18 }}>
          <div className="pill-tabs">
            <button className={tab === 'list' ? 'active' : ''} onClick={() => setTab('list')}>👥 Student List</button>
            <button className={tab === 'manual' ? 'active' : ''} onClick={() => setTab('manual')}>➕ Add Single</button>
            <button className={tab === 'bulk' ? 'active' : ''} onClick={() => setTab('bulk')}>📋 Bulk Create</button>
            <button className={tab === 'requests' ? 'active' : ''} onClick={() => setTab('requests')}>
              🔔 My Requests
              {pendingCount > 0 && (
                <span className="badge ms-2" style={{ background: 'var(--ep-danger)', color: '#fff', fontSize: 10, padding: '2px 6px', borderRadius: 12 }}>{pendingCount}</span>
              )}
            </button>
          </div>
          {admin?.role === 'super_admin' && (
            <button onClick={handleClearData} className="ep-btn ep-btn-outline" style={{ color: 'var(--ep-danger)', borderColor: 'var(--ep-danger-soft)' }}>
              🗑️ Clear All Students
            </button>
          )}
        </div>

        {/* ═══ TAB: REQUESTS ═══ */}
        {tab === 'requests' && (
          <div className="ep-card" style={{ padding: 24 }}>
            <div className="d-flex gap-2 mb-3 align-items-center flex-wrap" style={{ borderBottom: '1px solid var(--ep-line)', paddingBottom: 16 }}>
              <span style={{ fontSize: 13, color: 'var(--ep-muted)', fontWeight: 600 }}>Filter Requests:</span>
              {['', 'Pending Approval', 'Approved', 'Rejected'].map((s) => (
                <button
                  key={s || 'all'}
                  onClick={() => setRequestStatusFilter(s)}
                  className={`ep-btn ${requestStatusFilter === s ? 'ep-btn-primary' : 'ep-btn-outline'}`}
                  style={{ padding: '6px 14px', fontSize: 12.5 }}
                >{s || 'All'}</button>
              ))}
              <button onClick={fetchMyRequests} className="ep-btn ep-btn-outline" style={{ padding: '6px 14px', fontSize: 12.5, marginLeft: 'auto' }}>
                🔄 Refresh
              </button>
            </div>

            {filteredRequests.length === 0 ? (
              <div className="ep-empty">
                <div style={{ fontSize: 48, marginBottom: 8 }}>📭</div>
                <h4>No requests found</h4>
                <p>When you request deletion of students, they will list here for Super Admin audit.</p>
              </div>
            ) : (
              <div className="ep-grid ep-grid-2">
                {filteredRequests.map((req) => (
                  <div className="ep-card" key={req.id} style={{ padding: 18, background: 'var(--ep-surface-2)' }}>
                    <div className="d-flex align-items-center justify-content-between">
                      <StatusPill status={req.status} />
                      <span style={{ fontSize: 11, color: 'var(--ep-muted)' }}>ID: #{req.id} • Student Deletion</span>
                    </div>
                    <div style={{ marginTop: 10, fontSize: 15, fontWeight: 700, color: 'var(--ep-ink)' }}>
                      {req.display_name || `Target ID: ${req.target_id}`}
                    </div>
                    {req.display_subtitle && (
                      <div style={{ fontSize: 12.5, color: 'var(--ep-muted)', marginTop: 2 }}>{req.display_subtitle}</div>
                    )}
                    {req.reason && (
                      <div style={{
                        marginTop: 10, padding: '10px 12px',
                        background: '#fff', borderRadius: 8,
                        fontSize: 12.5, color: 'var(--ep-ink-2)',
                        borderLeft: '3px solid var(--ep-brand)',
                      }}>
                        <strong>Reason:</strong> {req.reason}
                      </div>
                    )}
                    <div style={{ marginTop: 10, fontSize: 11.5, color: 'var(--ep-muted)' }}>
                      Submitted: {new Date(req.created_at).toLocaleString('en-IN')}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* ═══ TAB: LIST ═══ */}
        {tab === 'list' && (
          <>
            <div className="ep-grid ep-grid-2 mb-3">
              {admin?.role === 'super_admin' && (
                <div className="field" style={{ marginBottom: 0 }}>
                  <select
                    value={selectedFilterAdminId}
                    onChange={(e) => setSelectedFilterAdminId(e.target.value)}
                    style={{ fontWeight: 600, color: 'var(--ep-brand)' }}
                  >
                    <option value="">All Faculty / Admins</option>
                    {adminsList.map((a) => (
                      <option key={a.id} value={a.id}>
                        {a.name || a.email} ({a.email})
                      </option>
                    ))}
                  </select>
                </div>
              )}
              <div className="field" style={{ marginBottom: 0 }}>
                <input
                  type="text" placeholder="🔍 Search students by name or email..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                />
              </div>
            </div>

            <div className="ep-card">
              <div className="ep-card-head" style={{ borderBottom: '1px solid var(--ep-line)', padding: '14px 18px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 12 }}>
                <div>
                  <h3 style={{ margin: 0, fontSize: 14.5, fontWeight: 700 }}>Student Directory</h3>
                  <p style={{ margin: '2px 0 0', fontSize: 12, color: 'var(--ep-muted)' }}>Registered students eligible for exam access</p>
                </div>
                <ExportToolbar
                  data={finalFilteredStudents}
                  prepareDataFn={prepareStudentsForExport}
                  filenameFn={(d) => getExportFilename('students', d)}
                  filters={exportFilters}
                  onFiltersChange={setExportFilters}
                />
              </div>

              {loading ? (
                <div style={{ padding: 40, textAlign: 'center', color: 'var(--ep-muted)' }}>
                  <div className="spinner-border spinner-border-sm text-primary me-2" />
                  Loading students Directory...
                </div>
              ) : finalFilteredStudents.length === 0 ? (
                <div className="ep-empty">
                  <div style={{ fontSize: 48, marginBottom: 8 }}>👥</div>
                  <h4>No students found</h4>
                  <p>Try clearing filters or add a student to begin.</p>
                </div>
              ) : (
                <div className="table-wrap">
                  <table className="ep-table">
                    <thead>
                      <tr>
                        <th>#</th>
                        <th>Name</th>
                        <th>Email</th>
                        <th>Assigned Admin</th>
                        <th>Joined Date</th>
                        <th style={{ textAlign: 'center' }}>Action</th>
                      </tr>
                    </thead>
                    <tbody>
                      {finalFilteredStudents.map((s, i) => {
                        const pendingReq = myRequests.find(
                          (r) => String(r.target_id) === String(s.id) && r.type === 'student' && r.status === 'Pending Approval'
                        );
                        const rejectedReq = myRequests.find(
                          (r) => String(r.target_id) === String(s.id) && r.type === 'student' && r.status === 'Rejected'
                        );

                        return (
                          <tr key={s.id} className="row-hover">
                            <td>{i + 1}</td>
                            <td className="cell-strong">{s.name}</td>
                            <td>{s.email}</td>
                            <td>
                              {(() => {
                                const found = adminsList.find((a) => String(a.id) === String(s.admin_id));
                                return found ? `${found.name || found.email}` : (s.admin_id ? `Admin #${s.admin_id}` : '—');
                              })()}
                            </td>
                            <td>
                              {new Date(s.created_at).toLocaleDateString('en-IN', {
                                day: 'numeric', month: 'short', year: 'numeric',
                              })}
                            </td>
                            <td>
                              <div style={{ display: 'flex', gap: 6, justifyContent: 'center', flexWrap: 'wrap' }}>
                                <button
                                  onClick={() => setResetModal({ isOpen: true, id: s.id, name: s.name, newPassword: '' })}
                                  className="ep-btn ep-btn-outline"
                                  style={{ padding: '4px 10px', fontSize: 11.5 }}
                                >
                                  🔑 Reset Pass
                                </button>

                                {pendingReq ? (
                                  <span className="ep-badge ep-badge-warning" style={{ fontSize: 11.5 }}>
                                    ⏳ Pending Approval
                                  </span>
                                ) : rejectedReq ? (
                                  <button
                                    onClick={() => handleDelete(s.id, s.name, s.email)}
                                    className="ep-btn ep-btn-outline"
                                    style={{ padding: '4px 10px', fontSize: 11.5, color: 'var(--ep-danger)', borderColor: 'var(--ep-danger-soft)' }}
                                  >
                                    🗑 Retry Delete
                                  </button>
                                ) : (
                                  <button
                                    onClick={() => handleDelete(s.id, s.name, s.email)}
                                    className="ep-btn ep-btn-outline"
                                    style={{ padding: '4px 10px', fontSize: 11.5, color: 'var(--ep-danger)' }}
                                  >
                                    🗑 Delete
                                  </button>
                                )}
                              </div>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </>
        )}

        {/* ═══ TAB: MANUAL ═══ */}
        {tab === 'manual' && (
          <div className="ep-card" style={{ maxWidth: 640, margin: '0 auto', padding: 28 }}>
            <div className="ep-card-head" style={{ borderBottom: '1px solid var(--ep-line)', paddingBottom: 12, marginBottom: 20 }}>
              <h3 style={{ margin: 0, fontSize: 16 }}>➕ Create Single Student Account</h3>
              <p style={{ margin: '2px 0 0', fontSize: 12, color: 'var(--ep-muted)' }}>Add individual student candidates instantly.</p>
            </div>
            <form onSubmit={handleSingleCreate}>
              <div className="form-row">
                <div className="field">
                  <label>Full Name *</label>
                  <input type="text" required
                    value={form.name}
                    onChange={(e) => {
                      const v = e.target.value;
                      setForm({ ...form, name: v });
                      if (autoPass) setForm((f) => ({ ...f, password: generatePassword(v) }));
                    }}
                    placeholder="e.g. John Doe"
                  />
                </div>
                <div className="field">
                  <label>Email Address *</label>
                  <input type="email" required
                    value={form.email}
                    onChange={(e) => setForm({ ...form, email: e.target.value })}
                    placeholder="e.g. john@university.edu"
                  />
                </div>
              </div>
              <div className="field">
                <label style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span>Password *</span>
                  <span onClick={() => { setAutoPass(!autoPass); if (!autoPass) setForm({ ...form, password: generatePassword(form.name) }); }}
                    style={{ color: 'var(--ep-brand)', cursor: 'pointer', fontWeight: 700, fontSize: 12 }}>
                    {autoPass ? '🔄 Switch to Manual' : '✏️ Switch to Auto'}
                  </span>
                </label>
                <input type="text" required
                  value={form.password}
                  onChange={(e) => setForm({ ...form, password: e.target.value })}
                  readOnly={autoPass}
                  style={{ background: autoPass ? 'var(--ep-surface-2)' : '#fff' }}
                />
              </div>
              {admin?.role === 'super_admin' && (
                <div className="field">
                  <label>Assign to Faculty Admin *</label>
                  <select required
                    value={selectedAdminId}
                    onChange={(e) => setSelectedAdminId(e.target.value)}
                  >
                    <option value="">Select admin…</option>
                    {adminsList.map((a) => (
                      <option key={a.id} value={a.id}>{a.name || a.email} ({a.email})</option>
                    ))}
                  </select>
                </div>
              )}
              <div className="field-help" style={{ marginBottom: 14 }}>
                Tip: Share credentials with the student. They can easily reset their password upon logging in.
              </div>
              <button type="submit" disabled={actionLoading} className="ep-btn ep-btn-primary ep-btn-block" style={{ marginTop: 10 }}>
                {actionLoading ? 'Creating Candidate…' : '➕ Create Student Account'}
              </button>
            </form>
          </div>
        )}

        {/* ═══ TAB: BULK ═══ */}
        {tab === 'bulk' && (
          <div className="ep-card" style={{ maxWidth: 700, margin: '0 auto', padding: 28 }}>
            <div className="ep-card-head" style={{ borderBottom: '1px solid var(--ep-line)', paddingBottom: 12, marginBottom: 16 }}>
              <h3 style={{ margin: 0, fontSize: 16 }}>📋 Bulk Create Student Accounts</h3>
              <p style={{ margin: '2px 0 0', fontSize: 12, color: 'var(--ep-muted)' }}>Paste raw CSV/list or upload a text file directly.</p>
            </div>
            <div className="ep-alert tips" style={{ background: 'var(--ep-info-soft)', color: '#0369a1', border: '1px solid #bae6fd', padding: 12, borderRadius: 10, fontSize: 12.5, marginBottom: 16 }}>
              Format structure: <code>Name, Email, Password</code> (one candidate per line). Password is optional and will auto-generate if omitted.
            </div>
            <div className="field">
              <label>Upload File (.csv, .txt)</label>
              <input type="file" accept=".csv,.txt" onChange={handleCSVUpload} style={{ padding: '8px 12px' }} />
            </div>
            <div className="field">
              <label>Or Paste Student List</label>
              <textarea
                placeholder={`John Doe, john@example.com, Pass@123\nJane Smith, jane@example.com`}
                value={bulkText}
                onChange={(e) => { setBulkText(e.target.value); parseBulkText(e.target.value); }}
                rows={6}
                style={{ fontFamily: 'monospace', fontSize: 12.5 }}
              />
            </div>
            {bulkPreview.length > 0 && (
              <div style={{ margin: '12px 0', padding: 10, background: 'var(--ep-brand-soft)', borderRadius: 8, fontSize: 13, color: 'var(--ep-brand)', fontWeight: 600 }}>
                📊 Parsing Check: {bulkPreview.filter((s) => s._valid).length} valid entries ready out of {bulkPreview.length} lines total.
              </div>
            )}
            {admin?.role === 'super_admin' && (
              <div className="field">
                <label>Assign to Faculty Admin *</label>
                <select value={selectedAdminId} onChange={(e) => setSelectedAdminId(e.target.value)}>
                  <option value="">Select admin…</option>
                  {adminsList.map((a) => (
                    <option key={a.id} value={a.id}>{a.name || a.email} ({a.email})</option>
                  ))}
                </select>
              </div>
            )}
            <button onClick={handleBulkCreate} disabled={actionLoading} className="ep-btn ep-btn-primary ep-btn-block" style={{ marginTop: 12 }}>
              {actionLoading ? 'Executing bulk import…' : '🚀 Import Student Accounts'}
            </button>
            {bulkResult && (
              <div style={{ marginTop: 14, padding: 12, background: 'var(--ep-surface-2)', borderRadius: 8, fontSize: 13, border: '1px solid var(--ep-line)' }}>
                <div>✅ Successful Creations: <strong>{bulkResult.summary?.created || 0}</strong></div>
                {bulkResult.skipped?.length > 0 && <div>⚠️ Skipped lines: {bulkResult.skipped.length}</div>}
                {bulkResult.errors?.length > 0 && <div style={{ color: 'var(--ep-danger)' }}>❌ Errors: {bulkResult.errors.length}</div>}
              </div>
            )}
          </div>
        )}
      </main>

      {/* Password Reset Modal */}
      {resetModal.isOpen && (
        <div style={{
          position: 'fixed', inset: 0,
          background: 'rgba(15,23,42,0.55)',
          backdropFilter: 'blur(4px)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          zIndex: 1000, padding: 20,
        }}>
          <div className="ep-card" style={{
            background: '#fff', borderRadius: 16, padding: 24,
            width: '100%', maxWidth: 390, boxShadow: 'var(--ep-shadow-lg)',
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 14 }}>
              <div>
                <h3 style={{ margin: 0, color: 'var(--ep-ink)', fontSize: 18, fontWeight: 800 }}>🔑 Reset Password</h3>
                <div style={{ color: 'var(--ep-muted)', fontSize: 13, marginTop: 3 }}>Change password for student: <strong>{resetModal.name}</strong></div>
              </div>
              <button
                type="button"
                onClick={() => setResetModal({ isOpen: false, id: null, name: '', newPassword: '' })}
                style={{ background: 'none', border: 'none', fontSize: 24, cursor: 'pointer', color: 'var(--ep-muted)', lineHeight: 1 }}
              >×</button>
            </div>

            <form onSubmit={handleResetPassword}>
              <div className="field">
                <label>New Password</label>
                <input
                  type="text"
                  required
                  value={resetModal.newPassword}
                  onChange={(e) => setResetModal({ ...resetModal, newPassword: e.target.value })}
                  placeholder="Enter secure new password"
                  disabled={actionLoading}
                />
              </div>

              <div style={{ display: 'flex', gap: 10, marginTop: 18 }}>
                <button
                  type="button"
                  className="ep-btn ep-btn-outline"
                  onClick={() => setResetModal({ isOpen: false, id: null, name: '', newPassword: '' })}
                  style={{ flex: 1 }}
                  disabled={actionLoading}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="ep-btn ep-btn-primary"
                  style={{ flex: 1 }}
                  disabled={actionLoading}
                >
                  {actionLoading ? 'Updating...' : 'Save Password'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default StudentManagement;
