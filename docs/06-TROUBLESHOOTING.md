# Troubleshooting — CyberSphere AI v3.1.0

## Backend Issues

### Backend Won't Start

**Symptoms:** Server fails to start, exit code 1.

**Solutions:**
1. Check logs: `docker compose logs backend`
2. Verify MongoDB is healthy: `docker compose ps mongodb`
3. Ensure `JWT_SECRET` and `JWT_REFRESH_SECRET` are set in `.env`
4. Verify `MONGODB_URI` is correct and reachable
5. Check if port 5000 is already in use: `lsof -i :5000`
6. Run `npm install` in the backend directory to ensure dependencies are installed

### MongoDB Connection Refused

**Symptoms:** `ECONNREFUSED` or `MongoNetworkError` in logs.

**Solutions:**
1. Wait for MongoDB healthcheck to pass: `docker compose ps mongodb`
2. Verify `MONGODB_URI` uses Docker Compose service name (`mongodb`)
3. Check credentials match `MONGO_INITDB_ROOT_USERNAME` / `MONGO_INITDB_ROOT_PASSWORD`
4. For MongoDB Atlas, ensure your IP is whitelisted in the Atlas dashboard
5. Check that the MongoDB cluster is running and accessible

### AI Chatbot Not Responding

**Symptoms:** AI responses timeout or return errors.

**Solutions:**
1. Verify `GEMINI_API_KEY` is set correctly in `backend/.env`
2. Ensure Ollama is running locally if using local AI: `curl http://localhost:11434/api/tags`
3. Check network connectivity for external API calls
4. Review Winston logs for detailed error messages
5. Verify AI provider status: `GET /api/chat/status`
6. Check that the AI request timeout is not too low (default: 30s)

### Rate Limiting Issues

**Symptoms:** 429 Too Many Requests errors.

**Solutions:**
1. Reduce request frequency
2. Check rate limit configuration in `backend/src/config/index.js`
3. For development, you can increase limits in the rate limiter config

## Frontend Issues

### Frontend Shows Blank Page

**Symptoms:** Browser loads but page is blank or white.

**Solutions:**
1. Check browser console for errors
2. Check nginx logs: `docker compose logs frontend`
3. Verify backend healthcheck passes: `docker compose ps backend`
4. Ensure `CLIENT_ORIGIN` matches the frontend URL in production
5. Clear browser cache and reload
6. Check if the Vite dev server is running on port 5173

### Frontend Build Fails

**Symptoms:** `npm run build` exits with errors.

**Solutions:**
1. Delete `node_modules` and reinstall: `rm -rf node_modules && npm install`
2. Ensure Node.js version is 18+
3. Check for environment variable mismatches
4. Review build output for specific error messages
5. Check that all environment variables are correctly set in `.env`

### API Calls Fail in Development

**Symptoms:** Frontend cannot reach backend API.

**Solutions:**
1. Verify the backend is running on `http://localhost:5000`
2. Check that the Vite proxy is configured correctly in `vite.config.js`
3. Ensure `VITE_API_URL` is set correctly in `frontend/.env`
4. Check browser network tab for CORS errors
5. Verify `CLIENT_ORIGIN` in backend `.env` includes `http://localhost:5173`

### Login Issues

**Symptoms:** Cannot log in, login form submits but no response.

**Solutions:**
1. Verify admin credentials are correct
2. Check that the admin user was seeded: `npm run seed` in backend
3. Verify `ADMIN_EMAIL` and `ADMIN_PASSWORD` in backend `.env`
4. Check browser console for JavaScript errors
5. Ensure cookies are enabled in the browser
6. Check that TOTP MFA is not blocking login (if enabled)

## Docker Issues

### Docker Compose Fails to Start

**Symptoms:** `docker compose up` exits with errors.

**Solutions:**
1. Check Docker Desktop is running
2. Verify Docker Compose file syntax: `docker compose config`
3. Ensure sufficient disk space and memory
4. Check that ports 5000, 5173, 3001, 80, 443 are not in use
5. Run `docker compose down -v` and try again (WARNING: deletes data)

