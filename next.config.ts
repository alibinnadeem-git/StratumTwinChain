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
 turbopack:{
  resolveAlias:process.env.VERCEL_ENV==='preview'?{}:prodAliases
 }
};
export default nextConfig;
