// src/services/api.js
const API_BASE_URL = process.env.REACT_APP_API_URL || 'https://exam-backend-eg8c.onrender.com';



class ApiService {
  constructor() {
    this.baseURL = API_BASE_URL;
  }

  getAuthHeader() {
    const token = localStorage.getItem('jwt_token');
    return token ? { 'Authorization': `Bearer ${token}` } : {};
  }

  async request(endpoint, options = {}) {
    const url = `${this.baseURL}${endpoint}`;

    const isFormData = options.body instanceof FormData;
    const defaultHeaders = {
      ...this.getAuthHeader(),
    };

    if (!isFormData) {
      defaultHeaders['Content-Type'] = 'application/json';
    }

    const config = {
      ...options,
      headers: {
        ...defaultHeaders,
        ...options.headers,
      },
    };



    try {
      const response = await fetch(url, config);
      
      // Handle non-JSON responses
      let data;
      const contentType = response.headers.get('content-type');
      if (contentType && contentType.includes('application/json')) {
        data = await response.json();
      } else {
        const text = await response.text();
        throw new Error(`Server returned non-JSON response: ${text.substring(0, 100)}`);
      }

      if (!response.ok) {
        // Only treat 401 as "session expired" if user already has a token stored
        // (i.e., they were previously authenticated). During login, 401 = wrong credentials.
        if (response.status === 401) {
          const hasToken = !!localStorage.getItem('jwt_token');
          if (hasToken) {
            localStorage.removeItem('jwt_token');
            localStorage.removeItem('user');
            window.location.href = '/login';
            throw new Error('Session expired. Please login again.');
          }
        }
        
        // Handle backend error format — show the actual backend message
        throw new Error(data.message || data.error || `Request failed (${response.status})`);
      }

      return data;
    } catch (error) {
      console.error('API Error:', error);
      throw error;
    }
  }

  // ══════════════════════════════════════════════════════════
  // AUTH APIs
  // ══════════════════════════════════════════════════════════

  async login(email, password) {
    try {
      const emailLower = email.trim().toLowerCase();
      const passwordTrimmed = password.trim();



      const response = await this.request('/api/login', {
        method: 'POST',
        body: JSON.stringify({ 
          email: emailLower, 
          password: passwordTrimmed,
        }),
      });
      
      if (response.success && response.data) {
        const { token, user } = response.data;
        localStorage.setItem('jwt_token', token);
        localStorage.setItem('user', JSON.stringify(user));
        return { token, user };
      } else {
        throw new Error(response.message || 'Login failed');
      }
    } catch (error) {
      console.error('Login error:', error);
      throw error;
    }
  }



  async verifyToken() {
    return this.request('/api/verify-token');
  }

  logout() {
    localStorage.removeItem('jwt_token');
    localStorage.removeItem('user');
    window.location.href = '/login';
  }

  // ══════════════════════════════════════════════════════════
  // STUDENT DASHBOARD APIs
  // ══════════════════════════════════════════════════════════

  async getStudentDashboard() {
    return this.request('/api/student/dashboard');
  }

  async getStudentProfile() {
    return this.request('/api/profile');
  }

  async changePassword(oldPassword, newPassword) {
    return this.request('/api/student/change-password', {
      method: 'POST',
      body: JSON.stringify({ 
        old_password: oldPassword, 
        new_password: newPassword 
      }),
    });
  }

  async getStatistics() {
    return this.request('/api/student/statistics');
  }

  // ══════════════════════════════════════════════════════════
  // EXAM APIs (Student)
  // ══════════════════════════════════════════════════════════

  async getExams() {
    const user = this.getUser();
    
    // Admin gets admin list
    if (user?.role === 'admin' || user?.role === 'super_admin') {
      return this.request('/api/admin/exams/list');
    }
    
    // Students get available exams
    return this.request('/api/exam/available');
  }

  async getExamByCode(code) {
    return this.request(`/api/exam/by-code/${encodeURIComponent(code.trim().toUpperCase())}`);
  }

  async joinExam(examCode) {
    return this.request('/api/exam/join', {
      method: 'POST',
      body: JSON.stringify({ exam_code: examCode }),
    });
  }

  async getExamQuestions(examId) {
    return this.request(`/api/exam/${examId}/questions`);
  }

  async saveAnswer(examId, answerData) {
    return this.request(`/api/exam/${examId}/save-answer`, {
      method: 'POST',
      body: JSON.stringify(answerData),
    });
  }

  async submitExam(examId, answers, time_taken = 0, violations = []) {
    return this.request(`/api/exam/${examId}/submit`, {
      method: 'POST',
      body: JSON.stringify({ answers, time_taken, violations }),
    });
  }

  async checkTimer(examId) {
    return this.request(`/api/exam/${examId}/timer`);
  }

