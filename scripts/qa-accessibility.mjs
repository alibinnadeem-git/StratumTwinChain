import fs from 'node:fs';
const css=fs.readFileSync('app/accessibility.css','utf8');
const shell=fs.readFileSync('components/Shell.tsx','utf8');
for(const required of [':focus-visible','outline:3px solid #ffca5c','min-height:44px','prefers-reduced-motion','animation-duration:.001ms','scroll-behavior:auto']){
 if(!css.includes(required))throw new Error(`Accessibility CSS missing: ${required}`);
}
for(const required of ['Skip to main content','href="#main-content"','aria-label="Primary navigation"','id="main-content"','tabIndex={-1}','aria-hidden="true"']){
 if(!shell.includes(required))throw new Error(`Accessibility shell invariant missing: ${required}`);
}
console.log('Keyboard focus, skip navigation, landmark, touch-target and reduced-motion accessibility foundation passed');
