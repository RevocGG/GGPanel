#!/usr/bin/env node
/**
 * GGoose UI launcher — loads .env from the same directory then starts server.js
 */
'use strict'
const path = require('path')
const fs   = require('fs')

const DIR = __dirname

// Load .env
const envFile = path.join(DIR, '.env')
if (fs.existsSync(envFile)) {
  const lines = fs.readFileSync(envFile, 'utf8').split('\n')
  for (const line of lines) {
    const trimmed = line.trim()
    if (!trimmed || trimmed.startsWith('#')) continue
    const eq = trimmed.indexOf('=')
    if (eq === -1) continue
    const key = trimmed.slice(0, eq).trim()
    const val = trimmed.slice(eq + 1).trim().replace(/^"(.*)"$/, '$1')
    if (!(key in process.env)) process.env[key] = val
  }
}

// Defaults
process.env.PORT     = process.env.PORT     || '3000'
process.env.HOSTNAME = process.env.HOSTNAME || '0.0.0.0'
process.env.NODE_ENV = process.env.NODE_ENV || 'production'
process.env.DATABASE_URL = process.env.DATABASE_URL
  || ('file:' + path.join(DIR, 'data', 'goose.db'))
process.env.CORES_DIR = process.env.CORES_DIR || path.join(DIR, 'data', 'cores')

// Start Next.js standalone server
require(path.join(DIR, 'server.js'))
