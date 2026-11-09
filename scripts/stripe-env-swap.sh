#!/usr/bin/env bash
# scripts/stripe-env-swap.sh
#
# Moves The Elder between Stripe TEST mode (Vercel Preview) and LIVE mode
# (Vercel Production) by setting the env vars that config/billing.ts reads.
# No code changes are involved: billing is inert until these are set.
#
#   scripts/stripe-env-swap.sh status            show which vars exist per scope (names only)
#   scripts/stripe-env-swap.sh test  [--dry]     Preview scope: test key, test prices, checkout ON
#   scripts/stripe-env-swap.sh live  [--dry]     Production scope: live key, live prices, checkout OFF
#   scripts/stripe-env-swap.sh enable            Production: STRIPE_CHECKOUT_ENABLED=true (after the live purchase test)
#   scripts/stripe-env-swap.sh disable           Production: STRIPE_CHECKOUT_ENABLED=false (kill switch)
#
# Secrets (the Stripe key and the webhook signing secret) are typed at a hidden
# prompt and piped to the Vercel CLI on stdin. They are never echoed, never put
# on a command line, and never written to disk. Price ids are not secrets.
#
# Rules this script enforces:
#   * test keys (sk_test_/rk_test_) go ONLY to Preview; live keys ONLY to Production
#   * whsec_ is required for the webhook secret
#   * Production checkout stays OFF until `enable`
#   * Council stays unpurchasable in Production (COUNCIL_PURCHASABLE=false) until you change it deliberately
set -euo pipefail

# ---- Stripe price ids (created 2026-11-09; ids are not secrets) -------------
TEST_KEPT_MONTHLY=price_1UApz9QivRu0hLGsFfkuLz7Y
TEST_KEPT_ANNUAL=price_1UApzDQivRu0hLGsUP5mbxms
TEST_COUNCIL_MONTHLY=price_1UApzGQivRu0hLGsRMOAz8fD
TEST_COUNCIL_ANNUAL=price_1UApzJQivRu0hLGsf0kYC3gL
LIVE_KEPT_MONTHLY=price_1UApokQivRu0hLGs7UCt967r
LIVE_KEPT_ANNUAL=price_1UApooQivRu0hLGs6Jyp20X1
LIVE_COUNCIL_MONTHLY=price_1UAporQivRu0hLGsPw6t7Iiq
LIVE_COUNCIL_ANNUAL=price_1UApovQivRu0hLGsWTknW87l

fail() { echo "ABORT: $*" >&2; exit 1; }
cmd="${1:-}"; shift || true
DRY=0; [ "${1:-}" = "--dry" ] && DRY=1

command -v vercel >/dev/null 2>&1 || fail "vercel CLI not found (npm i -g vercel), then run: vercel link"
[ -d .vercel ] || fail "run from the repo root after 'vercel link' (no .vercel directory)"

# setvar NAME SCOPE VALUE   (VALUE via stdin, never argv)
setvar() {
  local name="$1" scope="$2" value="$3"
  if [ "$DRY" = 1 ]; then echo "  [dry] $scope  $name  (value hidden)"; return; fi
  vercel env rm "$name" "$scope" --yes >/dev/null 2>&1 || true   # replace, don't duplicate
  printf '%s' "$value" | vercel env add "$name" "$scope" >/dev/null \
    || fail "vercel env add $name $scope failed (check: vercel env ls)"
  echo "  set  $scope  $name"
}

ask_secret() { # PROMPT -> echoes the typed value
  local v; read -r -s -p "$1: " v; echo >&2; [ -n "$v" ] || fail "empty value"; printf '%s' "$v"
}

case "$cmd" in
  status)
    for scope in preview production; do
      echo "== $scope"
      vercel env ls "$scope" 2>/dev/null | grep -E 'STRIPE_|COUNCIL_PURCHASABLE|BILLING_SLACK|CRON_SECRET' || echo "  (none of the billing vars are set)"
    done ;;

  test)
    echo "==> TEST mode -> Vercel Preview"
    key=$(ask_secret "Stripe TEST secret key (sk_test_... or restricted rk_test_...)")
    case "$key" in sk_test_*|rk_test_*) ;; *) fail "that is not a test key; test keys never go to Preview as anything else";; esac
    echo "    In Stripe (test mode) add a webhook endpoint at https://<your-preview-url>/api/webhooks/stripe"
    echo "    with events: checkout.session.completed, invoice.paid, invoice.payment_failed,"
    echo "    customer.subscription.updated, customer.subscription.deleted. Then copy its signing secret."
    whs=$(ask_secret "Test webhook signing secret (whsec_...)")
    case "$whs" in whsec_*) ;; *) fail "webhook secret must start with whsec_";; esac
    setvar STRIPE_SECRET_KEY            preview "$key"
    setvar STRIPE_WEBHOOK_SECRET        preview "$whs"
    setvar STRIPE_PRICE_KEPT_MONTHLY    preview "$TEST_KEPT_MONTHLY"
    setvar STRIPE_PRICE_KEPT_ANNUAL     preview "$TEST_KEPT_ANNUAL"
    setvar STRIPE_PRICE_COUNCIL_MONTHLY preview "$TEST_COUNCIL_MONTHLY"
    setvar STRIPE_PRICE_COUNCIL_ANNUAL  preview "$TEST_COUNCIL_ANNUAL"
    setvar STRIPE_CHECKOUT_ENABLED      preview "true"
    setvar COUNCIL_PURCHASABLE          preview "true"
    echo "==> Done. Redeploy the Preview (env changes apply to NEW deployments only)."
    echo "    Test card 4242 4242 4242 4242; failing renewal: 4000 0000 0000 0341." ;;

  live)
    echo "==> LIVE mode -> Vercel Production (checkout stays OFF)"
    key=$(ask_secret "Stripe LIVE secret key (sk_live_... or restricted rk_live_...)")
    case "$key" in sk_live_*|rk_live_*) ;; *) fail "that is not a live key; live keys go only to Production";; esac
    echo "    In Stripe (live mode) add a webhook endpoint at https://<your-production-domain>/api/webhooks/stripe"
    echo "    with the same five events, then copy its signing secret."
    whs=$(ask_secret "Live webhook signing secret (whsec_...)")
    case "$whs" in whsec_*) ;; *) fail "webhook secret must start with whsec_";; esac
    setvar STRIPE_SECRET_KEY            production "$key"
    setvar STRIPE_WEBHOOK_SECRET        production "$whs"
    setvar STRIPE_PRICE_KEPT_MONTHLY    production "$LIVE_KEPT_MONTHLY"
    setvar STRIPE_PRICE_KEPT_ANNUAL     production "$LIVE_KEPT_ANNUAL"
    setvar STRIPE_PRICE_COUNCIL_MONTHLY production "$LIVE_COUNCIL_MONTHLY"
    setvar STRIPE_PRICE_COUNCIL_ANNUAL  production "$LIVE_COUNCIL_ANNUAL"
    setvar STRIPE_CHECKOUT_ENABLED      production "false"
    setvar COUNCIL_PURCHASABLE          production "false"
    echo "==> Done. Redeploy Production, make ONE real purchase of the cheapest plan"
    echo "    (needs checkout on: run '$0 enable', buy, confirm tier flips, refund it,"
    echo "    then decide whether to leave it enabled)." ;;

  enable)  setvar STRIPE_CHECKOUT_ENABLED production "true";  echo "Redeploy Production for it to take effect." ;;
  disable) setvar STRIPE_CHECKOUT_ENABLED production "false"; echo "Redeploy Production for it to take effect." ;;
  *) sed -n '2,22p' "$0"; exit 1 ;;
esac
