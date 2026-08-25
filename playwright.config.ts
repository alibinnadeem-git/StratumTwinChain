import {defineConfig,devices} from '@playwright/test';

const localBaseURL='http://127.0.0.1:3000';
const externalBaseURL=process.env.STRATUM_UAT_BASE_URL?.replace(/\/$/,'');
const baseURL=externalBaseURL||localBaseURL;

export default defineConfig({
  testDir:'./tests/e2e',
  timeout:45_000,
  expect:{timeout:8_000},
  fullyParallel:true,
  retries:process.env.CI?1:0,
  workers:process.env.CI?2:undefined,
  reporter:process.env.CI?[['line'],['html',{outputFolder:'playwright-report',open:'never'}]]:'list',
  use:{
    baseURL,
    trace:'retain-on-failure',
    screenshot:'only-on-failure',
    video:'retain-on-failure'
  },
  projects:[
    {name:'desktop-chromium',use:{...devices['Desktop Chrome'],viewport:{width:1440,height:1000}}},
    {name:'tablet-chromium',use:{...devices['iPad Pro 11'],browserName:'chromium'}},
    {name:'mobile-chromium',use:{...devices['Pixel 7'],browserName:'chromium'}}
  ],
  webServer:externalBaseURL?undefined:{
    command:'npm run start',
    url:localBaseURL,
    reuseExistingServer:!process.env.CI,
    timeout:120_000
  }
});
