'use client';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Upload } from 'lucide-react';
import { useState } from 'react';

interface FileUploaderProps {
  onFileUploaded: (file: File) => void;
}

export function FileUploader({ onFileUploaded }: FileUploaderProps) {
  const [dragActive, setDragActive] = useState(false);

  const handleDrag = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === 'dragenter' || e.type === 'dragover') {
      setDragActive(true);
    } else if (e.type === 'dragleave') {
      setDragActive(false);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);

    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      onFileUploaded(e.dataTransfer.files[0]);
    }
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      onFileUploaded(e.target.files[0]);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>📤 Upload File Excel</CardTitle>
      </CardHeader>
      <CardContent>
        <div
          className={`border-2 border-dashed rounded-lg p-8 text-center transition-colors ${
            dragActive
              ? 'border-primary bg-primary/5'
              : 'border-muted-foreground/25 hover:border-primary/50'
          }`}
          onDragEnter={handleDrag}
          onDragLeave={handleDrag}
          onDragOver={handleDrag}
          onDrop={handleDrop}
        >
          <Upload className="mx-auto h-12 w-12 text-muted-foreground mb-4" />
          <p className="text-lg font-medium mb-2">
            Kéo thả file Excel vào đây
          </p>
          <p className="text-sm text-muted-foreground mb-4">
            hoặc click để chọn file (.xlsx, .xls)
          </p>
          <Input
            type="file"
            accept=".xlsx,.xls"
            onChange={handleChange}
            className="max-w-sm mx-auto"
          />
        </div>
      </CardContent>
    </Card>
  );
}