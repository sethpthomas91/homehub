FROM python:3.12-slim
WORKDIR /app
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt
COPY app.py .
ENV DB_PATH=/data/homehub.db
ENV FLASK_ENV=production
CMD ["python", "-m", "flask", "run", "--host=0.0.0.0", "--port=5000"]
