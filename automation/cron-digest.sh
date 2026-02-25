#!/bin/bash
# Cron wrapper for the daily research digest.
# Cron doesn't inherit shell environment, so we set up PATH manually.

export HOME="/home/josh"
export PATH="$HOME/.local/bin:$HOME/.nvm/versions/node/v24.12.0/bin:$PATH"

cd /home/josh/coding/claude/research

node --experimental-strip-types automation/digest.ts
