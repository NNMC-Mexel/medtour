#!/bin/zsh
# Usage: stand.sh sqlite|pg  — fresh DB, seed, SMTP sink, Strapi on :1351.
# Needs a built server (cd server && npx strapi build). pg mode expects a throwaway
# Postgres on 127.0.0.1:5544, user qa, trust auth (see QA_REPORT_LOGIN_SECURITY_2026-10-11.md).
Q=${0:A:h}; MODE=$1; SERVER=${Q:h:h}/server
# Throwaway self-signed cert for the local SMTP sink (not committed).
[[ -f $Q/key.pem ]] || openssl req -x509 -newkey rsa:2048 -nodes -keyout $Q/key.pem -out $Q/cert.pem -days 2 -subj '/CN=localhost' 2>/dev/null
pkill -f "strapi start" 2>/dev/null; pkill -f smtp-sink.cjs 2>/dev/null; sleep 1
rm -f $Q/mails.jsonl $Q/strapi.log
export NODE_ENV=development PORT=1351 HOST=127.0.0.1 CRON_ENABLED=false
export SMTP_HOST=127.0.0.1 SMTP_PORT=2465 SMTP_USER=qa@qa.invalid SMTP_PASS=qa SMTP_FROM=qa@qa.invalid NODE_TLS_REJECT_UNAUTHORIZED=0
export FRONTEND_URL=http://localhost:1343 SERVER_URL=http://localhost:1351 IS_PROXIED=true PROXY_MAX_IPS_COUNT=1
export MINIO_ENDPOINT= S3_ENDPOINT=
if [[ $MODE == pg ]]; then
  export DATABASE_CLIENT=postgres DATABASE_HOST=127.0.0.1 DATABASE_PORT=5544 DATABASE_NAME=medtour_qa DATABASE_USERNAME=qa DATABASE_PASSWORD= DATABASE_URL=
  /opt/homebrew/opt/postgresql@16/bin/psql -h 127.0.0.1 -p 5544 -U qa -d postgres -qc "drop database if exists medtour_qa" -c "create database medtour_qa" >/dev/null
else
  export DATABASE_CLIENT=sqlite DATABASE_FILENAME=.tmp/qa-sec.db
  rm -f $SERVER/.tmp/qa-sec.db
fi
cd $SERVER
node $Q/seed.cjs 2>&1 | grep SEED > $Q/seed-$MODE.out || { echo SEED FAILED; exit 1; }
(node $Q/smtp-sink.cjs > $Q/smtp.log 2>&1 &)
(npx strapi start > $Q/strapi.log 2>&1 &)
for i in {1..60}; do curl -s -o /dev/null -w "%{http_code}" http://127.0.0.1:1351/_health | grep -q 204 && break; sleep 2; done
echo "stand $MODE: $(curl -s -o /dev/null -w '%{http_code}' http://127.0.0.1:1351/_health)"
