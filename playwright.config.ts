import {defineConfig,devices} from '@playwright/test';

export default defineConfig({
  testDir:'./tests/e2e',
  timeout:45_000,
  expect:{timeout:8_000},
  fullyParallel:true,
  retries:process.env.CI?1:0,
  workers:process.env.CI?2:undefined,
  reporter:process.env.CI?[['line'],['html',{outputFolder:'playwright-report',open:'never'}]]:'list',
  use:{
    baseURL:'http://127.0.0.1:3000',
    trace:'retain-on-failure',
    screenshot:'only-on-failure',
    video:'retain-on-failure'
  },
  projects:[
    {name:'desktop-chromium',use:{...devices['Desktop Chrome'],viewport:{width:1440,height:1000}}},
    {name:'tablet-chromium',use:{...devices['iPad Pro 11'],browserName:'chromium'}},
    {name:'mobile-chromium',use:{...devices['Pixel 7'],browserName:'chromium'}}
  ],
  webServer:{
    command:'npm run start',
    url:'http://127.0.0.1:3000',
    reuseExistingServer:!process.env.CI,
    timeout:120_000
  }
});
