#!/bin/bash
export PATH="/Users/johnnywu/.nvm/versions/node/v20.20.1/bin:$PATH"
cd /Users/johnnywu/Desktop/ai-code-security-scanner
exec node node_modules/.bin/next dev --port "${PORT:-3000}"