### Ollama Not Responding

**Symptoms:** Ollama container exits or doesn't respond.

**Solutions:**
1. Check Ollama health: `docker compose ps ollama`
2. For GPU acceleration, uncomment the `deploy` section in `docker-compose.yml`
3. Ensure sufficient RAM (4GB minimum, 8GB+ recommended)
4. Check Ollama logs: `docker compose logs ollama`
5. Verify the Ollama model is downloaded: `docker exec ollama ollama list`

### MongoDB Data Not Persisting

**Symptoms:** Data is lost after container restart.

**Solutions:**
1. Verify MongoDB volume is configured in `docker-compose.yml`
2. Check that the volume path is correct
3. Ensure the volume is not being removed by `docker compose down -v`

## AI Provider Issues

### Gemini API Errors

**Symptoms:** AI responses fail with Gemini-related errors.

**Solutions:**
1. Verify `GEMINI_API_KEY` is set correctly
2. Check that the API key has not been revoked or expired
3. Verify the API key has the Generative Language API enabled
4. Check Google Cloud quota limits
5. Ensure network connectivity to `generativelanguage.googleapis.com`

### Ollama Model Not Found

**Symptoms:** Ollama returns model not found errors.

**Solutions:**
1. Check available models: `docker exec ollama ollama list`
2. Pull the model if missing: `docker exec ollama ollama pull llama3.1`
3. Verify the `OLLAMA_MODEL` environment variable matches the available model name

### AI Response Quality Issues

**Symptoms:** AI responses are vague, incorrect, or unhelpful.

**Solutions:**
1. Check that the AI provider is available (Gemini for cloud, Ollama for local)
2. Verify the input is properly sanitized and not being blocked
3. Check Winston logs for AI provider errors
4. Try switching between Gemini and Ollama to compare results

## Database Issues

### MongoDB Slow Queries

**Symptoms:** API responses are slow, especially for scan operations.

**Solutions:**
1. Check MongoDB Atlas performance metrics
2. Verify indexes are created (run `npm run seed` to ensure indexes)
3. Check connection pool settings
4. Consider upgrading MongoDB tier for production workloads

### Redis Connection Issues

**Symptoms:** Cache misses, increased API response times.

**Solutions:**
1. Verify Redis is running: `docker compose ps redis`
2. Check Redis connection string in backend `.env`
3. Test Redis connectivity: `redis-cli -h <host> -p 6379 PING`
4. Check Redis memory usage and eviction policy

## Monitoring & Observability

### Prometheus Metrics Not Available

**Symptoms:** `GET /metrics` returns 404 or connection refused.

**Solutions:**
1. Verify `OTEL_ENABLED=true` in backend `.env`
2. Check that the OTLP collector is running
3. Verify Prometheus is scraping the correct endpoint
4. Check Grafana data source configuration

### Grafana Dashboards Not Loading

**Symptoms:** Grafana UI shows no data or connection errors.

**Solutions:**
1. Verify Grafana is running: `docker compose ps grafana`
2. Check Grafana URL: `http://localhost:3001`
3. Verify Prometheus data source is configured in Grafana
4. Check that dashboards are provisioned correctly

## Common Error Messages

| Error | Cause | Solution |
|-------|-------|----------|
| `ECONNREFUSED` | Service not running | Start the service with `docker compose up` |
| `401 Unauthorized` | Invalid/missing token | Log in again or refresh token |
| `403 Forbidden` | Insufficient permissions | Check user role and RBAC configuration |
| `429 Too Many Requests` | Rate limit exceeded | Wait and retry, or increase rate limits |
| `500 Internal Server Error` | Backend exception | Check Winston logs for details |
| `CORS error` | Origin not allowed | Add origin to `CLIENT_ORIGIN` |
| `JWT expired` | Token expired | Use refresh token or log in again |