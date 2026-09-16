#!/bin/zsh
set -e
cd -- "${0:A:h}/.."
echo 'AgentPass + native Hermes shopping'
echo 'First type: /browser connect'
echo 'Then use the prompt in docs/HERMES-SHOPPING.md.'
echo 'Sign in directly in the Chrome window Hermes opens.'
echo 'The current integration authorizes spending but cannot execute bank payments.'
exec npm run hermes:shopping -- --cli
