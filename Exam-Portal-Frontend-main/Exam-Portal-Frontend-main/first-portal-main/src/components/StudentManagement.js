/* eslint-disable */
import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import apiService from '../services/api';
import SharedAdminSidebar from './SharedAdminSidebar';

/* ─── helpers ─── */
// ✅ PRODUCTION-READY PASSWORD GENERATOR
const generatePassword = (name) => {
  /**
   * Generates a secure password that meets:
   * - Minimum 8 characters
   * - At least one uppercase letter
   * - At least one lowercase letter
   * - At least one digit
   * - At least one special character
   */

  if (!name || name.trim() === '') {
    // Fallback if no name provided
    name = 'student';
  }

  // Extract name base (lowercase, remove special chars)
  const nameBase = name
    .trim()
    .split(' ')[0]
    .toLowerCase()
    .replace(/[^a-z]/g, '')
    .substring(0, 4); // Limit to 4 chars

  // Character sets
  const uppercase = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
  const digits = '0123456789';
  const specials = '!@#$%^&*';

  // Guarantee each requirement is met
  const passwordParts = [
    nameBase, // Lowercase (from name)
    uppercase[Math.floor(Math.random() * uppercase.length)], // Uppercase
    digits[Math.floor(Math.random() * digits.length)], // First digit
    specials[Math.floor(Math.random() * specials.length)], // Special char
    digits[Math.floor(Math.random() * digits.length)], // Second digit (for length)
  ];

  // Add random lowercase letters if the length is less than 8
  const lowercase = 'abcdefghijklmnopqrstuvwxyz';
  while (passwordParts.join('').length < 8) {
    passwordParts.push(lowercase[Math.floor(Math.random() * lowercase.length)]);
  }

  // Shuffle for randomness
  for (let i = passwordParts.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [passwordParts[i], passwordParts[j]] = [passwordParts[j], passwordParts[i]];
  }

  const password = passwordParts.join('');

  // Verify it meets all requirements
  const meetsRequirements =
    password.length >= 8 &&
    /[A-Z]/.test(password) &&
    /[a-z]/.test(password) &&
    /[0-9]/.test(password) &&
    /[!@#$%^&*]/.test(password);

  if (!meetsRequirements) {
    // Recursive call if somehow it doesn't meet requirements
    console.warn('Generated password did not meet requirements, regenerating...');
    return generatePassword(name + 'a'); // ensure the name is longer to prevent infinite loop
  }

  return password;
};

const downloadCSV = (rows, filename) => {
  const header = Object.keys(rows[0]).join(',');
  const body = rows.map(r => Object.values(r).map(v => `"${v}"`).join(',')).join('\n');
  const blob = new Blob([header + '\n' + body], { type: 'text/csv' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = filename; a.click();
  URL.revokeObjectURL(url);
};

// Sidebar is imported from SharedAdminSidebar.js

/* ─── main component ─── */
const StudentManagement = () => {
  const navigate = useNavigate();
  const admin = apiService.getUser();
  const fileRef = useRef();

  // tab: 'list' | 'bulk' | 'manual'
  const [tab, setTab] = useState('list');
  const [students, setStudents] = useState([]);
  const [loading, setLoading] = useState(false);
  const [actionLoading, setActionLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [searchTerm, setSearchTerm] = useState('');

  // Manual single form
  const [form, setForm] = useState({ name: '', email: '', password: '' });
  const [autoPass, setAutoPass] = useState(true);

  // Bulk textarea input
  const [bulkText, setBulkText] = useState('');
  const [bulkPreview, setBulkPreview] = useState([]);
  const [bulkResult, setBulkResult] = useState(null);

  // Fetch students
  const [resetModal, setResetModal] = useState({ isOpen: false, id: null, name: '', newPassword: '' });

  const [adminsList, setAdminsList] = useState([]);
  const [selectedAdminId, setSelectedAdminId] = useState('');
  const [deletionRequests, setDeletionRequests] = useState([]);

  const fetchStudents = async () => {
    setLoading(true);
    try {
      const res = await apiService.getStudents();
      setStudents(res.students || []);
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  };

  const fetchDeletionRequests = async () => {
    try {
      const res = await apiService.getAdminDeletionRequests();
      if (res.success) setDeletionRequests(res.requests || []);
    } catch (e) { console.error(e); }
  };

  useEffect(() => { 
    fetchStudents(); 
    fetchDeletionRequests();
    if (admin?.role === 'super_admin') {
      apiService.getAdmins()
        .then(res => setAdminsList(res.admins || res.data || []))
        .catch(console.error);
    }
  }, []);

  // Password is generated inline in the name onChange handler (no useEffect needed)

  const handleClearData = async () => {
    if (admin?.role !== 'super_admin') {
      return setError('Only Super Admins can perform bulk deletions.');
    }
    if (window.confirm("Are you sure you want to delete all students? This action cannot be undone.")) {
      try {
        setLoading(true);
        await Promise.all(students.map(student => apiService.deleteStudent(student.id)));
        setStudents([]);
        setSuccess('All students deleted successfully.');
      } catch (err) {
        setError('Failed to clear students: ' + err.message);
      } finally {
        setLoading(false);
      }
    }
  };

  /* ── single create ── */
  /* ── single create ── */
const handleSingleCreate = async (e) => {
  e.preventDefault();
  setError(''); 
  setSuccess('');
  
  if (!form.name || !form.email || !form.password) {
    return setError('All fields are required.');
  }
  
  if (admin?.role === 'super_admin' && !selectedAdminId) {
    return setError('Please assign the student to an Admin.');
  }
  
  setActionLoading(true);
  
  try {
    // ✅ CORRECT ENDPOINT: /api/admin/students/create
    // ✅ CORRECT FORMAT: Send as JSON (not bulk array)
    const res = await apiService.request('/api/admin/students/create', {
      method: 'POST',
      body: JSON.stringify({
        email: form.email.trim().toLowerCase(),
        password: form.password,
        first_name: form.name.trim().split(' ')[0],  // First word is first name
        last_name: form.name.trim().split(' ').slice(1).join(' ') || null,  // Rest is last name
        admin_id: selectedAdminId || admin?.id,
      }),
    });
    
    console.log('✅ Student created:', res);
    
    if (res.success && res.data) {
      setSuccess(`✅ Student "${form.name}" created!\n📧 Email: ${form.email}\n🔑 Password: ${form.password}`);
      setForm({ name: '', email: '', password: '' });
      fetchStudents();
    } else {
      setError(res.message || 'Failed to create student.');
    }
    
  } catch (e) {
    console.error('❌ Error:', e);
    setError(e.message || 'Failed to create student.');
  }
  
  setActionLoading(false);
};

const handleResetPassword = async (e) => {
  e.preventDefault();
  if (!resetModal.newPassword) return setError('Please enter a new password.');
  try {
    setActionLoading(true);
    await apiService.updateStudent(resetModal.id, { password: resetModal.newPassword });
    setSuccess(`✅ Password for "${resetModal.name}" updated successfully.`);
    setResetModal({ isOpen: false, id: null, name: '', newPassword: '' });
  } catch (err) {
    setError(err.message || 'Failed to update password.');
  } finally {
    setActionLoading(false);
  }
};

  /* ── bulk text parse ── */
  const parseBulkText = (text) => {
    const lines = text.split('\n').map(l => l.trim()).filter(Boolean);
    const parsed = lines.map((line, i) => {
      // support: "Name, email, password"  OR  "Name, email"  (auto-gen pass)
      const parts = line.split(',').map(p => p.trim());
      if (parts.length >= 2) {
        const name = parts[0];
        const email = parts[1];
        const password = parts[2] || generatePassword(name);
        return { name, email, password, _line: i + 1, _valid: !!(name && email) };
      }
      return { name: line, email: '', password: '', _line: i + 1, _valid: false };
    });
    setBulkPreview(parsed);
  };

  /* ── csv upload parse ── */
  const handleCSVUpload = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      const text = ev.target.result;
      // skip header row if it contains "name" (case-insensitive)
      const lines = text.split('\n').filter(Boolean);
      const startIdx = lines[0]?.toLowerCase().includes('name') ? 1 : 0;
      const dataLines = lines.slice(startIdx).join('\n');
      setBulkText(dataLines);
      parseBulkText(dataLines);
    };
    reader.readAsText(file);
  };

  /* ── bulk submit ── */
  /* ── bulk submit ── */
const handleBulkCreate = async () => {
  setError(''); 
  setSuccess(''); 
  setBulkResult(null);
  
  const validStudents = bulkPreview
    .filter(s => s._valid)
    .map(({ name, email, password }) => ({
      email: email.toLowerCase(),
      password: password,
      first_name: name.trim().split(' ')[0],
      last_name: name.trim().split(' ').slice(1).join(' ') || null,
    }));
  
  if (!validStudents.length) {
    return setError('No valid student records found.');
  }

  if (admin?.role === 'super_admin' && !selectedAdminId) {
    return setError('Please assign the students to an Admin.');
  }
  
  setActionLoading(true);
  
  try {
    // ✅ Build CSV and use apiService.bulkCreateStudents (correct endpoint)
    const csvContent = [
      'email,password,first_name,last_name',
      ...validStudents.map(s =>
        `${s.email},${s.password},"${s.first_name}","${s.last_name || ''}"`
      )
    ].join('\n');
    
    const csvBlob = new Blob([csvContent], { type: 'text/csv' });
    const csvFile = new File([csvBlob], 'students.csv', { type: 'text/csv' });
    
    const targetAdmin = selectedAdminId || admin?.id;
    const data = await apiService.bulkCreateStudents(csvFile, targetAdmin);
    console.log('✅ Bulk response:', data);
    
    if (data.success) {
      setBulkResult(data.data);
      const created = data.data?.summary?.created ?? validStudents.length;
      setSuccess(`✅ ${created} student(s) created successfully!`);
      fetchStudents();
      
      // Clear form after 3 seconds
      setTimeout(() => {
        setBulkText('');
        setBulkPreview([]);
      }, 3000);
    } else {
      setError(data.message || 'Failed to create students');
    }
    
  } catch (e) {
    console.error('❌ Error:', e);
    setError(e.message || 'Failed to create students');
  }
  
  setActionLoading(false);
};

  /* ── delete ── */
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
      if (!window.confirm(`Request deletion of student "${name}"? The Super Admin must approve this.`)) return;
      setError('');
      try {
        await apiService.submitDeletionRequest({ type: 'student', target_id: id, student_name: name, student_email: email });
        setSuccess(`Deletion request for "${name}" sent to Super Admin.`);
        fetchDeletionRequests();
      } catch (e) { setError(e.message); }
    }
  };

  /* ── filtered list ── */
  const filtered = students.filter(s =>
    (s.name || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
    (s.email || '').toLowerCase().includes(searchTerm.toLowerCase())
  );

  /* ── styles ── */
  const tabStyle = (t) => ({
    padding: '10px 24px', borderRadius: 8, fontWeight: 600, fontSize: 14,
    border: 'none', cursor: 'pointer', transition: 'all 0.2s',
    background: tab === t ? 'linear-gradient(135deg,#5B0A7B,#2D0040)' : '#f0f0f5',
    color: tab === t ? '#fff' : '#555',
    boxShadow: tab === t ? '0 4px 14px rgba(91,10,123,0.3)' : 'none'
  });

  const inputStyle = {
    width: '100%', padding: '12px 14px', fontSize: 14, borderRadius: 10,
    border: '2px solid #e0e0e0', outline: 'none', boxSizing: 'border-box',
    transition: 'border 0.2s'
  };

  return (
    <div style={{ display: 'flex', minHeight: '100vh', background: '#f5f7fa', fontFamily: 'Inter, sans-serif' }}>
      <SharedAdminSidebar active="students" onLogout={() => apiService.logout()} />

      <div style={{ marginLeft: 260, flex: 1 }}>
        {/* Header */}
        <div style={{
          background: '#fff', padding: '20px 36px',
          boxShadow: '0 2px 10px rgba(0,0,0,0.06)',
          display: 'flex', justifyContent: 'space-between', alignItems: 'center',
          position: 'sticky', top: 0, zIndex: 50
        }}>
          <div>
            <h2 style={{ margin: 0, fontSize: 22, fontWeight: 800, color: '#1a1a2e' }}>Student Accounts</h2>
            <p style={{ margin: '2px 0 0', fontSize: 13, color: '#888' }}>
              {students.length} student(s) registered
            </p>
          </div>
          <div className="user-info" style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <div style={{ fontSize: 14, color: '#5B0A7B', fontWeight: 600 }}>{admin?.email}</div>
            <div className="user-avatar" style={{ width: 40, height: 40, borderRadius: '50%', background: 'linear-gradient(135deg, #5B0A7B, #2D0040)', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 'bold', fontSize: 15 }}>
              {admin?.name?.charAt(0)?.toUpperCase()}
            </div>
          </div>
        </div>

        <div style={{ padding: '32px 36px' }}>
          {/* Alerts */}
          {success && (
            <div style={{
              background: '#e8f5e9', border: '2px solid #4caf50', borderRadius: 12,
              padding: '14px 20px', marginBottom: 20, color: '#2e7d32', fontWeight: 600,
              display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start'
            }}>
              <span>{success}</span>
              <button onClick={() => setSuccess('')} style={{ background: 'none', border: 'none', fontSize: 20, cursor: 'pointer', color: '#2e7d32', lineHeight: 1 }}>×</button>
            </div>
          )}
          {error && (
            <div style={{
              background: '#ffebee', border: '2px solid #f44336', borderRadius: 12,
              padding: '14px 20px', marginBottom: 20, color: '#c62828', fontWeight: 600,
              display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start'
            }}>
              <span>{error}</span>
              <button onClick={() => setError('')} style={{ background: 'none', border: 'none', fontSize: 20, cursor: 'pointer', color: '#c62828', lineHeight: 1 }}>×</button>
            </div>
          )}

          {/* Tabs */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 10, marginBottom: 28 }}>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10 }}>
              <button style={tabStyle('list')} onClick={() => setTab('list')}>👥 Student List</button>
              <button style={tabStyle('manual')} onClick={() => setTab('manual')}>➕ Add Single</button>
              <button style={tabStyle('bulk')} onClick={() => setTab('bulk')}>📋 Bulk Create</button>
            </div>
            {admin?.role === 'super_admin' && (
              <button 
                style={{
                  padding: '10px 24px', borderRadius: 8, fontWeight: 600, fontSize: 14, 
                  cursor: 'pointer', transition: 'all 0.2s', 
                  background: 'transparent', color: '#dc3545', border: '1px solid #dc3545'
                }} 
                onClick={handleClearData}
              >
                🗑️ Clear Data
              </button>
            )}
          </div>

          {/* ─── TAB: LIST ─── */}
          {tab === 'list' && (
            <div style={{ background: '#fff', borderRadius: 16, boxShadow: '0 4px 20px rgba(0,0,0,0.07)', overflow: 'hidden' }}>
              <div style={{ padding: '20px 24px', borderBottom: '1px solid #f0f0f5', display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 16 }}>
                <div style={{ width: '100%', maxWidth: 500 }}>
                  <input
                    placeholder="🔍  Search by name or email..."
                    value={searchTerm}
                    onChange={e => setSearchTerm(e.target.value)}
                    style={{ ...inputStyle, width: '100%', marginBottom: 0 }}
                  />
                </div>
                <button
                  onClick={() => {
                    if (!students.length) return;
                    downloadCSV(students.map(s => ({ name: s.name, email: s.email, created: s.created_at })), 'students.csv');
                  }}
                  style={{
                    padding: '10px 20px', background: 'linear-gradient(135deg,#5B0A7B,#2D0040)',
                    color: '#fff', border: 'none', borderRadius: 8, fontWeight: 600, cursor: 'pointer', fontSize: 13
                  }}
                >⬇️ Export CSV</button>
              </div>

              {loading ? (
                <div style={{ padding: 60, textAlign: 'center', color: '#888' }}>Loading students…</div>
              ) : filtered.length === 0 ? (
                <div style={{ padding: 60, textAlign: 'center' }}>
                  <div style={{ fontSize: 56, marginBottom: 12 }}>👤</div>
                  <p style={{ color: '#888', fontSize: 15 }}>No students found. Use the tabs above to add students.</p>
                </div>
              ) : (
                <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                  <thead>
                    <tr style={{ background: '#f8f6fc' }}>
                      {['#', 'Name', 'Email', 'Joined', 'Action'].map(h => (
                        <th key={h} style={{ padding: '14px 20px', textAlign: 'left', fontSize: 12, fontWeight: 700, color: '#666', textTransform: 'uppercase', letterSpacing: 0.5 }}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {filtered.map((s, i) => (
                      <tr key={s.id} style={{ borderTop: '1px solid #f0f0f5', transition: 'background 0.15s' }}
                        onMouseEnter={e => e.currentTarget.style.background = '#fdfcff'}
                        onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
                      >
                        <td style={{ padding: '14px 20px', fontSize: 13, color: '#999' }}>{i + 1}</td>
                        <td style={{ padding: '14px 20px' }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                            <div style={{
                              width: 34, height: 34, borderRadius: '50%',
                              background: `hsl(${(s.name.charCodeAt(0) * 47) % 360},60%,55%)`,
                              color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center',
                              fontWeight: 700, fontSize: 14, flexShrink: 0
                            }}>{s.name.charAt(0).toUpperCase()}</div>
                            <span style={{ fontWeight: 600, fontSize: 14, color: '#1a1a2e' }}>{s.name}</span>
                          </div>
                        </td>
                        <td style={{ padding: '14px 20px', fontSize: 13, color: '#555' }}>{s.email}</td>
                        <td style={{ padding: '14px 20px', fontSize: 12, color: '#888' }}>
                          {new Date(s.created_at).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}
                        </td>
                        <td style={{ padding: '14px 20px' }}>
                          <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                            <button onClick={() => setResetModal({ isOpen: true, id: s.id, name: s.name, newPassword: '' })}
                              style={{
                                padding: '7px 12px', background: '#fff', border: '2px solid #e0e0e0',
                                borderRadius: 8, color: '#555', fontWeight: 600, fontSize: 12, cursor: 'pointer',
                                transition: 'all 0.2s'
                              }}
                              onMouseEnter={e => { e.currentTarget.style.background = '#f5f5f5'; e.currentTarget.style.borderColor = '#ccc'; }}
                              onMouseLeave={e => { e.currentTarget.style.background = '#fff'; e.currentTarget.style.borderColor = '#e0e0e0'; }}
                            >🔑 Reset Pass</button>
                            
                            {(() => {
                              const pendingReq = deletionRequests.find(r => String(r.target_id) === String(s.id) && r.type === 'student');
                              if (pendingReq && pendingReq.status === 'Pending Approval') {
                                return <span style={{ padding: '6px 10px', background: '#fff3cd', color: '#856404', borderRadius: 8, fontSize: 12, fontWeight: 600, border: '1px solid #ffeeba' }}>⏳ Pending Approval</span>;
                              }
                              if (pendingReq && pendingReq.status === 'Rejected') {
                                return (
                                  <>
                                    <span style={{ padding: '6px 10px', background: '#f8d7da', color: '#721c24', borderRadius: 8, fontSize: 12, fontWeight: 600, border: '1px solid #f5c6cb' }}>❌ Rejected</span>
                                    <button onClick={() => handleDelete(s.id, s.name, s.email)}
                                      style={{
                                        padding: '7px 12px', background: '#fff', border: '2px solid #ffcdd2',
                                        borderRadius: 8, color: '#c62828', fontWeight: 600, fontSize: 12, cursor: 'pointer',
                                        transition: 'all 0.2s'
                                      }}
                                      onMouseEnter={e => { e.currentTarget.style.background = '#ffebee'; e.currentTarget.style.borderColor = '#f44336'; }}
                                      onMouseLeave={e => { e.currentTarget.style.background = '#fff'; e.currentTarget.style.borderColor = '#ffcdd2'; }}
                                    >🗑 Retry Delete</button>
                                  </>
                                );
                              }
                              return (
                                <button onClick={() => handleDelete(s.id, s.name, s.email)}
                                  style={{
                                    padding: '7px 12px', background: '#fff', border: '2px solid #ffcdd2',
                                    borderRadius: 8, color: '#c62828', fontWeight: 600, fontSize: 12, cursor: 'pointer',
                                    transition: 'all 0.2s'
                                  }}
                                  onMouseEnter={e => { e.currentTarget.style.background = '#ffebee'; e.currentTarget.style.borderColor = '#f44336'; }}
                                  onMouseLeave={e => { e.currentTarget.style.background = '#fff'; e.currentTarget.style.borderColor = '#ffcdd2'; }}
                                >🗑 Delete</button>
                              );
                            })()}
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          )}

          {/* ─── TAB: MANUAL SINGLE ─── */}
          {tab === 'manual' && (
            <div style={{ background: '#fff', borderRadius: 16, boxShadow: '0 4px 20px rgba(0,0,0,0.07)', padding: 36, maxWidth: 560 }}>
              <h3 style={{ margin: '0 0 6px', color: '#1a1a2e', fontSize: 18, fontWeight: 700 }}>Add Single Student</h3>
              <p style={{ margin: '0 0 28px', color: '#888', fontSize: 13 }}>Create one student account manually.</p>
              <form onSubmit={handleSingleCreate}>
                <div style={{ marginBottom: 20 }}>
                  <label style={{ fontWeight: 600, fontSize: 13, color: '#444', display: 'block', marginBottom: 8 }}>Full Name *</label>
                  <input style={inputStyle} placeholder="e.g. Ravi Kumar"
                    value={form.name}
                    onChange={e => {
                      const newName = e.target.value;
                      setForm(f => ({
                        ...f,
                        name: newName,
                        password: autoPass && newName.trim() ? generatePassword(newName) : f.password
                      }));
                    }}
                    onFocus={e => e.target.style.borderColor = '#5B0A7B'}
                    onBlur={e => e.target.style.borderColor = '#e0e0e0'}
                  />
                </div>
                <div style={{ marginBottom: 20 }}>
                  <label style={{ fontWeight: 600, fontSize: 13, color: '#444', display: 'block', marginBottom: 8 }}>Email Address *</label>
                  <input style={inputStyle} type="email" placeholder="e.g. ravi@school.com"
                    value={form.email} onChange={e => setForm(f => ({ ...f, email: e.target.value }))}
                    onFocus={e => e.target.style.borderColor = '#5B0A7B'}
                    onBlur={e => e.target.style.borderColor = '#e0e0e0'}
                  />
                </div>
                <div style={{ marginBottom: 28 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                    <label style={{ fontWeight: 600, fontSize: 13, color: '#444' }}>Password *</label>
                    <label style={{ fontSize: 12, color: '#5B0A7B', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6 }}>
                      <input type="checkbox" checked={autoPass} onChange={e => {
                        const checked = e.target.checked;
                        setAutoPass(checked);
                        if (checked && form.name.trim()) {
                          setForm(f => ({ ...f, password: generatePassword(f.name) }));
                        }
                      }} />
                      Auto-generate
                    </label>
                  </div>
                  <input style={{ ...inputStyle, background: autoPass ? '#f9f6fc' : '#fff' }}
                    placeholder="Password" value={form.password} readOnly={autoPass}
                    onChange={e => setForm(f => ({ ...f, password: e.target.value }))}
                    onFocus={e => e.target.style.borderColor = '#5B0A7B'}
                    onBlur={e => e.target.style.borderColor = '#e0e0e0'}
                  />
                </div>

                {admin?.role === 'super_admin' && (
                  <div style={{ marginBottom: 28 }}>
                    <label style={{ fontWeight: 600, fontSize: 13, color: '#444', display: 'block', marginBottom: 8 }}>Assign to Admin *</label>
                    <select
                      style={inputStyle}
                      value={selectedAdminId}
                      onChange={e => setSelectedAdminId(e.target.value)}
                    >
                      <option value="">-- Select an Admin --</option>
                      {adminsList.map(a => (
                        <option key={a.id} value={a.id}>{a.name} ({a.email})</option>
                      ))}
                    </select>
                  </div>
                )}

                <button type="submit" disabled={actionLoading}
                  style={{
                    width: '100%', padding: 14, background: 'linear-gradient(135deg,#5B0A7B,#2D0040)',
                    color: '#fff', border: 'none', borderRadius: 10, fontWeight: 700, fontSize: 15,
                    cursor: actionLoading ? 'not-allowed' : 'pointer',
                    boxShadow: '0 4px 16px rgba(91,10,123,0.35)'
                  }}>
                  {actionLoading ? '⏳ Creating…' : '✅ Create Student Account'}
                </button>
              </form>
            </div>
          )}

          {/* ─── TAB: BULK ─── */}
          {tab === 'bulk' && (
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 24, alignItems: 'start' }}>
              {/* Left: Input */}
              <div style={{ background: '#fff', borderRadius: 16, boxShadow: '0 4px 20px rgba(0,0,0,0.07)', padding: 32 }}>
                <h3 style={{ margin: '0 0 4px', color: '#1a1a2e', fontSize: 17, fontWeight: 700 }}>Bulk Create Students</h3>
                <p style={{ margin: '0 0 20px', color: '#888', fontSize: 13 }}>
                  Paste student data or upload a CSV file.
                </p>

                {/* Format guide */}
                <div style={{ background: '#f8f6fc', borderRadius: 10, padding: '12px 16px', marginBottom: 20 }}>
                  <p style={{ margin: '0 0 6px', fontWeight: 700, fontSize: 12, color: '#5B0A7B' }}>FORMAT (one per line):</p>
                  <code style={{ fontSize: 12, color: '#333', display: 'block', lineHeight: 1.8 }}>
                    Name, email@domain.com, password<br />
                    Name, email@domain.com  ← (password auto-generated)
                  </code>
                </div>

                {/* CSV Upload */}
                <div style={{ marginBottom: 16 }}>
                  <input ref={fileRef} type="file" accept=".csv,.txt" style={{ display: 'none' }} onChange={handleCSVUpload} />
                  <button onClick={() => fileRef.current.click()} style={{
                    width: '100%', padding: '10px 0', border: '2px dashed #c7b0e0',
                    borderRadius: 10, background: '#fdfcff', color: '#5B0A7B',
                    fontWeight: 600, fontSize: 13, cursor: 'pointer'
                  }}>📎 Upload CSV / TXT File</button>
                </div>

                <div style={{ marginBottom: 4, fontWeight: 600, fontSize: 13, color: '#444' }}>Or paste directly:</div>
                <textarea
                  rows={10}
                  placeholder={`Aarav Shah, aarav@school.com, pass123\nPriya Patel, priya@school.com\nRohan Mehta, rohan@school.com, secure456`}
                  value={bulkText}
                  onChange={e => { setBulkText(e.target.value); parseBulkText(e.target.value); }}
                  style={{
                    width: '100%', padding: 14, fontSize: 13, borderRadius: 10,
                    border: '2px solid #e0e0e0', resize: 'vertical', outline: 'none',
                    fontFamily: 'monospace', lineHeight: 1.7, boxSizing: 'border-box'
                  }}
                  onFocus={e => e.target.style.borderColor = '#5B0A7B'}
                  onBlur={e => e.target.style.borderColor = '#e0e0e0'}
                />

                {admin?.role === 'super_admin' && (
                  <div style={{ marginTop: 16 }}>
                    <label style={{ fontWeight: 600, fontSize: 13, color: '#444', display: 'block', marginBottom: 8 }}>Assign to Admin *</label>
                    <select
                      style={inputStyle}
                      value={selectedAdminId}
                      onChange={e => setSelectedAdminId(e.target.value)}
                    >
                      <option value="">-- Select an Admin --</option>
                      {adminsList.map(a => (
                        <option key={a.id} value={a.id}>{a.name} ({a.email})</option>
                      ))}
                    </select>
                  </div>
                )}

                <div style={{ display: 'flex', gap: 10, marginTop: 16 }}>
                  <button onClick={handleBulkCreate} disabled={actionLoading || !bulkPreview.filter(s => s._valid).length}
                    style={{
                      flex: 1, padding: 14, background: 'linear-gradient(135deg,#5B0A7B,#2D0040)',
                      color: '#fff', border: 'none', borderRadius: 10, fontWeight: 700, fontSize: 14,
                      cursor: actionLoading ? 'not-allowed' : 'pointer',
                      opacity: (!bulkPreview.filter(s => s._valid).length && !actionLoading) ? 0.5 : 1,
                      boxShadow: '0 4px 16px rgba(91,10,123,0.3)'
                    }}>
                    {actionLoading ? '⏳ Creating…' : `🚀 Create ${bulkPreview.filter(s => s._valid).length} Student(s)`}
                  </button>
                  <button onClick={() => { setBulkText(''); setBulkPreview([]); setBulkResult(null); setError(''); setSuccess(''); }}
                    style={{
                      padding: '14px 20px', background: '#f5f5f5', border: 'none',
                      borderRadius: 10, color: '#555', fontWeight: 600, cursor: 'pointer', fontSize: 14
                    }}>Clear</button>
                </div>
              </div>

              {/* Right: Preview */}
              <div style={{ background: '#fff', borderRadius: 16, boxShadow: '0 4px 20px rgba(0,0,0,0.07)', padding: 32 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
                  <h3 style={{ margin: 0, color: '#1a1a2e', fontSize: 17, fontWeight: 700 }}>Preview</h3>
                  {bulkResult?.created?.length > 0 && (
                    <button onClick={() => downloadCSV(bulkResult.created, 'new_students_credentials.csv')}
                      style={{
                        padding: '8px 16px', background: 'linear-gradient(135deg,#2e7d32,#1b5e20)',
                        color: '#fff', border: 'none', borderRadius: 8, fontWeight: 600,
                        cursor: 'pointer', fontSize: 12
                      }}>⬇️ Download Credentials</button>
                  )}
                </div>

                {bulkResult && (
                  <div style={{ marginBottom: 16 }}>
                    <div style={{ display: 'flex', gap: 10 }}>
                      {[
                        { label: 'Created', count: bulkResult.created?.length, color: '#4caf50', bg: '#e8f5e9' },
                        { label: 'Skipped', count: bulkResult.skipped?.length, color: '#ff9800', bg: '#fff3e0' },
                        { label: 'Errors', count: bulkResult.errors?.length, color: '#f44336', bg: '#ffebee' },
                      ].map(stat => (
                        <div key={stat.label} style={{ flex: 1, background: stat.bg, borderRadius: 10, padding: '10px 14px', textAlign: 'center' }}>
                          <div style={{ fontSize: 22, fontWeight: 800, color: stat.color }}>{stat.count}</div>
                          <div style={{ fontSize: 11, color: stat.color, fontWeight: 600 }}>{stat.label}</div>
                        </div>
                      ))}
                    </div>
                    {bulkResult.skipped?.length > 0 && (
                      <div style={{ marginTop: 10, padding: '8px 12px', background: '#fff8e1', borderRadius: 8, fontSize: 12, color: '#856404' }}>
                        ⚠️ Already exist: {bulkResult.skipped.join(', ')}
                      </div>
                    )}
                  </div>
                )}

                {bulkPreview.length === 0 ? (
                  <div style={{ textAlign: 'center', padding: '40px 0', color: '#bbb' }}>
                    <div style={{ fontSize: 40, marginBottom: 10 }}>📋</div>
                    <p style={{ fontSize: 13 }}>Paste or upload student data to see a preview here.</p>
                  </div>
                ) : (
                  <div style={{ maxHeight: 420, overflowY: 'auto' }}>
                    {bulkPreview.map((s, i) => (
                      <div key={i} style={{
                        padding: '10px 14px', borderRadius: 10, marginBottom: 8,
                        background: s._valid ? '#f8f6fc' : '#fff4f4',
                        border: `1px solid ${s._valid ? '#e0d6f0' : '#ffcdd2'}`
                      }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                          <div>
                            <span style={{ fontWeight: 700, fontSize: 13, color: s._valid ? '#1a1a2e' : '#c62828' }}>{s.name || '(no name)'}</span>
                            <span style={{ fontSize: 12, color: '#777', marginLeft: 8 }}>{s.email || '(no email)'}</span>
                          </div>
                          <span style={{
                            fontSize: 10, fontWeight: 700, padding: '3px 8px', borderRadius: 20,
                            background: s._valid ? '#e8f5e9' : '#ffebee',
                            color: s._valid ? '#2e7d32' : '#c62828'
                          }}>{s._valid ? '✓ VALID' : '✗ ERROR'}</span>
                        </div>
                        {s._valid && (
                          <div style={{ fontSize: 11, color: '#888', marginTop: 4 }}>
                            🔑 Password: <code style={{ color: '#5B0A7B' }}>{s.password}</code>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* ─── RESET PASSWORD MODAL ─── */}
      {resetModal.isOpen && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.5)', zIndex: 9999, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <div style={{ background: '#fff', borderRadius: 16, padding: 32, width: 400, boxShadow: '0 10px 40px rgba(0,0,0,0.2)' }}>
            <h3 style={{ margin: '0 0 10px', fontSize: 18, color: '#1a1a2e' }}>Reset Password</h3>
            <p style={{ margin: '0 0 20px', fontSize: 13, color: '#666' }}>Enter a new password for <strong>{resetModal.name}</strong></p>
            <form onSubmit={handleResetPassword}>
              <input 
                type="text"
                placeholder="New Password"
                value={resetModal.newPassword}
                onChange={e => setResetModal({ ...resetModal, newPassword: e.target.value })}
                style={{ width: '100%', padding: '12px 14px', fontSize: 14, borderRadius: 10, border: '2px solid #e0e0e0', outline: 'none', boxSizing: 'border-box', marginBottom: 20 }}
              />
              <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
                <button type="button" onClick={() => setResetModal({ isOpen: false, id: null, name: '', newPassword: '' })}
                  style={{ padding: '10px 16px', borderRadius: 8, border: 'none', background: '#e0e0e0', color: '#555', fontWeight: 600, cursor: 'pointer' }}>Cancel</button>
                <button type="submit" disabled={actionLoading}
                  style={{ padding: '10px 20px', borderRadius: 8, border: 'none', background: 'linear-gradient(135deg,#5B0A7B,#2D0040)', color: '#fff', fontWeight: 600, cursor: actionLoading ? 'not-allowed' : 'pointer' }}>
                  {actionLoading ? 'Updating...' : 'Update Password'}
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

