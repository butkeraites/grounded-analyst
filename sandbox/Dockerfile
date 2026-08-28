# The sandbox image. An ephemeral container is spawned from this per execution
# and torn down (`docker run --rm`) — it holds the Python data stack and the
# trusted runner harness, nothing else. No app code, no secrets, no network.
FROM python:3.12-slim

# Pinned data stack. statsmodels/scikit-learn can be added here later; kept lean
# now for fast builds.
RUN pip install --no-cache-dir \
    "pandas==2.2.3" \
    "numpy==2.1.3" \
    "matplotlib==3.9.2"

# Matplotlib/HOME need a writable dir; the container runs read-only with a
# tmpfs at /tmp, so point config there.
ENV MPLCONFIGDIR=/tmp HOME=/tmp

WORKDIR /work
COPY runner.py /opt/runner.py

# Runs as an unprivileged user (also enforced via --user at run time).
USER 65534:65534

ENTRYPOINT ["python", "/opt/runner.py"]
