const sourcePath=(process.env.BRYNHURST_GOLDEN_PDF||'').trim();
if(!sourcePath){
 throw new Error('BRYNHURST_GOLDEN_PDF must point to the private locked Brynhurst customer PDF');
}
await import('./qa-brynhurst-golden.mjs');
