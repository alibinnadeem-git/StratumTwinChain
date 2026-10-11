import type {NextConfig} from 'next';
import path from 'node:path';
/**
 * Next 16 builds with Turbopack. Alias every demo fixture/renderer to an empty
 * replacement in non-preview builds, so no synthetic asset ids reach production.
 */
const prodAliases={
 '@/lib/preview-synthetic-twin':path.resolve(process.cwd(),'lib/preview-disabled-fixture.ts'),
 '@/lib/preview-demo-renderer':path.resolve(process.cwd(),'lib/preview-disabled-renderer.ts'),
 '@/components/PreviewDemoAssetInspector':path.resolve(process.cwd(),'components/PreviewDemoAssetInspectorDisabled.tsx'),
 '@/components/PreviewDemoExperience':path.resolve(process.cwd(),'components/PreviewDemoExperienceDisabled.tsx'),
};
const nextConfig:NextConfig={
 reactStrictMode:true,
 turbopack:{
  resolveAlias:process.env.VERCEL_ENV==='preview'?{}:prodAliases
 }
};
export default nextConfig;
