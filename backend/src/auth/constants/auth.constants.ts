import type { StringValue } from 'ms';

export const JWT_SECRET = process.env.JWT_SECRET ?? 'zirba-dev-secret';
export const JWT_EXPIRES_IN =
	(process.env.JWT_EXPIRES_IN as StringValue | undefined) ?? ('12h' as StringValue);
