import { S3Client, HeadObjectCommand, GetObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { campaignAttachmentSchema, type CampaignAttachment } from '@/lib/campaigns';

function mediaContext(tenantId: string, key: string) {
  if (!key.startsWith(`tenants/${tenantId}/attachments/`) || key.includes('..') || key.length > 500) throw new Error('Arquivo de outro ambiente ou inválido.');
  const bucket = process.env.AWS_S3_BUCKET_NAME;
  if (!bucket) throw new Error('Armazenamento de arquivos não configurado.');
  return { bucket, client: new S3Client({ region: process.env.AWS_S3_REGION || 'sa-east-1' }) };
}
export async function verifyCampaignMedia(tenantId: string, input: CampaignAttachment): Promise<CampaignAttachment> {
  const attachment = campaignAttachmentSchema.parse(input);
  const { bucket, client } = mediaContext(tenantId, attachment.key);
  const object = await client.send(new HeadObjectCommand({ Bucket: bucket, Key: attachment.key }));
  if (!object.ETag || object.ContentLength !== attachment.size || object.ContentType !== attachment.mimeType) throw new Error('O arquivo não foi confirmado no armazenamento. Envie-o novamente.');
  if (attachment.etag && attachment.etag !== object.ETag) throw new Error('O arquivo foi alterado após a revisão da campanha.');
  return { ...attachment, etag: object.ETag };
}
export async function campaignMediaUrl(tenantId: string, key: string) {
  const { bucket, client } = mediaContext(tenantId, key);
  return getSignedUrl(client, new GetObjectCommand({ Bucket: bucket, Key: key }), { expiresIn: 3600 });
}
