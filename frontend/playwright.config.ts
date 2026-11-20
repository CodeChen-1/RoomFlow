import { existsSync } from 'node:fs'
import path from 'node:path'
import { defineConfig } from '@playwright/test'

const backend = path.resolve('../backend')
const virtualPython = path.join(backend, process.platform === 'win32' ? '.venv/Scripts/python.exe' : '.venv/bin/python')
const python = process.env.ROOMFLOW_PYTHON || (existsSync(virtualPython) ? virtualPython : 'python')
const api = 'http://127.0.0.1:8781'
const web = 'http://127.0.0.1:5179'

export default defineConfig({
  testDir: './e2e',
  workers: 1,
  timeout: 45_000,
  use: {
    baseURL: web,
    channel: process.env.ROOMFLOW_BROWSER_CHANNEL || undefined,
    timezoneId: 'Asia/Kuala_Lumpur',
    trace: 'retain-on-failure',
  },
  webServer: [
    {
      command: `"${python}" "../frontend/e2e/serve_backend.py"`,
      cwd: backend,
      url: api + '/api/rooms',
      reuseExistingServer: false,
    },
    {
      command: 'npm run dev -- --host 127.0.0.1 --port 5179 --strictPort',
      url: web,
      env: { ROOMFLOW_API_URL: api },
      reuseExistingServer: false,
    },
  ],
})
