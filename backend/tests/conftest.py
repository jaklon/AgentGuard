import os
import tempfile
from pathlib import Path

TEST_DB = Path(tempfile.mkdtemp(prefix="agentguard-test-")) / "audit.db"
for suffix in ("", "-shm", "-wal"):
    try:
        Path(str(TEST_DB) + suffix).unlink()
    except FileNotFoundError:
        pass

os.environ["DATABASE_URL"] = f"sqlite:///{TEST_DB}"
os.environ["OPENAI_API_KEY"] = ""
os.environ["API_RATE_LIMIT_PER_MINUTE"] = "100"
