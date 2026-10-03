import { CloudinaryStorageAdapter } from './cloudinary-storage.adapter';
import { v2 as cloudinary } from 'cloudinary';
import { AppError } from '../../../../shared/errors/app-error';
import { MEDIA_ERROR_CODES } from '../../../../shared/errors/codes/media.error-codes';
import envConfig from '../../../../shared/config';

jest.mock('cloudinary', () => ({
  v2: {
    config: jest.fn(),
    utils: {
      api_sign_request: jest.fn(),
    },
    api: {
      resource: jest.fn(),
    },
  },
}));

describe('CloudinaryStorageAdapter', () => {
  let adapter: CloudinaryStorageAdapter;

  beforeEach(() => {
    jest.clearAllMocks();
    
    // Enable media and set credentials
    envConfig.MEDIA_ENABLED = true;
    envConfig.CLOUDINARY_CLOUD_NAME = 'cloud';
    envConfig.CLOUDINARY_API_KEY = 'key';
    envConfig.CLOUDINARY_API_SECRET = 'secret';
    envConfig.CLOUDINARY_SIGNATURE_ALGORITHM = 'sha256';

    adapter = new CloudinaryStorageAdapter();
    adapter.onModuleInit();
  });

  describe('createUploadIntent', () => {
    beforeEach(() => {
      (cloudinary.utils.api_sign_request as jest.Mock).mockReturnValue('mock-signature');
    });

    it('creates correct intent for IMAGE and deliveryType upload', async () => {
      const result = await adapter.createUploadIntent({
        publicId: 'test-public-id',
        resourceType: 'IMAGE',
        deliveryType: 'upload',
        timestamp: 1234567890,
      });

      expect(result.uploadUrl).toBe('https://api.cloudinary.com/v1_1/cloud/image/upload');
      expect(result.method).toBe('POST');
      expect(result.formFields.api_key).toBe('key');
      expect((result.formFields as Record<string, unknown>).api_secret).toBeUndefined(); // MUST NOT contain api_secret
      
      expect(cloudinary.utils.api_sign_request).toHaveBeenCalledWith(
        expect.objectContaining({
          public_id: 'test-public-id',
          type: 'upload',
          timestamp: expect.any(Number),
        }),
        'secret'
      );
      
      const signedParams = (cloudinary.utils.api_sign_request as jest.Mock).mock.calls[0][0];
      expect(signedParams.file).toBeUndefined();
    });

    it('creates correct intent for VIDEO and deliveryType authenticated', async () => {
      const result = await adapter.createUploadIntent({
        publicId: 'test-public-id-video',
        resourceType: 'VIDEO',
        deliveryType: 'authenticated',
        timestamp: 1234567890,
      });

      expect(result.uploadUrl).toBe('https://api.cloudinary.com/v1_1/cloud/video/upload');
      expect(result.method).toBe('POST');
      expect(result.formFields.api_key).toBe('key');
      expect((result.formFields as Record<string, unknown>).api_secret).toBeUndefined(); // MUST NOT contain api_secret
      
      expect(cloudinary.utils.api_sign_request).toHaveBeenCalledWith(
        expect.objectContaining({
          public_id: 'test-public-id-video',
          type: 'authenticated',
          timestamp: expect.any(Number),
        }),
        'secret'
      );
    });
  });

  describe('verifyUploadResponse', () => {
    it('returns true if signature matches', async () => {
      (cloudinary.utils.api_sign_request as jest.Mock).mockReturnValue('correct-sig');
      const result = await adapter.verifyUploadResponse({
        publicId: 'test',
        version: 1,
        signature: 'correct-sig',
      });
      expect(result).toBe(true);
    });

    it('returns false if signature does not match', async () => {
      (cloudinary.utils.api_sign_request as jest.Mock).mockReturnValue('expected-sig');
      const result = await adapter.verifyUploadResponse({
        publicId: 'test',
        version: 1,
        signature: 'wrong-sig',
      });
      expect(result).toBe(false);
    });
  });

  describe('getAssetMetadata', () => {
    it('returns mapped metadata successfully', async () => {
      (cloudinary.api.resource as jest.Mock).mockResolvedValue({
        asset_id: 'a1',
        public_id: 'p1',
        format: 'jpg',
        bytes: 1024,
        width: 800,
        height: 600,
        duration: null,
        secure_url: 'https://...',
        resource_type: 'image',
        type: 'upload',
        created_at: '2023-10-01T12:00:00Z',
      });

      const result = await adapter.getAssetMetadata({ publicId: 'p1', resourceType: 'IMAGE', deliveryType: 'upload' });

      expect(result).toEqual({
        providerAssetId: 'a1',
        providerPublicId: 'p1',
        format: 'jpg',
        bytes: 1024,
        width: 800,
        height: 600,
        durationMs: null,
        secureUrl: 'https://...',
        resourceType: 'IMAGE',
        deliveryType: 'upload',
        providerUploadedAt: new Date('2023-10-01T12:00:00Z'),
      });
    });

    it('returns null on 404', async () => {
      (cloudinary.api.resource as jest.Mock).mockRejectedValue({ http_code: 404 });
      const result = await adapter.getAssetMetadata({ publicId: 'p1', resourceType: 'IMAGE', deliveryType: 'upload' });
      expect(result).toBeNull();
    });

    it('throws MEDIA_PROVIDER_ERROR on other errors', async () => {
      (cloudinary.api.resource as jest.Mock).mockRejectedValue({ http_code: 500, message: 'Server error' });
      await expect(adapter.getAssetMetadata({ publicId: 'p1', resourceType: 'IMAGE', deliveryType: 'upload' }))
        .rejects.toThrow(new AppError({ code: MEDIA_ERROR_CODES.MEDIA_PROVIDER_ERROR, message: 'Provider lookup failed' }));
    });
  });

  describe('ensureDerivatives', () => {
    it('returns immediately for upload deliveryType', async () => {
      cloudinary.uploader = { explicit: jest.fn() } as any;
      await adapter.ensureDerivatives({ providerPublicId: 'p1', resourceType: 'IMAGE', deliveryType: 'upload', variants: ['EVIDENCE_PREVIEW'] });
      expect(cloudinary.uploader.explicit).not.toHaveBeenCalled();
    });

    it('generates derivatives for IMAGE authenticated', async () => {
      cloudinary.uploader = { explicit: jest.fn().mockResolvedValue({}) } as any;
      await adapter.ensureDerivatives({ providerPublicId: 'p1', resourceType: 'IMAGE', deliveryType: 'authenticated', variants: ['EVIDENCE_PREVIEW'] });
      expect(cloudinary.uploader.explicit).toHaveBeenCalledWith('p1', expect.objectContaining({ type: 'authenticated', resource_type: 'image', eager: expect.any(Array) }));
    });

    it('generates derivatives for VIDEO authenticated', async () => {
      cloudinary.uploader = { explicit: jest.fn().mockResolvedValue({}) } as any;
      await adapter.ensureDerivatives({ providerPublicId: 'p1', resourceType: 'VIDEO', deliveryType: 'authenticated', variants: ['VIDEO_PREVIEW'] });
      expect(cloudinary.uploader.explicit).toHaveBeenCalledWith('p1', expect.objectContaining({ type: 'authenticated', resource_type: 'video', eager: expect.any(Array) }));
    });
  });

  describe('createDeliveryUrl', () => {
    beforeEach(() => {
      cloudinary.url = jest.fn().mockImplementation((id, opts) => `https://res.cloudinary.com/cloud/${opts.resource_type}/${opts.type}/${id}`);
    });

    it('creates public catalog URL', async () => {
      const result = await adapter.createDeliveryUrl({ providerPublicId: 'p1', resourceType: 'IMAGE', deliveryType: 'upload', variant: 'CATALOG_CARD' });
      expect(result.url).toBe('https://res.cloudinary.com/cloud/image/upload/p1');
    });

    it('creates signed authenticated Evidence URL', async () => {
      const result = await adapter.createDeliveryUrl({ providerPublicId: 'p1', resourceType: 'IMAGE', deliveryType: 'authenticated', variant: 'EVIDENCE_PREVIEW' });
      expect(result.url).toBe('https://res.cloudinary.com/cloud/image/authenticated/p1');
      expect(cloudinary.url).toHaveBeenCalledWith('p1', expect.objectContaining({ sign_url: true }));
    });
  });

  describe('openOriginalStream', () => {
    it('creates stream url with sign_url depending on delivery type', async () => {
      cloudinary.url = jest.fn().mockReturnValue('https://example.com/test');
      const https = require('https');
      jest.spyOn(https, 'get').mockImplementation((url, cb: any) => {
        cb({ statusCode: 200, on: jest.fn() });
        return { on: jest.fn() };
      });
      await adapter.openOriginalStream({ providerPublicId: 'p1', resourceType: 'IMAGE', deliveryType: 'authenticated' });
      expect(cloudinary.url).toHaveBeenCalledWith('p1', expect.objectContaining({ sign_url: true }));
    });
  });

  describe('getImageAnalysis', () => {
    it('calls explicit with phash and media_metadata true', async () => {
      cloudinary.uploader = { explicit: jest.fn().mockResolvedValue({ phash: 'abc', image_metadata: { DateTimeOriginal: '2023' } }) } as any;
      const result = await adapter.getImageAnalysis({ providerPublicId: 'p1', deliveryType: 'authenticated' });
      expect(cloudinary.uploader.explicit).toHaveBeenCalledWith('p1', expect.objectContaining({ phash: true, media_metadata: true }));
      expect(result.perceptualHash).toBe('abc');
      expect(result.mediaMetadata?.dateTimeOriginal).toBe('2023');
    });
  });

  describe('deleteAsset', () => {
    beforeEach(() => {
      cloudinary.uploader = { destroy: jest.fn().mockResolvedValue({ result: 'ok' }) } as any;
    });

    it('deletes IMAGE upload', async () => {
      await adapter.deleteAsset({ providerPublicId: 'p1', resourceType: 'IMAGE', deliveryType: 'upload', invalidate: true });
      expect(cloudinary.uploader.destroy).toHaveBeenCalledWith('p1', { resource_type: 'image', type: 'upload', invalidate: true });
    });

    it('deletes IMAGE authenticated', async () => {
      await adapter.deleteAsset({ providerPublicId: 'p1', resourceType: 'IMAGE', deliveryType: 'authenticated', invalidate: false });
      expect(cloudinary.uploader.destroy).toHaveBeenCalledWith('p1', { resource_type: 'image', type: 'authenticated', invalidate: false });
    });

    it('deletes VIDEO authenticated', async () => {
      await adapter.deleteAsset({ providerPublicId: 'p1', resourceType: 'VIDEO', deliveryType: 'authenticated', invalidate: true });
      expect(cloudinary.uploader.destroy).toHaveBeenCalledWith('p1', { resource_type: 'video', type: 'authenticated', invalidate: true });
    });

    it('is idempotent on not-found', async () => {
      cloudinary.uploader.destroy = jest.fn().mockResolvedValue({ result: 'not found' });
      await expect(adapter.deleteAsset({ providerPublicId: 'p1', resourceType: 'IMAGE', deliveryType: 'upload', invalidate: true })).resolves.not.toThrow();
    });

    it('throws AppError on provider failure', async () => {
      cloudinary.uploader.destroy = jest.fn().mockRejectedValue(new Error('Provider fail'));
      await expect(adapter.deleteAsset({ providerPublicId: 'p1', resourceType: 'IMAGE', deliveryType: 'upload', invalidate: true })).rejects.toThrow(AppError);
    });
  });

  describe('simulateDevUpload', () => {
    it('passes upload type', async () => {
      const mockStream = { end: jest.fn() };
      cloudinary.uploader = { upload_stream: jest.fn((opts, cb) => {
        cb(null, { public_id: 'p1', version: 1, signature: 'sig' });
        return mockStream;
      }) } as any;

      const result = await adapter.simulateDevUpload({ publicId: 'p1', resourceType: 'IMAGE', deliveryType: 'upload', buffer: Buffer.from('test') });
      expect(cloudinary.uploader.upload_stream).toHaveBeenCalledWith(expect.objectContaining({ type: 'upload' }), expect.any(Function));
      expect(result.publicId).toBe('p1');
    });

    it('passes authenticated type', async () => {
      const mockStream = { end: jest.fn() };
      cloudinary.uploader = { upload_stream: jest.fn((opts, cb) => {
        cb(null, { public_id: 'p1', version: 1, signature: 'sig' });
        return mockStream;
      }) } as any;

      const result = await adapter.simulateDevUpload({ publicId: 'p1', resourceType: 'VIDEO', deliveryType: 'authenticated', buffer: Buffer.from('test') });
      expect(cloudinary.uploader.upload_stream).toHaveBeenCalledWith(expect.objectContaining({ type: 'authenticated', resource_type: 'video' }), expect.any(Function));
      expect(result.publicId).toBe('p1');
    });
  });
});
