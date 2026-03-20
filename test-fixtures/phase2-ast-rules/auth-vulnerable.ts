// Test fixture for authentication vulnerability detection
import * as jwt from 'jsonwebtoken';
import bcrypt from 'bcrypt';

export function hardcodedJwtSecret(payload: any): string {
  // SHOULD FIND: Insecure Authentication (hardcoded JWT secret)
  const token = jwt.sign(payload, 'super-secret-key-hardcoded');
  return token;
}

export function hardcodedJwtVerify(token: string): any {
  // SHOULD FIND: Insecure Authentication (hardcoded JWT secret)
  try {
    const decoded = jwt.verify(token, 'super-secret-key-hardcoded');
    return decoded;
  } catch {
    return null;
  }
}

export function hardcodedPasswordComparison(password: string): boolean {
  // SHOULD FIND: Insecure Authentication (hardcoded password)
  if (password === 'admin123') {
    return true;
  }
  return false;
}

export function hardcodedApiKeyComparison(apiKey: string): boolean {
  // SHOULD FIND: Insecure Authentication (hardcoded API key)
  if (apiKey === 'sk_live_abc123xyz789') {
    return true;
  }
  return false;
}

export function hardcodedCredentialVariable() {
  // SHOULD FIND: Insecure Authentication (hardcoded password variable)
  const dbPassword = 'postgres-root-password';
  connectToDatabase(dbPassword);
}

export function hardcodedApiCredential() {
  // SHOULD FIND: Hardcoded Secret (API key variable)
  const apiToken = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...';
  sendAuthenticatedRequest(apiToken);
}

export function safeJwtSecret(payload: any): string {
  // SHOULD NOT FIND: Using environment variable
  const secret = process.env.JWT_SECRET;
  if (!secret) throw new Error('JWT_SECRET not configured');
  const token = jwt.sign(payload, secret);
  return token;
}

export async function safePasswordComparison(inputPassword: string, hashedPassword: string): Promise<boolean> {
  // SHOULD NOT FIND: Using bcrypt.compare (secure pattern)
  const isMatch = await bcrypt.compare(inputPassword, hashedPassword);
  return isMatch;
}

export function safeApiKey(): string {
  // SHOULD NOT FIND: Using environment variable
  const apiKey = process.env.API_KEY;
  if (!apiKey) throw new Error('API_KEY not configured');
  return apiKey;
}

// Helper functions (safe)
function connectToDatabase(password: string): void {
  // dummy implementation
}

function sendAuthenticatedRequest(token: string): void {
  // dummy implementation
}
