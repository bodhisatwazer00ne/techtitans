LIFE RPG
Project Report
A Real-Life RPG Where Productivity Is the Gameplay
## 1. Introduction
Life RPG is a full-stack gamified productivity platform that transforms real-life tasks, habits, and personal goals into an RPG-style progression system. Instead of treating productivity as a conventional checklist, the system represents a user's progress through a persistent game character, attributes, experience points, levels, quests, rewards, equipment, achievements, rivals, and interactive battles.
The central idea is that real-world effort should create measurable in-game progression. Completing meaningful quests earns Character XP and relevant Attribute XP. Character XP determines the user's overall level, while Attribute XP develops specific capabilities such as Strength, Intelligence, Endurance, Resilience, Discipline, and Willpower. These attributes are not merely visual statistics: they influence the user's character, equipment, abilities, and turn-based combat.
The application uses a retro pixel-art RPG visual direction inspired by classic pixel-based monster-battling games, while using original characters, assets, terminology, and artwork. The battle system is secondary to real-life productivity: users cannot progress primarily by repeatedly fighting other users. This keeps the product focused on improving real-world habits and accomplishments.
## 2. Problem Statement
Traditional to-do lists, habit trackers, and productivity applications often reduce progress to checkboxes, percentages, and static statistics. Although these systems can record completed work, they may provide limited immediate feedback or a strong sense of progression.
The project addresses the problem of making everyday productivity more engaging by introducing game mechanics without allowing the game itself to replace the real-world activity. Users need a system in which completing tasks produces immediate feedback, visible character development, meaningful rewards, and long-term progression.
Because progression and competition can be manipulated in a client-side application, the platform also requires a secure backend, persistent database storage, authentication, server-side reward validation, and authoritative battle calculations.
## 3. Proposed Solution
Life RPG converts real-life activities into quests. A user creates or accepts a quest, completes the real-world activity, and submits the completion. The backend validates the operation and awards the configured Character XP, Attribute XP, and in-game currency.
The resulting progression changes the user's RPG character. As the character gains levels, attributes improve, new abilities and equipment can become available, and the user's profile visibly evolves. Users can maintain streaks, collect badges, purchase virtual items, compare their progress with other users, and challenge suitable rivals.
The system therefore creates a continuous loop:
Real Life Activity → Quest Completion → XP & Attribute Growth → Character Progression → Rewards & Equipment → Competition → Motivation
## 4. Objectives
• Convert real-life productivity into an engaging RPG progression system.
• Provide secure authentication and persistent cross-device user data.
• Implement task and quest creation, completion, editing, and deletion.
• Implement non-linear character leveling where higher levels require increasing XP.
• Develop six balanced primary attributes with distinct gameplay roles.
• Make attribute progression meaningful in the interactive battle system.
• Provide virtual currency, inventory, equipment, character designs, badges, and achievements.
• Provide streak tracking and progress visualization.
• Allow users to discover approximately 50 rivals near their current level.
• Provide global and attribute-specific leaderboards.
• Implement a server-authoritative turn-based battle system.
• Maintain responsive, accessible, and performant interfaces.
## 5. Target Users
The primary users are individuals who want to improve productivity, habits, study, exercise, personal projects, or other measurable real-life activities while enjoying a game-like progression experience.
The system is designed for users who are motivated by visible progression, achievement systems, collection, competition, and interactive feedback. It can support different lifestyles because quests and attribute mappings are not limited to a single type of activity.
## 6. Core Features
6.1 Authentication and User Accounts
Secure signup, login, logout, session handling, password protection, and cross-device persistence.
6.2 Quest and Task Management
Users can create, view, edit, delete, and complete quests. Quests contain a title, description, category, difficulty, completion state, XP rewards, attribute rewards, and relevant metadata.
6.3 Character Progression
Character XP controls the overall character level using a non-linear XP curve. Higher levels require progressively more XP.
6.4 Attribute System
Six primary attributes are used:
• Strength — physical attack power and weapon damage.
• Intelligence — special attacks, combo abilities, and advanced techniques.
• Endurance — maximum health/stamina and sustained activity.
• Resilience — damage reduction and recovery efficiency.
• Discipline — accuracy, action efficiency, and stamina management.
• Willpower — comeback mechanics, Second Wind, and low-health recovery potential.
All six attributes have distinct roles so that no single capability becomes the universal best choice.
6.5 Streaks
The platform records consecutive days of meaningful quest completion and provides visual feedback and achievement rewards for maintaining streaks.
6.6 Economy and Rewards
Users earn virtual currency or points through valid progression activities. Currency can be spent on virtual weapons, character designs, themes, effects, badges, and other cosmetic or gameplay-related items.
6.7 Inventory and Equipment
Collected items are persisted in the database. Users can inspect, equip, and change available equipment. Equipment can modify battle characteristics while remaining subordinate to real-life progression.
6.8 Achievements and Badges
Examples include First Quest, 7-Day Streak, Warrior, Scholar, Dedicated, and Legend. Achievements are displayed on the user's profile.
6.9 Interactive Turn-Based Battle
Battles are actual turn-based encounters. The player sees action buttons such as ATTACK, SPECIAL/COMBO, DEFEND, RECOVER, and ITEM. Each action consumes the appropriate turn and produces a visible battle result.
6.10 Rivals
Users can view roughly 50 users around their own level and challenge appropriate rivals. Rival discovery should use level proximity rather than exposing unrestricted user data.
6.11 Leaderboards
A global leaderboard provides competitive rankings. Separate attribute leaderboards can recognize different strengths without making one playstyle dominant.
6.12 Dashboard
The dashboard summarizes level, XP, attributes, streaks, quests, rewards, recent activity, and progression.
6.13 Character Profile
The profile displays the pixel character, level, XP progress, attributes, equipped items, badges, achievements, and visual progression.
6.14 Quest Board
A themed board presents available quests and lets users create their own real-life challenges.
6.15 Accessibility and Responsiveness
The application supports keyboard navigation, screen-reader-friendly structure, readable contrast, responsive layouts, accessible controls, and reduced-motion considerations.
## 7. Unique Selling Proposition
Life RPG differs from conventional productivity software by making productivity itself the source of game progression. The user does not grind the game to become productive; real-life accomplishments are the primary progression mechanism.
The strongest differentiator is the connection between real-world activities and a persistent RPG identity. A completed study session can develop Intelligence and Discipline, physical training can develop Strength and Endurance, and difficult long-term tasks can contribute to Resilience or Willpower. These improvements then have visible and functional consequences in the character and battle system.
## 8. Game Design and Attribute Mapping
Quest categories should map to one or more relevant attributes. For example:
• Gym/training quests → Strength + Endurance
• Coding/study quests → Intelligence + Discipline
• Difficult long-term challenges → Resilience + Willpower
• Consistent routine completion → Discipline + relevant activity attribute
A quest may award multiple attributes so users are not forced into a single specialization. Attribute XP and Character XP are separate. Character XP controls overall level, while Attribute XP controls individual capabilities.
The design must avoid a system in which one attribute dominates combat, progression, or leaderboard value.
## 9. Battle System
The battle system is an interactive, turn-based RPG mechanic inspired by classic turn-based monster-battling games. It is not an automatic comparison of two power scores.
During a player's turn, the interface provides explicit actions such as ATTACK, SPECIAL/COMBO, DEFEND, RECOVER, and ITEM. The player chooses an action, the server validates the action against the current battle state, calculates the result, and advances the battle.
Strength influences physical attacks and weapon damage. Intelligence influences special attacks and combo abilities. Endurance affects maximum HP and stamina. Resilience affects defensive strength and recovery. Discipline influences accuracy, efficiency, and resource management. Willpower provides controlled comeback mechanics such as Second Wind.
Combat should include controlled randomness rather than pure determinism. However, randomness must not overwhelm player decisions or attribute differences.
The backend remains authoritative. Clients must never be trusted to submit final damage, XP, health, currency, or battle outcomes. Battle state and results must be validated and persisted server-side.
Most importantly, PvP should not become the primary source of progression. Real-life quests remain the main progression engine.
## 10. System Architecture
The proposed architecture is a three-layer full-stack system:
Frontend:
React + TypeScript + Vite
Tailwind CSS
shadcn/ui / Radix-style accessible components
Framer Motion for transitions and feedback
Backend:
Node.js
Express
TypeScript
REST-style API modules
Authentication and authorization middleware
Server-side progression and battle logic
Database:
PostgreSQL
Prisma ORM
Conceptual flow:
User → React Frontend → Secure API → Express Backend → Business Logic → PostgreSQL
The frontend handles presentation and interaction. The backend owns authorization, quest completion validation, XP calculations, inventory transactions, leaderboard queries, and battle calculations. PostgreSQL stores historical and current state.
## 11. Database Design
The database should contain persistent entities similar to:
User
- id
- username
- email
- passwordHash
- level
- characterXp
- currency
- createdAt
- updatedAt
Attribute
- id
- userId
- strengthXp
- intelligenceXp
- enduranceXp
- resilienceXp
- disciplineXp
- willpowerXp
Quest
- id
- userId
- title
- description
- category
- difficulty
- status
- characterXpReward
- attribute rewards
- createdAt
- completedAt
QuestCompletion
- id
- questId
- userId
- completedAt
- validatedReward
Streak
- id
- userId
- currentStreak
- longestStreak
- lastCompletionDate
InventoryItem
- id
- userId
- itemId
- quantity
- acquiredAt
Item
- id
- name
- type
- description
- attributes/effects
- rarity
Equipment
- id
- userId
- equippedItemId or slot configuration
Achievement
- id
- name
- description
- requirement
UserAchievement
- id
- userId
- achievementId
- unlockedAt
Battle
- id
- playerId
- opponentId
- status
- currentTurn
- state
- result
- createdAt
- completedAt
BattleAction
- id
- battleId
- userId
- action
- turnNumber
- result
- createdAt
Leaderboard data can be calculated from authoritative user progression rather than maintained as an independently editable client value.
## 12. Functional Requirements
FR-01: The system shall allow users to register and authenticate securely.
FR-02: The system shall maintain authenticated sessions across supported devices.
FR-03: Users shall only access and modify their own quests and progression data.
FR-04: Users shall create, read, update, delete, and complete quests.
FR-05: The server shall validate quest completion before awarding rewards.
FR-06: The system shall calculate Character XP and non-linear levels.
FR-07: The system shall maintain independent XP for all six attributes.
FR-08: The system shall update streaks according to valid activity.
FR-09: The system shall award and persist virtual currency.
FR-10: Users shall view and manage their inventory and equipment.
FR-11: Users shall view achievements and badges.
FR-12: Users shall view their character and progression.
FR-13: The system shall provide an interactive turn-based battle interface.
FR-14: The battle interface shall expose actionable commands including attack, special/combo, defend, recover, and item where valid.
FR-15: The server shall validate every battle action and calculate combat results.
FR-16: The system shall persist battle history.
FR-17: Users shall discover nearby-level rivals and issue challenges.
FR-18: The system shall provide a global leaderboard.
FR-19: The system shall provide attribute-specific competitive rankings.
FR-20: The UI shall work on desktop and mobile layouts.
FR-21: Core interactions shall be keyboard accessible and screen-reader friendly.
## 13. Non-Functional Requirements
Security: Authentication, authorization, password hashing, input validation, protected endpoints, and server-authoritative progression.
Performance: Fast navigation, efficient database queries, minimal unnecessary API calls, optimized assets, and smooth animations.
Reliability: Transactions should prevent inconsistent XP, currency, inventory, or battle states.
Scalability: The architecture should allow additional users, quests, items, achievements, and battle records without redesigning the core system.
Maintainability: Frontend and backend should be modular, typed, documented, and separated by responsibility.
Accessibility: Keyboard navigation, semantic HTML, accessible labels, focus management, contrast, and reduced-motion support.
Responsiveness: Core workflows must remain usable across mobile, tablet, and desktop screen sizes.
## 14. Security and Anti-Cheat
Security is particularly important because the application contains progression, currency, leaderboards, and competitive battles.
The client must never be treated as authoritative for:
• XP totals
• Attribute values
• Currency balances
• Item ownership
• Damage values
• Battle outcomes
• Quest rewards
The server should validate authenticated ownership, quest state, reward rules, transaction limits, and battle state. Database transactions should be used where multiple related records must change together.
Passwords should be securely hashed. Authentication tokens or sessions should be protected, and sensitive cookies should use appropriate security flags. API input should be validated and protected against common attacks. Rate limiting should be considered for authentication, quest completion, challenge creation, and battle actions.
## 15. User Interface and Creative Direction
The visual identity should strongly resemble a polished retro pixel RPG rather than a generic SaaS dashboard.
Key visual principles:
• Pixel-art character presentation.
• RPG-style panels, cards, menus, and inventory screens.
• Thematic typography and terminology.
• XP bars, stat meters, badges, item rarity, and level-up feedback.
• Animated quest completion.
• XP gain particles and level-up effects.
• Battle animations and battle logs.
• Character and equipment visual progression.
• Clear hover, focus, pressed, success, and error states.
• Smooth transitions without sacrificing performance.
The design may be inspired by the visual language of classic pixel RPGs, but should use original assets and avoid copyrighted characters, logos, sprites, names, or direct copies.
## 16. Main Application Screens
1. Landing / Welcome Screen
2. Signup / Login
3. Dashboard
4. Quest Board
5. Quest Creation / Editing
6. Character Profile
7. Attribute Details
8. Inventory
9. Equipment
10. Achievements / Badges
11. Rivals
12. Battle Preparation
13. Live Turn-Based Battle
14. Battle Result / History
15. Global Leaderboard
16. Attribute Leaderboards
17. Settings / Account
## 17. Progression Flow
A typical user journey is:
1. User registers or logs in.
2. The dashboard displays the current character level and attributes.
3. The user creates or selects a real-life quest.
4. The user performs the activity in real life.
5. The user completes the quest in the application.
6. The backend validates the completion.
7. Character XP, Attribute XP, streaks, and currency are updated.
8. The character may level up.
9. New equipment, badges, effects, or abilities may become available.
10. The user can inspect progression and compare with rivals.
11. The user may participate in a turn-based battle.
12. Battle decisions use the user's earned attributes and equipment.
13. Battle history is stored.
14. The user's long-term progression continues primarily through real-life quests.
## 18. Competition and Leaderboards
The Rivals feature should show approximately 50 users whose levels are close to the current user's level. Each rival card can show a public username, level, selected character, major progression indicators, and an available challenge action.
The global leaderboard ranks users according to overall progression. Attribute leaderboards separately recognize Strength, Intelligence, Endurance, Resilience, Discipline, and Willpower.
Leaderboards should not expose private information. Ranking calculations must be based on server-side values and should not be editable by clients.
## 19. Rewards and Collection
Rewards should provide visible evidence of progression. The collection system can contain:
• Weapons
• Character designs
• Badges
• Themes
• Battle effects
• Cosmetic items
• Achievement rewards
Items should have clear descriptions and rarity or category information where appropriate. The inventory should make collection feel meaningful and visually rewarding.
## 20. Testing Strategy
Testing should cover both normal workflows and edge cases.
Authentication tests:
• Valid registration and login.
• Invalid credentials.
• Unauthorized API access.
• Session expiration.
Quest tests:
• CRUD operations.
• Completion validation.
• Duplicate completion prevention.
• Reward calculation.
• Ownership protection.
Progression tests:
• XP thresholds.
• Non-linear level calculations.
• Attribute XP updates.
• Streak rollover and missed days.
• Currency transactions.
Battle tests:
• Valid and invalid actions.
• Turn order.
• Health/stamina updates.
• Attribute effects.
• Special/combo availability.
• Defend/recover behavior.
• Item use.
• Battle completion.
• Disconnect/reconnect handling.
• Tampered client requests.
UI tests:
• Responsive layouts.
• Keyboard navigation.
• Accessible labels and focus.
• Loading, empty, success, and error states.
## 21. Constraints and Edge Cases
Important edge cases include duplicate quest submissions, repeated reward requests, simultaneous battle actions, stale battle states, interrupted sessions, invalid item usage, insufficient currency, attempts to equip unavailable items, abandoned battles, leaderboard ties, and network failures.
The system should fail safely. A client refresh or network interruption must not duplicate rewards or corrupt battle state. Database transactions and idempotent server operations should be used where required.
## 22. Deployment and Deliverables
The final project should contain a public GitHub repository with the frontend and backend, a clean commit history, README documentation, and an .env.example file without secrets.
The deployed application should have a functioning frontend, backend API, database connection, and authentication flow.
A walkthrough video should demonstrate:
• Signup/login
• Creating or adding a quest
• Completing a quest
• XP gain
• Level progression
• Persistence after refresh
• Character/stat progression
• A turn-based battle
• Competition/leaderboard features
The implementation must not depend on localStorage as the primary persistence mechanism.
## 23. Recommended Technology Stack
Frontend:
• React
• TypeScript
• Vite
• Tailwind CSS
• shadcn/ui or Radix-based components
• Framer Motion
Backend:
• Node.js
• Express
• TypeScript
Database:
• PostgreSQL
• Prisma ORM
Authentication:
• Secure session or JWT-based authentication
• HTTP-only cookies where applicable
• bcrypt or an equivalent password-hashing mechanism
Supporting technologies:
• REST API
• Environment variables
• Automated testing
• Production logging and error handling
## 24. Future Scope
Future versions can introduce guilds or parties, cooperative quests, seasonal events, procedural quests, additional character classes, more equipment types, boss encounters, achievement seasons, social groups, analytics, calendar integrations, optional AI-assisted quest suggestions, and more advanced battle mechanics.
The core principle should remain unchanged: meaningful real-world actions are the foundation of progression.
## 25. Conclusion
Life RPG combines productivity software with RPG progression to create a system in which real-life accomplishments directly develop a persistent virtual character. The project goes beyond a simple to-do list by connecting quests, XP, attributes, streaks, rewards, inventory, achievements, competition, and an interactive turn-based battle system.
Its most important design principle is balance. The six attributes have distinct but equally valuable purposes, and the battle system uses them as meaningful inputs without allowing combat to replace real-world productivity. The backend remains authoritative so that XP, currency, inventory, and battle results cannot be manipulated through the client.
With a strong pixel-art identity, persistent progression, interactive combat, competitive features, and secure full-stack architecture, Life RPG provides a cohesive gamified productivity experience rather than a conventional productivity dashboard.