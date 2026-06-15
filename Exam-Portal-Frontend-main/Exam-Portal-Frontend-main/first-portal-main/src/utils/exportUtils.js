/**
 * Export Utilities - CSV, Excel, and PDF generation
 * Reusable across all roles: Student, Admin, Super Admin
 */

// ==================== CSV Export ====================
export const exportToCSV = (data, filename = 'export') => {
  if (!data || data.length === 0) {
    alert('No data available to export.');
    return;
  }

  // Extract headers from first object
  const headers = Object.keys(data[0]);
  
  // Create CSV content
  const csvContent = [
    headers.map(h => `"${h}"`).join(','),
    ...data.map(row => 
      headers.map(h => {
        const value = row[h] !== null && row[h] !== undefined ? row[h] : '';
        // Escape quotes and wrap in quotes
        return `"${String(value).replace(/"/g, '""')}"`;
      }).join(',')
    )
  ].join('\n');

  // Create and download file
  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = `${filename}_${new Date().toISOString().slice(0, 10)}.csv`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
};

// ==================== Excel Export ====================
export const exportToExcel = async (data, filename = 'export', sheetName = 'Sheet1') => {
  if (!data || data.length === 0) {
    alert('No data available to export.');
    return;
  }

  try {
    // Dynamic import to avoid bundling issues
    const XLSX = await import('xlsx');
    
    // Create worksheet
    const ws = XLSX.utils.json_to_sheet(data);
    
    // Auto-size columns
    const colWidths = Object.keys(data[0]).map(key => {
      const headerLen = key.length;
      const maxDataLen = Math.max(...data.map(row => 
        String(row[key] !== null && row[key] !== undefined ? row[key] : '').length
      ));
      return { wch: Math.max(headerLen, maxDataLen) + 2 };
    });
    ws['!cols'] = colWidths;
    
    // Create workbook and download
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, sheetName);
    XLSX.writeFile(wb, `${filename}_${new Date().toISOString().slice(0, 10)}.xlsx`);
    
  } catch (error) {
    console.error('Excel export failed, falling back to CSV:', error);
    exportToCSV(data, filename);
  }
};

// ==================== PDF Export ====================
export const exportToPDF = async (data, filename = 'export', title = 'Report', headers = null) => {
  if (!data || data.length === 0) {
    alert('No data available to export.');
    return;
  }

  try {
    // Dynamic imports
    const { jsPDF } = await import('jspdf');
    await import('jspdf-autotable');
    
    const doc = new jsPDF('landscape');
    
    // Get headers from data if not provided
    const cols = headers || Object.keys(data[0]);
    
    // Get rows
    const rows = data.map(row => cols.map(col => 
      row[col] !== null && row[col] !== undefined ? String(row[col]) : ''
    ));
    
    // Add title
    doc.setFontSize(18);
    doc.text(title, 14, 20);
    
    // Add date
    doc.setFontSize(10);
    doc.text(`Generated on: ${new Date().toLocaleString('en-IN')}`, 14, 28);
    
    // Add table
    doc.autoTable({
      head: [cols],
      body: rows,
      startY: 35,
      styles: { fontSize: 9 },
      headStyles: { 
        fillColor: [102, 126, 234],
        textColor: 255,
        fontStyle: 'bold'
      },
      alternateRowStyles: { fillColor: [245, 247, 250] },
      margin: { top: 35 }
    });
    
    // Save PDF
    doc.save(`${filename}_${new Date().toISOString().slice(0, 10)}.pdf`);
    
  } catch (error) {
    console.error('PDF export failed:', error);
    alert('PDF export failed. Please try CSV or Excel format.');
  }
};

// ==================== Filter Data by Date Range ====================
export const filterByDateRange = (data, startDate, endDate, dateField = 'created_at') => {
  if (!data || data.length === 0) return data;
  
  let filtered = [...data];
  
  if (startDate) {
    const start = new Date(startDate);
    start.setHours(0, 0, 0, 0);
    filtered = filtered.filter(item => {
      const itemDate = new Date(item[dateField]);
      return itemDate >= start;
    });
  }
  
  if (endDate) {
    const end = new Date(endDate);
    end.setHours(23, 59, 59, 999);
    filtered = filtered.filter(item => {
      const itemDate = new Date(item[dateField]);
      return itemDate <= end;
    });
  }
  
  return filtered;
};

