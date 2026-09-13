# Life RPG

> Turn real-life goals into an RPG adventure.

Life RPG is a gamified productivity and personal development platform that turns everyday tasks into meaningful RPG progression. Instead of treating productivity as a simple checklist, Life RPG connects real-world actions with character growth, visual progression, achievements, streaks, inventory, and competitive stat-based battles.

The core idea is simple:

**Your real-life progress becomes your character's progression.**

## Overview

```text
Real-Life Activity
       |
       v
     Quest
       |
       v
   Completion
       |
       v
      XP
       |
       v
   Level Up
       |
       v
Avatar + Stats + Rewards
       |
       +-------------------+
       |                   |
       v                   v
Achievements          Arena Battles
                           |
                           v
                    Stat-Based Results
                           |
                           v
                     Battle Rewards
```

## Features

### Authentication and Account Management
- Email/password authentication.
- Google Sign-In support.
- Secure authenticated sessions.
- User-specific data isolation.
- Duplicate username prevention.
- Duplicate account/sign-in handling.
- Username availability checking and username changes.
- Player-data reset functionality.

### Quest System
- Create, view, edit, and delete quests.
- Organize quests by category and difficulty.
- Complete real-life activities through quests.
- Completing quests awards XP and contributes to character progression.
- Validation helps prevent invalid or duplicate quest actions.

### XP and Non-Linear Leveling
- XP-based character progression.
- Non-linear leveling where higher levels require progressively more XP.
- Level-ups provide progression rewards.
- Player level directly contributes to Arena performance.
- Long-term consistency becomes increasingly meaningful as progression continues.

### Character Attributes
Players develop their character through multiple attributes:

- Strength
- Intelligence
- Endurance
- Resilience
- Discipline
- Willpower
- Creativity

Different quest categories can contribute to different attributes, allowing real-life activities to shape the player's RPG profile.

### Avatar Progression
- Avatar upgrades as the player's level increases.
- Visual character progression reflects gameplay progression.
- Character development is connected to overall player progress.

### Daily Streaks
- Track daily activity and consistency.
- Maintain everyday streaks.
- Streaks encourage long-term engagement.
- Streak milestones contribute to achievements and progression.

### Inventory and Equipment
- Collect items and equipment through progression.
- Manage unlocked rewards and collectibles.
- Equipment can contribute to character statistics and Arena performance.

### Achievements and Badges
Achievements reward milestones such as:
- Quest completion.
- Level progression.
- Daily streaks.
- Attribute growth.
- Difficult quests.
- Arena and battle performance.
- Other progression milestones.

# Arena and Stat-Based Battles

The Arena is one of the core gameplay features of Life RPG.

Unlike a traditional turn-based combat system, Life RPG uses **level-based and stat-based battles**. The player's real-life progression directly influences their competitive performance.

### How Arena Battles Work

- Player level is a major factor in battle calculations.
- Character attributes influence battle performance.
- Equipment and character progression can affect battle statistics.
- Battle outcomes are calculated from player progression and stats.
- Critical-hit and other controlled gameplay mechanics can add variation.
- Successful battles provide battle rewards.
- Battles are not turn-based.
- Battles are not simultaneous real-time multiplayer combat.

This creates a direct connection between productivity and competition: **the stronger your real-life progression, the stronger your character becomes in the Arena.**

## Rivals and Leaderboards

- Compare progression with other players.
- Track rankings and competitive statistics.
- View rival performance and battle history.
- Use leaderboards as an additional motivation layer.
- Arena performance is connected to player level and character statistics.

## Retro RPG Experience

Life RPG uses a cohesive retro RPG-inspired interface to make progression feel immediate and engaging.

- Pixel-inspired visual design.
- CRT display mode.
- Retro RPG sound effects.
- Animations and interactive feedback.
- Level-up and reward effects.
- Tactile interactions throughout the application.
- Consistent RPG styling across quests, character, inventory, achievements, and Arena.

## Responsive and Accessible UI

- Responsive layouts for desktop and smaller screens.
- Clear navigation and interactive controls.
- Keyboard-friendly interactions.
- Readable UI and accessible content structures.
- Designed to remain usable across different screen sizes.

## Robustness and Edge Cases

The application handles common edge cases including:

- Invalid quest submissions.
- Duplicate quest completion attempts.
- XP and level boundaries.
- Streak date handling.
- Invalid progression states.
- Authentication failures.
- Duplicate usernames and account conflicts.
- Missing or inconsistent player data.
- Protected user-specific operations.

---

## Product Flow

1. Create an account or sign in.
2. Set up and view your character.
3. Create or select a real-life quest.
4. Complete the activity in real life.
5. Mark the quest as complete.
6. Earn XP and progress character attributes.
7. Maintain daily streaks.
8. Unlock achievements, rewards, items, and equipment.
9. Level up and evolve the avatar.
10. Compare progress through Rivals and Leaderboards.
11. Enter the Arena.
12. Fight using level, attributes, and equipment.
13. Receive battle rewards and continue progressing.

---

## Architecture

Life RPG follows a layered architecture that separates the user interface, application logic, authentication, and persistent game data.

```text
                    Life RPG
                       |
                       v
              React Frontend
                       |
        +--------------+--------------+
        |              |              |
        v              v              v
     Quests        Character        Arena
        |              |              |
        +--------------+--------------+
                       |
                       v
             Application Services
                       |
      +----------------+----------------+
      |                |                |
      v                v                v
 Authentication    Game Logic       Data Services
      |                |                |
      |        +-------+-------+        |
      |        |       |       |        |
      |        v       v       v        |
      |     XP/Level  Stats  Battles    |
      |                                |
      +---------------+----------------+
                      |
                      v
             Firebase Services
              |             |
              v             v
      Firebase Auth     Firestore
                            |
                            v
                  Persistent Player Data
```

