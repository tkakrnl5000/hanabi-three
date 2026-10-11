import {defineConfig} from '@playwright/test';
export default defineConfig({testDir:'./e2e',timeout:90000,use:{baseURL:'http://127.0.0.1:4173',trace:'retain-on-failure'},webServer:{command:'npm run start',url:'http://127.0.0.1:4173/healthz',env:{PORT:'4173',DATA_DIR:'data/e2e'},reuseExistingServer:false},reporter:'list'});
