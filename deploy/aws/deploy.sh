#!/usr/bin/env bash

set -Eeuo pipefail

: "${SOURCE_DIR:?SOURCE_DIR is required}"
: "${DEPLOY_PATH:=/var/www/istura}"
: "${DEPLOY_SHA:=unknown}"
: "${DEPLOY_OWNER:=ubuntu}"
: "${SUPERVISOR_USER:=www-data}"

if [ ! -f "$SOURCE_DIR/artisan" ]; then
    echo "Invalid deployment source: artisan was not found in $SOURCE_DIR" >&2
    exit 1
fi

if ! id "$DEPLOY_OWNER" >/dev/null 2>&1; then
    echo "Deploy owner '$DEPLOY_OWNER' does not exist." >&2
    exit 1
fi

if ! id "$SUPERVISOR_USER" >/dev/null 2>&1; then
    echo "Supervisor user '$SUPERVISOR_USER' does not exist." >&2
    exit 1
fi

mkdir -p "$DEPLOY_PATH"

restore_application() {
    status=$?
    if [ "$status" -ne 0 ]; then
        echo "Deployment $DEPLOY_SHA failed; restoring application availability." >&2
        if [ -f "$DEPLOY_PATH/artisan" ]; then
            cd "$DEPLOY_PATH"
            php artisan up || true
        fi
    fi
    exit "$status"
}
trap restore_application EXIT

if [ -f "$DEPLOY_PATH/artisan" ]; then
    cd "$DEPLOY_PATH"
    php artisan down --render="errors::503" --retry=15 \
        || php artisan down \
        || true
fi

rsync -a --delete --no-perms --no-owner --no-group \
    --exclude='.env' \
    --exclude='node_modules/' \
    --exclude='vendor/' \
    --exclude='public/storage' \
    --exclude='storage/app/' \
    --exclude='storage/framework/cache/' \
    --exclude='storage/framework/sessions/' \
    --exclude='storage/framework/testing/' \
    --exclude='storage/framework/views/' \
    --exclude='storage/framework/down' \
    --exclude='storage/framework/maintenance.php' \
    --exclude='storage/logs/' \
    "$SOURCE_DIR/" "$DEPLOY_PATH/"

if [ ! -f "$DEPLOY_PATH/.env" ]; then
    echo ".env not found in $DEPLOY_PATH." >&2
    exit 1
fi

chown -R "$DEPLOY_OWNER:www-data" "$DEPLOY_PATH"
chmod 2755 "$DEPLOY_PATH"
chmod 640 "$DEPLOY_PATH/.env"
chmod 755 "$DEPLOY_PATH/artisan"
chmod 755 "$DEPLOY_PATH/deploy/aws/deploy.sh"

mkdir -p \
    "$DEPLOY_PATH/storage/app" \
    "$DEPLOY_PATH/storage/framework/cache" \
    "$DEPLOY_PATH/storage/framework/sessions" \
    "$DEPLOY_PATH/storage/framework/views" \
    "$DEPLOY_PATH/storage/logs" \
    "$DEPLOY_PATH/bootstrap/cache"
chown -R "$DEPLOY_OWNER:www-data" "$DEPLOY_PATH/storage" "$DEPLOY_PATH/bootstrap/cache"
find "$DEPLOY_PATH/storage" "$DEPLOY_PATH/bootstrap/cache" -type d -exec chmod 2770 {} +
find "$DEPLOY_PATH/storage" "$DEPLOY_PATH/bootstrap/cache" -type f -exec chmod 660 {} +

