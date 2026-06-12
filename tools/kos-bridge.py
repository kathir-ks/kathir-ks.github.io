#!/usr/bin/env python3
"""
kos-bridge — outbound-only daemon connecting the GCP VM to Kathir OS.

Every HEARTBEAT_SECS:
  - if local Jarvis is up, push heartbeat + task log to the Worker
Every EPISTEMIC_EVERY heartbeats (default ~12h at 60s):
  - export graph/learning from local epistemic-feed and push to the Worker

The VM only ever makes outbound HTTPS calls — nothing is exposed inbound.
Reuses the `kos` CLI's config and helpers (same directory).

Run via systemd user service (see kos-bridge.service) or:
  python3 tools/kos-bridge.py
"""

import importlib.util
import pathlib
import sys
import time

_spec = importlib.util.spec_from_loader("kos", loader=None)
kos = importlib.util.module_from_spec(_spec)
exec(pathlib.Path(__file__).with_name("kos").read_text(), kos.__dict__)

HEARTBEAT_SECS = 60
EPISTEMIC_EVERY = 720  # heartbeats between epistemic syncs (720 × 60s = 12h)


def log(msg):
    print(f"[{time.strftime('%Y-%m-%d %H:%M:%S')}] {msg}", flush=True)


def main():
    if not kos.CFG["token"]:
        log("FATAL: KATHIR_OS_ADMIN_TOKEN not set")
        sys.exit(1)
    log(f"kos-bridge up — api={kos.CFG['api']} jarvis={kos.CFG['jarvis']} epistemic={kos.CFG['epistemic']}")

    tick = 0
    while True:
        try:
            if kos.jarvis_heartbeat():
                kos.api("POST", "/jarvis/sync",
                        {"status": "online", "tasks": kos.read_task_log()}, admin=True)
                log("jarvis heartbeat pushed")
            else:
                log("jarvis not running — heartbeat skipped")
        except SystemExit:
            log("worker rejected jarvis sync (check token)")
        except Exception as e:
            log(f"jarvis sync error: {e}")

        if tick % EPISTEMIC_EVERY == 0:
            try:
                kos.cmd_epistemic_sync(None)
            except SystemExit:
                log("worker rejected epistemic sync")
            except Exception as e:
                log(f"epistemic sync error: {e}")

        tick += 1
        time.sleep(HEARTBEAT_SECS)


if __name__ == "__main__":
    main()
