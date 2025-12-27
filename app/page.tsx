'use client';

import { useState, useRef } from 'react';

interface RaviResult {
  bookName: string;
  status: 'Thiqah' | 'Zaeef' | 'Unknown';
  page: number;
  context: string;
}

export default function Home() {
  const [files, setFiles] = useState<File[]>([]);
  const [loading, setLoading] = useState(false);
  const [results, setResults] = useState<RaviResult[]>([]);
  const [error, setError] = useState<string>('');
  const [dragging, setDragging] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setDragging(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    setDragging(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragging(false);
    const droppedFiles = Array.from(e.dataTransfer.files).filter(
      file => file.type === 'application/pdf'
    );
    setFiles(prev => [...prev, ...droppedFiles]);
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      const selectedFiles = Array.from(e.target.files).filter(
        file => file.type === 'application/pdf'
      );
      setFiles(prev => [...prev, ...selectedFiles]);
    }
  };

  const removeFile = (index: number) => {
    setFiles(prev => prev.filter((_, i) => i !== index));
  };

  const analyzeBooks = async () => {
    if (files.length === 0) return;

    setLoading(true);
    setError('');
    setResults([]);

    const formData = new FormData();
    files.forEach(file => formData.append('files', file));

    try {
      const response = await fetch('/api/analyze', {
        method: 'POST',
        body: formData,
      });

      if (!response.ok) {
        throw new Error('Analysis failed');
      }

      const data = await response.json();
      setResults(data.results);
    } catch (err) {
      setError('Failed to analyze books. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="container">
      <div className="header">
        <h1>📚 Ravi Status Analyzer</h1>
        <p>Upload PDF books to find references to Ravi and determine their status (Thiqah or Zaeef)</p>
      </div>

      <div className="upload-section">
        <div
          className={`upload-area ${dragging ? 'dragging' : ''}`}
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
          onClick={() => fileInputRef.current?.click()}
        >
          <div className="upload-icon">📄</div>
          <h3>Drag & Drop PDF files here</h3>
          <p>or click to browse</p>
          <input
            ref={fileInputRef}
            type="file"
            className="file-input"
            accept="application/pdf"
            multiple
            onChange={handleFileSelect}
          />
        </div>

        {files.length > 0 && (
          <div className="file-list">
            <h3>Selected Files:</h3>
            {files.map((file, index) => (
              <div key={index} className="file-item">
                <span>{file.name}</span>
                <button className="remove-btn" onClick={() => removeFile(index)}>
                  Remove
                </button>
              </div>
            ))}
            <button
              className="button"
              onClick={analyzeBooks}
              disabled={loading}
            >
              {loading ? 'Analyzing...' : 'Analyze Books'}
            </button>
          </div>
        )}
      </div>

      {loading && (
        <div className="loading">
          <div className="spinner"></div>
          <p>Analyzing PDF books for Ravi references...</p>
        </div>
      )}

      {error && (
        <div className="error">
          {error}
        </div>
      )}

      {results.length > 0 && (
        <div className="results">
          <h2>Analysis Results</h2>
          {results.map((result, index) => (
            <div
              key={index}
              className={`result-item ${result.status.toLowerCase()}`}
            >
              <div className="book-name">{result.bookName}</div>
              <div className={`status ${result.status.toLowerCase()}`}>
                Status: {result.status}
              </div>
              <div className="reference">
                📍 Reference: Page {result.page}
              </div>
              <div className="context">
                "{result.context}"
              </div>
            </div>
          ))}
        </div>
      )}

      {!loading && results.length === 0 && files.length > 0 && error === '' && (
        <div className="results">
          <div className="no-results">
            No results yet. Click "Analyze Books" to start the analysis.
          </div>
        </div>
      )}
    </div>
  );
}
