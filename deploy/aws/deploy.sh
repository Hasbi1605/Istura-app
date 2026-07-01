#!/usr/bin/env bash

set -Eeuo pipefail

: "${SOURCE_DIR:?SOURCE_DIR is required}"
: "${DEPLOY_PATH:?Set DEPLOY_PATH to the Laravel release path}"
: "${DEPLOY_SHA:=unknown}"
: "${DEPLOY_OWNER:=ubuntu}"
: "${SUPERVISOR_USER:=www-data}"
: "${HEALTHCHECK_HOST:=www.isturaiky.page}"

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

env_value() {
    key="$1"
    value="$(
        awk -F= -v key="$key" '$1 == key {print substr($0, length($1) + 2)}' "$DEPLOY_PATH/.env" \
            | tail -n 1
    )"
    value="${value%\"}"
    value="${value#\"}"
    value="${value%\'}"
    value="${value#\'}"
    printf '%s' "$value"
}

set_env_value() {
    key="$1"
    value="$2"
    escaped_value="$(printf '%s' "$value" | sed 's/[&|\\]/\\&/g')"

    if grep -q "^${key}=" "$DEPLOY_PATH/.env"; then
        sed -i "s|^${key}=.*|${key}=${escaped_value}|" "$DEPLOY_PATH/.env"
    else
        printf '\n%s=%s\n' "$key" "$value" >> "$DEPLOY_PATH/.env"
    fi
}

url_host() {
    php -r '$host = parse_url($argv[1] ?? "", PHP_URL_HOST); echo $host ?: "";' "$1"
}

configure_session_cookie_scope() {
    if [ "${ISTURA_KEEP_LOOSE_SESSION_DOMAIN:-false}" = "true" ]; then
        echo "Keeping existing SESSION_DOMAIN because ISTURA_KEEP_LOOSE_SESSION_DOMAIN=true."
        return 0
    fi

    session_domain="$(env_value SESSION_DOMAIN)"
    if [ -z "$session_domain" ] || [ "${session_domain#.}" = "$session_domain" ]; then
        return 0
    fi

    canonical_url="$(env_value PUBLIC_CANONICAL_URL)"
    if [ -z "$canonical_url" ]; then
        canonical_url="$(env_value APP_URL)"
    fi

    canonical_host="$(url_host "$canonical_url")"
    if [ -z "$canonical_host" ]; then
        echo "Could not determine canonical host; leaving SESSION_DOMAIN unchanged." >&2
        return 0
    fi

    parent_domain="${session_domain#.}"
    if [ "$canonical_host" = "$parent_domain" ] || [ "${canonical_host#*.}" = "$parent_domain" ]; then
        set_env_value SESSION_DOMAIN ""
        echo "Scoped SESSION_DOMAIN to host-only cookies for ${canonical_host}."
        chown "$DEPLOY_OWNER:www-data" "$DEPLOY_PATH/.env"
        chmod 640 "$DEPLOY_PATH/.env"
    else
        echo "SESSION_DOMAIN=${session_domain} does not match canonical host ${canonical_host}; leaving unchanged." >&2
    fi
}

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
configure_session_cookie_scope

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

configure_php_upload_limits() {
    target_conf_dir="/etc/php/8.4/fpm/conf.d"
    if [ ! -d "$target_conf_dir" ]; then
        # Fall back to whatever PHP-FPM conf.d exists (resilient to version path differences).
        target_conf_dir="$(find /etc/php -type d -path '*/fpm/conf.d' 2>/dev/null | sort | tail -n 1)"
    fi

    if [ -z "$target_conf_dir" ] || [ ! -d "$target_conf_dir" ]; then
        echo "PHP-FPM conf.d directory not found; skipping upload-limit tuning." >&2
        return 0
    fi

    # Keep PHP upload limits comfortably above the 5 MB app-level cap so poster /
    # letter uploads are not silently rejected at the PHP layer ("failed to upload").
    cat > "$target_conf_dir/99-istura-upload.ini" <<'PHPINI'
; Managed by ISTURA deploy. Do not edit by hand.
upload_max_filesize = 8M
post_max_size = 10M
PHPINI
    chmod 0644 "$target_conf_dir/99-istura-upload.ini"
    echo "Configured PHP upload limits in $target_conf_dir/99-istura-upload.ini"
}

