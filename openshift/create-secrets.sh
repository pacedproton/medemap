#!/usr/bin/env bash
# Run on `one` as root with oc logged in. Usage: openshift/create-secrets.sh /path/to/.env.local
# Creates two Postgres roles and the Secret medemap-env. Nothing here is written to git.
#   medemap      owns the database objects (DDL, restores); it can not log in (app-role.sql sets that)
#   medemap_app  what the web app logs in as: read access only, with a new random password
set -euo pipefail
ENV_FILE=${1:?usage: create-secrets.sh /path/to/.env.local}
PW=$(openssl rand -base64 24 | tr -d '/+=')

oc exec -n postgres pg-1 -c postgres -- psql -U postgres -v ON_ERROR_STOP=1 \
  -c "DO \$\$ BEGIN IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname='medemap') THEN CREATE ROLE medemap LOGIN; END IF; END \$\$;" \
  -c "DO \$\$ BEGIN IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname='medemap_app') THEN CREATE ROLE medemap_app LOGIN; END IF; END \$\$;" \
  -c "ALTER ROLE medemap_app PASSWORD '$PW';"

TMP=$(mktemp); trap 'rm -f "$TMP"' EXIT
# runtime secrets from the env file; DB and URL settings come from the Deployment env instead
grep -E '^(NEXTAUTH_SECRET|OPENAI_API_KEY|ANTHROPIC_API_KEY|OLLAMA_URL|AI_ACCESS_KEY)=.+' "$ENV_FILE" > "$TMP"
printf 'POSTGRES_USER=medemap_app\nDB_USER=medemap_app\nPOSTGRES_PASSWORD=%s\nDB_PASSWORD=%s\n' "$PW" "$PW" >> "$TMP"

oc create secret generic medemap-env -n medemap --from-env-file="$TMP" --dry-run=client -o yaml | oc apply -f -
echo "roles + secret ready; keys: $(cut -d= -f1 "$TMP" | tr '\n' ' ')"
