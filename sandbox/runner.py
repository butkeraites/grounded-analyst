"""Sandbox runner: the trusted harness that executes untrusted, LLM-generated
Python inside an ephemeral, network-isolated container.

Contract (kept deliberately narrow so the Node adapter is simple):
  - Reads a single JSON job from stdin:
      {"mode": "execute", "code": "...", "dataset_path": "/data/x.csv"}
      {"mode": "profile", "dataset_path": "/data/x.csv"}
  - Writes exactly ONE JSON envelope to stdout, nothing else. All user `print`
    output is captured and nested inside the envelope, so stdout is always
    parseable and user code can never corrupt the framing.

The harness never raises to the outside: a user exception becomes
{"ok": false, "stderr": <traceback>} so the orchestration loop can repair it.
"""

import base64
import io
import json
import sys
import traceback
from contextlib import redirect_stdout

import matplotlib

matplotlib.use("Agg")  # headless; no display, no network
import matplotlib.pyplot as plt  # noqa: E402
import numpy as np  # noqa: E402
import pandas as pd  # noqa: E402

MAX_TABLE_ROWS = 200


def _dtype(series: "pd.Series") -> str:
    if pd.api.types.is_bool_dtype(series):
        return "boolean"
    if pd.api.types.is_integer_dtype(series):
        return "integer"
    if pd.api.types.is_float_dtype(series):
        return "float"
    if pd.api.types.is_datetime64_any_dtype(series):
        return "datetime"
    nunique = series.nunique(dropna=True)
    if nunique <= 20 and nunique < len(series):
        return "categorical"
    return "string"


def _json_safe(value):
    """Coerce numpy/pandas scalars into JSON-serialisable Python values."""
    if value is None or (isinstance(value, float) and np.isnan(value)):
        return None
    if isinstance(value, (np.integer,)):
        return int(value)
    if isinstance(value, (np.floating,)):
        return None if np.isnan(value) else float(value)
    if isinstance(value, (np.bool_,)):
        return bool(value)
    if pd.isna(value) if np.ndim(value) == 0 else False:
        return None
    if isinstance(value, (int, float, bool, str)):
        return value
    return str(value)


def profile(df: "pd.DataFrame") -> dict:
    columns = []
    for name in df.columns:
        s = df[name]
        non_null = s.dropna()
        sample = [_json_safe(v) for v in non_null.unique()[:5]]
        columns.append(
            {
                "name": str(name),
                "dtype": _dtype(s),
                "nullCount": int(s.isna().sum()),
                "uniqueCount": int(s.nunique(dropna=True)),
                "sample": sample,
            }
        )
    return {"rowCount": int(len(df)), "columns": columns}


def _collect_artifacts(scope: dict) -> list:
    artifacts = []
    # Charts: every open matplotlib figure becomes a PNG artifact.
    for num in plt.get_fignums():
        fig = plt.figure(num)
        buf = io.BytesIO()
        fig.savefig(buf, format="png", bbox_inches="tight", dpi=120)
        artifacts.append(
            {
                "kind": "chart",
                "mimeType": "image/png",
                "data": base64.b64encode(buf.getvalue()).decode("ascii"),
            }
        )
    # Table: a conventional `result` DataFrame/Series is returned as structured data.
    result = scope.get("result")
    if isinstance(result, pd.Series):
        result = result.reset_index()
    if isinstance(result, pd.DataFrame):
        head = result.head(MAX_TABLE_ROWS)
        artifacts.append(
            {
                "kind": "table",
                "columns": [str(c) for c in head.columns],
                "rows": [[_json_safe(v) for v in row] for row in head.itertuples(index=False, name=None)],
            }
        )
    return artifacts


def execute(code: str, df: "pd.DataFrame") -> dict:
    scope = {"df": df, "pd": pd, "np": np, "plt": plt}
    captured = io.StringIO()
    try:
        with redirect_stdout(captured):
            exec(code, scope)  # noqa: S102 — this IS the sandbox's purpose
        artifacts = _collect_artifacts(scope)
        return {"ok": True, "stdout": captured.getvalue(), "stderr": "", "artifacts": artifacts}
    except Exception:
        return {
            "ok": False,
            "stdout": captured.getvalue(),
            "stderr": traceback.format_exc(),
            "artifacts": [],
        }
    finally:
        plt.close("all")


def main() -> None:
    job = json.loads(sys.stdin.read() or "{}")
    mode = job.get("mode", "execute")
    df = pd.read_csv(job["dataset_path"])
    envelope = profile(df) if mode == "profile" else execute(job["code"], df)
    sys.stdout.write(json.dumps(envelope))


if __name__ == "__main__":
    main()
