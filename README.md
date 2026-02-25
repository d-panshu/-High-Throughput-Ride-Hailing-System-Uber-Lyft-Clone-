# 🚗 RideHail System — FAANG-Level Architecture

A production-grade Uber/Lyft clone demonstrating:
- **Event Streaming** with Kafka
- **Geospatial Indexing** with MongoDB 2dsphere
- **Real-time WebSockets** with Socket.io
- **Microservices** with Docker Compose
- **The Thundering Herd** mitigation pattern

---

## Architecture

```
[Driver App / Test Client]
        │ WebSocket
        ▼
[Driver Service :3001]
  - Socket.io server
  - Rate limiting (token bucket)
  - Input validation
        │ Kafka: driver-locations topic
        ▼
[Apache Kafka :9092]
  - Partitioned by driverId
  - Ordered delivery per driver
        │
        ▼
[Consumer Service]
  - Kafka consumer group
  - Geospatial matching
        │ MongoDB upsert
        ▼
[MongoDB :27017]
  - 2dsphere index on location
  - TTL index: auto-expire offline drivers
```

---

## Phase Roadmap

| Phase | Status | What's Built |
|-------|--------|-------------|
| 1 | 🔜 | Docker infra, Driver WebSocket service, Kafka producer, Consumer service |
| 2 | 🔜 | Rider API, ride request flow |
| 3 | 🔜 | Matching engine: consumer triggers real-time match notifications |
| 4 | 🔜 | React frontend: live map with MapLibre |
| 5 | 🔜 | Nginx load balancer + Node.js cluster |
| 6 | 🔜 | Auth: JWT for drivers and riders |
| 7 | 🔜 | Observability: Prometheus + Grafana |

---

## Quick Start

### Prerequisites
- Docker Desktop 4.x+
- Node.js 20+ (for running test scripts locally)

### 1. Start all infrastructure

```bash
docker compose up -d
```

Wait ~30 seconds for Kafka to fully initialize.

### 2. Verify everything is healthy

```bash
# Check all containers are running
docker compose ps

# Expected output:
# ridehail-zookeeper    running (healthy)
# ridehail-kafka        running (healthy)
# ridehail-kafka-ui     running
# ridehail-mongodb      running (healthy)
# ridehail-driver-service  running
# ridehail-consumer-service running
```

### 3. Check driver service health

```bash
curl http://localhost:3001/health/ready | jq
```

Expected:
```json
{
  "service": "driver-service",
  "status": "healthy",
  "checks": {
    "kafka": { "status": "ok" },
    "mongodb": { "status": "ok" }
  }
}
```

### 4. Open Kafka UI

Visit http://localhost:8080 — you'll see the `driver-locations` topic.

### 5. Simulate a driver

```bash
# Install socket.io-client for the test script
cd scripts && npm install socket.io-client

# Run the driver simulator
node scripts/test-driver-client.js
```

### 6. Watch messages flow

In Kafka UI → Topics → `driver-locations` → Messages tab.
You'll see real-time location events appear.

```bash
# Check MongoDB got updated
docker exec -it ridehail-mongodb mongosh ridehail --eval \
  "db.drivers.find({}, {driverId:1, status:1, location:1, updatedAt:1}).pretty()"
```

---

## Debugging Guide (Senior SWE Playbook)

### Problem: Kafka consumer not receiving messages

```bash
# 1. Check consumer group lag
docker exec -it ridehail-kafka kafka-consumer-groups \
  --bootstrap-server localhost:9092 \
  --group location-processor-group \
  --describe

# Look for LAG column. 0 = caught up. >0 = falling behind.

# 2. Check if topic exists and has messages
docker exec -it ridehail-kafka kafka-topics \
  --bootstrap-server localhost:9092 \
  --list

# 3. Manually consume from topic to see raw messages
docker exec -it ridehail-kafka kafka-console-consumer \
  --bootstrap-server localhost:9092 \
  --topic driver-locations \
  --from-beginning \
  --max-messages 5
```

### Problem: MongoDB geospatial queries returning no results

```bash
# 1. Verify 2dsphere index exists
docker exec -it ridehail-mongodb mongosh ridehail --eval \
  "db.drivers.getIndexes()"

# 2. Check coordinate order! GeoJSON uses [lng, lat] NOT [lat, lng]
# Test a $nearSphere query manually:
docker exec -it ridehail-mongodb mongosh ridehail --eval "
  db.drivers.find({
    status: 'available',
    location: {
      \$nearSphere: {
        \$geometry: { type: 'Point', coordinates: [77.2090, 28.6139] },
        \$maxDistance: 5000
      }
    }
  }).pretty()
"

# 3. Check if driver docs have valid location format
docker exec -it ridehail-mongodb mongosh ridehail --eval \
  "db.drivers.findOne({driverId: 'driver-001'})"
```

### Problem: WebSocket connections dropping

```bash
# Check driver service logs
docker logs ridehail-driver-service --tail=50 -f

# Check if rate limiting is triggering
# Look for "RATE_LIMITED" in logs

# Test raw WebSocket connection
wscat -c ws://localhost:3001/socket.io/?transport=websocket
```

### Problem: Service won't start (dependency issue)

```bash
# Force recreate with fresh state
docker compose down -v  # -v removes volumes (resets Kafka + MongoDB!)
docker compose up -d

# Tail all logs simultaneously
docker compose logs -f
```

---

## Key Engineering Decisions

### Why Kafka instead of direct MongoDB writes?

Driver apps send GPS updates every 1-2 seconds. At 1,000 concurrent drivers, that's 500-1,000 writes/second to MongoDB. MongoDB can handle this at small scale, but Kafka gives us:

1. **Buffering**: Kafka absorbs traffic spikes. MongoDB gets steady writes.
2. **Multiple consumers**: Future services (analytics, fraud detection) can independently consume the same stream.
3. **Replay**: Can reprocess historical location data.

### Why partition by driverId?

Kafka partitions by message key. Using driverId means:
- All updates for driver-001 go to the same partition
- The consumer sees them in chronological ORDER
- No out-of-order GPS coordinates causing map jitter

### Why GeoJSON [lng, lat] and not [lat, lng]?

MongoDB follows the GeoJSON spec (RFC 7946) which specifies `[longitude, latitude]`. This is the OPPOSITE of how most humans think (we say "lat/lng"). This trips up every developer at some point. The 2dsphere index will silently produce wrong results if you swap them.

### Why a TTL index on drivers?

If a driver's app crashes without sending an "offline" status, their document would remain with `status: "available"` forever. Riders would be matched to phantom drivers. The TTL index (5 minutes) automatically deletes stale driver records, fixing this without any cleanup job.
