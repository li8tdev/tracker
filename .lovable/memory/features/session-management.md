---
name: Session Management
description: Start/End Day lifecycle, productivity tracking, daily resets with historical preservation
type: feature
---
- 'Iniciar Día' starts session timer and enables Workana reminders
- 'Terminar Día' creates fresh copies of daily tasks for tomorrow, preserving yesterday's completed records as historical snapshots
- Daily tasks are NOT mutated in-place; each day gets its own task copies with unique IDs
- Streaks and analytics read from historical task copies by date field
- Session state stored in localStorage with UTC-5 day boundary expiry