### Frontend Layer

The React frontend provides the interactive RPG experience and contains the major application areas such as:

- Dashboard
- Quests
- Character
- Inventory
- Achievements
- Arena
- Rivals
- Leaderboards
- Settings
- Authentication and onboarding

### Application Services Layer

Application services handle the core gameplay and application logic, including:

- Authentication
- Quest management
- XP and level progression
- Character attributes
- Streak calculations
- Rewards
- Inventory and equipment
- Battle calculations
- Avatar progression
- Audio and RPG interactions

### Backend Layer

The Node.js and Express layer supports backend application functionality and provides a structured server-side layer for the application.

### Firebase Layer

Firebase provides:

- Authentication through Firebase Authentication.
- Persistent application data through Firestore.
- User data protection through Firestore Security Rules.

---

## Database Schema

Life RPG uses Firebase Authentication for identity management and Firebase Firestore for persistent application data.

### Core Data Model

```text
User
|
+-- Profile
|   +-- Username
|   +-- Account Settings
|
+-- Character
|   +-- Level
|   +-- XP
|   +-- Attributes
|   +-- Avatar Progression
|
+-- Quests
|   +-- Quest Completions
|
+-- Streaks
|
+-- Inventory
|   +-- Equipment
|
+-- Achievements
|
+-- Battles
|   +-- Battle Results
|   +-- Battle Rewards
|
+-- Rivals / Leaderboard Data
```

### Character Attributes

```text
Character
|
+-- Strength
+-- Intelligence
+-- Endurance
+-- Resilience
+-- Discipline
+-- Willpower
+-- Creativity
```

Firestore Security Rules are used to protect user-specific data and prevent unauthorized access.

---

## Environment Variables

The project uses environment variables for Firebase and application configuration. A `.env.example` file is included in the repository as a template.

Create a local `.env` file from `.env.example`:

```bash
cp .env.example .env
```

Configure the Firebase project values required by the application.

Example structure:

```env
VITE_FIREBASE_API_KEY=your_firebase_api_key
VITE_FIREBASE_AUTH_DOMAIN=your_firebase_auth_domain
```

If additional server-side environment variables are required by the current deployment configuration, they should also be added to the `.env` file and configured in the deployment environment.

Do not commit `.env` or real credentials to the repository. Use `.env.example` to document required variable names without exposing secrets.

---

## Technology Stack

### Frontend

- React
- TypeScript
- Vite
- Tailwind CSS
- Motion / Animations
- Lucide React

### Backend

- Node.js
- Express
- TypeScript

### Authentication and Database

- Firebase Authentication
- Firebase Firestore
- Firestore Security Rules

### Deployment

- Render

---

## Project Structure

```text
src/
├── achievements/
├── arena/
├── auth/
├── battle/
├── character/
├── components/
├── context/
├── dashboard/
├── leaderboard/
├── navigation/
├── onboarding/
├── quests/
├── rivals/
├── rpg/
├── services/
├── settings/
└── types/

server.ts
firestore.rules
.env.example
```

---

## Installation

### Prerequisites

- Node.js
- npm
- Firebase project

### Clone the Repository

```bash
git clone https://github.com/bodhisatwazer00ne/techtitans.git
cd techtitans
```

### Install Dependencies

```bash
npm install
```

### Configure Environment Variables

Create a `.env` file from `.env.example` and add the required Firebase and application configuration.

```bash
cp .env.example .env
```

### Run Locally

```bash
npm run dev
```

### Build for Production

```bash
npm run build
```

---

## Deployment

The Life RPG application is deployed on **Render**.

### Live Application

https://liferpg-jl3p.onrender.com/

### Source Code

https://github.com/bodhisatwazer00ne/techtitans.git

The production deployment uses the configured environment variables and Firebase services required by the application.

---

## Security

Life RPG uses authentication and database security mechanisms to protect player data.

Security considerations include:

- Authenticated access to protected features.
- User-specific data isolation.
- Firebase Authentication.
- Firestore Security Rules.
- Username uniqueness validation.
- Input and gameplay validation.
- Protection against unauthorized player-data access.
- Handling of authentication and account conflicts.
- Environment variables for configuration and sensitive values.

---

## Design Philosophy

Life RPG is built around one central idea:

> Productivity should feel like progression rather than a chore.

The application combines real-world tasks with immediate game-like feedback:

```text
Real-Life Action
      |
      v
    Quest
      |
      v
     XP
      |
      v
 Character Growth
      |
      v
   Level Up
      |
      +---------> Avatar Progression
      |
      +---------> Attribute Growth
      |
      +---------> Achievements
      |
      +---------> Arena Strength
```

The Arena reinforces this loop by turning the player's accumulated progression into measurable stat-based competitive performance.

---

## Team

### Tech Titans

| Role | Name |
|---|---|
| Team Leader | Krishna Sapkal |
| Team Member | Waghmare Bodhisatwa |
| Team Member | Shubham Kharat |
| Team Member | Prashik Teleng |

---

## Project Links

- Live Application: https://liferpg-jl3p.onrender.com/
- GitHub Repository: https://github.com/bodhisatwazer00ne/techtitans.git

---

## Life RPG

**Your real life is the game.  
Your progress is your character.**
