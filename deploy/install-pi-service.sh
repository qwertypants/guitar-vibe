#!/usr/bin/env bash
set -euo pipefail

service_name="guitar-vibe"
unit_path="/etc/systemd/system/${service_name}.service"
app_dir="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")/.." && pwd -P)"
service_user="$(id -un)"

fail() {
  printf 'Pi service setup: %s\n' "$1" >&2
  exit 1
}

[[ "${EUID}" -ne 0 ]] || fail "run this script as the checkout owner; it uses sudo only for systemd operations."
[[ "$service_user" =~ ^[a-z_][a-z0-9_-]*$ ]] || fail "unsupported Linux username: ${service_user}"
[[ "$app_dir" =~ ^/[A-Za-z0-9_./-]+$ ]] || fail "the checkout path must use letters, numbers, dots, underscores, slashes, or hyphens only."

command -v sudo >/dev/null 2>&1 || fail "sudo is required to install a system service."
command -v systemctl >/dev/null 2>&1 || fail "systemd is required on the Raspberry Pi."
command -v curl >/dev/null 2>&1 || fail "curl is required for the local HTTP check."

node_bin="$(command -v node || true)"
npm_bin="$(command -v npm || true)"
[[ -n "$node_bin" && -n "$npm_bin" ]] || fail "Node.js and npm must be available in this SSH session."
[[ "$node_bin" =~ ^/[A-Za-z0-9_./-]+$ && "$npm_bin" =~ ^/[A-Za-z0-9_./-]+$ ]] || fail "Node.js and npm paths must not contain spaces or systemd-special characters."
[[ "$(node --version)" == "v22.22.2" ]] || fail "install Node.js 22.22.2 from .nvmrc, then rerun this script."

[[ -f "$app_dir/.next/BUILD_ID" ]] || fail "run 'npm run build' in this checkout before installing the service."
key_configured=false
for env_file in .env.production.local .env.local .env.production .env; do
  if [[ -f "$app_dir/$env_file" ]] && grep -Eq '^[[:space:]]*(export[[:space:]]+)?OPENROUTER_API_KEY[[:space:]]*=[[:space:]]*[^[:space:]#]' "$app_dir/$env_file"; then
    key_configured=true
    break
  fi
done
[[ "$key_configured" == true ]] || fail "put OPENROUTER_API_KEY in a Next.js environment file; systemd does not inherit variables from your SSH shell."

if sudo systemctl cat "${service_name}.service" >/dev/null 2>&1; then
  fail "${service_name}.service already exists; inspect it before changing the existing service."
fi

if command -v ss >/dev/null 2>&1 && ss -ltnH | awk '{print $4}' | grep -Eq ':3000$'; then
  fail "TCP port 3000 is already in use; stop the existing server before enabling the production service."
fi

node_bin_dir="$(dirname -- "$node_bin")"
[[ "$node_bin_dir" =~ ^/[A-Za-z0-9_./-]+$ ]] || fail "the Node.js directory must not contain spaces or systemd-special characters."

unit_temp="$(mktemp)"
trap 'rm -f -- "$unit_temp"' EXIT
cat >"$unit_temp" <<EOF
[Unit]
Description=Vibe Chords web application
After=network-online.target
Wants=network-online.target

[Service]
Type=simple
User=${service_user}
WorkingDirectory=${app_dir}
Environment=NODE_ENV=production
Environment=PORT=3000
Environment=PATH=${node_bin_dir}:/usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin:/sbin:/bin
ExecStart=${npm_bin} run start:pi
Restart=on-failure
RestartSec=5
NoNewPrivileges=true
PrivateTmp=true

[Install]
WantedBy=multi-user.target
EOF

sudo install -o root -g root -m 0644 "$unit_temp" "$unit_path"
sudo systemctl daemon-reload
sudo systemctl enable --now "${service_name}.service"

if ! sudo systemctl is-active --quiet "${service_name}.service"; then
  sudo systemctl --no-pager --full status "${service_name}.service" || true
  sudo journalctl -u "${service_name}.service" -n 60 --no-pager || true
  fail "the service did not become active."
fi

if ! curl --fail --silent --show-error --max-time 5 http://127.0.0.1:3000/ >/dev/null; then
  sudo journalctl -u "${service_name}.service" -n 60 --no-pager || true
  fail "the service is active but did not answer HTTP at http://127.0.0.1:3000/."
fi

printf 'Installed and started %s.service for %s.\n' "$service_name" "$app_dir"
printf 'Open http://<pi-ip>:3000 from a device on the same network.\n'
