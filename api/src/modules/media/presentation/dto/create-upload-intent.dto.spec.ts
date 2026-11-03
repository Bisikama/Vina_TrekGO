import { createUploadIntentSchema } from './create-upload-intent.dto';

describe('createUploadIntentSchema', () => {
  it('validates USER_GEAR scope successfully', () => {
    const payload = {
      scope: 'USER_GEAR',
      resourceType: 'IMAGE',
      fileName: 'tag.jpg',
      contentType: 'image/jpeg',
      sizeBytes: 2048,
    };

    const parsed = createUploadIntentSchema.safeParse(payload);
    expect(parsed.success).toBe(true);
  });

  it('rejects invalid scopes', () => {
    const payload = {
      scope: 'INVALID_SCOPE',
      resourceType: 'IMAGE',
      fileName: 'tag.jpg',
      contentType: 'image/jpeg',
      sizeBytes: 2048,
    };

    const parsed = createUploadIntentSchema.safeParse(payload);
    expect(parsed.success).toBe(false);
  });
});
