/* eslint-disable */
/**
 * ExportToolbar - Reusable component for data export with filters
 * Provides CSV, Excel, PDF download buttons with date range filtering
 */
import React, { useState } from 'react';
import { exportToCSV, exportToExcel, exportToPDF, filterByDateRange } from '../utils/exportUtils';

const ExportToolbar = ({
  data,
  filename,
  title = 'Report',
  headers = null,
  dateField = 'created_at',
  onFilterChange = null,
  showDateFilter = true,
  showSearchFilter = false,
  extraButtons = null
}) => {
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [searchTerm, setSearchTerm] = useState('');
  const [showFilters, setShowFilters] = useState(false);

  const handleExport = async (format) => {
    let filteredData = data;

    // Apply date range filter
    if (startDate || endDate) {
      filteredData = filterByDateRange(filteredData, startDate, endDate, dateField);
    }

    // Apply search filter if applicable
    if (searchTerm && showSearchFilter) {
      const search = searchTerm.toLowerCase();
      filteredData = filteredData.filter(item =>
        Object.values(item).some(val =>
          String(val).toLowerCase().includes(search)
        )
      );
    }

    if (filteredData.length === 0) {
      alert('No data matches your current filters.');
      return;
    }

    switch (format) {
      case 'csv':
        exportToCSV(filteredData, filename);
        break;
      case 'excel':
        await exportToExcel(filteredData, filename);
        break;
      case 'pdf':
        await exportToPDF(filteredData, filename, title, headers);
        break;
      default:
        break;
    }
  };

  const handleApplyFilters = () => {
    let filteredData = data;

    if (startDate || endDate) {
      filteredData = filterByDateRange(filteredData, startDate, endDate, dateField);
    }

    if (searchTerm && showSearchFilter) {
      const search = searchTerm.toLowerCase();
      filteredData = filteredData.filter(item =>
        Object.values(item).some(val =>
          String(val).toLowerCase().includes(search)
        )
      );
    }

    if (onFilterChange) {
      onFilterChange(filteredData);
    }
  };

  const handleClearFilters = () => {
    setStartDate('');
    setEndDate('');
    setSearchTerm('');
    if (onFilterChange) {
      onFilterChange(data);
    }
  };

  const buttonStyle = (color) => ({
    padding: '8px 16px',
    borderRadius: 8,
    border: 'none',
    background: color,
    color: '#fff',
    fontWeight: 600,
    fontSize: 13,
    cursor: 'pointer',
    transition: 'all 0.2s',
    display: 'flex',
    alignItems: 'center',
    gap: 6
  });

  const filterButtonStyle = {
    padding: '8px 16px',
    borderRadius: 8,
    border: '2px solid #e0e0e0',
    background: '#fff',
    color: '#555',
    fontWeight: 600,
    fontSize: 13,
    cursor: 'pointer',
    transition: 'all 0.2s',
    display: 'flex',
    alignItems: 'center',
    gap: 6
  };

  return (
    <div style={{ marginBottom: 20 }}>
      {/* Main Export Buttons */}
      <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between' }}>
        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
          <button
            onClick={() => handleExport('csv')}
            style={buttonStyle('#4caf50')}
            onMouseEnter={e => e.currentTarget.style.background = '#388e3c'}
            onMouseLeave={e => e.currentTarget.style.background = '#4caf50'}
            title="Export as CSV"
          >
            📄 CSV
          </button>
          <button
            onClick={() => handleExport('excel')}
            style={buttonStyle('#2196f3')}
            onMouseEnter={e => e.currentTarget.style.background = '#1976d2'}
            onMouseLeave={e => e.currentTarget.style.background = '#2196f3'}
            title="Export as Excel"
          >
            📊 Excel
          </button>
          <button
            onClick={() => handleExport('pdf')}
            style={buttonStyle('#f44336')}
            onMouseEnter={e => e.currentTarget.style.background = '#d32f2f'}
            onMouseLeave={e => e.currentTarget.style.background = '#f44336'}
            title="Export as PDF"
          >
            📑 PDF
          </button>
          {extraButtons}
        </div>

        {/* Filter Toggle */}
        <div style={{ display: 'flex', gap: 10 }}>
          {(showDateFilter || showSearchFilter) && (
            <button
              onClick={() => setShowFilters(!showFilters)}
              style={filterButtonStyle}
              onMouseEnter={e => { e.currentTarget.style.background = '#f5f5f5'; }}
              onMouseLeave={e => { e.currentTarget.style.background = '#fff'; }}
            >
              🔍 Filters {showFilters ? '▲' : '▼'}
            </button>
          )}
        </div>
      </div>

      {/* Filter Panel */}
      {showFilters && (
        <div style={{
          marginTop: 15,
          padding: 16,
          background: '#f8f9fa',
          borderRadius: 10,
          border: '1px solid #e0e0e0'
        }}>
          <div style={{ display: 'flex', gap: 15, flexWrap: 'wrap', alignItems: 'flex-end' }}>
            {showDateFilter && (
              <>
                <div style={{ flex: 1, minWidth: 150 }}>
                  <label style={{ fontSize: 12, fontWeight: 600, color: '#555', marginBottom: 4, display: 'block' }}>
                    From Date
                  </label>
                  <input
                    type="date"
                    value={startDate}
                    onChange={e => setStartDate(e.target.value)}
                    style={{
                      width: '100%',
                      padding: '8px 12px',
                      borderRadius: 8,
                      border: '2px solid #e0e0e0',
                      fontSize: 13,
                      outline: 'none',
                      boxSizing: 'border-box'
                    }}
                  />
                </div>
                <div style={{ flex: 1, minWidth: 150 }}>
                  <label style={{ fontSize: 12, fontWeight: 600, color: '#555', marginBottom: 4, display: 'block' }}>
                    To Date
                  </label>
                  <input
                    type="date"
                    value={endDate}
                    onChange={e => setEndDate(e.target.value)}
                    style={{
                      width: '100%',
                      padding: '8px 12px',
                      borderRadius: 8,
                      border: '2px solid #e0e0e0',
                      fontSize: 13,
                      outline: 'none',
                      boxSizing: 'border-box'
                    }}
                  />
                </div>
              </>
            )}

            {showSearchFilter && (
              <div style={{ flex: 2, minWidth: 200 }}>
                <label style={{ fontSize: 12, fontWeight: 600, color: '#555', marginBottom: 4, display: 'block' }}>
                  Search
                </label>
                <input
                  type="text"
                  placeholder="Search across all fields..."
                  value={searchTerm}
                  onChange={e => setSearchTerm(e.target.value)}
                  style={{
                    width: '100%',
                    padding: '8px 12px',
                    borderRadius: 8,
                    border: '2px solid #e0e0e0',
                    fontSize: 13,
                    outline: 'none',
                    boxSizing: 'border-box'
                  }}
                />
              </div>
            )}

            <button
              onClick={handleApplyFilters}
              style={{
                padding: '8px 20px',
                borderRadius: 8,
                border: 'none',
                background: 'linear-gradient(135deg, #667eea, #764ba2)',
                color: '#fff',
                fontWeight: 600,
                fontSize: 13,
                cursor: 'pointer'
              }}
            >
              Apply Filters
            </button>

            <button
              onClick={handleClearFilters}
              style={{
                padding: '8px 20px',
                borderRadius: 8,
                border: '2px solid #e0e0e0',
                background: '#fff',
                color: '#555',
                fontWeight: 600,
                fontSize: 13,
                cursor: 'pointer'
              }}
            >
              Clear
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default ExportToolbar;
