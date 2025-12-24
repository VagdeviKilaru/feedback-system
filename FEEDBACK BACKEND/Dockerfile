FROM python:3.11-slim

WORKDIR /app

# Install system dependencies
RUN apt-get update && apt-get install -y gcc && rm -rf /var/lib/apt/lists/*

# Install python dependencies
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Copy app
COPY ./app ./app

# Railway exposes PORT automatically
ENV PYTHONUNBUFFERED=1

# Start FastAPI correctly
CMD ["python", "-m", "app.main"]
