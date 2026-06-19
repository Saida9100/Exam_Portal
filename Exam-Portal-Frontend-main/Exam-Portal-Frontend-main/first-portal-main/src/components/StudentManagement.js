// src/components/StudentManagement.js
// ✅ ENHANCED: regular admins can now see the status of their own
//    deletion requests (pending / approved / rejected).

import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import apiService from '../services/api';
import SharedAdminSidebar from './SharedAdminSidebar';
import ExportToolbar from './ExportToolbar';
import {
  prepareStudentsForExport, getExportFilename, filterByDateRange,
} from '../utils/exportUtils';

// (password generator & helpers unchanged — see original file)
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

const downloadCSV = (rows, filename) => {
  const header = Object.keys(rows[0]).join(',');
  const body = rows.map((r) => Object.values(r).map((v) => `"${v}"`).join(',')).join('\n');
  const blob = new Blob([header + '\n' + body], { type: 'text/csv' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = filename; a.click();
  URL.revokeObjectURL(url);
};

const StatusPill = ({ status }) => {
  const meta = {
    'Pending Approval': { bg: '#fff3e0', color: '#e65100', icon: '⏳' },
    'Approved': { bg: '#e8f5e9', color: '#2e7d32', icon: '✅' },
    'Rejected': { bg: '#ffebee', color: '#c62828', icon: '❌' },
  }[status] || { bg: '#eee', color: '#555', icon: '•' };
  return (
    <span style={{
      background: meta.bg, color: meta.color,
      padding: '3px 9px', borderRadius: 999,
      fontSize: 11, fontWeight: 700,
      display: 'inline-flex', alignItems: 'center', gap: 4,
    }}>
      <span>{meta.icon}</span><span>{status}</span>
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

  // ✅ NEW: my own deletion requests
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

  // ✅ REWRITTEN: admin (non-super) submits request, super admin deletes directly
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
      if (reason === null) return; // cancelled
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
        setSuccess(`✅ ${created} student(s) created successfully!`);
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

  const tabStyle = (t) => ({
    padding: '10px 24px', borderRadius: 8, fontWeight: 600, fontSize: 14,
    border: 'none', cursor: 'pointer', transition: 'all 0.2s',
    background: tab === t ? 'linear-gradient(135deg,#5B0A7B,#2D0040)' : '#f0f0f5',
    color: tab === t ? '#fff' : '#555',
    boxShadow: tab === t ? '0 4px 14px rgba(91,10,123,0.3)' : 'none',
  });

  const inputStyle = {
    width: '100%', padding: '12px 14px', fontSize: 14, borderRadius: 10,
    border: '2px solid #e0e0e0', outline: 'none', boxSizing: 'border-box',
  };

  // Filter my requests by status
  const filteredRequests = requestStatusFilter
    ? myRequests.filter((r) => r.status === requestStatusFilter)
    : myRequests;

  const pendingCount = myRequests.filter((r) => r.status === 'Pending Approval').length;

  return (
    <div style={{ minHeight: '100vh', background: '#f5f7fb' }}>
      <SharedAdminSidebar onLogout={() => apiService.logout()} admin={admin} />

      <div style={{ marginLeft: 260, padding: '24px 28px' }}>
        {/* Header */}
        <div style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          marginBottom: 22,
        }}>
          <div>
            <h1 style={{ margin: 0, color: '#2c2c54', fontSize: 24, fontWeight: 800 }}>
              👥 Student Accounts
            </h1>
            <div style={{ color: '#7a7a93', fontSize: 13, marginTop: 2 }}>
              {students.length} active student(s)
              {pendingCount > 0 && (
                <span style={{
                  marginLeft: 10, background: '#fff3e0', color: '#e65100',
                  padding: '3px 10px', borderRadius: 999,
                  fontSize: 12, fontWeight: 700,
                }}>
                  ⏳ {pendingCount} deletion request{pendingCount > 1 ? 's' : ''} pending
                </span>
              )}
            </div>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <span style={{ fontSize: 13, color: '#555' }}>{admin?.email}</span>
            <div style={{
              width: 40, height: 40, borderRadius: '50%',
              background: 'linear-gradient(135deg, #5B0A7B, #7B1FA2)',
              color: '#fff', display: 'flex', alignItems: 'center',
              justifyContent: 'center', fontWeight: 700,
            }}>{admin?.name?.charAt(0)?.toUpperCase() || 'A'}</div>
          </div>
        </div>

        {success && (
          <div style={{
            background: '#e8f5e9', color: '#2e7d32', padding: '12px 16px',
            borderRadius: 10, marginBottom: 16, display: 'flex',
            justifyContent: 'space-between', alignItems: 'center',
            whiteSpace: 'pre-line', fontSize: 14,
          }}>
            <span>{success}</span>
            <button onClick={() => setSuccess('')}
              style={{ background: 'none', border: 'none', color: '#2e7d32',
                       fontSize: 20, cursor: 'pointer' }}>×</button>
          </div>
        )}
        {error && (
          <div style={{
            background: '#ffebee', color: '#c62828', padding: '12px 16px',
            borderRadius: 10, marginBottom: 16, display: 'flex',
            justifyContent: 'space-between', alignItems: 'center', fontSize: 14,
          }}>
            <span>{error}</span>
            <button onClick={() => setError('')}
              style={{ background: 'none', border: 'none', color: '#c62828',
                       fontSize: 20, cursor: 'pointer' }}>×</button>
          </div>
        )}

        {/* Tabs */}
        <div style={{ display: 'flex', gap: 8, marginBottom: 22, flexWrap: 'wrap' }}>
          <button style={tabStyle('list')} onClick={() => setTab('list')}>👥 Student List</button>
          <button style={tabStyle('manual')} onClick={() => setTab('manual')}>➕ Add Single</button>
          <button style={tabStyle('bulk')} onClick={() => setTab('bulk')}>📋 Bulk Create</button>
          <button
            style={tabStyle('requests')}
            onClick={() => setTab('requests')}
          >
            🔔 My Requests
            {pendingCount > 0 && (
              <span style={{
                marginLeft: 8, background: '#e65100', color: '#fff',
                padding: '2px 8px', borderRadius: 999, fontSize: 11, fontWeight: 700,
              }}>{pendingCount}</span>
            )}
          </button>
          {admin?.role === 'super_admin' && (
            <button onClick={handleClearData}
              style={{
                padding: '10px 24px', borderRadius: 8,
                background: '#fff', border: '2px solid #ffcdd2',
                color: '#c62828', fontWeight: 600, fontSize: 14, cursor: 'pointer',
                marginLeft: 'auto',
              }}
            >🗑️ Clear Data</button>
          )}
        </div>

        {/* ═══ TAB: REQUESTS (NEW) ═══ */}
        {tab === 'requests' && (
          <div>
            <div style={{ display: 'flex', gap: 8, marginBottom: 14, alignItems: 'center' }}>
              <span style={{ fontSize: 13, color: '#555', fontWeight: 600 }}>Filter:</span>
              {['', 'Pending Approval', 'Approved', 'Rejected'].map((s) => (
                <button
                  key={s || 'all'}
                  onClick={() => setRequestStatusFilter(s)}
                  style={{
                    padding: '6px 14px', borderRadius: 8,
                    background: requestStatusFilter === s ? '#5B0A7B' : '#fff',
                    color: requestStatusFilter === s ? '#fff' : '#555',
                    border: '1.5px solid ' + (requestStatusFilter === s ? '#5B0A7B' : '#e0e0e0'),
                    fontWeight: 600, fontSize: 13, cursor: 'pointer',
                  }}
                >{s || 'All'}</button>
              ))}
              <button onClick={fetchMyRequests}
                style={{
                  marginLeft: 'auto', padding: '6px 14px', borderRadius: 8,
                  background: '#fff', border: '1.5px solid #e0e0e0',
                  color: '#555', fontWeight: 600, fontSize: 13, cursor: 'pointer',
                }}
              >🔄 Refresh</button>
            </div>

            {filteredRequests.length === 0 ? (
              <div style={{
                padding: 50, textAlign: 'center',
                background: '#fff', borderRadius: 14,
                border: '1px solid #ece9f4',
              }}>
                <div style={{ fontSize: 36, marginBottom: 8 }}>📭</div>
                <div style={{ color: '#888', fontSize: 15 }}>
                  No deletion requests yet.
                </div>
                <div style={{ color: '#aaa', fontSize: 12, marginTop: 6 }}>
                  When you click 🗑 on a student, a request will appear here.
                </div>
              </div>
            ) : (
              <div style={{ display: 'grid', gap: 12 }}>
                {filteredRequests.map((req) => (
                  <div key={req.id} style={{
                    background: '#fff', borderRadius: 12,
                    padding: 18, border: '1px solid #ece9f4',
                    boxShadow: '0 2px 8px rgba(91,10,123,0.04)',
                  }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
                      <StatusPill status={req.status} />
                      <span style={{ fontSize: 12, color: '#888' }}>
                        Request #{req.id} • {req.type}
                      </span>
                    </div>
                    <div style={{ marginTop: 8, fontSize: 15, fontWeight: 700, color: '#2c2c54' }}>
                      {req.display_name || `Target #${req.target_id}`}
                    </div>
                    {req.display_subtitle && (
                      <div style={{ fontSize: 13, color: '#666' }}>{req.display_subtitle}</div>
                    )}
                    {req.reason && (
                      <div style={{
                        marginTop: 8, padding: '8px 12px',
                        background: '#fafafa', borderRadius: 8,
                        fontSize: 13, color: '#555',
                        borderLeft: '3px solid #7B1FA2',
                      }}>
                        <strong>Reason:</strong> {req.reason}
                      </div>
                    )}
                    <div style={{ marginTop: 8, fontSize: 12, color: '#888' }}>
                      Submitted {new Date(req.created_at).toLocaleString('en-IN', {
                        day: '2-digit', month: 'short', year: 'numeric',
                        hour: '2-digit', minute: '2-digit',
                      })}
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
            {admin?.role === 'super_admin' && (
              <div style={{ marginBottom: 12 }}>
                <select
                  value={selectedFilterAdminId}
                  onChange={(e) => setSelectedFilterAdminId(e.target.value)}
                  style={{ ...inputStyle, color: '#5B0A7B', fontWeight: 600 }}
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
            <div style={{ marginBottom: 12 }}>
              <input
                type="text" placeholder="🔍 Search students..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                style={inputStyle}
              />
            </div>
            <ExportToolbar
              data={finalFilteredStudents}
              prepareDataFn={prepareStudentsForExport}
              filenameFn={(d) => getExportFilename('students', d)}
              filters={exportFilters}
              onFiltersChange={setExportFilters}
            />

            {loading ? (
              <div style={{ padding: 40, textAlign: 'center', color: '#888' }}>
                Loading students…
              </div>
            ) : finalFilteredStudents.length === 0 ? (
              <div style={{
                padding: 50, textAlign: 'center',
                background: '#fff', borderRadius: 14,
                border: '1px solid #ece9f4',
              }}>
                <div style={{ fontSize: 36, marginBottom: 8 }}>👤</div>
                <div style={{ color: '#888', fontSize: 15 }}>
                  No students found.
                </div>
              </div>
            ) : (
              <div style={{ background: '#fff', borderRadius: 12, overflow: 'hidden', border: '1px solid #ece9f4' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 14 }}>
                  <thead>
                    <tr style={{ background: '#faf8ff' }}>
                      {['#', 'Name', 'Email', 'Assigned Admin', 'Joined', 'Action'].map((h) => (
                        <th key={h} style={{
                          padding: '14px 16px', textAlign: 'left',
                          color: '#5B0A7B', fontSize: 12, fontWeight: 700,
                          letterSpacing: 0.5, borderBottom: '2px solid #ece9f4',
                        }}>{h.toUpperCase()}</th>
                      ))}
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
                        <tr
                          key={s.id}
                          style={{ borderBottom: '1px solid #f5f5f5', transition: 'background 0.15s' }}
                          onMouseEnter={(e) => e.currentTarget.style.background = '#fdfcff'}
                          onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}
                        >
                          <td style={{ padding: '14px 16px', color: '#888' }}>{i + 1}</td>
                          <td style={{ padding: '14px 16px', fontWeight: 600 }}>{s.name}</td>
                          <td style={{ padding: '14px 16px', color: '#555' }}>{s.email}</td>
                          <td style={{ padding: '14px 16px', color: '#666' }}>
                            {(() => {
                              const found = adminsList.find((a) => String(a.id) === String(s.admin_id));
                              return found ? `${found.name || found.email} (${found.id})` : (s.admin_id ? `Admin #${s.admin_id}` : '—');
                            })()}
                          </td>
                          <td style={{ padding: '14px 16px', color: '#888' }}>
                            {new Date(s.created_at).toLocaleDateString('en-IN', {
                              day: 'numeric', month: 'short', year: 'numeric',
                            })}
                          </td>
                          <td style={{ padding: '14px 16px' }}>
                            <div style={{ display: 'flex', gap: 6, alignItems: 'center', flexWrap: 'wrap' }}>
                              <button
                                onClick={() => setResetModal({ isOpen: true, id: s.id, name: s.name, newPassword: '' })}
                                style={{
                                  padding: '7px 12px', background: '#fff',
                                  border: '2px solid #e0e0e0', borderRadius: 8,
                                  color: '#555', fontWeight: 600, fontSize: 12, cursor: 'pointer',
                                }}
                              >🔑 Reset Pass</button>

                              {pendingReq ? (
                                <span style={{
                                  padding: '7px 12px', background: '#fff3e0',
                                  color: '#e65100', border: '1.5px solid #ffe0b2',
                                  borderRadius: 8, fontWeight: 700, fontSize: 12,
                                }}>
                                  ⏳ Pending Approval
                                </span>
                              ) : rejectedReq ? (
                                <button
                                  onClick={() => handleDelete(s.id, s.name, s.email)}
                                  style={{
                                    padding: '7px 12px', background: '#fff',
                                    border: '2px solid #ffcdd2', borderRadius: 8,
                                    color: '#c62828', fontWeight: 600, fontSize: 12, cursor: 'pointer',
                                  }}
                                >🗑 Retry Delete</button>
                              ) : (
                                <button
                                  onClick={() => handleDelete(s.id, s.name, s.email)}
                                  style={{
                                    padding: '7px 12px', background: '#fff',
                                    border: '2px solid #ffcdd2', borderRadius: 8,
                                    color: '#c62828', fontWeight: 600, fontSize: 12, cursor: 'pointer',
                                  }}
                                  onMouseEnter={(e) => { e.currentTarget.style.background = '#ffebee'; }}
                                  onMouseLeave={(e) => { e.currentTarget.style.background = '#fff'; }}
                                >🗑 Delete</button>
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
          </>
        )}

        {/* ═══ TAB: MANUAL ═══ */}
        {tab === 'manual' && (
          <form onSubmit={handleSingleCreate}
            style={{ background: '#fff', padding: 28, borderRadius: 14, border: '1px solid #ece9f4' }}>
            <h3 style={{ marginTop: 0, color: '#2c2c54', fontSize: 18 }}>➕ Create Single Student</h3>
            <div style={{ marginBottom: 14 }}>
              <label style={{ fontSize: 13, color: '#555', fontWeight: 600 }}>Full Name</label>
              <input type="text" required
                value={form.name}
                onChange={(e) => {
                  const v = e.target.value;
                  setForm({ ...form, name: v });
                  if (autoPass) setForm((f) => ({ ...f, password: generatePassword(v) }));
                }}
                style={{ ...inputStyle, marginTop: 6 }}
              />
            </div>
            <div style={{ marginBottom: 14 }}>
              <label style={{ fontSize: 13, color: '#555', fontWeight: 600 }}>Email</label>
              <input type="email" required
                value={form.email}
                onChange={(e) => setForm({ ...form, email: e.target.value })}
                style={{ ...inputStyle, marginTop: 6 }}
              />
            </div>
            <div style={{ marginBottom: 14 }}>
              <label style={{ fontSize: 13, color: '#555', fontWeight: 600 }}>
                Password{' '}
                <span onClick={() => { setAutoPass(!autoPass); if (!autoPass) setForm({ ...form, password: generatePassword(form.name) }); }}
                  style={{ color: '#7B1FA2', cursor: 'pointer', fontWeight: 700 }}>
                  {autoPass ? '🔄 Auto-generate' : '✏️ Manual'}
                </span>
              </label>
              <input type="text" required
                value={form.password}
                onChange={(e) => setForm({ ...form, password: e.target.value })}
                readOnly={autoPass}
                style={{ ...inputStyle, marginTop: 6, background: autoPass ? '#f5f5f5' : '#fff' }}
              />
            </div>
            {admin?.role === 'super_admin' && (
              <div style={{ marginBottom: 14 }}>
                <label style={{ fontSize: 13, color: '#555', fontWeight: 600 }}>Assign to Admin</label>
                <select required
                  value={selectedAdminId}
                  onChange={(e) => setSelectedAdminId(e.target.value)}
                  style={{ ...inputStyle, marginTop: 6 }}
                >
                  <option value="">Select admin…</option>
                  {adminsList.map((a) => (
                    <option key={a.id} value={a.id}>{a.name || a.email} ({a.email})</option>
                  ))}
                </select>
              </div>
            )}
            <button type="submit" disabled={actionLoading}
              style={{
                padding: '12px 28px', borderRadius: 10,
                background: 'linear-gradient(135deg, #5B0A7B, #7B1FA2)',
                color: '#fff', border: 'none',
                fontWeight: 700, fontSize: 15, cursor: 'pointer',
                opacity: actionLoading ? 0.6 : 1,
              }}
            >
              {actionLoading ? 'Creating…' : '➕ Create Student'}
            </button>
          </form>
        )}

        {/* ═══ TAB: BULK ═══ */}
        {tab === 'bulk' && (
          <div style={{ background: '#fff', padding: 28, borderRadius: 14, border: '1px solid #ece9f4' }}>
            <h3 style={{ marginTop: 0, color: '#2c2c54', fontSize: 18 }}>📋 Bulk Create Students</h3>
            <p style={{ color: '#666', fontSize: 13 }}>
              Format: <code>Name, Email, Password</code> (one per line). Password is optional — auto-generated if missing.
            </p>
            <input type="file" accept=".csv,.txt" onChange={handleCSVUpload}
              style={{ marginBottom: 12, padding: 8, border: '2px dashed #e0e0e0', borderRadius: 10, width: '100%' }}
            />
            <textarea
              placeholder={`John Doe, john@example.com, Pass@123\nJane Smith, jane@example.com`}
              value={bulkText}
              onChange={(e) => { setBulkText(e.target.value); parseBulkText(e.target.value); }}
              rows={8}
              style={{ ...inputStyle, fontFamily: 'monospace', fontSize: 13 }}
            />
            {bulkPreview.length > 0 && (
              <div style={{ marginTop: 12, background: '#fafafa', padding: 12, borderRadius: 8, fontSize: 13 }}>
                <strong>Preview:</strong> {bulkPreview.filter((s) => s._valid).length} valid / {bulkPreview.length} total
              </div>
            )}
            {admin?.role === 'super_admin' && (
              <div style={{ marginTop: 14 }}>
                <label style={{ fontSize: 13, color: '#555', fontWeight: 600 }}>Assign to Admin</label>
                <select value={selectedAdminId} onChange={(e) => setSelectedAdminId(e.target.value)}
                  style={{ ...inputStyle, marginTop: 6 }}>
                  <option value="">Select admin…</option>
                  {adminsList.map((a) => (
                    <option key={a.id} value={a.id}>{a.name || a.email} ({a.email})</option>
                  ))}
                </select>
              </div>
            )}
            <button onClick={handleBulkCreate} disabled={actionLoading}
              style={{
                marginTop: 16, padding: '12px 28px', borderRadius: 10,
                background: 'linear-gradient(135deg, #5B0A7B, #7B1FA2)',
                color: '#fff', border: 'none',
                fontWeight: 700, fontSize: 15, cursor: 'pointer',
                opacity: actionLoading ? 0.6 : 1,
              }}
            >
              {actionLoading ? 'Creating…' : '🚀 Create All'}
            </button>
            {bulkResult && (
              <div style={{ marginTop: 14, padding: 12, background: '#f5f5f5', borderRadius: 8, fontSize: 13 }}>
                <div>Created: <strong>{bulkResult.summary?.created || 0}</strong></div>
                {bulkResult.skipped?.length > 0 && <div>Skipped: {bulkResult.skipped.length}</div>}
                {bulkResult.errors?.length > 0 && <div>Errors: {bulkResult.errors.length}</div>}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

export default StudentManagement;
