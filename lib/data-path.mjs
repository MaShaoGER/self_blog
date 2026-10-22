import path from 'node:path';

/** Runtime files belong beside the checkout, not inside the source tree. */
export function resolveDataDir(cwd = process.cwd(), configured = process.env.BLOG_DATA_DIR) {
  return configured?.trim()
    ? path.resolve(cwd, configured.trim())
    : path.resolve(cwd, '..', `${path.basename(cwd) || 'self_blog'}-data`);
}
