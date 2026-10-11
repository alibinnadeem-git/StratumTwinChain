import type {NextConfig} from 'next';
import path from 'node:path';
/**
 * Exclude preview data/renderers from non-preview compilation.
 * Demo must also remain gated at the server entrypoint.
 */
const nextConfig:NextConfig={
 reactStrictMode:true,
 webpack(config){
  if(process.env.VERCEL_ENV!=='preview'){
   config.resolve ??= {};
   config.resolve.alias={
    ...config.resolve.alias,
    '@/lib/preview-synthetic-twin$':path.resolve(process.cwd(),'lib/preview-disabled-fixture.ts'),
    '@/lib/preview-demo-renderer$':path.resolve(process.cwd(),'lib/preview-disabled-renderer.ts'),
    '@/components/PreviewDemoAssetInspector$':path.resolve(process.cwd(),'components/PreviewDemoAssetInspectorDisabled.tsx'),
    '@/components/PreviewDemoExperience$':path.resolve(process.cwd(),'components/PreviewDemoExperienceDisabled.tsx'),
   };
  }
  return config;
 }
};
export default nextConfig;
