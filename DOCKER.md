# SCR-Mesh Docker Images

This document provides instructions for building and pushing Docker images for the SCR-Mesh project.

## Prerequisites

- Docker installed
- Docker Hub account or access to a container registry
- Docker Compose installed

## Image Names

The images use the following naming convention:
- Frontend: `scr-mesh-frontend`
- Backend: `scr-mesh-backend`

## Building and Pushing Images

### Option 1: Using the provided scripts

#### For Linux/Mac (Bash):

1. Edit the `build-and-push.sh` script to set your Docker Hub username or registry:

```sh
# Change these values
REGISTRY="docker.io"  # Your registry
NAMESPACE="your-username"  # Your Docker Hub username or organization
```

2. Make the script executable:

```sh
chmod +x build-and-push.sh
```

3. Run the script:

```sh
./build-and-push.sh
```

#### For Windows (PowerShell):

1. Edit the `build-and-push.ps1` script to set your Docker Hub username or registry:

```powershell
# Change these values
$REGISTRY = "docker.io"  # Your registry
$NAMESPACE = "your-username"  # Your Docker Hub username or organization
```

2. Run the PowerShell script:

```powershell
.\build-and-push.ps1
```

### Option 2: Manual build and push

1. Build the images:

```sh
docker-compose build
```

2. Tag the images:

```sh
docker tag scr-mesh-frontend:latest your-username/scr-mesh-frontend:latest
docker tag scr-mesh-backend:latest your-username/scr-mesh-backend:latest
```

3. Push the images:

```sh
docker push your-username/scr-mesh-frontend:latest
docker push your-username/scr-mesh-backend:latest
```

## Running in Production

### Option 1: Using provided scripts

#### For Linux/Mac (Bash):

Create a `.env` file manually and run:

```sh
docker-compose -f docker-compose.prod.yml up -d
```

#### For Windows (PowerShell):

Use the provided script that sets up the environment and runs the containers:

1. Edit the configuration in `run-production.ps1`:

```powershell
$REGISTRY = "docker.io"
$NAMESPACE = "your-username"
$TAG = "latest"
$DB_PASSWORD = "secure-password"  # Change this to a secure password
```

2. Run the script:

```powershell
.\run-production.ps1
```

### Option 2: Manual setup

1. Create a `.env` file with your configuration:

```
REGISTRY=docker.io
NAMESPACE=your-username
TAG=latest
DB_PASSWORD=secure-password
```

2. Start the services:

```sh
docker-compose -f docker-compose.prod.yml up -d
```

## Image Details

### Frontend (scr-mesh-frontend)

- Base: Node.js 18 Alpine (build) and Nginx Alpine (runtime)
- Ports: 80
- Optimized for production with multi-stage build

### Backend (scr-mesh-backend)

- Base: Node.js 18 Alpine
- Ports: 5000
- Runs as non-root user for security
- Production-ready configuration 