configure_nginx_security_headers() {
    if [ "${ISTURA_MANAGE_NGINX_SECURITY_HEADERS:-true}" = "false" ]; then
        echo "Skipping Nginx security header management because ISTURA_MANAGE_NGINX_SECURITY_HEADERS=false."
        return 0
    fi

    if ! command -v nginx >/dev/null 2>&1; then
        echo "Nginx binary not found; skipping Nginx security header management." >&2
        return 0
    fi

    snippet_dir="/etc/nginx/snippets"
    snippet_file="${snippet_dir}/istura-security-headers.conf"
    mkdir -p "$snippet_dir"
    cat > "$snippet_file" <<'NGINX'
# Managed by ISTURA deploy. Do not edit by hand.
# HSTS must also cover static assets that bypass Laravel middleware.
add_header Strict-Transport-Security "max-age=31536000; includeSubDomains" always;
NGINX
    chmod 0644 "$snippet_file"

    include_line="include ${snippet_file};"
    candidates=()
    for file in /etc/nginx/sites-enabled/* /etc/nginx/conf.d/*.conf; do
        [ -f "$file" ] || continue
        target="$(readlink -f "$file" 2>/dev/null || printf '%s' "$file")"
        [ -f "$target" ] || continue

        if grep -Fq "$DEPLOY_PATH/public" "$target" || grep -Fq "$HEALTHCHECK_HOST" "$target"; then
            case " ${candidates[*]} " in
                *" ${target} "*) ;;
                *) candidates+=("$target") ;;
            esac
        fi
    done

    if [ "${#candidates[@]}" -eq 0 ]; then
        echo "No matching Nginx server config found for ${HEALTHCHECK_HOST}; HSTS snippet installed but not included." >&2
        return 0
    fi

    backups=()
    changed=0
    for target in "${candidates[@]}"; do
        tmp_file="$(mktemp)"
        awk \
            -v deploy_root="${DEPLOY_PATH}/public" \
            -v health_host="$HEALTHCHECK_HOST" \
            -v include_line="$include_line" '
            function flush_block() {
                if ((has_ssl || has_deploy_root) && has_match && block !~ /istura-security-headers\.conf/) {
                    sub(/\n/, "\n    " include_line "\n", block)
                }
                printf "%s", block
            }

            {
                if (! in_server && $0 ~ /^[[:space:]]*server[[:space:]]*\{/) {
                    in_server = 1
                    depth = 0
                    block = ""
                    has_ssl = 0
                    has_match = 0
                    has_deploy_root = 0
                }

                if (in_server) {
                    block = block $0 ORS
                    probe = $0
                    if (probe ~ /^[[:space:]]*listen[[:space:]].*(443|ssl)/ || probe ~ /^[[:space:]]*ssl_certificate/) {
                        has_ssl = 1
                    }
                    if (index(probe, deploy_root) > 0) {
                        has_deploy_root = 1
                        has_match = 1
                    }
                    if (index(probe, health_host) > 0) {
                        has_match = 1
                    }

                    opens = gsub(/\{/, "{", probe)
                    closes = gsub(/\}/, "}", probe)
                    depth += opens - closes
                    if (depth <= 0) {
                        flush_block()
                        in_server = 0
                        depth = 0
                        block = ""
                        has_ssl = 0
                        has_match = 0
                        has_deploy_root = 0
                    }
                    next
                }

                print
            }

            END {
                if (in_server) {
                    printf "%s", block
                }
            }
        ' "$target" > "$tmp_file"

        if ! cmp -s "$target" "$tmp_file"; then
            backup="${target}.istura-security-headers.bak"
            cp "$target" "$backup"
            backups+=("${target}|${backup}")
            mv "$tmp_file" "$target"
            changed=1
        else
            rm -f "$tmp_file"
        fi
    done

    if [ "$changed" -eq 0 ]; then
        echo "Nginx HSTS include already present for ISTURA HTTPS server block(s)."
        return 0
    fi

    if ! nginx -t; then
        echo "Nginx config validation failed; restoring previous config." >&2
        for pair in "${backups[@]}"; do
            target="${pair%%|*}"
            backup="${pair#*|}"
            cp "$backup" "$target"
        done
        nginx -t || true
        exit 1
    fi

    echo "Configured Nginx HSTS include for ISTURA HTTPS server block(s)."
}

configure_php_upload_limits
configure_nginx_security_headers

systemctl try-reload-or-restart php8.4-fpm
systemctl reload nginx
sudo -u "$DEPLOY_OWNER" -H php artisan up

curl --fail --silent --show-error \
    --resolve "${HEALTHCHECK_HOST}:443:127.0.0.1" \
    "https://${HEALTHCHECK_HOST}/up" >/dev/null

trap - EXIT
echo "Deployment $DEPLOY_SHA completed successfully."