  // ══════════════════════════════════════════════════════════
  // RESULTS APIs
  // ══════════════════════════════════════════════════════════

  async getResult(attemptId) {
    return this.request(`/api/result/${attemptId}`);
  }

  async getUserResults() {
    return this.request('/api/student/results');
  }

  // ══════════════════════════════════════════════════════════
  // ADMIN DASHBOARD APIs
  // ══════════════════════════════════════════════════════════

  async getAdminDashboard() {
    return this.request('/api/admin/dashboard');
  }

  async getAdminExams() {
    return this.request('/api/admin/exams/list');
  }

  async createExamPDF(formData) {
    return this.request('/api/exams/create-with-pdf', {
      method: 'POST',
      body: formData,
    });
  }

  async createExamDbMode(examData) {
    return this.request('/api/admin/exams/create', {
      method: 'POST',
      body: JSON.stringify(examData),
    });
  }

  async deleteExam(examId) {
    return this.request(`/api/admin/exams/${examId}`, {
      method: 'DELETE',
    });
  }

  async getAdminResults(examId = null) {
    const endpoint = examId 
      ? `/api/admin/results/list?exam_id=${examId}`
      : '/api/admin/results/list';
    return this.request(endpoint);
  }

  async clearAllViolations() {
    return this.request('/api/admin/clear-violations', { method: 'DELETE' });
  }

  // ══════════════════════════════════════════════════════════
  // STUDENT MANAGEMENT APIs
  // ══════════════════════════════════════════════════════════

  async getStudents() {
    return this.request('/api/admin/students/list');
  }

  async createStudent(studentData) {
    try {
      console.log('📝 Creating student with data:', studentData);
      
      const response = await this.request('/api/admin/students/create', {
        method: 'POST',
        body: JSON.stringify(studentData),
      });

      console.log('✅ Student created successfully:', response);
      return response;
    } catch (error) {
      console.error('❌ Create student error:', error);
      throw error;
    }
  }

  async deleteStudent(studentId) {
    return this.request(`/api/admin/students/${studentId}`, {
      method: 'DELETE',
    });
  }

  async bulkCreateStudents(file, adminId = null) {
    // FormData for CSV upload
    const formData = new FormData();
    formData.append('file', file);
    if (adminId) formData.append('admin_id', adminId);
    
    return this.request('/api/admin/students/bulk-create', {
      method: 'POST',
      body: formData,
    });
  }

  async updateStudent(studentId, studentData) {
    return this.request(`/api/admin/students/${studentId}`, {
      method: 'PUT',
      body: JSON.stringify(studentData),
    });
  }

  // ══════════════════════════════════════════════════════════
  // SUPER ADMIN APIs
  // ══════════════════════════════════════════════════════════

  async getAdmins() {
    return this.request('/api/super_admin/admins/list');
  }

  async createAdmin(adminData) {
    return this.request('/api/super_admin/create-admin', {
      method: 'POST',
      body: JSON.stringify(adminData),
    });
  }

  async deleteAdmin(adminId) {
    return this.request(`/api/super_admin/admins/${adminId}`, {
      method: 'DELETE',
    });
  }

  async bulkCreateAdmins(file) {
    const formData = new FormData();
    formData.append('file', file);
    return this.request('/api/super_admin/admins/bulk-create', {
      method: 'POST',
      body: formData,
    });
  }

  async updateAdmin(adminId, adminData) {
    return this.request(`/api/super_admin/admins/${adminId}`, {
      method: 'PUT',
      body: JSON.stringify(adminData),
    });
  }

  // ══════════════════════════════════════════════════════════
  // DELETION REQUEST APIs
  // ══════════════════════════════════════════════════════════

  async getAdminDeletionRequests() {
    return this.request('/api/admin/deletion-requests');
  }

  async submitDeletionRequest(payload) {
    return this.request('/api/admin/deletion-requests', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
  }

  async getSuperAdminDeletionRequests() {
    return this.request('/api/superadmin/deletion-requests');
  }

  async processDeletionRequest(id, action) {
    return this.request(`/api/superadmin/deletion-requests/${id}/${action}`, {
      method: 'PUT',
    });
  }

  async deleteAdminResult(resultId) {
    return this.request(`/api/admin/results/${resultId}`, {
      method: 'DELETE',
    });
  }

  // ══════════════════════════════════════════════════════════
  // UTILITY METHODS
  // ══════════════════════════════════════════════════════════

  isAuthenticated() {
    return !!localStorage.getItem('jwt_token');
  }

  getUser() {
    const user = localStorage.getItem('user');
    return user ? JSON.parse(user) : null;
  }
}

const apiServiceInstance = new ApiService();
export default apiServiceInstance;