// ==================== Get Filename with Role Prefix ====================
export const getExportFilename = (role, dataType) => {
  const rolePrefix = role === 'student' ? 'student' : 
                     role === 'super_admin' ? 'superadmin' : 'admin';
  return `${rolePrefix}_${dataType}`;
};

// ==================== Prepare Student Results for Export ====================
export const prepareStudentResultsForExport = (results) => {
  return results.map(result => {
    const percentage = result.total_questions > 0 
      ? ((result.score / result.total_questions) * 100).toFixed(1) 
      : 0;
    const status = percentage >= 60 ? 'Passed' : 'Failed';
    const timeTaken = result.time_taken 
      ? `${Math.floor(result.time_taken / 60)}m ${result.time_taken % 60}s` 
      : 'N/A';
    
    return {
      'Exam Name': result.exam_title || 'Untitled Exam',
      'Score': `${result.score} / ${result.total_questions}`,
      'Percentage': `${percentage}%`,
      'Status': status,
      'Time Taken': timeTaken,
      'Submitted On': new Date(result.submitted_at).toLocaleString('en-IN'),
      'Attempt ID': result.attempt_id || result.id
    };
  });
};

// ==================== Prepare Students Data for Export ====================
export const prepareStudentsForExport = (students) => {
  return students.map(student => ({
    'Name': student.name || '—',
    'Email': student.email || '—',
    'Joined': student.created_at 
      ? new Date(student.created_at).toLocaleDateString('en-IN') 
      : '—',
    'Student ID': student.id || '—'
  }));
};

// ==================== Prepare Exams Data for Export ====================
export const prepareExamsForExport = (exams) => {
  return exams.map(exam => {
    const isActive = !exam.deadline || new Date(exam.deadline) > new Date();
    return {
      'Exam Title': exam.title || '—',
      'Questions': exam.total_questions || '—',
      'Duration': exam.duration ? `${exam.duration} min` : '—',
      'Deadline': exam.deadline 
        ? new Date(exam.deadline).toLocaleString('en-IN') 
        : 'No Deadline',
      'Status': isActive ? 'Active' : 'Expired',
      'Exam Code': exam.exam_code || '—',
      'Created': exam.created_at 
        ? new Date(exam.created_at).toLocaleDateString('en-IN') 
        : '—'
    };
  });
};

// ==================== Prepare Results Data for Export ====================
export const prepareResultsForExport = (results) => {
  return results.map(result => {
    const percentage = result.total_questions > 0 
      ? ((result.score / result.total_questions) * 100).toFixed(1) 
      : 0;
    const status = percentage >= 60 ? 'Passed' : 'Failed';
    const timeTaken = result.time_taken 
      ? `${Math.floor(result.time_taken / 60)}m ${result.time_taken % 60}s` 
      : 'N/A';
    
    return {
      'Student Name': result.student_name || '—',
      'Student Email': result.student_email || '—',
      'Exam Name': result.exam_title || '—',
      'Score': `${result.score} / ${result.total_questions}`,
      'Percentage': `${percentage}%`,
      'Status': status,
      'Time Taken': timeTaken,
      'Violations': result.violations ? result.violations.length : 0,
      'Submitted': result.submitted_at 
        ? new Date(result.submitted_at).toLocaleString('en-IN') 
        : '—'
    };
  });
};

// ==================== Prepare Violations Data for Export ====================
export const prepareViolationsForExport = (results) => {
  const violations = [];
  
  results.forEach(result => {
    if (result.violations && result.violations.length > 0) {
      result.violations.forEach(violation => {
        violations.push({
          'Student Name': result.student_name || '—',
          'Student Email': result.student_email || '—',
          'Exam Name': result.exam_title || '—',
          'Violation Type': violation.type || '—',
          'Timestamp': new Date(violation.timestamp).toLocaleString('en-IN'),
          'Score': `${result.score} / ${result.total_questions}`,
          'Attempt ID': result.attempt_id || result.id
        });
      });
    }
  });
  
  return violations;
};

// ==================== Prepare Admins Data for Export ====================
export const prepareAdminsForExport = (admins) => {
  return admins.map(admin => ({
    'Name': admin.name || '—',
    'Email': admin.email || '—',
    'Role': admin.role === 'super_admin' ? 'Super Admin' : 'Admin (Faculty)',
    'Joined': admin.created_at 
      ? new Date(admin.created_at).toLocaleDateString('en-IN') 
      : '—',
    'Admin ID': admin.id || '—'
  }));
};
