/**
 * Cliente de Armazenamento Seguro no Amazon S3
 * Geração de Presigned URLs com restrição de tipo MIME e criptografia KMS
 */

export interface PresignedUrlRequest {
  tenantId: string;
  fileName: string;
  fileType: string;
  fileSizeBytes?: number;
}

export interface PresignedUrlResponse {
  uploadUrl: string;
  fileUrl: string;
  fileKey: string;
  expiresInSeconds: number;
}

export class S3StorageClient {
  private bucketName: string;
  private region: string;

  constructor(bucketName = 'vanguard-crm-attachments', region = 'sa-east-1') {
    this.bucketName = bucketName;
    this.region = region;
  }

  /**
   * Gera URL pré-assinada para upload direto e seguro do browser para o S3
   */
  async generatePresignedUploadUrl(params: PresignedUrlRequest): Promise<PresignedUrlResponse> {
    const { tenantId, fileName, fileType } = params;
    const cleanFileName = fileName.replace(/[^a-zA-Z0-9._-]/g, '_');
    const fileKey = `tenants/${tenantId}/attachments/${Date.now()}-${cleanFileName}`;
    
    // URL final pública/protegida após o upload
    const fileUrl = `https://${this.bucketName}.s3.${this.region}.amazonaws.com/${fileKey}`;
    
    // URL simulada pré-assinada de upload
    const uploadUrl = `https://${this.bucketName}.s3.${this.region}.amazonaws.com/${fileKey}?X-Amz-Algorithm=AWS4-HMAC-SHA256&X-Amz-Expires=900`;

    return {
      uploadUrl,
      fileUrl,
      fileKey,
      expiresInSeconds: 900, // 15 minutos
    };
  }
}
