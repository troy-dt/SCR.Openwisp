# OpenWrt Router Monitor

A Docker-based application for monitoring OpenWrt routers and displaying metrics in a React dashboard.

## Features

- Monitor multiple OpenWrt routers via SSH
- Collect and display metrics:
  - Uptime
  - CPU load
  - Memory usage
  - Disk usage
  - Network interfaces
  - Wireless clients
- Real-time status monitoring
- Scheduled metrics collection
- Responsive dashboard
- Automatic hostname detection
- PostgreSQL for reliable data storage

## Architecture

The application consists of three main components:

1. **React Frontend**: UI for displaying router metrics and managing routers
2. **Node.js Backend**: API for collecting and serving router data
3. **PostgreSQL Database**: Persistent storage for router configurations and metrics

## Prerequisites

- Docker and Docker Compose
- OpenWrt routers with SSH access

## Getting Started

1. Clone the repository:
   ```
   git clone https://github.com/yourusername/openwisp-router-monitor.git
   cd openwisp-router-monitor
   ```

2. Start the application using Docker Compose:
   ```
   docker-compose up -d
   ```

3. Access the application:
   - Frontend: http://localhost:3000
   - Backend API: http://localhost:5000

## Usage

1. Add a router by providing:
   - Name
   - IP Address (hostname is auto-detected)
   - SSH credentials (port, username, password or SSH key)

2. View metrics on the dashboard
3. Monitor router status
4. Configure collection intervals

## Development

### Backend

The backend is built with Node.js, Express, and PostgreSQL using Sequelize ORM:

```
cd backend
npm install
npm run dev
```

### Frontend

The frontend is built with React and Material UI:

```
cd frontend
npm install
npm start
```

### Database Migrations

The application uses Sequelize migrations to manage database schema:

```
cd backend
npm run migrate  # Run pending migrations
```

## Advanced Features

### Automatic Hostname Detection

When adding a router, the system only requires the IP address. Upon saving:
1. The system connects to the router via SSH
2. Automatically detects the hostname using various methods
3. Updates the router record with the actual hostname

This feature simplifies router setup and ensures accurate hostname information.

## License

MIT 

# SCR-Mesh

## Development Setup

To run the application in development mode:

```bash
docker-compose up
```

This will start the application with volume mounts for live code reloading during development.

## Production Deployment

For production deployment, simply use the production docker-compose file:

```bash
# Set your environment variables
export POSTGRES_PASSWORD=your_secure_password
export FRONTEND_PORT=80
export BACKEND_PORT=5000

# Deploy the stack
docker-compose -f docker-compose.prod.yml up -d
```

### Building and Pushing Images

To build and push the Docker images to your registry:

```bash
# Windows
.\build-and-push.ps1

# Linux/macOS (if using bash script)
# ./build-and-push.sh
```

### Environment Variables

The following environment variables can be set:

| Variable | Default | Description |
|----------|---------|-------------|
| REGISTRY | docker.io | Docker registry |
| NAMESPACE | d1g1talterrain | Organization/username in registry |
| TAG | latest | Image tag |
| FRONTEND_PORT | 80 | Port to expose frontend |
| BACKEND_PORT | 5000 | Port to expose backend API |
| POSTGRES_PORT | 5432 | Port to expose PostgreSQL |
| POSTGRES_PASSWORD | postgres | PostgreSQL password |

## Accessing the Application

- Frontend: http://localhost:${FRONTEND_PORT}
- Backend API: http://localhost:${BACKEND_PORT}/api 