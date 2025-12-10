# Game Victory & Cleanup Flow

## Complete Victory Flow

### When Only One Player Remains:

#### 1. **Player A Eliminates Player B**
[app/ble-scanning.tsx:1070-1090](app/ble-scanning.tsx#L1070-L1090)
```typescript
const damageResult = await gameService.damagePlayer(targetPlayerId, damageDealt, playerId);

if (damageResult.eliminated) {
  // Player B is eliminated
}
```

#### 2. **Player B Sees Death Screen**
[app/ble-scanning.tsx:647-677](app/ble-scanning.tsx#L647-L677)
```typescript
// Poll detects elimination status
if (playerStatus?.status === 'eliminated') {
  // Show skull icon "YOU DIED!"
  // After 2.5 seconds → redirect to home
  router.replace('/');
}
```

**Player B goes home immediately** ✅

#### 3. **Player A Checks if They Won**
[app/ble-scanning.tsx:1130-1155](app/ble-scanning.tsx#L1130-L1155)
```typescript
const gameStats = await gameService.getLobbyStats(lobbyId);
if (gameStats.alivePlayers === 1) {
  // Show victory alert
  Alert.alert('🎉 Victory!', 'You are the last player standing!');
}
```

#### 4. **Winner Presses OK → Game Ends**
[app/ble-scanning.tsx:1143-1150](app/ble-scanning.tsx#L1143-L1150)
```typescript
{
  text: 'OK',
  onPress: async () => {
    // End the game and clean up data
    await gameService.endLobby(lobbyId);

    // Navigate home
    router.replace('/');
  }
}
```

#### 5. **Game Data Cleanup Process**
[services/gameService.ts:479-533](services/gameService.ts#L479-L533)

**Step 1**: Mark lobby as 'ended' (triggers real-time notifications)
```typescript
await supabase
  .from('lobby')
  .update({ status: 'ended', endedAt: now() })
  .eq('id', lobbyId);
```

**Step 2**: Wait 2 seconds for notifications to propagate
```typescript
await new Promise(resolve => setTimeout(resolve, 2000));
```

**Step 3-5**: Delete all game data
```typescript
// Delete game states
// Delete players
// Delete lobby
```

## Why This Works:

### For Eliminated Players:
- ✅ Automatically redirected home when eliminated (before winner even sees victory)
- ✅ No longer subscribed to game events
- ✅ Clean exit

### For the Winner:
- ✅ Sees victory alert
- ✅ Presses OK → game data cleanup starts
- ✅ Goes home after cleanup

### For Any Stragglers:
- ✅ Lobby status updated to 'ended' first (Step 1)
- ✅ Real-time subscription fires → kicks them home
- ✅ Then data is deleted (Step 3-5)

## Timeline:

```
Time    Player B (Eliminated)        Player A (Winner)
────────────────────────────────────────────────────────
0s      Takes fatal damage           Deals fatal damage
        ↓
1s      💀 Death screen shows        ✅ Elimination animation
        ↓
2.5s    → Redirected home            Checks stats: 1 alive!
        ✅ GONE                       🎉 Victory alert shows
                                     ↓
5s                                   Presses OK
                                     ↓ Calls endLobby()
                                     ↓
6s                                   Lobby marked as 'ended'
                                     (Notifications sent)
                                     ↓
8s                                   Data deleted
                                     ↓
                                     → Redirected home
                                     ✅ DONE
```

## Result:

✅ **All players end up at home screen**
✅ **All game data (lobby, players, game states) deleted**
✅ **Devices preserved for next game**
✅ **Clean victory experience**

## Edge Cases Handled:

1. **Eliminated players already gone** → No issue, they're home
2. **Winner delays pressing OK** → No issue, cleanup happens when they press OK
3. **Host watching game** → Gets 'ended' notification, kicked home
4. **Network lag** → 2 second delay ensures notifications propagate before deletion
