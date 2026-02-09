# Troubleshooting Deployment Issues

## Current Issue: 403 Forbidden Error

### Symptoms
- Nginx returns "403 Forbidden" when accessing the application
- Error logs show: `directory index of "/usr/share/nginx/html/" is forbidden`
- Frontend files not being served

### Root Cause
The frontend build files are not being properly built or copied to the nginx container's `/usr/share/nginx/html` directory.

## Quick Fix Steps

### Step 1: Pull Latest Changes
```bash
cd /path/to/antigravity
git pull origin main
```

### Step 2: Stop and Remove Existing Containers
```bash
docker compose -f docker-compose.prod.yml down
```

### Step 3: Remove Old Images (Force Clean Build)
```bash
docker compose -f docker-compose.prod.yml build --no-cache
```

### Step 4: Deploy with Verbose Output
```bash
./deploy.sh
```

Watch the build output carefully. You should see:
- Frontend dependencies being installed
- Frontend build completing successfully
- "Verification" steps showing files in /app/dist
- Files being copied to nginx

### Step 5: Verify Files in Container
After deployment, check if files exist in the nginx container:

```bash
# Check if files exist
docker exec company_board_nginx ls -la /usr/share/nginx/html/

# Check if index.html exists
docker exec company_board_nginx cat /usr/share/nginx/html/index.html | head -20
```

You should see index.html and other static files (assets folder, etc.).

## If Still Not Working

### Check Build Logs
```bash
# View nginx build logs
docker compose -f docker-compose.prod.yml logs nginx

# View full build logs
docker compose -f docker-compose.prod.yml build nginx 2>&1 | tee build.log
```

### Manual Build Test
Try building the nginx image manually to see detailed output:

```bash
# Build with verbose output
docker build -f Dockerfile.nginx \
  --build-arg VITE_API_URL=http://YOUR_EC2_IP \
  --progress=plain \
  -t test-nginx .

# Run test container
docker run -d -p 8080:80 --name test-nginx test-nginx

# Check files
docker exec test-nginx ls -la /usr/share/nginx/html/

# Test access
curl http://localhost:8080

# Cleanup
docker stop test-nginx && docker rm test-nginx
```

### Check Environment Variables
Ensure .env file has the correct VITE_API_URL:

```bash
cat .env | grep VITE_API_URL
```

Should output: `VITE_API_URL=http://YOUR_EC2_IP`

## Common Issues

### Issue 1: Build Fails Silently
**Symptom**: No error during build but /app/dist is empty

**Solution**: The updated Dockerfile.nginx now includes verification steps that will fail loudly if dist directory is not created.

### Issue 2: Wrong API URL
**Symptom**: Frontend builds but API calls fail

**Solution**: Update VITE_API_URL in .env file to match your EC2 public IP:
```bash
nano .env
# Change: VITE_API_URL=http://3.89.59.227  (use your actual IP)
```

### Issue 3: Permission Issues
**Symptom**: Cannot access /usr/share/nginx/html

**Solution**: The nginx:alpine image should have correct permissions. If issues persist, try:
```bash
docker exec company_board_nginx chown -R nginx:nginx /usr/share/nginx/html
```

### Issue 4: Disk Space
**Symptom**: Build fails with "no space left on device"

**Solution**: Clean up Docker resources:
```bash
docker system prune -a --volumes
```

## Verification Checklist

- [ ] .env file exists and has correct values
- [ ] Git repository is up to date (git pull)
- [ ] Old containers are stopped (docker compose down)
- [ ] Build completes without errors
- [ ] Verification steps in Dockerfile pass
- [ ] index.html exists in /usr/share/nginx/html/
- [ ] Nginx container is running (docker compose ps)
- [ ] Can access application at http://YOUR_EC2_IP

## Still Having Issues?

If the problem persists after following all steps above, collect the following information:

```bash
# System info
df -h
docker info | grep -A 5 "Storage Driver"

# Container status
docker compose -f docker-compose.prod.yml ps

# Full logs
docker compose -f docker-compose.prod.yml logs > all-logs.txt

# Nginx container inspection
docker exec company_board_nginx nginx -t
docker exec company_board_nginx find /usr/share/nginx/html -type f
```

Share the output and any error messages for further debugging.
