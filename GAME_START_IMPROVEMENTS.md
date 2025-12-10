# Game Start & Real-time Attack Syncing - Implementation Summary

## Changes Made

### 1. ✅ Host No Longer Added as Player
**File**: [services/SupabaseLobbyStore.ts](services/SupabaseLobbyStore.ts#L140-L142)

The host is now **only a game manager**, not a player:
- Removed host player creation in `createLobby()`
- Host cannot be targeted by players
- Host only manages the game via the host management screen

### 2. ✅ Target Assignment Fixed
**File**: [services/gameService.ts](services/gameService.ts#L51-L89)

When host clicks "Start Game":
- All players (excluding host) get assigned targets in circular fashion
- Player 1 → Player 2 → Player 3 → ... → Player 1
- Added logging to debug target assignments
- Requires at least 2 players to start

### 3. ✅ Real-time Attack/Damage Syncing
**New File**: [services/AttackSyncService.ts](services/AttackSyncService.ts)

Created new service to broadcast attack events:
- `broadcastMarked()` - When attacker holds MARK for 2s
- `broadcastAttacking()` - When attacker presses ATTACK button
- `broadcastDamage()` - When damage is dealt
- `broadcastDodged()` - When victim dodges

### 4. ✅ BLE Scanning Screen Updated
**File**: [app/ble-scanning.tsx](app/ble-scanning.tsx)

Added real-time attack state subscription:
- **Lines 570-632**: New subscription listens for attack state changes
- **Line 600**: Shows warning when marked
- **Line 604**: Shows alert when actively attacked
- **Line 1005**: Broadcasts "marked" event when mark completes
- **Line 1047**: Broadcasts "attacking" event when attack starts
- **Line 912**: Broadcasts "dodged" event when player dodges

## Database Changes Required

⚠️ **IMPORTANT**: You must run this SQL in Supabase before testing!

See [SUPABASE_MIGRATION.md](SUPABASE_MIGRATION.md) for full migration SQL.

Add these columns to the `player` table:
```sql
ALTER TABLE player
ADD COLUMN IF NOT EXISTS "beingAttackedBy" INTEGER REFERENCES player(id) ON DELETE SET NULL,
ADD COLUMN IF NOT EXISTS "markedAt" TIMESTAMP,
ADD COLUMN IF NOT EXISTS "attackStartedAt" TIMESTAMP;
```

## How It Works Now

### Game Start Flow:
1. **Host creates lobby** → Host is NOT added as player
2. **Players join via code** → Added to `player` table
3. **Host clicks "Start Game"**:
   - Calls `gameService.assignTargetsForLobby()`
   - Assigns targets circularly (A→B→C→A)
   - Updates lobby status to 'started'
   - Players automatically navigate to BLE scanning screen
4. **Players see their target** → Target name appears at top of screen

### Attack Syncing Flow:

#### When Player A Attacks Player B:

1. **Player A holds MARK TARGET (2s)**
   - After 2s: `attackSyncService.broadcastMarked()` called
   - Database updated: `player B.beingAttackedBy = A, markedAt = now()`
   - **Player B's screen**: Gets real-time update → Shows warning "⚠️ Being Marked!"

2. **Player A presses ATTACK button**
   - `attackSyncService.broadcastAttacking()` called
   - Database updated: `player B.attackStartedAt = now()`
   - **Player B's screen**: Red border appears, damage counter starts, BLOCK button activates

3. **Player B can DODGE**
   - Presses BLOCK button
   - `attackSyncService.broadcastDodged()` called
   - Database updated: All attack fields reset to null
   - **Player B's screen**: Shield animation plays
   - **Player A's screen**: Attack canceled (via real-time subscription)

4. **Damage Applied**
   - When Player A releases ATTACK button
   - `gameService.damagePlayer()` updates health
   - **Player B's screen**: Health bar updates automatically via subscription

### Real-time Updates:

All players have active Supabase real-time subscriptions:
- **Game end** (lobby status → 'ended')
- **Player removal** (kicked by host)
- **Attack state changes** (being marked/attacked)
- **Health updates** (damage taken)

## Testing Checklist

- [ ] Run Supabase migration SQL
- [ ] Host creates lobby (verify host is NOT in player list)
- [ ] 2+ players join via code
- [ ] Host starts game (verify targets assigned in logs)
- [ ] Players navigate to BLE scanning screen
- [ ] Each player sees correct target name
- [ ] Player A marks Player B → Player B sees warning
- [ ] Player A attacks Player B → Player B sees red border
- [ ] Player B dodges → attack canceled on both screens
- [ ] Damage updates in real-time
- [ ] Host ends game → all players kicked

## Files Modified

1. ✅ [services/SupabaseLobbyStore.ts](services/SupabaseLobbyStore.ts) - Removed host player creation
2. ✅ [services/gameService.ts](services/gameService.ts) - Enhanced target assignment logging
3. ✅ [services/AttackSyncService.ts](services/AttackSyncService.ts) - NEW - Real-time attack broadcasting
4. ✅ [app/ble-scanning.tsx](app/ble-scanning.tsx) - Added attack state subscription and broadcasts
5. ✅ [SUPABASE_MIGRATION.md](SUPABASE_MIGRATION.md) - NEW - Database migration guide

## Victory & Game End Flow

When only one player remains:

1. **Winner sees victory alert**: "🎉 Victory! You are the last player standing!"
2. **Winner presses OK**: Triggers `gameService.endLobby()`
3. **Lobby marked as 'ended'**: Real-time notifications sent to all players
4. **2 second delay**: Allows notifications to propagate
5. **Data cleanup**: Deletes game states → players → lobby
6. **All players redirected home**: Clean exit for everyone

**Eliminated players** are already home before the winner sees the victory alert.

See [VICTORY_FLOW.md](VICTORY_FLOW.md) for detailed timeline and flow.

## Next Steps

1. **Run the Supabase migration** (add columns to player table)
2. **Test the full flow** with 2+ devices
3. **Monitor console logs** for target assignment and attack events
4. **Verify real-time updates** work between devices
5. **Test victory flow** - ensure all players redirected home and data cleaned up
