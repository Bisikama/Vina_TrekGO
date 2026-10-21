import { createHash } from 'node:crypto';
import { Injectable } from '@nestjs/common';
import { createClient, SupabaseClient } from '@supabase/supabase-js';
import envconfig from 'src/shared/config';
import { AppError } from 'src/shared/errors';
import { RENTAL_DOCUMENT_ERROR_CODES as RD } from 'src/shared/errors/codes/rental-document.error-codes';

export interface DocumentStoragePort {
  put(key: string, bytes: Buffer): Promise<void>;
  read(key: string): Promise<Buffer>;
  signedGet(key: string, seconds: number): Promise<string>;
}
export const DOCUMENT_STORAGE_PORT = Symbol('DOCUMENT_STORAGE_PORT');
export const pdfDigest = (bytes: Buffer) => createHash('sha256').update(bytes).digest('hex');
export function documentObjectKey(documentId: string, templateVersion: string, snapshotHash: string) {
  if (!/^[0-9a-f-]{36}$/i.test(documentId) || !/^[a-zA-Z0-9.-]{1,30}$/.test(templateVersion) ||
      !/^[0-9a-f]{64}$/i.test(snapshotHash)) throw new Error('INVALID_DOCUMENT_OBJECT_KEY');
  return `rental-documents/${documentId}/${createHash('sha256').update(`${templateVersion}:${snapshotHash}`).digest('hex')}.pdf`;
}

/** Uses a dedicated, private Supabase bucket. No public object URLs are emitted. */
@Injectable()
export class SupabaseDocumentStorage implements DocumentStoragePort {
  private readonly client: SupabaseClient | null;
  private readonly bucket = envconfig.RENTAL_DOCUMENT_BUCKET ?? process.env.RENTAL_DOCUMENT_BUCKET ?? '';
  constructor() {
    const url = envconfig.SUPABASE_URL ?? process.env.SUPABASE_URL;
    const key = envconfig.SUPABASE_SERVICE_ROLE_KEY ?? process.env.SUPABASE_SERVICE_ROLE_KEY;
    this.client = url && key ? createClient(url, key, { auth: { persistSession: false } }) : null;
  }
  private async privateBucket() {
    if (!this.client || !this.bucket) throw AppError.fromCode(RD.STORAGE_UNAVAILABLE);
    const { data, error } = await this.client.storage.getBucket(this.bucket);
    if (error || !data || data.public) throw AppError.fromCode(RD.STORAGE_UNAVAILABLE);
    return this.client.storage.from(this.bucket);
  }
  private safeKey(key: string) {
    if (!/^rental-documents\/[0-9a-f-]{36}\/[0-9a-f]{64}\.pdf$/i.test(key))
      throw AppError.fromCode(RD.INTEGRITY_FAILED);
  }
   
  async put(key: string, bytes: Buffer) {
    this.safeKey(key);
    const bucket = await this.privateBucket();
    const { error } = await bucket.upload(key, bytes, { contentType: 'application/pdf', upsert: false });
    if (error) {
      // A crash after upload may leave the object in place. Reuse only identical bytes.
      const existing = await this.read(key).catch(() => null);
      if (!existing || pdfDigest(existing) !== pdfDigest(bytes)) throw AppError.fromCode(RD.STORAGE_UNAVAILABLE);
    }
  }
  async read(key: string) {
    this.safeKey(key);
    const bucket = await this.privateBucket();
    const { data, error } = await bucket.download(key);
    if (error || !data) throw AppError.fromCode(RD.STORAGE_UNAVAILABLE);
    return Buffer.from(await data.arrayBuffer());
  }
  async signedGet(key: string, seconds: number) {
    this.safeKey(key);
    if (seconds !== 600) throw AppError.fromCode(RD.STORAGE_UNAVAILABLE);
    const bucket = await this.privateBucket();
    const { data, error } = await bucket.createSignedUrl(key, seconds);
    if (error || !data?.signedUrl) throw AppError.fromCode(RD.STORAGE_UNAVAILABLE);
    return data.signedUrl;
  }
}

/** Test double; never wired in production. */
export class MemoryDocumentStorage implements DocumentStoragePort {
  readonly objects = new Map<string, Buffer>();
  // eslint-disable-next-line @typescript-eslint/require-await
  async put(key: string, bytes: Buffer) {
    const existing = this.objects.get(key);
    if (existing && pdfDigest(existing) !== pdfDigest(bytes)) throw new Error('OBJECT_HASH_CONFLICT');
    this.objects.set(key, Buffer.from(bytes));
  }
  // eslint-disable-next-line @typescript-eslint/require-await
  async read(key: string) {
    const value = this.objects.get(key);
    if (!value) throw new Error('OBJECT_NOT_FOUND');
    return Buffer.from(value);
  }
  // eslint-disable-next-line @typescript-eslint/require-await
  async signedGet(key: string, seconds: number) {
    if (!this.objects.has(key) || seconds !== 600) throw new Error('OBJECT_NOT_FOUND');
    return `memory://test-only/${encodeURIComponent(key)}`;
  }
}
