#!/bin/bash
# Cron wrapper for the daily research digest.
# Cron doesn't inherit shell environment, so we set up PATH and secrets manually.
#
# Install crontab entry (run daily at 8am):
#   0 8 * * * /home/josh/coding/claude/research/automation/cron-digest.sh >> /home/josh/coding/claude/research/automation/logs/cron-digest.log 2>&1

export HOME="/home/josh"

# Source nvm so we pick up whatever default node version is installed
export NVM_DIR="$HOME/.nvm"
[ -s "$NVM_DIR/nvm.sh" ] && source "$NVM_DIR/nvm.sh"

# Source API key for Anthropic SDK
[ -f "$HOME/.env" ] && set -a && source "$HOME/.env" && set +a

cd /home/josh/coding/claude/research

# Ensure log directory exists for cron output redirect
mkdir -p /home/josh/coding/claude/research/automation/logs

node --experimental-strip-types automation/digest.ts
