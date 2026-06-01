#!/bin/bash
export PATH="/home/jason/.nvm/versions/node/v24.15.0/bin:$PATH"
node node_modules/.bin/ts-mocha -p ./tsconfig.json -t 1000000 tests/**/*.ts
