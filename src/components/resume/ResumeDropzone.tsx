"use client";

import { useCallback, useState } from "react";
import { useDropzone, type FileRejection } from "react-dropzone";
import { Upload, FileText, X, CheckCircle } from "lucide-react";
import { clsx } from "clsx";

interface ResumeDropzoneProps {
  onFileSelect: (file: File) => void;
  selectedFile?: File | null;
  onClear?: () => void;
  disabled?: boolean;
}

const ACCEPTED_TYPES = {
  "application/pdf": [".pdf"],
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document": [
    ".docx",
  ],
};

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export function ResumeDropzone({
  onFileSelect,
  selectedFile,
  onClear,
  disabled = false,
}: ResumeDropzoneProps) {
  const [error, setError] = useState("");

  const onDrop = useCallback(
    (acceptedFiles: File[], rejectedFiles: FileRejection[]) => {
      setError("");
      if (rejectedFiles.length > 0) {
        const err = rejectedFiles[0].errors[0];
        if (err?.code === "file-too-large") {
          setError("File is too large. Maximum size is 5MB.");
        } else if (err?.code === "file-invalid-type") {
          setError("Invalid file type. Please upload a PDF or DOCX file.");
        } else {
          setError(err?.message ?? "File rejected.");
        }
        return;
      }
      if (acceptedFiles[0]) {
        onFileSelect(acceptedFiles[0]);
      }
    },
    [onFileSelect]
  );

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: ACCEPTED_TYPES,
    maxSize: 5 * 1024 * 1024,
    multiple: false,
    disabled,
  });

  if (selectedFile) {
    return (
      <div className="relative border-2 border-green-200 bg-green-50 rounded-xl p-6">
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 bg-green-100 rounded-xl flex items-center justify-center shrink-0">
            <CheckCircle className="w-6 h-6 text-green-600" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-semibold text-gray-900 truncate">
              {selectedFile.name}
            </p>
            <p className="text-xs text-gray-500 mt-0.5">
              {formatBytes(selectedFile.size)} · Ready to process
            </p>
          </div>
          {onClear && !disabled && (
            <button
              onClick={onClear}
              className="p-1.5 text-gray-400 hover:text-gray-600 transition-colors rounded-lg hover:bg-gray-100"
            >
              <X className="w-4 h-4" />
            </button>
          )}
        </div>
      </div>
    );
  }

  return (
    <div>
      <div
        {...getRootProps()}
        className={clsx(
          "border-2 border-dashed rounded-xl p-8 text-center cursor-pointer transition-all duration-150",
          {
            "border-[#FF3E6C] bg-[#FFF0F3]": isDragActive,
            "border-gray-200 bg-gray-50 hover:border-[#FF3E6C] hover:bg-[#FFF0F3]":
              !isDragActive && !disabled,
            "border-gray-100 bg-gray-50 cursor-not-allowed opacity-60": disabled,
          }
        )}
      >
        <input {...getInputProps()} />
        <div className="flex flex-col items-center gap-3">
          <div
            className={clsx(
              "w-14 h-14 rounded-2xl flex items-center justify-center",
              isDragActive ? "bg-[#FF3E6C]" : "bg-gray-100"
            )}
          >
            {isDragActive ? (
              <Upload className="w-7 h-7 text-white" />
            ) : (
              <FileText className="w-7 h-7 text-gray-400" />
            )}
          </div>

          <div>
            <p className="text-sm font-semibold text-gray-900">
              {isDragActive ? "Drop your resume here" : "Upload your resume"}
            </p>
            <p className="text-xs text-gray-500 mt-1">
              Drag & drop or{" "}
              <span className="text-[#FF3E6C] font-medium">browse files</span>
            </p>
          </div>

          <p className="text-xs text-gray-400">PDF or DOCX · Max 5MB</p>
        </div>
      </div>

      {error && (
        <p className="mt-2 text-xs text-red-600 flex items-center gap-1.5">
          <X className="w-3.5 h-3.5 shrink-0" />
          {error}
        </p>
      )}
    </div>
  );
}
