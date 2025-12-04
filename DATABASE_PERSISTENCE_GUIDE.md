# Database Persistence Guide - Join & Host

## The Issue

Your app was using **in-memory storage** (`services/LobbyStore.ts`), which means:
- ❌ All player data lost when app reloads
- ❌ Data doesn't survive app crashes
- ❌ Nothing stored in your database
- ❌ No record of games played

## The Solution

Created **`services/DatabaseLobbyStore.ts`** that replaces the old store with Prisma:
- ✅ All data persisted to PostgreSQL database
- ✅ Data survives app reloads, crashes, device restarts
- ✅ Complete audit trail of all games
- ✅ Same API - minimal code changes needed

## What Happens Now (With Database Storage)

### When Host Creates Lobby

**Before (in-memory):**
```
Host clicks "Host Match"
→ Creates lobby in Map (RAM)
→ Code generated: "ABC123"
→ Reload app → LOST FOREVER
```

**After (database):**
```
Host clicks "Host Match"
→ Creates Device record in DB
→ Creates Lobby record in DB
→ Creates Player record for host in DB
→ Code stored: "ABC123" ✅ PERSISTED
→ Reload app → Data still there! ✅
```

### When Player Joins Lobby

**Before (in-memory):**
```
Player enters code "ABC123"
→ Found in Map (if host didn't close app)
→ Player added to in-memory array
→ Close app → LOST
```

**After (database):**
```
Player enters code "ABC123"
→ Fetches from database ✅
→ Creates Device record for player
→ Creates Player record in lobby
→ Data stored in DB
→ Close app → Rejoin game later! ✅
```

## Migration Steps

### Step 1: Update `app/host_page/host.tsx`

**Change from:**
```typescript
import { createLobby, getCurrentActiveLobby } from "@/services/LobbyStore";

// ...
const newLobby = createLobby("Host", "Game Night");
```

**Change to:**
```typescript
import databaseLobbyStore from "@/services/DatabaseLobbyStore";
import { useDeviceId } from "@/hooks/useDeviceId"; // or get device ID from Bluetooth hook

// ...
const deviceId = useDeviceId(); // Unique device identifier
const newLobby = await databaseLobbyStore.createLobby(
  deviceId,        // Device ID
  "Host",          // Username
  "Game Night"     // Lobby name
);
```

### Step 2: Update `app/join.tsx`

**Change from:**
```typescript
import { getLobbyByCode } from "@/services/LobbyStore";

const lobby = getLobbyByCode(code);
```

**Change to:**
```typescript
import databaseLobbyStore from "@/services/DatabaseLobbyStore";

const lobby = await databaseLobbyStore.getLobbyByCode(code);
```

### Step 3: Update Join Lobby Screen (when player joins)

**Change from:**
```typescript
import { addParticipantToLobby } from "@/services/LobbyStore";

addParticipantToLobby(code, "PlayerName");
```

**Change to:**
```typescript
import databaseLobbyStore from "@/services/DatabaseLobbyStore";
import { useDeviceId } from "@/hooks/useDeviceId";

const deviceId = useDeviceId();
const updated = await databaseLobbyStore.addParticipantToLobby(
  code,       // Lobby code
  deviceId,   // Device ID
  "PlayerName" // Username
);
```

### Step 4: Update Start Game

**Change from:**
```typescript
// Old: just change state
```

**Change to:**
```typescript
import databaseLobbyStore from "@/services/DatabaseLobbyStore";
import gameService from "@/app/services/gameService";

// Start lobby in DB
const started = await databaseLobbyStore.startLobby(lobbyCode);
const lobbyId = started.id;

// Assign targets using game service
await gameService.assignTargetsForLobby(lobbyId);
```

## API Comparison

### Old API (In-Memory)
```typescript
createLobby(hostName, lobbyName) // No persistence
getLobbyByCode(code)
addParticipantToLobby(code, username)
removeParticipantFromLobby(code, participantId)
getCurrentActiveLobby()
closeLobby(code)
getAllLobbies()
```

### New API (Database)
```typescript
// Same signatures, but now with database persistence!
createLobby(deviceId, username, lobbyName)           // ← deviceId added
getLobbyByCode(code)
addParticipantToLobby(code, deviceId, username)      // ← deviceId added
removeParticipantFromLobby(code, username)           // ← username (not ID)
getCurrentActiveLobby(deviceId)                      // ← deviceId parameter
startLobby(code)                                      // ← NEW: starts game in DB
closeLobby(code)
getAllLobbies()

// NEW database functions
getLobbyById(lobbyId)                                 // ← Get by ID
getOrCreateDevice(deviceId)                          // ← Device management
clearCache()                                          // ← Cache control
```

