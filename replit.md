# MetalWorks Industrial Safety Monitor

A full-stack AI-Based Industrial Safety Monitoring System with real-time camera feed monitoring, PPE compliance tracking, IoT sensor monitoring, and automated safety alerts.

## Run & Operate

- `pnpm --filter @workspace/api-server run dev` — run the API server (port 8080, serves `/api` and `/ws`)
- `pnpm --filter @workspace/safety-monitor run dev` — run the frontend (port 20053, serves `/`)
- `pnpm run typecheck` — full typecheck across all packages
- `pnpm run build` — typecheck + build all packages
- `pnpm --filter @workspace/api-spec run codegen` — regenerate API hooks and Zod schemas from the OpenAPI spec

## Login Credentials (mock)

- Admin: `admin` / `admin123`
- Supervisor: `supervisor` / `super123`
- Viewer: `viewer` / `view123`

## Stack

- pnpm workspaces, Node.js 24, TypeScript 5.9
- Frontend: React + Vite + Tailwind CSS + Wouter routing + Recharts
- API: Express 5 + WebSocket (ws)
- Mock data: In-memory (no DB required for mock mode)
- API codegen: Orval (from OpenAPI spec)

## Where things live

- `lib/api-spec/openapi.yaml` — OpenAPI spec (source of truth for all contracts)
- `lib/api-client-react/src/generated/` — generated React Query hooks
- `lib/api-zod/src/generated/` — generated Zod schemas (used by server)
- `artifacts/api-server/src/lib/mock-data.ts` — all mock data (workers, cameras, zones, sensors, alerts)
- `artifacts/api-server/src/lib/websocket.ts` — WebSocket server (broadcasts live feed, sensors, alerts)
- `artifacts/api-server/src/routes/` — route handlers (one file per domain)
- `artifacts/safety-monitor/src/` — React frontend (pages, components, hooks)

## Pages

- `/login` — Authentication
- `/dashboard` — Main command center: live camera feeds with detection overlays, stats, IoT sensors, active alerts
- `/workers` — Worker management (RFID, PPE status, compliance history)
- `/cameras` — Camera CRUD + zone mapping
- `/zones` — Safety zone management with polygon visualizer
- `/alerts` — Alert management (acknowledge/resolve, voice alert text)
- `/warning-logs` — Full PPE violation audit log
- `/reports` — Analytics: compliance trend charts, zone/worker violation breakdowns
- `/sensors` — Live sensor monitoring with 48h history charts
- `/settings` — System configuration (factory info, voice alerts, thresholds)

## Architecture decisions

- **Mock-first**: All data is in-memory in `mock-data.ts`. No DB is needed. Replace mock functions with real DB queries to integrate actual hardware.
- **WebSocket at `/ws`**: Broadcasts live updates every 3-5s. Frontend supplements with polling for resilience.
- **TTS alerts**: Uses Web Speech API (`window.speechSynthesis`) — browser-native, no external service needed.
- **Auth**: Simple token-based mock auth. Tokens stored in `localStorage` under `auth_token`. Replace with real JWT/session auth when hardening.
- **OpenAPI-first**: All contracts defined in `lib/api-spec/openapi.yaml`. Run codegen after any spec change.

## Integration points (future)

- Replace `generateLiveFeed()` in `mock-data.ts` with real YOLOv8 + ByteTrack output
- Replace `getLiveSensorReadings()` with ESP32/MQTT sensor data
- Replace RFID association logic in `mock-data.ts` with real RFID reader output
- Swap in-memory stores for PostgreSQL + Drizzle ORM using the existing `lib/db` package

## User preferences

- Dark professional UI (dark mode only, no toggle)
- Primary accent: amber #F59E0B
- Danger: red #EF4444, Success: green #22C55E
