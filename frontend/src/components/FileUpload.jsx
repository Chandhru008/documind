import { useCallback } from 'react';
import { useDropzone } from 'react-dropzone';
import { Upload, CloudUpload } from 'lucide-react';

export default function FileUpload({ onUpload, isUploading, disabled, documentCount }) {
  const maxFiles = 2 - documentCount;

  const onDrop = useCallback(
    (acceptedFiles) => {
      if (acceptedFiles.length > 0 && !disabled) {
        onUpload(acceptedFiles);
      }
    },
    [onUpload, disabled]
  );

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: {
      'application/pdf': ['.pdf'],
    },
    maxFiles: maxFiles,
    disabled: disabled || maxFiles <= 0,
    multiple: maxFiles > 1,
  });

  const isFullyDisabled = disabled || maxFiles <= 0;

  return (
    <div
      {...getRootProps()}
      className={`upload-zone ${isDragActive ? 'active' : ''} ${isFullyDisabled ? 'disabled' : ''}`}
      id="file-upload-zone"
    >
      <input {...getInputProps()} id="file-upload-input" />

      <div className="upload-icon">
        {isDragActive ? (
          <CloudUpload size={40} strokeWidth={1.5} />
        ) : (
          <Upload size={36} strokeWidth={1.5} />
        )}
      </div>

      {isUploading ? (
        <div className="upload-progress">
          <div className="progress-bar-track">
            <div
              className="progress-bar-fill"
              style={{ width: '60%' }}
            ></div>
          </div>
          <p className="progress-text">Processing documents...</p>
        </div>
      ) : isDragActive ? (
        <p className="upload-text">
          <strong>Drop your PDF here!</strong>
        </p>
      ) : maxFiles <= 0 ? (
        <p className="upload-text">
          Maximum documents reached.
          <br />
          <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
            Clear existing documents to upload new ones.
          </span>
        </p>
      ) : (
        <>
          <p className="upload-text">
            <strong>Drag & drop PDF files here</strong>
            <br />
            or click to browse
          </p>
          <p className="upload-hint">
            Upload up to {maxFiles} PDF file{maxFiles !== 1 ? 's' : ''} (max 50MB each)
          </p>
        </>
      )}
    </div>
  );
}
