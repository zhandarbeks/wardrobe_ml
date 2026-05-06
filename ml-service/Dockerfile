FROM python:3.11-slim
WORKDIR /app

RUN apt-get update && apt-get install -y --no-install-recommends \
    libgl1 libglib2.0-0 && \
    rm -rf /var/lib/apt/lists/*

# CPU-only PyTorch first (saves ~2 GB vs default CUDA wheels). Cached as its own
# layer so app code changes don't trigger a torch re-download.
RUN pip install --no-cache-dir \
    torch==2.4.1 torchvision==0.19.1 \
    --index-url https://download.pytorch.org/whl/cpu

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Copy trained models into the image
COPY models/ /app/models/

COPY main.py .
RUN mkdir -p /app/uploads
CMD ["uvicorn", "main:app", "--host", "0.0.0.0", "--port", "8001"]
