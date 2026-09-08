import importlib.util
from pathlib import Path
import unittest

spec = importlib.util.spec_from_file_location("prebuilt", Path(__file__).resolve().parents[2] / "scripts/check-release-prebuilt.py")
module = importlib.util.module_from_spec(spec)
spec.loader.exec_module(module)


class PrebuiltTests(unittest.TestCase):
    def setUp(self):
        self.source = {"deploy.sh": "source-hash"}
        self.images = {"backend": "sha256:" + "a" * 64, "nginx": "sha256:" + "b" * 64}
        self.bundle = {"source": self.source.copy(), "images": self.images.copy()}
        self.config = {"services": {k: {"image": v} for k, v in self.images.items()}}

    def inspect(self, image_id):
        return {"Id": image_id, "Os": "linux", "Architecture": "amd64"}

    def check(self, inspect=None):
        return module.validate(self.bundle, self.source, self.config, inspect or self.inspect)

    def test_valid_loaded_bundle(self):
        self.assertTrue(self.check()["verified"])

    def test_source_mismatch(self):
        self.source["new.py"] = "changed"
        with self.assertRaises(ValueError): self.check()

    def test_mutable_image_ref_rejected(self):
        self.bundle["images"]["backend"] = "backend:latest"
        with self.assertRaises(ValueError): self.check()

    def test_compose_mismatch(self):
        self.config["services"]["nginx"]["image"] = "nginx:latest"
        with self.assertRaises(ValueError): self.check()

    def test_wrong_platform(self):
        with self.assertRaises(ValueError):
            self.check(lambda image_id: {"Id": image_id, "Os": "linux", "Architecture": "arm64"})

    def test_missing_image(self):
        def missing(image_id): raise ValueError("missing")
        with self.assertRaises(ValueError): self.check(missing)

    def test_missing_service(self):
        del self.bundle["images"]["nginx"]
        with self.assertRaises(ValueError): self.check()
