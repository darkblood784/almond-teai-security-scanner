import https from 'https';
import fs from 'fs';
import path from 'path';
import { pipeline } from 'stream/promises';

/**
 * Download a GitHub repository as a zip and save to destPath.
 * Returns the path to the saved zip file.
 */
export async function downloadGitHubZip(
  owner: string,
  repo:  string,
  ref:   string = 'HEAD',
  destPath: string,
): Promise<string> {
  const token = process.env.GITHUB_TOKEN;
  const headers: Record<string, string> = {
    'User-Agent': 'ai-code-security-scanner/1.0',
    'Accept':     'application/vnd.github+json',
  };
  if (token) headers['Authorization'] = `Bearer ${token}`;

  const zipUrl = `https://api.github.com/repos/${owner}/${repo}/zipball/${ref}`;

  // Follow redirects manually (GitHub returns a 302)
  const finalUrl = await resolveRedirects(zipUrl, headers);

  const zipPath = path.join(destPath, `${owner}-${repo}.zip`);
  await downloadFile(finalUrl, zipPath, headers);
  return zipPath;
}

function resolveRedirects(url: string, headers: Record<string, string>): Promise<string> {
  return new Promise((resolve, reject) => {
    const req = https.get(url, { headers }, (res) => {
      if (res.statusCode === 302 || res.statusCode === 301) {
        const location = res.headers.location;
        if (!location) return reject(new Error('Redirect with no Location header'));
        // Consume response body
        res.resume();
        resolve(resolveRedirects(location, headers));
      } else if (res.statusCode === 200) {
        res.resume();
        resolve(url);
      } else if (res.statusCode === 404) {
        reject(new Error(`Repository not found: ${url}`));
      } else if (res.statusCode === 403) {
        reject(new Error('GitHub API rate limit exceeded. Add a GITHUB_TOKEN to increase limits.'));
      } else {
        reject(new Error(`Unexpected status ${res.statusCode} from GitHub`));
      }
    });
    req.on('error', reject);
  });
}

function downloadFile(url: string, dest: string, headers: Record<string, string>): Promise<void> {
  return new Promise((resolve, reject) => {
    const file = fs.createWriteStream(dest);
    const req = https.get(url, { headers }, async (res) => {
      if (res.statusCode !== 200) {
        fs.unlink(dest, () => {});
        return reject(new Error(`Failed to download file: HTTP ${res.statusCode}`));
      }
      try {
        await pipeline(res, file);
        resolve();
      } catch (err) {
        reject(err);
      }
    });
    req.on('error', (err) => {
      fs.unlink(dest, () => {});
      reject(err);
    });
  });
}