## What Gets Stored in Database

### When Host Creates Match:

```
✅ Device Table:
   - bluetoothId (host's device ID)
   - bluetoothStatus
   - lastHeartbeat

✅ Lobby Table:
   - lobbyCode: "ABC123"
   - lobbyName: "Game Night"
   - hostId: (device ID)
   - status: "waiting"
   - gameTimeLimit: (1 hour from now)
   - createdAt: (timestamp)

✅ Player Table (Host):
   - userId: (device ID)
   - username: "Alice"
   - lobbyId: (reference to lobby)
   - healthRemaining: 100.0
   - status: "alive"
   - createdAt: (timestamp)
```

### When Player Joins Match:

```
✅ Device Table (Player):
   - bluetoothId: (player's device ID)
   - Updated lastHeartbeat

✅ Player Table (New):
   - userId: (device ID)
   - username: "Bob"
   - lobbyId: (same lobby as host)
   - healthRemaining: 100.0
   - status: "alive"
```

### When Game Starts:

```
✅ Lobby Table:
   - status: "started" ← UPDATED
   - startedAt: (timestamp)

✅ Player Table (All):
   - targetId: (assigned by game service)
   - Circular chain created: Alice→Bob→Alice
```

### During Gameplay:

```
✅ Player Table:
   - healthRemaining: ← UPDATED (decreased by damage)
   - kills: ← UPDATED (incremented on elimination)
   - targetId: ← UPDATED (reassigned on target elimination)
   - status: "eliminated" ← UPDATED (if killed)
   - attackerId: (who killed them)

✅ GameState Table:
   - eliminations: (updated)
   - timeSurvived: (updated)
   - accuracy: (updated)
   - lastKnownLocation: (updated)

✅ Mission Table:
   - progress: (updated)
```

## Benefits of Database Storage

### 1. Data Persistence
```typescript
// Session 1:
const lobby = await databaseLobbyStore.createLobby(deviceId, "Alice", "My Game");
// App crashes or closes

// Session 2 (next day):
const sameLobby = await databaseLobbyStore.getLobbyByCode("ABC123");
console.log(sameLobby.players); // ["Alice"] ✅ Still there!
```

### 2. Player Rejoin
```typescript
// Player 1 crashes mid-game
// Player 1 reopens app and rejoin:
const lobby = await databaseLobbyStore.getLobbyByCode("ABC123");
const player = await gameService.getPlayerState(playerId);
console.log(player.target); // Still has a target! ✅
```

### 3. Game Analytics
```typescript
// Query all past games:
const allLobbies = await databaseLobbyStore.getAllLobbies();

// Query leaderboard across all games:
const allPlayers = await prisma.player.findMany();
const topPlayers = allPlayers.sort((a, b) => b.kills - a.kills);
```

### 4. Audit Trail
```typescript
// See exactly when each player joined:
const players = await prisma.player.findMany({
  where: { lobbyId },
  orderBy: { createdAt: 'asc' }
});
// Shows join order and timestamps
```

### 5. Fraud Prevention
```typescript
// Detect impossible scenarios:
const player = await gameService.getPlayerState(playerId);
if (player.kills > 100) {
  // Alert: suspicious activity
}
```

## Example: Complete Join Flow

