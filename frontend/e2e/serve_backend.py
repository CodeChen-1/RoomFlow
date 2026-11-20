import os
import sys
from pathlib import Path
from tempfile import TemporaryDirectory

import uvicorn


if __name__ == "__main__":
    sys.path.insert(0, str(Path.cwd()))
    with TemporaryDirectory(prefix="roomflow-e2e-") as directory:
        os.environ["ROOMFLOW_DB_PATH"] = str(Path(directory) / "browser.sqlite3")
        uvicorn.run("app.main:app", host="127.0.0.1", port=8781)
