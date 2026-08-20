 # 🦺 AI-Powered Industrial Safety Monitoring System

An AI-based Industrial Safety Monitoring System that detects Personal Protective Equipment (PPE) violations in real time and instantly alerts workers through IoT devices. The system combines Computer Vision, Web Technologies, and Embedded Hardware to improve workplace safety, reduce accidents, and ensure PPE compliance in industrial environments.

---

## 📌 Problem Statement

Industrial workers are required to wear safety equipment such as helmets and safety vests. Manual monitoring is inefficient, time-consuming, and prone to human error. This project automates PPE compliance monitoring using Artificial Intelligence and instantly alerts workers whenever a safety violation is detected.

---

## 🎯 Objectives

- Detect workers in real time.
- Identify helmets and safety vests.
- Detect PPE violations instantly.
- Count workers inside factory zones.
- Maintain violation history.
- Notify workers through IoT devices.
- Display live monitoring dashboard.
- Provide real-time alerts to supervisors.

---

# 🚀 Features

## AI-Based PPE Detection

- Helmet Detection
- Safety Vest Detection
- Worker Detection
- PPE Compliance Verification

## Real-Time Monitoring

- Live Dashboard
- Live Worker Count
- Real-Time Alerts
- Violation Tracking

## IoT-Based Worker Alerts

- OLED Display Notifications
- Buzzer Alert
- Vibration Alert
- Alert Acknowledgement Button

## Data Management

- Worker Records
- Violation History
- Detection Logs
- Compliance Reports

---

# 🛠️ Technology Stack

## Frontend

| Technology | Purpose |
|------------|----------|
| React.js | Dashboard User Interface |
| TypeScript | Type Safety and Maintainability |
| Vite | Fast Development and Build Tool |
| Tailwind CSS | Responsive UI Design |
| Wouter | Client-Side Routing |
| React Query | API Data Management |
| WebSocket Client | Real-Time Dashboard Updates |

---

## Backend

| Technology | Purpose |
|------------|----------|
| Node.js | Server Runtime Environment |
| Express.js | REST API Development |
| TypeScript | Backend Type Safety |
| Axios | ESP32/ESP8266 Communication |
| WebSocket Server | Real-Time Event Streaming |

---

## AI & Computer Vision

| Technology | Purpose |
|------------|----------|
| Roboflow | Dataset Collection and Annotation |
| YOLOv11 | Real-Time PPE Object Detection |
| Roboflow Inference API | Model Hosting and Inference |
| PPE Detection Logic | Compliance Verification |
| Worker Mapping Engine | Worker Identification |

---

## Database

| Technology | Purpose |
|------------|----------|
| SQLite | Local Data Storage |
| Drizzle ORM | Type-Safe Database Operations |

---

## IoT Hardware

| Component | Purpose |
|-----------|---------|
| ESP8266 / ESP32 | Wireless Alert Controller |
| OLED Display | Display Safety Messages |
| Buzzer | Audible Warning |
| Vibration Motor | Personal Alert System |
| Push Button | Alert Acknowledgement |

---

# ⚙️ System Workflow

1. Camera continuously captures video from the industrial workspace.
2. Video frames are sent to the Roboflow-hosted YOLOv11 model.
3. YOLOv11 detects:
   - Person
   - Safety Helmet
   - Safety Vest
4. PPE Detection Logic verifies whether every worker is wearing the required PPE.
5. If a violation is detected:
   - Detection details are sent to the backend.
   - Violation record is stored in SQLite.
   - Dashboard receives a real-time notification through WebSocket.
   - Backend sends an HTTP request to ESP8266/ESP32.
6. ESP8266/ESP32 activates:
   - OLED Display
   - Buzzer
   - Vibration Motor
7. Worker receives the alert and wears the missing PPE.
8. AI model rechecks compliance status.
9. If compliance is restored:
   - Alert is cleared.
   - Dashboard updates automatically.
   - Hardware alert is turned off.
10. Dashboard displays:
    - No PPE Violations Detected

---

# 🔔 Alert Mechanism

### Helmet Missing

OLED Display:

HELMET MISSING

Actions:
- Buzzer ON
- Vibration Motor ON

---

### Vest Missing

OLED Display:

VEST MISSING

Actions:
- Buzzer ON
- Vibration Motor ON

---

### PPE Compliant

OLED Display:

SAFE

