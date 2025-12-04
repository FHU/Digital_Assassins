# Game Service Guide

This guide explains how to use the game service (`app/services/gameService.ts`) for managing player data, missions, game states, and the target elimination system.

## Overview

The Game Service provides a complete backend for the Digital Assassins game:

- **Target Assignment**: Circular target distribution when a game starts
- **Elimination System**: Handles player elimination with automatic target reassignment
- **Player Management**: Track player stats, health, and status
- **Mission Tracking**: Create and manage player missions
- **Game State**: Store game statistics and progress
- **Leaderboards**: Real-time player rankings

## Installation & Setup

### 1. Generate Prisma Client

After modifying the schema, generate the Prisma client:

```bash
npx prisma generate
```

### 2. Create & Run Migrations

```bash
# Create a migration
npx prisma migrate dev --name init

# Apply migrations to production
npx prisma migrate deploy
```

### 3. Seed Database (Optional)

Create a `prisma/seed.ts` file if you want to populate test data.

## Core Concepts

### Target Assignment System

Every player is assigned a circular target:
- Player 1 → Player 2 → Player 3 → ... → Player 1

When Player A eliminates Player B:
1. B is marked as "eliminated"
2. A's kill count increases
3. **All players targeting B now target B's target** (target inheritance)
4. If A was targeting B, A now targets B's target

This creates a dynamic, self-balancing system where eliminating your target automatically gives you a new one.

### Player Status

- **"alive"**: Currently playing
- **"eliminated"**: Has been eliminated
- **"spectator"**: Watching (future feature)

## API Reference

### Target Assignment

#### `assignTargetsForLobby(lobbyId: number)`

Assigns targets to all players in a lobby using circular distribution.

**Usage:**
```typescript
import gameService from '@/app/services/gameService';

// When game starts, assign targets
await gameService.assignTargetsForLobby(lobbyId);
```

**Requirements:**
- Minimum 2 players in lobby
- All players must have status "alive"

---

### Elimination System

#### `eliminatePlayer(attackerId: number, victimId: number)`

Eliminates a player and handles target reassignment.

**Usage:**
```typescript
const result = await gameService.eliminatePlayer(attackerId, victimId);

// result.victim - The eliminated player
// result.attacker - Updated attacker with kills increment
// result.reassignedPlayers - Players who got new targets
```

**What happens:**
1. Victim marked as eliminated
2. All players targeting victim now target victim's target
3. Attacker gets victim's target (if they were targeting victim)
4. Attacker's kill count increases

---

### Player Queries

#### `getPlayerState(playerId: number)`

Fetch complete player state with game context.

**Usage:**
```typescript
const playerState = await gameService.getPlayerState(playerId);

console.log(playerState.target);        // Who this player targets
console.log(playerState.targetedBy);    // Players targeting this player
console.log(playerState.attacker);      // Who eliminated this player
console.log(playerState.gameStates);    // Game statistics
```

---

#### `getLobbyPlayers(lobbyId: number, includeEliminated?: boolean)`

Get all players in a lobby with their targets.

**Usage:**
```typescript
// Only alive players
const alivePlayers = await gameService.getLobbyPlayers(lobbyId);

// Include eliminated players
const allPlayers = await gameService.getLobbyPlayers(lobbyId, true);
```

---

#### `getLobbyLeaderboard(lobbyId: number)`

Get leaderboard sorted by kills (descending).

**Usage:**
```typescript
const leaderboard = await gameService.getLobbyLeaderboard(lobbyId);

leaderboard.forEach(player => {
  console.log(`${player.username}: ${player.kills} kills`);
});
```

---

### Health & Damage

#### `damagePlayer(playerId: number, damageAmount: number, attackerId: number)`

Apply damage to a player. Automatically eliminates if health ≤ 0.

**Usage:**
```typescript
const result = await gameService.damagePlayer(
  victimId,
  25,           // Damage amount
  attackerId    // Who's attacking
);

if (result.eliminated) {
  console.log('Player was eliminated!');
}
```

---

#### `healPlayer(playerId: number, healAmount: number, maxHealth?: number)`

Heal a player (default max health: 100).

**Usage:**
```typescript
await gameService.healPlayer(playerId, 50, 100);
```

---

### Game State & Missions

#### `updatePlayerGameState(playerId: number, lobbyId: number, updates)`

Update or create player's game state with statistics.

**Usage:**
```typescript
const gameState = await gameService.updatePlayerGameState(
  playerId,
  lobbyId,
  {
    eliminations: 2,
    timeSurvived: 3600,    // seconds
    distanceTraveled: 5000, // meters
    accuracy: 85.5,         // percentage
    isAlive: true,
    lastKnownLocation: JSON.stringify({ lat: 40.7128, lng: -74.0060 })
  }
);
```

---

#### `getPlayerMissions(playerId: number, status?: string)`

Get player's missions (optionally filtered by status).

**Usage:**
```typescript
// All missions
const allMissions = await gameService.getPlayerMissions(playerId);

// Only active missions
const active = await gameService.getPlayerMissions(playerId, 'active');

// Only completed missions
const completed = await gameService.getPlayerMissions(playerId, 'completed');
```

---

#### `updateMissionProgress(missionId: number, progress: number, completed?: boolean)`

Update mission progress (0-100).

**Usage:**
```typescript
await gameService.updateMissionProgress(
  missionId,
  75,      // 75% complete
  false    // not completed yet
);

// Mark mission as completed
await gameService.updateMissionProgress(missionId, 100, true);
```

---

### Lobby Management

#### `getLobbyState(lobbyId: number)`

Get complete lobby state with all players and their targets.