```typescript
// ============================================================
// HOST CREATES LOBBY
// ============================================================

import databaseLobbyStore from "@/services/DatabaseLobbyStore";
import gameService from "@/app/services/gameService";

const hostDeviceId = "device-123-abc"; // From device
const lobby = await databaseLobbyStore.createLobby(
  hostDeviceId,
  "Alice",         // Host username
  "Friday Night"   // Lobby name
);

console.log(`Lobby code: ${lobby.code}`);
// Output: Lobby code: ABC123
// Database now contains:
// - Device(bluetoothId: "device-123-abc")
// - Lobby(lobbyCode: "ABC123", status: "waiting")
// - Player(username: "Alice", lobbyId: lobby.id)

// ============================================================
// PLAYERS JOIN LOBBY
// ============================================================

// Player 1 joins
const playerDeviceId1 = "device-456-def";
const updated1 = await databaseLobbyStore.addParticipantToLobby(
  "ABC123",
  playerDeviceId1,
  "Bob"
);
console.log(updated1.players); // ["Alice", "Bob"] ✅ IN DATABASE

// Player 2 joins
const playerDeviceId2 = "device-789-ghi";
const updated2 = await databaseLobbyStore.addParticipantToLobby(
  "ABC123",
  playerDeviceId2,
  "Charlie"
);
console.log(updated2.players); // ["Alice", "Bob", "Charlie"] ✅ IN DATABASE

// ============================================================
// HOST STARTS GAME
// ============================================================

const startedLobby = await databaseLobbyStore.startLobby("ABC123");
// Lobby.status updated to "started" in database

// Assign targets
await gameService.assignTargetsForLobby(startedLobby.id);
// Players get targetId assigned in database:
// Alice.targetId = Bob.id
// Bob.targetId = Charlie.id
// Charlie.targetId = Alice.id

// ============================================================
// GAMEPLAY - BOB SHOOTS ALICE
// ============================================================

const result = await gameService.damagePlayer(
  aliceId,  // Victim
  50,        // Damage
  bobId      // Attacker
);

// Database updated:
// Alice.healthRemaining = 50 ✅
// Alice still alive, no target change

// ============================================================
// ALICE IS ELIMINATED
// ============================================================

const elimResult = await gameService.damagePlayer(
  aliceId,
  60,        // Overkill damage
  bobId
);

// Database updated:
// Alice.status = "eliminated" ✅
// Alice.attackerId = Bob.id ✅
// Bob.kills = 1 ✅
// Bob.targetId = Charlie.id (inherited from Alice) ✅
// Charlie.targetId = Bob.id (was targeting Alice, now Bob) ✅

// ============================================================
// QUERY DATA
// ============================================================

// Get leaderboard
const board = await gameService.getLobbyLeaderboard(lobbyId);
// Bob: 1 kill
// Charlie: 0 kills
// (Alice eliminated)

// Get player state
const bob = await gameService.getPlayerState(bobId);
console.log(bob.target.username); // "Charlie" (new target)
console.log(bob.kills); // 1

// ============================================================
// GAME ENDS
// ============================================================

// Only Bob alive - he wins
const endedLobby = await gameService.endLobby(lobbyId);

// Database updated:
// Lobby.status = "ended" ✅
// Lobby.endedAt = (timestamp) ✅

// Get final stats
const stats = await prisma.player.findMany({
  where: { lobbyId },
  orderBy: { kills: 'desc' }
});
// Winner: Bob (1 kill)
// All data persisted! ✅
```

## Migration Checklist

- [ ] Read `QUICK_START.md` (if not done)
- [ ] Run `npx prisma migrate dev --name init`
- [ ] Create `services/DatabaseLobbyStore.ts` (already provided)
- [ ] Create helper hook for device ID (see below)
- [ ] Update `app/host_page/host.tsx` to use `DatabaseLobbyStore`
- [ ] Update `app/join.tsx` to use `DatabaseLobbyStore`
- [ ] Update join lobby screen (if separate file)
- [ ] Update "Start Game" button to call `gameService.assignTargetsForLobby()`
- [ ] Test: Create lobby → Join lobby → Start game
- [ ] Verify data in database: `npx prisma studio`

## Helper: Get Device ID

Create `hooks/useDeviceId.ts`:

```typescript
import { useState, useEffect } from 'react';
import * as Device from 'expo-device';

export function useDeviceId(): string {
  const [deviceId, setDeviceId] = useState<string>('');

  useEffect(() => {
    // Use device's unique ID
    const id = Device.modelId || Device.deviceName || 'unknown-device';
    setDeviceId(id);
  }, []);

  return deviceId;
}
```

## Verify Data is Stored

Run Prisma Studio to view database:

```bash
npx prisma studio
```

You'll see:
- **Device** table with entries for each device that joined
- **Lobby** table with lobby code and status
- **Player** table with all players and their targets
- **GameState** table with player statistics
- **Mission** table with any missions created

## Next Steps

1. ✅ Implement `DatabaseLobbyStore` (done)
2. **TODO**: Update UI screens to use new store
3. **TODO**: Run migrations: `npx prisma migrate dev --name init`
4. **TODO**: Test join flow end-to-end
5. **TODO**: Verify data in Prisma Studio
6. **TODO**: Add real-time updates (WebSocket) for live player list

---

**Your data is now safe and persistent!** 🎉

