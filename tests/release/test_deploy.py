"""Linux, standard-library-only failure tests. Docker is replaced with a local fake.

Run: python3 -m unittest discover -s tests/release -v
"""
import importlib.util
import json
import os
from pathlib import Path
import shutil
import subprocess
import tempfile
import unittest

ROOT = Path(__file__).resolve().parents[2]
FAKE_DOCKER = r'''#!/usr/bin/env python3
import io, json, os, re, sys, tarfile
from pathlib import Path
args = sys.argv[1:]
mode = os.environ.get("FAKE_MODE", "")
with open("commands.jsonl", "a") as log:
    log.write(json.dumps(args) + "\n")
state_path = Path("state.json")
state = json.loads(state_path.read_text()) if state_path.exists() else {"backend": "running", "nginx": "running"}
is_compose = args[0] == "compose"
if is_compose:
    args = args[3:]
command = args[0]
if command == "tag":
    assert re.fullmatch(r"[a-z0-9-]+:retained", args[-1]), args[-1]
elif command == "config":
    if mode == "unset-env": print('The "SMTP_PORT" variable is not set. Defaulting to a blank string.', file=sys.stderr)
    if "--format" in args:
        config = {"services": {"nginx": {"build": {"args": {"VITE_API_URL": "https://changed.invalid" if Path("resolved-change").exists() else ""}}}}}
        if os.environ.get("RELEASE_PREBUILT_BUNDLE"):
            config["services"]["backend"] = {"image": "sha256:" + "a" * 64}
            config["services"]["nginx"]["image"] = "sha256:" + "b" * 64
        print(json.dumps(config))
elif command == "image":
    if mode == "missing-prebuilt": sys.exit(1)
    print(json.dumps([{"Id": args[-1], "Os": "linux", "Architecture": "amd64"}]))
elif command == "ps" and not is_compose:
    if mode == "stale-candidate": print("leftover-oneoff")
elif command == "ps":
    if "--services" in args:
        print("postgres\nredis")
        for service, status in state.items():
            if status == "running": print(service)
    else:
        print(args[-1])
        if mode == "multiple-nginx" and args[-1] == "nginx": print("extra-nginx")
elif command == "inspect":
    fmt = args[2]
    if "Labels" in fmt: print("fake-project")
    elif "State.Status" in fmt: print(state.get(args[-1], "exited"))
    elif "PortBindings" in fmt: print("0")
    elif "Mounts" in fmt: print("[]")
    else: print("sha256:old-image")
elif command == "build":
    if mode == "build-fail": sys.exit(1)
    if mode == "source-change": Path("backend/changed.py").write_text("changed")
    if mode == "config-change": Path("resolved-change").write_text("changed")
elif command == "stop":
    if mode == "stop-fail": sys.exit(1)
    for service in ("backend", "nginx"):
        if service in args: state[service] = "exited"
elif command == "up":
    for service in ("backend", "nginx"):
        if service in args: state[service] = "running"
elif command == "exec":
    if "postgres" in args:
        if any("pg_dump" in arg for arg in args): sys.stdout.buffer.write(b"PGDMP-test")
        elif "pg_restore" in args:
            sys.stdin.buffer.read()
            if mode == "backup-fail": sys.exit(1)
            print("validated dump listing")
        elif any("psql" in arg for arg in args): print("202609050004")
    elif "backend" in args:
        sys.stdin.read()
        if mode == "candidate-fail": sys.exit(1)
        print('{"checks": "fake-success"}')
elif command == "run":
    if "--entrypoint" in args and "python" in args:
        sys.stdin.read()
        if mode == "invalid-settings": sys.exit(1)
        print('{"valid": true}')
    elif "--entrypoint" in args and "tar" in args:
        stream = io.BytesIO()
        with tarfile.open(fileobj=stream, mode="w:gz") as archive:
            info = tarfile.TarInfo("uploads/sentinel.txt")
            info.size = 7
            archive.addfile(info, io.BytesIO(b"fixture"))
        sys.stdout.buffer.write(stream.getvalue())
    elif "alembic" in args and mode == "migration-fail": sys.exit(1)
    elif "--name" in args: print("candidate-container-id")
state_path.write_text(json.dumps(state))
'''


