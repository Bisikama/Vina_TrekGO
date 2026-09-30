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
});
