// src/components/LoginPage.js
import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Form, Button, Alert, Spinner } from 'react-bootstrap';
import apiService from '../services/api';

const LoginPage = () => {
  const navigate = useNavigate();
  
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const emailTrimmed = email.trim().toLowerCase();
      const passwordTrimmed = password.trim();
      
      console.log('🔄 Step 1: Attempting login...');
      console.log('  - Email:', emailTrimmed);
      console.log('  - Password length:', passwordTrimmed.length);
      
      // ✅ Call login API
      const response = await apiService.login(emailTrimmed, passwordTrimmed);
      
      console.log('🔄 Step 2: Login API response received');
      console.log('  - Response object:', response);
      console.log('  - Has token?', !!response?.token);
      console.log('  - Has user?', !!response?.user);
      console.log('  - User role:', response?.user?.role);
      
      // ✅ Verify data is in localStorage
      const storedToken = localStorage.getItem('jwt_token');
      const storedUser = localStorage.getItem('user');
      
      console.log('🔄 Step 3: Checking localStorage');
      console.log('  - jwt_token saved?', !!storedToken);
      console.log('  - user saved?', !!storedUser);
      
      if (!storedToken || !storedUser) {
        console.error('❌ ERROR: Data not saved to localStorage!');
        setError('Login failed: Data could not be saved. Please try again.');
        setLoading(false);
        return;
      }
      
      console.log('✅ Step 4: All data verified in localStorage');
      
      const userRole = response.user?.role;
      
      console.log('✅ Step 5: Navigating...');
      console.log('  - User role:', userRole);
      
      // ✅ Navigate based on role
      if (userRole === 'super_admin') {
        console.log('  ↗️ Redirecting to /superadmin');
        navigate('/superadmin', { replace: true });
      } else if (userRole === 'admin') {
        console.log('  ↗️ Redirecting to /admin');
        navigate('/admin', { replace: true });
      } else if (userRole === 'student') {
        console.log('  ↗️ Redirecting to /dashboard');
        navigate('/dashboard', { replace: true });
      } else {
        console.log('  ⚠️ Unknown role, redirecting to /dashboard');
        navigate('/dashboard', { replace: true });
      }

    } catch (err) {
      console.error('❌ Login Error:', err);
      console.error('  - Error message:', err.message);
      console.error('  - Error stack:', err.stack);
      setError(err.message || 'Invalid email or password. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="login-wrapper">
      <div className="login-card">
        {/* Logo */}
        <div style={{ textAlign: 'center', marginBottom: 8 }}>
          <div style={{
            width: 56,
            height: 56,
            borderRadius: 14,
            background: 'linear-gradient(135deg, #667eea, #764ba2)',
            display: 'inline-flex',
            alignItems: 'center',
            justifyContent: 'center',
            marginBottom: 16,
            boxShadow: '0 4px 12px rgba(102, 126, 234, 0.3)'
          }}>
            <span style={{ fontSize: 22, color: '#fff', fontWeight: 700 }}>EP</span>
          </div>
        </div>

        <h2>Welcome Back</h2>
        <p className="subtitle">Online Examination &amp; Assessment Platform</p>

        {/* Error Alert */}
        {error && (
          <Alert 
            variant="danger" 
            dismissible 
            onClose={() => setError('')}
            className="py-2" 
            style={{ borderRadius: 10, fontSize: 14 }}
          >
            {error}
          </Alert>
        )}

        {/* Login Form */}
        <Form onSubmit={handleSubmit}>
          {/* Email Field */}
          <Form.Group className="mb-3">
            <Form.Label style={{ fontWeight: 600, fontSize: 14, color: '#555' }}>
              Email Address
            </Form.Label>
            <Form.Control
              type="email"
              placeholder="Enter your email address"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              disabled={loading}
              style={{
                borderRadius: 10,
                padding: '12px 16px',
                border: '1.5px solid #e0e0e0',
                fontSize: 14
              }}
            />
            <Form.Text style={{ color: '#888', fontSize: 11 }}>
              Use the email provided by your administrator
            </Form.Text>
          </Form.Group>

          {/* Password Field */}
          <Form.Group className="mb-2">
            <Form.Label style={{ fontWeight: 600, fontSize: 14, color: '#555' }}>
              Password
            </Form.Label>
            <div style={{ position: 'relative' }}>
              <Form.Control
                type={showPassword ? 'text' : 'password'}
                placeholder="Enter your password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                disabled={loading}
                style={{
                  borderRadius: 10,
                  padding: '12px 16px',
                  paddingRight: 45,
                  border: '1.5px solid #e0e0e0',
                  fontSize: 14
                }}
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                style={{
                  position: 'absolute',
                  right: 12,
                  top: '50%',
                  transform: 'translateY(-50%)',
                  background: 'none',
                  border: 'none',
                  cursor: 'pointer',
                  fontSize: 18,
                  color: '#888',
                  padding: 4
                }}
                disabled={loading}
              >
                {showPassword ? '👁️' : '👁️‍🗨️'}
              </button>
            </div>
          </Form.Group>

          {/* Show Password Checkbox */}
          <Form.Group className="mb-4">
            <Form.Check
              type="checkbox"
              label="Show Password"
              checked={showPassword}
              onChange={(e) => setShowPassword(e.target.checked)}
              style={{ fontSize: 13, color: '#888' }}
              disabled={loading}
            />
          </Form.Group>

          {/* Submit Button */}
          <Button 
            type="submit" 
            className="btn-login" 
            disabled={loading}
            style={{
              width: '100%',
              padding: '14px',
              background: loading ? '#ccc' : 'linear-gradient(135deg, #667eea, #764ba2)',
              border: 'none',
              borderRadius: 10,
              fontWeight: 700,
              fontSize: 15,
              color: '#fff',
              cursor: loading ? 'not-allowed' : 'pointer',
              transition: 'all 0.3s',
              boxShadow: loading ? 'none' : '0 4px 12px rgba(102, 126, 234, 0.3)'
            }}
          >
            {loading ? (
              <>
                <Spinner animation="border" size="sm" className="me-2" />
                Signing In...
              </>
            ) : (
              'Sign In'
            )}
          </Button>
        </Form>

        {/* Contact Admin Notice */}
        <div style={{ 
          textAlign: 'center', 
          marginTop: 24,
          padding: 16,
          background: '#f8f9fa',
          borderRadius: 10,
          border: '1px solid #e0e0e0'
        }}>
          <small style={{ color: '#888', fontSize: 12 }}>
            Don't have login credentials? Contact your administrator.
          </small>
        </div>

        {/* Help Section */}
        <div style={{ 
          marginTop: 20,
          padding: 16,
          background: '#e3f2fd',
          borderRadius: 10,
          border: '1px solid #bbdefb'
        }}>
          <div style={{ 
            fontSize: 12, 
            fontWeight: 600, 
            color: '#1976d2',
            marginBottom: 8,
            display: 'flex',
            alignItems: 'center',
            gap: 8
          }}>
            <span>ℹ️</span>
            <span>Having trouble logging in?</span>
          </div>
          <div style={{ fontSize: 12, color: '#555', lineHeight: 1.6 }}>
            • Ensure you're using the email provided by your institution
            <br />
            • Password is case-sensitive
            <br />
            • Contact your administrator if you forgot your password
          </div>
        </div>

        {/* Footer */}
        <div style={{ textAlign: 'center', marginTop: 24 }}>
          <small style={{ color: '#aaa', fontSize: 11 }}>
            © 2024 ExamPortal. Secure Online Examination Platform.
          </small>
        </div>
      </div>
    </div>
  );
};

export default LoginPage;
