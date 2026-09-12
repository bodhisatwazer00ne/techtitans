LIFE RPG
Functional Requirements Report
Project Type: Full-Stack Gamified Productivity and Real-Life Progression Platform
Core Concept: Real-life tasks become quests that develop a player's RPG character.
Battle Model: Interactive, turn-based RPG combat where character attributes directly influence gameplay.
1. Introduction
Life RPG is a full-stack gamified productivity application that converts real-world activities into quests, progression,
character development, rewards, and competitive gameplay. Instead of treating productivity as a conventional list
of tasks, the system represents completed real-life activities as progression actions for a game-like character.
Users earn experience points, improve attributes, unlock equipment and character designs, maintain streaks, and
participate in competitive turn-based battles.
The application follows a retro pixelated RPG direction inspired by classic role-playing games. The battle system is
interactive and turn-based: players select actions such as Attack, Special, Defend, Recover, or Use Item. The
outcome of these actions is influenced by the character's attributes, equipment, abilities, current battle state, and
controlled randomness. The backend remains authoritative over progression and combat to prevent users from
manipulating XP, statistics, inventory, or battle results.
2. Functional Requirements
The following requirements define the functional behavior expected from the Life RPG system. Each requirement
identifies a capability that the software must provide to its users.
FR-01: User Registration
The system shall allow a new user to create an account using required registration information. The backend shall
validate the submitted information and securely store account credentials.
FR-02: User Login
The system shall authenticate registered users and establish a secure session. Invalid credentials shall result in an
appropriate error without exposing sensitive authentication information.
FR-03: User Logout
The system shall allow an authenticated user to log out and invalidate the active session.
FR-04: User Authorization
The system shall restrict users to their own quests, progression data, inventory, character information, and other
private records. Authorization shall be enforced on the backend rather than relying only on the client.
FR-05: Character Creation
The system shall create a game character associated with the user's account. The character shall have a level,
experience points, attributes, equipment state, and visual identity.
FR-06: Character Attribute Management
The system shall maintain character attributes including Intelligence, Strength, Endurance, Resilience, Discipline,
and Willpower. Additional attributes may be introduced without changing the core progression model.
FR-07: Quest Creation
The system shall allow users to create real-life quests/tasks with information such as title, description, category,
difficulty, and applicable rewards.
FR-08: Quest Viewing
The system shall display active, completed, and relevant quest information to the authenticated user.
FR-09: Quest Updating
The system shall allow users to modify their own editable quest information before completion, subject to validation
and anti-cheat rules.
FR-10: Quest Deletion
The system shall allow users to delete eligible quests belonging to their own account.
FR-11: Quest Completion
The system shall allow a user to mark an eligible quest as completed. The backend shall validate ownership,
completion state, and reward eligibility before granting progression.
FR-12: XP Calculation
The system shall calculate experience rewards using server-side rules based on quest properties and applicable
progression rules. The client shall not be trusted to submit arbitrary XP values.
FR-13: Overall Character Leveling
The system shall increase the character's overall level when the required XP threshold is reached. The XP
requirement shall be non-linear so that higher levels require progressively more experience.
FR-14: Attribute XP
The system shall award attribute-specific progression from completed quests. A quest may contribute to one or
multiple relevant attributes depending on its category and configured reward mapping.
FR-15: Attribute Level-Up
The system shall increase individual attribute levels when their corresponding attribute XP reaches the required
threshold. Attribute progression shall be independent enough to support different character builds.
FR-16: Equipment Unlocking
The system shall unlock weapons or other equipment when users satisfy the required level, attribute, achievement,
or progression conditions.
FR-17: Character Design Unlocking
The system shall allow users to unlock and select alternative character designs, visual effects, or cosmetic
appearances earned through progression.
FR-18: Streak Tracking
The system shall track consecutive days or configured periods in which the user completes qualifying quests. The
system shall update streak status consistently using server-side timestamps and rules.
FR-19: Currency System
The system shall maintain an in-game currency or points balance that can be earned through qualifying activities
and spent on eligible virtual rewards.
FR-20: Reward System
The system shall grant virtual rewards such as currency, equipment, badges, character designs, effects, or other
unlockable items based on configured conditions.
FR-21: Inventory Management
The system shall maintain a persistent inventory containing items owned by the user. Users shall be able to
inspect eligible items and equip or unequip supported equipment.
FR-22: Badge and Achievement System
The system shall award badges or achievements for milestones such as completing initial quests, maintaining
streaks, reaching progression milestones, or meeting other defined conditions.
FR-23: Turn-Based Battle System
The system shall provide an interactive turn-based battle mode. Battles shall alternate between the player's turn
and the opponent's turn until a defined victory, defeat, or other terminal condition occurs.
FR-24: Battle Turn Management
The system shall maintain the current battle state and identify whose turn it is. A player shall not perform actions
outside their permitted turn.
FR-25: Attack Action
During the player's turn, the system shall provide an Attack action. Selecting Attack shall execute a normal combat
move using the player's relevant attributes, equipped weapon, and battle state.
FR-26: Special and Combo Actions
The system shall provide special or combo actions when the character has unlocked the required ability.
Intelligence shall contribute to the effectiveness and availability of special/combo abilities.
FR-27: Defense Action
The system shall provide a Defend action that changes the player's defensive state for the applicable turn or
duration. The effectiveness of defense shall depend on defined combat rules and relevant attributes.
FR-28: Recovery Action
The system shall provide a Recover action when permitted. Recovery may restore health or stamina according to
the character's attributes, current state, and battle rules.
FR-29: Item Usage
The system shall allow eligible consumable or battle items to be used during a player's turn, subject to inventory
ownership, item restrictions, cooldowns, and battle-state validation.
FR-30: Attribute-Based Combat Calculation
The system shall use character attributes as active inputs to combat calculations. Battle outcomes shall not be
determined solely by overall character level.
FR-31: Strength-Based Combat
Strength shall influence physical attack power, including the effectiveness of normal attacks and strength-oriented
weapons.
FR-32: Intelligence-Based Combat
Intelligence shall influence special abilities, combo attacks, ability effectiveness, and/or access to advanced
combat techniques.
FR-33: Endurance-Based Combat
Endurance shall influence maximum health, stamina, action capacity, or the ability to sustain prolonged combat
according to the implemented combat model.
FR-34: Resilience-Based Combat
Resilience shall influence resistance to damage and recovery-related mechanics, reducing the impact of incoming
attacks or improving recovery effectiveness according to defined rules.
FR-35: Discipline-Based Combat
Discipline shall influence combat efficiency, accuracy, action reliability, stamina management, defensive timing, or
other precision-oriented mechanics.
FR-36: Willpower-Based Combat
Willpower shall influence comeback mechanics, low-health performance, resistance to defeat, or second-wind
abilities so that it has a distinct gameplay purpose.
FR-37: Equipment-Based Combat Modifiers
Equipped weapons and other combat equipment shall modify relevant combat properties. Equipment shall be
validated against the user's persistent inventory before its effects are applied.
FR-38: Balanced Attribute System
The battle system shall ensure that the primary attributes have distinct and meaningful roles rather than making
one attribute universally dominant. Different builds shall support different combat strategies.
FR-39: Battle State Management
The system shall maintain battle participants, current turn, health, stamina or equivalent resources, available
actions, cooldowns, effects, equipped items, and terminal status.
FR-40: Server-Validated Battle Execution
The backend shall validate each battle action and calculate its authoritative result. The client shall not be permitted
to directly modify damage, health, stamina, attributes, rewards, or victory status.
FR-41: Battle Results
The system shall determine and persist the final battle result when a terminal condition is reached. The result shall
identify the winner, loser, relevant rewards, and applicable progression.
FR-42: Battle Rewards
The system may grant configured rewards for battle participation or victory. Rewards shall be processed
server-side and recorded as persistent transactions.
FR-43: Battle History
The system shall maintain a history of completed battles, including participants, result, relevant outcome
information, and timestamp.
FR-44: Rival Matchmaking
The system shall provide a list of approximately 50 users near the current player's progression level for
competition, subject to privacy, availability, and matchmaking rules.
FR-45: Rival Profiles
The system shall display permitted public information for potential rivals, such as level, selected character
appearance, relevant statistics, equipment summary, and achievements.
FR-46: Challenge System
The system shall allow a user to initiate a battle challenge against an eligible rival. The backend shall validate
eligibility before creating the battle.
FR-47: Global Leaderboard
The system shall provide a global leaderboard showing ranked users according to a defined overall progression
metric.
FR-48: Attribute Leaderboards
The system shall support separate rankings for major attributes such as Strength, Intelligence, Endurance,
Resilience, Discipline, and Willpower, allowing different forms of progression to be recognized.
FR-49: Character Profile
The system shall provide a character profile containing level, XP, attributes, equipped gear, visual design, badges,
and other relevant progression information.
FR-50: Reward Display
The system shall visibly present earned rewards, including badges, weapons, character designs, effects, currency,
and other collectible items.
FR-51: Level-Up Feedback
The system shall provide immediate visual and/or audio feedback for significant events such as quest completion,
XP gain, attribute increase, level-up, item unlock, and achievement completion.
FR-52: Responsive Interface
The system shall provide a responsive interface usable across desktop, tablet, and mobile screen sizes.
FR-53: Keyboard Accessibility
Interactive controls shall be operable using keyboard navigation with visible focus states and logical navigation
order.
FR-54: Screen Reader Accessibility
Important interface elements shall use appropriate semantic structure, accessible names, labels, and status
announcements so that key workflows can be understood using assistive technologies.
FR-55: Retro Pixel RPG Interface
The system shall use a cohesive pixelated RPG visual language, including themed UI components, character
visuals, battle presentation, animations, feedback, and game-oriented terminology.
FR-56: Persistence and Synchronization
User accounts, quests, progression, inventory, achievements, battle history, and other persistent information shall
be stored in the backend database and remain available after refresh, logout/login, or use from another device.
FR-57: Error Handling
The system shall provide meaningful feedback for invalid actions, failed requests, expired sessions, unavailable
resources, invalid battle actions, and other expected error conditions without exposing sensitive implementation
details.
FR-58: Performance and UI Feedback
The system shall provide responsive interactions, loading states, skeletons or equivalent feedback where
appropriate, and smooth transitions/animations without blocking normal application use.
FR-59: Secure Data Validation
The backend shall validate user input, resource ownership, progression transactions, inventory operations, and
battle actions to protect the integrity of application data.
FR-60: Deployment and Operational Availability
The complete application shall support deployment as a functional full-stack system with a publicly accessible
frontend, working backend/API, persistent database, environment configuration, and secure production settings.
3. Functional Battle Flow
The battle flow is intentionally interactive. The player's real-life progression determines the strength and
capabilities of the character, while the battle requires tactical decisions on each turn.
Step System Function
1 Player selects an eligible rival and initiates a challenge.
2 Backend validates both players, their current progression, equipment, and battle eligibility.
3 Battle state is created and both characters' authoritative combat statistics are loaded.
4 The player receives a turn and sees available actions.
5 Player chooses Attack, Special, Defend, Recover, Use Item, or another unlocked action.
6 Backend validates the action and calculates its result using attributes, equipment, abilities, resources, and controlled randomness.
7 Battle UI displays damage, effects, HP/stamina changes, animations, and battle-log information.
8 If the opponent remains active, the opponent performs its turn using the defined opponent behavior.
9 Turns continue until a terminal condition such as defeat or victory is reached.
10 Backend stores the final result and applies only valid rewards/progression.
4. Attribute-to-Gameplay Mapping
Attribute Primary Gameplay Role
Strength- Physical attack power, weapon damage, heavy attacks.
Intelligence- Special attacks, combo complexity, advanced abilities.
Endurance- Maximum health/stamina and prolonged combat capability.
Resilience -Damage resistance and recovery-related effects.
Discipline -Accuracy, efficiency, stamina control, defensive precision.
Willpower -Second-wind, comeback, low-health resistance and last-resort mechanics.
5. Example Combat Interaction
Player turn: The battle screen displays the player's character, opponent, health/stamina status, battle log, and
available action buttons. The player selects Attack. The backend evaluates the character's Strength, Discipline,
equipped weapon, current stamina, opponent's defensive properties, and controlled randomness before returning
the authoritative damage result.
Special action: If the player selects a Special or Combo ability, Intelligence and the ability's requirements are
considered. The ability may consume stamina or have a cooldown. The client only displays the resulting state; it
does not decide the damage or reward.
Opponent turn: After the player's action resolves, the turn changes to the opponent. The opponent performs an
eligible action according to the implemented battle behavior. The battle state is updated again.
This interaction continues until one combatant reaches the defined defeat condition. The server then records the
final battle result and applies any valid rewards.
6. Core Functional Data
The implementation should persist at minimum the information required to support account ownership, quests,
progression, attributes, inventory, rewards, achievements, rivals, and battles. A suitable relational model may
contain entities such as User, Character, AttributeProgress, Quest, QuestCompletion, InventoryItem, Equipment,
Badge, Achievement, CurrencyTransaction, Battle, BattleTurn/Action, and Leaderboard-related derived data.
Exact table structure may be refined during implementation.
7. Functional Security Requirements
• All progression-changing operations must be validated by the backend.
• A user must only be able to modify resources owned by that user.
• XP, attribute levels, currency, inventory ownership, and battle outcomes must not be accepted as arbitrary
client-supplied values.
• Battle actions must be validated against the current authoritative battle state.
• Equipment effects must be calculated from persistent server-side inventory/equipment records.
• Invalid, duplicated, expired, or out-of-order battle actions must be rejected.
• Sensitive authentication information must not be exposed through normal API responses or client-side logs.
• Reward and currency changes should be recorded as auditable server-side transactions where appropriate.
8. End-to-End Functional Flow
Real-Life Activity ® Quest ® Completion ® XP + Attribute XP ® Character Level/Attributes ® Unlock
Equipment/Abilities ® Character Build ® Find Rivals ® Challenge ® Turn-Based Battle ® Strategic
Action + Attribute Effects ® Victory/Defeat ® Rewards/History ® Continued Progression
9. Acceptance Summary
The Life RPG system will be considered functionally complete when users can securely register and log in, create
and complete real-life quests, receive persistent XP and attribute progression, level up, maintain streaks, unlock
and display rewards, manage inventory and character appearance, find suitable rivals, and participate in an
interactive turn-based battle. The battle must expose actionable controls to the player and must use the character's
attributes and equipment as meaningful inputs to combat. All critical progression and combat state must persist in
the backend and be protected against client-side manipulation.