@unittest.skipUnless(os.name == "posix" and shutil.which("flock"), "Linux Bash/flock required")
class DeploymentTests(unittest.TestCase):
    def setUp(self):
        self.temporary = tempfile.TemporaryDirectory()
        self.root = Path(self.temporary.name)
        self.addCleanup(self.temporary.cleanup)
        (self.root / "scripts").mkdir()
        (self.root / "backend").mkdir()
        (self.root / "bin").mkdir()
        shutil.copy(ROOT / "deploy.sh", self.root)
        for name in ("release-common.sh", "backup-release.sh", "release-manifest.py", "check-release.py", "check-release-settings.py", "check-release-compose.py", "check-release-prebuilt.py"):
            shutil.copy(ROOT / "scripts" / name, self.root / "scripts" / name)
        (self.root / ".env").write_text("# fake, no secrets\n")
        (self.root / "docker-compose.prod.yml").write_text("services: {}\n")
        for name, content in (("docker", FAKE_DOCKER), ("sleep", "#!/bin/sh\nexit 0\n")):
            path = self.root / "bin" / name
            path.write_text(content)
            path.chmod(0o755)

    def run_script(self, mode="", args=None, script="deploy.sh", extra_env=None):
        env = {key: value for key, value in os.environ.items() if not key.startswith("RELEASE_")}
        env.update(PATH=str(self.root / "bin") + os.pathsep + env["PATH"], FAKE_MODE=mode)
        env.update(extra_env or {})
        result = subprocess.run(["bash", script, *(args if args is not None else ["--confirm-downtime"])], cwd=self.root, env=env, capture_output=True, text=True, timeout=30)
        log = self.root / "commands.jsonl"
        self.commands = [json.loads(line) for line in log.read_text().splitlines()] if log.exists() else []
        return result

    def assert_no_mutation(self):
        self.assertFalse(any("stop" in command or "run" in command or "up" in command for command in self.commands))

    def assert_closed(self):
        self.assertEqual(json.loads((self.root / "state.json").read_text()), {"backend": "exited", "nginx": "exited"})

    def test_requires_explicit_downtime(self):
        result = self.run_script(args=[])
        self.assertEqual(result.returncode, 2)
        self.assertEqual(self.commands, [])

    def test_build_failure_preserves_live_services(self):
        self.assertNotEqual(self.run_script("build-fail").returncode, 0)
        self.assert_no_mutation()

    def test_unset_environment_blocks_before_build_or_downtime(self):
        result = self.run_script("unset-env")
        self.assertNotEqual(result.returncode, 0)
        self.assertIn("unset variables", result.stderr)
        self.assert_no_mutation()
        self.assertFalse(any("build" in command for command in self.commands))

    def test_invalid_settings_blocks_before_downtime(self):
        result = self.run_script("invalid-settings")
        self.assertNotEqual(result.returncode, 0)
        self.assertFalse(any("stop" in command or "alembic" in command for command in self.commands))
        self.assertEqual(json.loads((self.root / "state.json").read_text())["nginx"], "running")

    def test_stale_candidate_blocks_before_downtime(self):
        result = self.run_script("stale-candidate")
        self.assertNotEqual(result.returncode, 0)
        self.assertIn("One-off containers remain", result.stderr)
        self.assert_no_mutation()

    def test_multiple_nginx_containers_block_before_downtime(self):
        result = self.run_script("multiple-nginx")
        self.assertNotEqual(result.returncode, 0)
        self.assertIn("exactly one nginx", result.stderr)
        self.assert_no_mutation()

    def test_docker_stop_failure_is_not_reported_as_safe(self):
        result = self.run_script("stop-fail")
        self.assertNotEqual(result.returncode, 0)
        self.assertIn("CRITICAL: cannot confirm", result.stderr)
        self.assertNotIn("public services remain stopped", result.stderr)

    def test_concurrent_release_is_rejected(self):
        import fcntl
        (self.root / "backups").mkdir()
        with (self.root / "backups/.release.lock").open("w") as lock:
            fcntl.flock(lock, fcntl.LOCK_EX | fcntl.LOCK_NB)
            result = self.run_script()
        self.assertNotEqual(result.returncode, 0)
        self.assertIn("workspace lock", result.stderr)
        self.assert_no_mutation()

    def test_source_change_stops_before_downtime(self):
        result = self.run_script("source-change")
        self.assertNotEqual(result.returncode, 0)
        self.assertIn("Source changed", result.stderr)
        self.assert_no_mutation()

    def test_resolved_environment_change_stops_before_downtime(self):
        result = self.run_script("config-change")
        self.assertNotEqual(result.returncode, 0)
        self.assertIn("configuration changed", result.stderr)
        self.assert_no_mutation()

    def test_backup_refuses_running_apps(self):
        result = self.run_script(args=[], script="scripts/backup-release.sh")
        self.assertNotEqual(result.returncode, 0)
        self.assertIn("stopped backend", result.stderr)
        self.assertFalse(any("pg_dump" in " ".join(command) for command in self.commands))

    def test_bad_backup_never_migrates(self):
        self.assertNotEqual(self.run_script("backup-fail").returncode, 0)
        self.assertFalse(any("alembic" in command for command in self.commands))
        self.assert_closed()

    def test_failed_migration_never_opens_sites(self):
        result = self.run_script("migration-fail")
        self.assertNotEqual(result.returncode, 0, result.stdout + result.stderr)
        self.assertTrue(any("alembic" in command for command in self.commands))
        self.assertFalse(any("up" in command for command in self.commands))
        self.assert_closed()

    def test_failed_candidate_stays_closed(self):
        result = self.run_script("candidate-fail")
        self.assertNotEqual(result.returncode, 0, result.stdout + result.stderr)
        self.assertFalse(any("up" in command and "nginx" in command for command in self.commands))
        self.assert_closed()

    def test_success_checks_private_candidate_before_public_nginx(self):
        result = self.run_script()
        self.assertEqual(result.returncode, 0, result.stdout + result.stderr)
        checks = [index for index, command in enumerate(self.commands) if "--connect-host" in command]
        public = next(index for index, command in enumerate(self.commands) if "up" in command and "nginx" in command)
        self.assertLess(checks[0], public)
        self.assertGreater(checks[-1], public)
        build = next(index for index, command in enumerate(self.commands) if "build" in command)
        pins = [index for index, command in enumerate(self.commands) if command[0] == "tag"]
        self.assertEqual(len(pins), 2)
        self.assertLess(max(pins), build)
        self.assertEqual(len(list((self.root / "backups").glob("release-*/database.dump"))), 1)
        self.assertFalse(any("down" in command or "prune" in command for command in self.commands))

    def prepare_prebuilt(self):
        import sys
        source = json.loads(subprocess.check_output([sys.executable, "scripts/release-manifest.py"], cwd=self.root))
        bundle = self.root / "prebuilt.json"
        bundle.write_text(json.dumps({"source": source, "images": {"backend": "sha256:" + "a" * 64, "nginx": "sha256:" + "b" * 64}}))
        return {"RELEASE_PREBUILT_BUNDLE": str(bundle)}

    def test_prebuilt_skips_build_but_keeps_backup_and_private_checks(self):
        result = self.run_script(extra_env=self.prepare_prebuilt())
        self.assertEqual(result.returncode, 0, result.stdout + result.stderr)
        self.assertFalse(any("build" in command for command in self.commands))
        self.assertEqual(len(list((self.root / "backups").glob("release-*/database.dump"))), 1)
        checks = [i for i, command in enumerate(self.commands) if "--connect-host" in command]
        public = next(i for i, command in enumerate(self.commands) if "up" in command and "nginx" in command)
        self.assertLess(checks[0], public)

    def test_missing_prebuilt_blocks_before_downtime(self):
        result = self.run_script("missing-prebuilt", extra_env=self.prepare_prebuilt())
        self.assertNotEqual(result.returncode, 0)
        self.assert_no_mutation()

    def test_prebuilt_source_change_blocks_before_downtime(self):
        env = self.prepare_prebuilt()
        (self.root / "backend/new.py").write_text("changed")
        result = self.run_script(extra_env=env)
        self.assertNotEqual(result.returncode, 0)
        self.assert_no_mutation()


