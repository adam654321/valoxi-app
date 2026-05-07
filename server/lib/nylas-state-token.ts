import jwt from 'jsonwebtoken';

type NylasStateClaims = {
  userId: number;
  userCompanyId: number;
  provider: 'google' | 'microsoft';
};

type SignedNylasState = NylasStateClaims & { iat: number; exp: number };

const STATE_TOKEN_TTL_SECONDS = 300; // 5 minutes

function getSecret(): string {
  const secret = process.env.NYLAS_STATE_SECRET;
  if (!secret) {
    throw new Error('NYLAS_STATE_SECRET environment variable is required');
  }
  if (secret.length < 32) {
    throw new Error('NYLAS_STATE_SECRET must be at least 32 characters');
  }
  return secret;
}

export function signNylasState(claims: NylasStateClaims): string {
  return jwt.sign(claims, getSecret(), {
    expiresIn: STATE_TOKEN_TTL_SECONDS,
    algorithm: 'HS256',
  });
}

export function verifyNylasState(token: string): SignedNylasState {
  try {
    const decoded = jwt.verify(token, getSecret(), {
      algorithms: ['HS256'],
    });
    if (typeof decoded === 'string') {
      throw new Error('Unexpected JWT payload type');
    }
    return decoded as SignedNylasState;
  } catch (err) {
    if (err instanceof jwt.TokenExpiredError) {
      throw new Error('OAuth state token has expired (older than 5 minutes)');
    }
    if (err instanceof jwt.JsonWebTokenError) {
      throw new Error('OAuth state token is invalid');
    }
    throw err;
  }
}