configure_trusted_proxies() {
    fallback_cloudflare_ips="173.245.48.0/20,103.21.244.0/22,103.22.200.0/22,103.31.4.0/22,141.101.64.0/18,108.162.192.0/18,190.93.240.0/20,188.114.96.0/20,197.234.240.0/22,198.41.128.0/17,162.158.0.0/15,104.16.0.0/13,104.24.0.0/14,172.64.0.0/13,131.0.72.0/22,2400:cb00::/32,2606:4700::/32,2803:f800::/32,2405:b500::/32,2405:8100::/32,2a06:98c0::/29,2c0f:f248::/32"
    cloudflare_ips=""

    if command -v curl >/dev/null 2>&1; then
        cloudflare_ips="$(
            (curl -fsS https://www.cloudflare.com/ips-v4; echo; curl -fsS https://www.cloudflare.com/ips-v6) \
                | awk 'NF' \
                | paste -sd, -
        )" || cloudflare_ips=""
    fi

    if [ -z "$cloudflare_ips" ]; then
        cloudflare_ips="$fallback_cloudflare_ips"
    fi

    existing_trusted_proxies="$(
        awk -F= '/^TRUSTED_PROXIES=/{print substr($0, length($1) + 2)}' "$DEPLOY_PATH/.env" \
            | tail -n 1
    )"
    trusted_proxies="$(
        printf '%s,%s,%s\n' "$existing_trusted_proxies" "127.0.0.1,::1" "$cloudflare_ips" \
            | tr ',' '\n' \
            | awk 'NF && !seen[$0]++' \
            | paste -sd, -
    )"

    if grep -q '^TRUSTED_PROXIES=' "$DEPLOY_PATH/.env"; then
        sed -i "s|^TRUSTED_PROXIES=.*|TRUSTED_PROXIES=${trusted_proxies}|" "$DEPLOY_PATH/.env"
    else
        printf '\nTRUSTED_PROXIES=%s\n' "$trusted_proxies" >> "$DEPLOY_PATH/.env"
    fi
    chown "$DEPLOY_OWNER:www-data" "$DEPLOY_PATH/.env"
    chmod 640 "$DEPLOY_PATH/.env"
}

configure_trusted_proxies

cd "$DEPLOY_PATH"
export COMPOSER_ALLOW_SUPERUSER=1

sudo -u "$DEPLOY_OWNER" -H composer install \
    --no-dev \
    --prefer-dist \
    --optimize-autoloader \
    --no-interaction
sudo -u "$DEPLOY_OWNER" -H npm ci --ignore-scripts
sudo -u "$DEPLOY_OWNER" -H npm run build

sudo -u "$DEPLOY_OWNER" -H php artisan migrate --force
sudo -u "$DEPLOY_OWNER" -H php artisan holidays:sync-id
sudo -u "$DEPLOY_OWNER" -H php artisan storage:link || true
sudo -u "$DEPLOY_OWNER" -H php artisan optimize:clear
sudo -u "$DEPLOY_OWNER" -H php artisan config:cache
sudo -u "$DEPLOY_OWNER" -H php artisan route:cache
sudo -u "$DEPLOY_OWNER" -H php artisan view:cache
sudo -u "$DEPLOY_OWNER" -H php artisan event:cache

install_supervisor_config() {
    source_file="$1"
    target_file="$2"
    sed \
        -e "s#__DEPLOY_PATH__#${DEPLOY_PATH}#g" \
        -e "s#__PHP_BINARY__#$(command -v php)#g" \
        -e "s#__SUPERVISOR_USER__#${SUPERVISOR_USER}#g" \
        "$source_file" > "$target_file"
    chmod 0644 "$target_file"
}

rm -f /etc/supervisor/conf.d/istura.conf
install_supervisor_config deploy/supervisor/istura-queue.conf /etc/supervisor/conf.d/istura-queue.conf
install_supervisor_config deploy/supervisor/istura-reverb.conf /etc/supervisor/conf.d/istura-reverb.conf
install_supervisor_config deploy/supervisor/istura-scheduler.conf /etc/supervisor/conf.d/istura-scheduler.conf

supervisorctl reread
supervisorctl update
supervisorctl restart istura-queue || supervisorctl start istura-queue
supervisorctl restart istura-reverb || supervisorctl start istura-reverb
supervisorctl restart istura-scheduler || supervisorctl start istura-scheduler

for process in istura-queue istura-reverb istura-scheduler; do
    if ! supervisorctl status "$process" | grep -q RUNNING; then
        echo "$process is not RUNNING after deploy." >&2
        exit 1
    fi
done

systemctl try-reload-or-restart php8.4-fpm
systemctl reload nginx
sudo -u "$DEPLOY_OWNER" -H php artisan up

curl --fail --silent --show-error \
    --resolve www.isturaiky.page:443:127.0.0.1 \
    https://www.isturaiky.page/up >/dev/null

trap - EXIT
echo "Deployment $DEPLOY_SHA completed successfully."