Actions:
- Buzzer OFF
- Vibration Motor OFF

---

# 🌐 REST API Endpoints

## Detection API

POST /api/detections

Stores AI detection results.

---

## Violation API

POST /api/violations

Stores PPE violation records.

---

## Worker API

GET /api/workers

Retrieves worker information.

---

## ESP Alert API

GET /alarm

Triggers the ESP8266/ESP32 hardware alert system.

---

# 🔄 Real-Time Communication

WebSocket is used for:

- Live Worker Count Updates
- PPE Detection Updates
- Active Violation Notifications
- Dashboard Synchronization
- Alert Status Changes

---

# 📊 Dashboard Modules

## Dashboard

- Live Camera Feed
- Worker Count
- Active Violations
- Compliance Percentage

## Worker Management

- Worker Profiles
- Worker ID Mapping
- Department Assignment

## Violation Logs

- Helmet Violations
- Vest Violations
- Timestamps
- Resolution Status

## Device Monitoring

- ESP Device Status
- Connection Status
- Alert History

## Settings

- Camera Configuration
- Device Registration
- Alert Preferences

---

# 🏗️ System Architecture

```text
┌─────────────────────────────────────────────┐
│                  CAMERA FEED                │
└───────────────────┬─────────────────────────┘
                    │
                    ▼
┌─────────────────────────────────────────────┐
│            ROBOFLOW + YOLOv11               │
│                                             │
│ Detect Person                               │
│ Detect Helmet                               │
│ Detect Safety Vest                          │
└───────────────────┬─────────────────────────┘
                    │
                    ▼
┌─────────────────────────────────────────────┐
│          PPE DETECTION ENGINE               │
│                                             │
│ Helmet Present?                             │
│ Vest Present?                               │
│ Worker Count                                │
│ Worker Mapping                              │
└───────────────────┬─────────────────────────┘
                    │
                    ▼
┌─────────────────────────────────────────────┐
│         NODE.JS + EXPRESS BACKEND           │
│                                             │
│ REST APIs                                   │
│ WebSocket Server                            │
│ Alert Manager                               │
│ ESP Communication Service                   │
└──────┬──────────────────┬───────────────────┘
       │                  │
       │                  │
       ▼                  ▼

┌────────────────┐  ┌─────────────────────────┐
│ SQLite DB      │  │ React Dashboard         │
│                │  │                         │
│ Workers        │  │ Live Feed               │
│ Violations     │  │ Worker Count            │
│ Logs           │  │ PPE Status              │
└────────────────┘  │ Alerts                  │
                    └─────────────────────────┘
                               ▲
                               │
                               │ WebSocket
                               │
                               ▼

                ┌─────────────────────────┐
                │ ESP8266 / ESP32         │
                │                         │
                │ OLED Display            │
                │ Buzzer                  │
                │ Vibration Motor         │
                │ Push Button             │
                └───────────┬─────────────┘
                            │
                            ▼

                ┌─────────────────────────┐
                │      WORKER ALERT       │
                │                         │
                │ Helmet Missing          │
                │ Vest Missing            │
                │ Safety Warning          │
                └─────────────────────────┘
```

---

# 📈 Future Enhancements

- Face Recognition for Worker Identification
- Multiple Camera Support
- SMS Notifications
- WhatsApp Alerts
- Mobile Application
- Cloud Deployment
- Predictive Safety Analytics
- Compliance Reporting Dashboard
- Heatmap-Based Safety Monitoring
- Edge AI Deployment using ESP32-CAM

---

# 🏭 Industrial Use Cases

- Manufacturing Plants
- Construction Sites
- Chemical Industries
- Warehouses
- Mining Operations
- Oil and Gas Facilities
- Power Plants
- Heavy Engineering Industries

---

# 👥 Team Roles

### Frontend Developer
- Dashboard Development
- UI/UX Design
- WebSocket Integration

### Backend Developer
- REST API Development
- Database Integration
- ESP Communication Service

### AI/ML Engineer
- Dataset Collection
- Model Training
- PPE Detection Logic

### IoT Engineer
- ESP8266 Programming
- Hardware Integration
- Alert System Development

---

# 🎯 Expected Impact

- Improved Worker Safety
- Reduced Workplace Accidents
- Faster Violation Response Time
- Automated PPE Compliance Monitoring
- Increased Safety Awareness
- Better Regulatory Compliance
- Real-Time Industrial Safety Management
