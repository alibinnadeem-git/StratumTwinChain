import type {NextConfig} from 'next';
import path from 'node:path';
/** Preview-only demo modules are never included in production/non-preview JS bundles. */
const nextConfig:NextConfig={
 reactStrictMode:true,
 webpack(config){
  if(process.env.VERCEL_ENV!=='preview'){
   config.resolve ??= {};
   config.resolve.alias={
    ...config.resolve.alias,
    '@/lib/preview-synthetic-twin$':path.resolve(process.cwd(),'lib/preview-disabled-fixture.ts'),
    '@/lib/preview-demo-renderer$':path.resolve(process.cwd(),'lib/preview-disabled-renderer.ts'),
    '@/components/PreviewDemoAssetInspector$':path.resolve(process.cwd(),'components/PreviewDemoAssetInspectorDisabled.tsx')
   };
  }
  return config;
 }
};
export default nextConfig;
