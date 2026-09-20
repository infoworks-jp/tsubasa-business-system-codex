import {defineConfig} from '@playwright/test';
export default defineConfig({testDir:'./tests/e2e',testMatch:'fl-trends.spec.ts',timeout:120000,expect:{timeout:15000},workers:2,projects:[{name:'pc',use:{viewport:{width:1440,height:1000}}},{name:'smartphone',use:{viewport:{width:390,height:844},isMobile:true}}],reporter:'list',outputDir:'test-results/fl'});
