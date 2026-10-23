import type {NextConfig} from 'next';
/**
 * Next 16 builds with Turbopack. Alias every demo fixture/renderer to an empty
 * replacement in non-preview builds, so no synthetic asset ids reach production.
 */
const prodAliases={
 '@/lib/preview-synthetic-twin':'./lib/preview-disabled-fixture.ts',
 '@/lib/preview-demo-renderer':'./lib/preview-disabled-renderer.ts',
 '@/components/PreviewDemoAssetInspector':'./components/PreviewDemoAssetInspectorDisabled.tsx',
 '@/components/PreviewDemoExperience':'./components/PreviewDemoExperienceDisabled.tsx',
};
const nextConfig:NextConfig={
 reactStrictMode:true,
 // Allows an isolated prod build/start (STRATUM_DIST_DIR) that does not clobber a running dev
 // server's .next. Unset in normal builds, so the default .next directory is used.
 ...(process.env.STRATUM_DIST_DIR?{distDir:process.env.STRATUM_DIST_DIR}:{}),
 turbopack:{
  resolveAlias:process.env.VERCEL_ENV==='preview'?{}:prodAliases
 }
};
export default nextConfig;
