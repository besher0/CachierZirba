import { createTypeOrmOptions } from './typeorm.config';

describe('createTypeOrmOptions', () => {
  const originalEnv = process.env;

  beforeEach(() => {
    jest.resetModules();
    process.env = { ...originalEnv };
    delete process.env.DATABASE_URL;
    delete process.env.SQLITE_DB_PATH;
    delete process.env.TYPEORM_SYNCHRONIZE;
    delete process.env.NODE_ENV;
  });

  afterAll(() => {
    process.env = originalEnv;
  });

  it('keeps synchronize disabled by default', () => {
    expect(createTypeOrmOptions().synchronize).toBe(false);
  });

  it('keeps synchronize disabled in production', () => {
    process.env.NODE_ENV = 'production';
    process.env.DATABASE_URL = 'postgresql://user:pass@example.com:5432/db';

    expect(createTypeOrmOptions().synchronize).toBe(false);
  });

  it('allows explicit development synchronize=true from env', () => {
    process.env.NODE_ENV = 'development';
    process.env.TYPEORM_SYNCHRONIZE = 'true';

    expect(createTypeOrmOptions().synchronize).toBe(true);
  });

  it('rejects explicit synchronize=true from env in production', () => {
    process.env.NODE_ENV = 'production';
    process.env.DATABASE_URL = 'postgresql://user:pass@example.com:5432/db';
    process.env.TYPEORM_SYNCHRONIZE = 'true';

    expect(() => createTypeOrmOptions()).toThrow(
      'TYPEORM_SYNCHRONIZE=true is not allowed in production',
    );
  });

  it('honors synchronize override=true outside production', () => {
    expect(createTypeOrmOptions({ synchronize: true }).synchronize).toBe(true);
  });

  it('honors synchronize override=false outside production', () => {
    process.env.TYPEORM_SYNCHRONIZE = 'true';

    expect(createTypeOrmOptions({ synchronize: false }).synchronize).toBe(false);
  });

  it('rejects synchronize override=true in production', () => {
    process.env.NODE_ENV = 'production';
    process.env.DATABASE_URL = 'postgresql://user:pass@example.com:5432/db';

    expect(() => createTypeOrmOptions({ synchronize: true })).toThrow(
      'TYPEORM_SYNCHRONIZE=true is not allowed in production',
    );
  });
});
