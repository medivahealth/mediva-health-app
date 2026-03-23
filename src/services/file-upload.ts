import api from './api';

export interface UploadedFile {
  id: string;
  url: string;
  filename: string;
  mimeType: string;
  size: number;
  category: 'xray' | 'lab_report' | 'prescription' | 'photo' | 'document';
  uploadedAt: string;
}

export interface FileAnalysisResult {
  summary: string;
  keyFindings: string[];
  recommendations: string[];
  abnormalValues?: Array<{
    parameter: string;
    value: string;
    referenceRange: string;
    severity: 'low' | 'moderate' | 'high';
  }>;
}

class FileUploadService {
  /**
   * Upload a file (image, PDF, etc.)
   */
  async uploadFile(
    uri: string,
    category: UploadedFile['category'],
    filename?: string,
    onProgress?: (progress: number) => void
  ): Promise<UploadedFile> {
    // Extract filename from uri if not provided
    const name = filename || uri.split('/').pop() || 'file';
    
    // Determine mime type from extension
    const extension = name.split('.').pop()?.toLowerCase();
    const mimeType = this.getMimeType(extension);

    const file = {
      uri,
      name,
      type: mimeType,
    };

    return api.uploadFile<UploadedFile>('/records/upload', file, 'file', {
      category,
    });
  }

  /**
   * Upload multiple files
   */
  async uploadMultiple(
    files: { uri: string; filename?: string }[],
    category: UploadedFile['category']
  ): Promise<UploadedFile[]> {
    const uploaded: UploadedFile[] = [];
    
    for (const file of files) {
      try {
        const result = await this.uploadFile(file.uri, category, file.filename);
        uploaded.push(result);
      } catch (err) {
        console.error('Failed to upload file:', file.filename, err);
      }
    }
    
    return uploaded;
  }

  /**
   * Analyze an uploaded file using AI
   */
  async analyzeFile(fileId: string): Promise<FileAnalysisResult> {
    return api.post<FileAnalysisResult>(`/records/${fileId}/analyze`);
  }

  /**
   * Get user's uploaded files
   */
  async getFiles(category?: UploadedFile['category']): Promise<UploadedFile[]> {
    const url = category ? `/records?category=${category}` : '/records';
    return api.get<UploadedFile[]>(url);
  }

  /**
   * Delete a file
   */
  async deleteFile(fileId: string): Promise<void> {
    await api.delete(`/records/${fileId}`);
  }

  /**
   * Get mime type from file extension
   */
  private getMimeType(extension?: string): string {
    const mimeTypes: Record<string, string> = {
      'jpg': 'image/jpeg',
      'jpeg': 'image/jpeg',
      'png': 'image/png',
      'gif': 'image/gif',
      'pdf': 'application/pdf',
      'doc': 'application/msword',
      'docx': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'txt': 'text/plain',
    };
    
    return mimeTypes[extension || ''] || 'application/octet-stream';
  }

  /**
   * Check if file is an image
   */
  isImage(mimeType: string): boolean {
    return mimeType.startsWith('image/');
  }

  /**
   * Check if file is a PDF
   */
  isPDF(mimeType: string): boolean {
    return mimeType === 'application/pdf';
  }

  /**
   * Get file icon based on type
   */
  getFileIcon(category: UploadedFile['category']): string {
    const icons: Record<string, string> = {
      'xray': '🩻',
      'lab_report': '🧪',
      'prescription': '💊',
      'photo': '📷',
      'document': '📄',
    };
    return icons[category] || '📎';
  }
}

export const fileUploadService = new FileUploadService();
export default fileUploadService;