**Usage:**
```typescript
const lobby = await gameService.getLobbyState(lobbyId);

console.log(lobby.status);           // "waiting" | "started" | "ended"
console.log(lobby.players.length);   // Number of players
console.log(lobby.gameTimeLimit);    // When game ends
```

---

#### `getLobbyStats(lobbyId: number)`

Get lobby game statistics.

**Usage:**
```typescript
const stats = await gameService.getLobbyStats(lobbyId);

console.log(stats.totalPlayers);      // 10
console.log(stats.alivePlayers);      // 3
console.log(stats.eliminatedPlayers); // 7
console.log(stats.gameProgress);      // "70.00" (70% eliminated)
```

---

#### `validateLobbyGameState(lobbyId: number)`

Validate game state integrity (check for orphaned targets, etc).

**Usage:**
```typescript
const validation = await gameService.validateLobbyGameState(lobbyId);

if (!validation.isValid) {
  validation.issues.forEach(issue => console.log('⚠️', issue));
}
```

---

#### `endLobby(lobbyId: number)`

End a lobby (only when exactly 1 player is alive).

**Usage:**
```typescript
const lobby = await gameService.endLobby(lobbyId);
console.log(lobby.status); // "ended"
```

---

## Example: Complete Game Flow

```typescript
import gameService from '@/app/services/gameService';

// 1. Create lobby (done elsewhere - returns lobbyId)
const lobbyId = 1;

// 2. Players join lobby (done elsewhere)
// Assume 5 players are now in lobby

// 3. Start game - assign targets
await gameService.assignTargetsForLobby(lobbyId);

// 4. Get initial player state
const playerState = await gameService.getPlayerState(playerId);
console.log(`Your target: ${playerState.target.username}`);

// 5. Player takes damage during gameplay
const damageResult = await gameService.damagePlayer(
  targetPlayerId,
  50,           // 50 damage
  playerId      // Who's attacking
);

if (damageResult.eliminated) {
  console.log('Target eliminated!');

  // View updated player state
  const updated = await gameService.getPlayerState(playerId);
  console.log(`New target: ${updated.target.username}`);
}

// 6. Check leaderboard
const leaderboard = await gameService.getLobbyLeaderboard(lobbyId);
leaderboard.slice(0, 5).forEach((player, idx) => {
  console.log(`${idx + 1}. ${player.username} - ${player.kills} kills`);
});

// 7. Update player statistics
await gameService.updatePlayerGameState(playerId, lobbyId, {
  timeSurvived: 1800,      // 30 minutes
  distanceTraveled: 12000,  // 12 km
  accuracy: 92,
  isAlive: true
});

// 8. End game when 1 player remains
const remainingStats = await gameService.getLobbyStats(lobbyId);
if (remainingStats.alivePlayers === 1) {
  const endedLobby = await gameService.endLobby(lobbyId);
  console.log('Game Over!');

  const final = await gameService.getLobbyLeaderboard(lobbyId);
  console.log(`Winner: ${final[0].username}`);
}
```

## Data Models

### Player
```typescript
{
  id: number
  userId: string         // Device identifier
  username: string
  healthRemaining: float // Current health (0-100)
  kills: int            // Number of eliminations
  status: string        // "alive" | "eliminated" | "spectator"
  targetId: number?     // Who this player targets
  attackerId: number?   // Who eliminated this player
  lobbyId: number
  createdAt: DateTime
  updatedAt: DateTime
  eliminatedAt: DateTime?
}
```

### Mission
```typescript
{
  id: number
  playerId: number
  lobbyId: number
  title: string
  description?: string
  missionType: string   // "elimination" | "survival" | etc
  status: string        // "active" | "completed" | "failed"
  progress: float       // 0-100
  completedAt?: DateTime
}
```

### GameState
```typescript
{
  id: number
  playerId: number
  lobbyId: number
  sessionStartTime: DateTime
  eliminations: int
  timeSurvived: int     // seconds
  distanceTraveled: float
  accuracy: float       // percentage
  isAlive: boolean
  lastKnownLocation?: string  // JSON
}
```

## Best Practices

1. **Always validate lobby state** before critical operations:
   ```typescript
   const { isValid, issues } = await gameService.validateLobbyGameState(lobbyId);
   if (!isValid) throw new Error(`Invalid state: ${issues.join(', ')}`);
   ```

2. **Use transactions for multi-step operations**:
   ```typescript
   // Consider using Prisma transactions for complex operations
   const result = await prisma.$transaction(async (tx) => {
     // Multiple operations that must succeed together
   });
   ```

3. **Cache leaderboard** for performance:
   ```typescript
   // Don't fetch on every update - cache and update when elimination occurs
   ```

4. **Handle edge cases**:
   - What if a player targets themselves? (Shouldn't happen in circular assignment)
   - What if all players are eliminated? (Handled by validation)
   - What if network latency causes race conditions? (Use database transactions)

## Performance Considerations

- **Indexes**: The schema includes indexes on frequently queried fields (`lobbyId`, `targetId`, `status`)
- **N+1 Queries**: The service uses `include` to fetch related data efficiently
- **Pagination**: For large lobbies, consider paginating leaderboards

## Error Handling

All functions throw descriptive errors:

```typescript
try {
  await gameService.eliminatePlayer(attackerId, victimId);
} catch (error) {
  console.error('Elimination failed:', error.message);
  // Handle error gracefully
}
```

## Next Steps

1. Run Prisma migrations: `npx prisma migrate dev`
2. Import game service in API routes or server actions
3. Create API endpoints that call these functions
4. Test with a simple game flow
5. Add WebSocket/real-time events for live updates

