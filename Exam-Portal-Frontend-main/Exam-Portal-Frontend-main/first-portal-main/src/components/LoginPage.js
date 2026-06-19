// src/components/LoginPage.js
import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Spinner } from 'react-bootstrap';
import apiService from '../services/api'; 

const LoginPage = () => {
  const navigate = useNavigate();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [remember, setRemember] = useState(true);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const response = await apiService.login(email.trim().toLowerCase(), password.trim());
      const userRole = response.user?.role;

      if (remember) {
        localStorage.setItem('remember_login', 'true');
      } else {
        localStorage.removeItem('remember_login');
      }

      if (userRole === 'super_admin') {
        navigate('/superadmin', { replace: true });
      } else if (userRole === 'admin') {
        navigate('/admin', { replace: true });
      } else if (userRole === 'student') {
        navigate('/dashboard', { replace: true });
      } else {
        navigate('/login', { replace: true });
      }
    } catch (err) {
      setError(err.message || 'Invalid email or password. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="login-wrap">
      <section className="login-hero">
        <div className="lh-brand">
          <div className="ep-logo">EP</div>
          <div>
            <div style={{ fontSize: 16, fontWeight: 800 }}>ExamPortal</div>
            <div style={{ fontSize: 12, opacity: 0.86 }}>Secure Online Examinations</div>
          </div>
        </div>

        <div>
          <h1 className="lh-title">Conduct secure, fair and intelligent online examinations.</h1>
          <p className="lh-sub">
            A role-based examination platform for institutions to create exams,
            manage candidates, monitor exam integrity and review results.
          </p>

          <div className="lh-features">
            <div className="lh-feature"><span className="chk">✓</span> AI-assisted proctoring and face visibility checks</div>
            <div className="lh-feature"><span className="chk">✓</span> Admin, Super Admin and Student dashboards</div>
            <div className="lh-feature"><span className="chk">✓</span> Exam code access, answer tracking and result reports</div>
            <div className="lh-feature"><span className="chk">✓</span> Export-ready exam, student and result management</div>
          </div>
        </div>

        <div className="lh-footer">© 2026 ExamPortal • Secure Online Examination Platform</div>
      </section>

      <section className="login-form-wrap">
        <form className="login-panel" onSubmit={handleSubmit}>
          <div style={{ textAlign: 'center', marginBottom: 22 }}>
            <div className="ep-logo" style={{ margin: '0 auto 14px' }}>EP</div>
            <h2>Welcome back</h2>
            <p className="lead">Sign in to access your dashboard, exams and reports.</p>
          </div>

          {error && (
            <div className="ep-alert">
              <div>⚠️</div>
              <div>{error}</div>
            </div>
          )}

          <div className="ep-field">
            <label>Email address</label>
            <input
              type="email"
              placeholder="Enter your registered email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              disabled={loading}
            />
            <div className="field-help">Use the email provided by your institution or administrator.</div>
          </div>

          <div className="ep-field">
            <label>Password</label>
            <div className="pw-wrap">
              <input
                type={showPassword ? 'text' : 'password'}
                placeholder="Enter your password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                disabled={loading}
              />
              <button
                type="button"
                className="pw-toggle"
                onClick={() => setShowPassword((value) => !value)}
                disabled={loading}
                aria-label={showPassword ? 'Hide password' : 'Show password'}
              >
                {showPassword ? '🙈' : '👁️'}
              </button>
            </div>
          </div>

          <div className="row-between">
            <label className="ep-check">
              <input
                type="checkbox"
                checked={remember}
                onChange={(e) => setRemember(e.target.checked)}
                disabled={loading}
              />
              Remember me
            </label>
            <span style={{ color: 'var(--ep-muted)' }}>Need help? Contact admin</span>
          </div>

          <button type="submit" className="ep-btn ep-btn-primary ep-btn-block" disabled={loading} style={{ padding: 12 }}>
            {loading ? (
              <>
                <Spinner animation="border" size="sm" />
                Signing in...
              </>
            ) : (
              <>Sign in →</>
            )}
          </button>

          <div className="login-note">
            <strong style={{ color: 'var(--ep-ink)' }}>Having trouble logging in?</strong>
            <div style={{ marginTop: 6 }}>
              Ensure your email and password match the credentials shared by your administrator.
              Passwords are case-sensitive.
            </div>
          </div>
        </form>
      </section>
    </div>
  );
};

export default LoginPage;
