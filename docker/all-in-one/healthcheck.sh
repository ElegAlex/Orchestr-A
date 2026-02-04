#!/bin/bash

# Check that all services are running via supervisorctl
check_service() {
    local service=$1
    if ! supervisorctl status "$service" 2>/dev/null | grep -q "RUNNING"; then
        echo "Service $service is not running"
        return 1
    fi
    return 0
}

# Check all services
check_service postgresql || exit 1
check_service redis || exit 1
check_service api || exit 1
check_service web || exit 1
check_service nginx || exit 1

# Check that API responds to health endpoint
if ! curl -sf http://localhost:3000/api/health > /dev/null 2>&1; then
    echo "API health check failed"
    exit 1
fi

exit 0
