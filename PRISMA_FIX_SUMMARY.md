# Prisma Setup & Game Service Implementation - Summary

## What Was Fixed

### 1. Prisma Schema Issues

**Before:**
```prisma
model Player {
  device    Device @relation(fields: [], references: [id])  // ❌ Empty fields array
  target    Player @relation(fields: [], references: [id])  // ❌ Conflicting relations
  attacker  Player @relation(fields: [], references: [id])  // ❌ No foreign key fields
}
```

**After:**
```prisma
model Player {
  targetId          Int?
  target            Player?   @relation("PlayerToTarget", fields: [targetId], references: [id])
  targetedBy        Player[]  @relation("PlayerToTarget")

  attackerId        Int?
  attacker          Player?   @relation("PlayerToAttacker", fields: [attackerId], references: [id])
  eliminatedPlayers Player[]  @relation("PlayerToAttacker")
}
```

**Issues Fixed:**
- ✅ Added proper foreign key fields (`targetId`, `attackerId`, `deviceId`, etc.)
- ✅ Replaced empty `fields: []` with actual field references
- ✅ Used relation names to avoid conflicts in self-referential relations
- ✅ Added `onDelete` cascade/set-null rules for data integrity
- ✅ Added database indexes for frequently queried fields

### 2. Database URL Configuration

**Before:**
```prisma
datasource db {
  provider = "postgresql"
}
// Missing URL configuration for Prisma 7
```

**After:**
- Moved to `prisma.config.ts` (Prisma 7 requirement)
- Environment variable properly configured: `url: env("DATABASE_URL")`

### 3. Missing Relationships

**Added:**
- ✅ Complete `Mission` model for mission tracking
- ✅ Complete `GameState` model for statistics
- ✅ Proper back-relations in all models
- ✅ Timestamps (`createdAt`, `updatedAt`, `eliminatedAt`)
- ✅ Optional fields properly marked with `?`

## New Schema Structure

### Core Models

**Player** - Represents a game participant
- Stores username, health, kill count, and status
- **Target System**: Each player targets another player (circular)
- **Attacker Tracking**: Records who eliminated this player
- **Relations**: Belongs to Lobby, Device, has Missions and GameState

**Lobby** - Represents a game session
- Lobby code, name, configuration (time limit, health, player limit)
- Hosts multiple players
- Status tracking (waiting → started → ended)

**Mission** - Player objectives
- Flexible mission types: "elimination", "survival", "collection", etc.
- Progress tracking (0-100%)
- Per-player mission management

**GameState** - Game statistics & progress
- Time survived, distance traveled, accuracy
- Current target at snapshot time
- Last known location

**Device** - Bluetooth device tracking
- Device ID, Bluetooth status
- Links to players on that device
- Heartbeat tracking

## Target Assignment & Elimination System

### How It Works

```
ASSIGNMENT (Game Start):
┌─────────────────────────────────────────┐
│ Create circular target chain:            │
│ Player1 → Player2 → Player3 → ... → Player1│
└─────────────────────────────────────────┘

ELIMINATION (During Game):
┌─────────────────────────────────────────┐
│ Player A eliminates Player B:            │
│ 1. B marked as "eliminated"             │
│ 2. ALL players targeting B → target B's B's target │
│ 3. A's kill count ++                   │
│ 4. If A was targeting B, A → B's target │
└─────────────────────────────────────────┘

RESULT:
- Self-balancing system
- No orphaned players without targets
- Killed player's target automatically reassigned
- Seamless experience during gameplay
```

### Key Functions

| Function | Purpose |
|----------|---------|
| `assignTargetsForLobby()` | Create circular target assignments |
| `eliminatePlayer()` | Handle player elimination + target reassignment |
| `damagePlayer()` | Apply damage, auto-eliminate if health ≤ 0 |
| `healPlayer()` | Restore player health |
| `getPlayerState()` | Fetch player with full context |
| `getLobbyLeaderboard()` | Get sorted kill leaderboard |
| `updateMissionProgress()` | Track mission completion |
| `validateLobbyGameState()` | Check for data integrity issues |

## File Structure

```
Digital_Assassins/
├── prisma/
│   ├── schema.prisma          ✨ Fixed & enhanced schema
│   └── migrations/            📝 Will be created by 'prisma migrate'
│
├── app/
│   ├── lib/
│   │   └── prisma.ts          ✨ Prisma client singleton
│   │
│   ├── services/
│   │   └── gameService.ts     ✨ All game logic & DB queries
│   │
│   └── api/
│       └── game-example.ts    ✨ Example API route handlers
│
├── prisma.config.ts           ✅ Updated for Prisma 7
├── GAME_SERVICE_GUIDE.md      📚 Comprehensive usage guide
└── PRISMA_FIX_SUMMARY.md      📄 This file
```

## Getting Started

### 1. Install Dependencies
Already installed in your project:
- `@prisma/client@7.0.1`
- `prisma@7.1.0`
- `dotenv@17.2.3`

### 2. Generate Prisma Client
```bash
npx prisma generate
```

### 3. Create Migration
```bash
npx prisma migrate dev --name init
```
This will:
- Create migration files
- Run migration on your database
- Generate Prisma client

