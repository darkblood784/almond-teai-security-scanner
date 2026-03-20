// Test fixture for false positive baseline
// This file contains LEGITIMATE code that should NOT trigger security findings

import { createHash } from 'crypto';
import * as jwt from 'jsonwebtoken';
import { exec } from 'child_process';

export function legitimateCodeExamples() {
  // SHOULD NOT FIND: This is a comment that mentions password, but no actual issue
  // Usage example: pass the password from environment variables

  // SHOULD NOT FIND: String that contains words but isn't a secret
  const documentation = 'API_KEY and SECRET_TOKEN are environment variables';

  // SHOULD NOT FIND: Test placeholder (recognized as non-secret)
  const testPassword = 'example-password';

  // SHOULD NOT FIND: Test placeholder (too short and generic)
  const demoSecret = 'test';

  return documentation;
}

export function legitimateCrypto() {
  // SHOULD NOT FIND: Safe SHA256 hash
  const safeHash = createHash('sha256');
  safeHash.update('data');
  return safeHash.digest('hex');

  // SHOULD NOT FIND: Safe SHA512 hash
  const sha512 = createHash('sha512');
  sha512.update('data');
  return sha512.digest('hex');
}

export function legitimateJwt() {
  // SHOULD NOT FIND: Using environment variable for secret
  const secret = process.env.JWT_SECRET || 'default-env-var';
  const payload = { userId: 123 };
  const token = jwt.sign(payload, secret);
  return token;
}

export function legitimateExec() {
  // SHOULD NOT FIND: Using literal string command
  exec('ls -la');

  // SHOULD NOT FIND: Using literal string with options
  exec('npm install');

  // SHOULD NOT FIND: Safe pattern with multiple literals
  exec('git status', { cwd: '/safe/path' });
}

export function legitimateStringComparisons() {
  // SHOULD NOT FIND: Comparing non-credential values
  const userRole = 'admin';
  if (userRole === 'admin') {
    grantAdminAccess();
  }

  // SHOULD NOT FIND: Comparing paths
  const path = '/home/user';
  if (path === '/home/user') {
    accessUserHome();
  }

  // SHOULD NOT FIND: Comparing status codes
  const status = 'success';
  if (status === 'success') {
    logSuccess();
  }
}

export function legitimateExamples() {
  // SHOULD NOT FIND: Code samples in comments/strings
  const exampleCode = `
    const password = "sample-password";
    eval(userCode);  // DON'T DO THIS
  `;

  // SHOULD NOT FIND: Documentation
  const docs = `
    WARNING: Do not use eval() with user input!
    Example of what NOT to do:
    eval(unsafeData)
  `;

  return { exampleCode, docs };
}

// Helper functions (safe)
function grantAdminAccess(): void {}
function accessUserHome(): void {}
function logSuccess(): void {}
