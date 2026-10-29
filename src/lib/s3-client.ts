import crypto from 'crypto';
import { S3Client, PutObjectCommand, GetObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';

export interface PresignedUrlRequest { tenantId: string; fileName: string; fileType: string; fileSizeBytes?: number; }
export interface PresignedUrlResponse { uploadUrl: string; fileUrl: string; fileKey: string; expiresInSeconds: number; headers: Record<string, string>; }
export class S3StorageClient {
  constructor(private bucketName = process.env.AWS_S3_BUCKET_NAME || '', private region = process.env.AWS_S3_REGION || 'sa-east-1') {}
  async generatePresignedUploadUrl(params: PresignedUrlRequest): Promise<PresignedUrlResponse> {
    if (!this.bucketName) throw new Error('Armazenamento não configurado: AWS_S3_BUCKET_NAME.');
    if (!/^[a-zA-Z0-9_-]+$/.test(params.tenantId)) throw new Error('Imobiliária inválida.');
    if (!params.fileSizeBytes || params.fileSizeBytes < 1 || params.fileSizeBytes > 25 * 1024 * 1024) throw new Error('Informe um arquivo de até 25 MB.');
    const allowed = /^(image\/(jpeg|png|webp)|audio\/(mpeg|ogg|mp4|wav|webm)|video\/(mp4|webm)|application\/pdf)$/;
    if (!allowed.test(params.fileType)) throw new Error('Tipo de arquivo não permitido.');
    const fileName = params.fileName.replace(/[^a-zA-Z0-9._-]/g, '_').slice(-150);
    const fileKey = `tenants/${params.tenantId}/attachments/${crypto.randomUUID()}-${fileName}`;
    const client = new S3Client({ region: this.region });
    const headers: Record<string, string> = { 'Content-Type': params.fileType };
    const command = new PutObjectCommand({ Bucket: this.bucketName, Key: fileKey, ContentType: params.fileType, ContentLength: params.fileSizeBytes });
    const uploadUrl = await getSignedUrl(client, command, { expiresIn: 900, signableHeaders: new Set(['content-type', 'content-length']) });
    const fileUrl = await getSignedUrl(client, new GetObjectCommand({ Bucket: this.bucketName, Key: fileKey }), { expiresIn: 900 });
    return { uploadUrl, fileUrl, fileKey, expiresInSeconds: 900, headers };
  }
}