### 4. (Optional) Seed Database
Create `prisma/seed.ts`:
```typescript
import { prisma } from '@/app/lib/prisma';

async function main() {
  // Create test data
  const device = await prisma.device.create({
    data: { bluetoothId: 'test-device' },
  });

  const lobby = await prisma.lobby.create({
    data: {
      lobbyCode: 'TEST1',
      lobbyName: 'Test Game',
      hostId: device.id,
      gameTimeLimit: new Date(Date.now() + 3600000),
    },
  });

  console.log('Seeded:', { device, lobby });
}

main();
```

Then run:
```bash
npx prisma db seed
```

### 5. Start Using in Your App

**Server Component Example:**
```typescript
"use server"

import gameService from '@/app/services/gameService';

export async function startGameAction(lobbyId: number) {
  const players = await gameService.assignTargetsForLobby(lobbyId);
  return players;
}
```

**Or with API Route:**
```typescript
// app/api/game/start/route.ts
import { gameHandlers } from '@/app/api/game-example';

export async function POST(req: Request) {
  const { lobbyId } = await req.json();
  const result = await gameHandlers.lobby.start(lobbyId);
  return Response.json(result);
}
```

## Schema Validation

✅ **Schema Status**: VALID
```
The schema at prisma/schema.prisma is valid 🚀
Generated Prisma Client (7.1.0) to ./app/generated/prisma
```

✅ **TypeScript Status**: NO ERRORS
```
gameService.ts - 0 diagnostics
game-example.ts - 0 diagnostics
prisma.ts - 0 diagnostics
```

## Database Requirements

- **Provider**: PostgreSQL (specified in schema)
- **Connection**: Use `DATABASE_URL` environment variable
- **Example URL**:
  ```
  postgresql://user:password@localhost:5432/digital_assassins
  ```

Your `.env` file already has a Prisma Postgres URL configured.

## Key Design Decisions

### 1. Circular Target Assignment
- **Why**: Ensures all players always have a target
- **Benefit**: No orphaned/waiting players
- **Fairness**: Everyone starts with same kill opportunity

### 2. Target Reassignment on Elimination
- **Why**: When you eliminate your target, you immediately get a new one
- **Benefit**: Fast-paced, continuous gameplay
- **Effect**: All players targeting eliminated player also get new targets automatically

### 3. Proper Indexing
```prisma
@@index([lobbyId])    // Fast lobby queries
@@index([targetId])   // Fast target lookups
@@index([deviceId])   // Fast device queries
@@index([status])     // Fast status filtering
```

### 4. Cascade Delete Rules
- Player deletion cascades to Missions & GameStates
- Lobby deletion cascades to all Players
- Prevents orphaned records

### 5. Timestamps
- `createdAt`: Immutable creation time
- `updatedAt`: Auto-updated on changes
- `eliminatedAt`: When player was eliminated

## Example Game Flow

```typescript
import gameService from '@/app/services/gameService';

async function playGame(lobbyId: number, playerId: number) {
  // 1. Start game - assign targets
  await gameService.assignTargetsForLobby(lobbyId);

  // 2. Get my target
  const me = await gameService.getPlayerState(playerId);
  console.log(`My target: ${me.target.username}`);

  // 3. Deal damage to target
  const result = await gameService.damagePlayer(
    me.targetId,  // target's ID
    50,            // 50 damage
    playerId       // I'm attacking
  );

  if (result.eliminated) {
    // 4. Get new target automatically
    const updated = await gameService.getPlayerState(playerId);
    console.log(`New target: ${updated.target.username}`);
  }

  // 5. Check leaderboard
  const board = await gameService.getLobbyLeaderboard(lobbyId);
  console.log(board[0]); // Current leader
}
```

## Security Considerations

- ✅ Proper foreign key constraints
- ✅ No SQL injection (using Prisma ORM)
- ✅ Validation in game service functions
- ✅ Status checks before eliminations
- ✅ Data integrity validation

## Performance Tips

1. **Use selective includes** when fetching:
   ```typescript
   const player = await prisma.player.findUnique({
     where: { id: 1 },
     include: { target: true },  // Only what you need
   });
   ```

2. **Cache leaderboards** (updates only on elimination):
   ```typescript
   const leaderboard = await getLeaderboard();
   // Cache for 30 seconds
   ```

3. **Use indexes** for queries by lobbyId, targetId, status

4. **Batch operations** with transactions:
   ```typescript
   await prisma.$transaction(async (tx) => {
     // Multiple operations
   });
   ```

## Next Steps

1. ✅ Schema fixed and validated
2. ✅ Prisma client generated
3. ✅ Game service implemented
4. ✅ Example handlers created
5. **TODO**: Run migrations: `npx prisma migrate dev`
6. **TODO**: Create API routes in `app/api/`
7. **TODO**: Integrate into React Native app
8. **TODO**: Add real-time updates with WebSocket
9. **TODO**: Add unit tests for game logic
10. **TODO**: Performance testing with real lobbies

## Resources

- **Prisma Docs**: https://www.prisma.io/docs/
- **Game Service Guide**: See `GAME_SERVICE_GUIDE.md`
- **Example API Routes**: See `app/api/game-example.ts`
- **Database Schema**: See `prisma/schema.prisma`

## Support

If you encounter issues:

1. **Validation errors**: Run `npx prisma validate`
2. **Migration issues**: Check `prisma/migrations/` folder
3. **Type errors**: Run `npx prisma generate` to regenerate types
4. **Connection issues**: Verify `DATABASE_URL` in `.env`

---

**Status**: ✅ Ready for production migration

All files have been created, validated, and type-checked. You can now run migrations and start integrating with your React Native app!