class ManifestTests(unittest.TestCase):
    def test_compose_summary_handles_api_origin_and_never_echoes_secrets(self):
        spec = importlib.util.spec_from_file_location("compose_check", ROOT / "scripts/check-release-compose.py")
        module = importlib.util.module_from_spec(spec)
        spec.loader.exec_module(module)
        def config(origin):
            return {"services": {"backend": {"environment": {"SECRET_KEY": "do-not-echo-me"}}, "nginx": {"build": {"args": {"VITE_API_URL": origin}}}}}
        for origin in ("", "https://jionc.com", "https://jionc.com:28443"):
            result = module.summary(config(origin))
            self.assertEqual(result["vite_api_origin"], origin)
            self.assertNotIn("do-not-echo-me", json.dumps(result))
        for origin in ("http://jionc.com", "https://user:secret@jionc.com", "https://jionc.com/api", "https://jionc.com?token=secret"):
            with self.assertRaises(ValueError):
                module.summary(config(origin))

    def test_asset_type_does_not_treat_icons_as_css(self):
        spec = importlib.util.spec_from_file_location("release_check", ROOT / "scripts/check-release.py")
        module = importlib.util.module_from_spec(spec)
        spec.loader.exec_module(module)
        self.assertEqual(module.asset_content_type("/assets/icon.svg?v=2"), "image/svg+xml")
        self.assertEqual(module.asset_content_type("/assets/font.woff2"), "font/woff2")
        self.assertEqual(module.asset_content_type("/assets/style.css"), "text/css")
        self.assertIsNone(module.asset_content_type("/assets/unknown.bin"))

    def test_excludes_runtime_and_secrets_but_includes_new_code(self):
        spec = importlib.util.spec_from_file_location("manifest", ROOT / "scripts/release-manifest.py")
        module = importlib.util.module_from_spec(spec)
        spec.loader.exec_module(module)
        for name in ("backend/uploads/blog/p.png", "frontend/.env.production", "backend/test.db", "frontend/node_modules/a.js"):
            self.assertFalse(module.eligible(Path(name)))
        for name in ("backend/app/new.py", "frontend-blog/.env.example", "backend/.dockerignore"):
            self.assertTrue(module.eligible(Path(name)))


if __name__ == "__main__":
    unittest.main()
