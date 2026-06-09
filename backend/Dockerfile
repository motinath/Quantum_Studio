FROM python:3.11-slim

WORKDIR /app

# Create non-root user for security
RUN groupadd -r appgroup && useradd -r -g appgroup appuser

# Install dependencies first (better layer caching)
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Copy source
COPY . .

# Use Postgres in production (override via env)
ENV DATABASE_URL=postgresql+asyncpg://postgres:password@db:5432/quantum_studio

# Switch to non-root user
RUN chown -R appuser:appgroup /app
USER appuser

EXPOSE 5000

CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "5000"]
