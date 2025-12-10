# Supabase Database Migration - Real-time Attack Syncing

## Required Schema Changes

Run these SQL commands in your Supabase SQL editor to add real-time attack tracking:

```sql
-- Add attack tracking columns to the player table
ALTER TABLE player
ADD COLUMN IF NOT EXISTS "beingAttackedBy" INTEGER REFERENCES player(id) ON DELETE SET NULL,
ADD COLUMN IF NOT EXISTS "markedAt" TIMESTAMP,
ADD COLUMN IF NOT EXISTS "attackStartedAt" TIMESTAMP;

-- Add indexes for performance
CREATE INDEX IF NOT EXISTS idx_player_being_attacked_by ON player("beingAttackedBy");
CREATE INDEX IF NOT EXISTS idx_player_marked_at ON player("markedAt");

-- Add comment for documentation
COMMENT ON COLUMN player."beingAttackedBy" IS 'ID of the player currently attacking this player (null if not being attacked)';
COMMENT ON COLUMN player."markedAt" IS 'Timestamp when this player was marked by an attacker';
COMMENT ON COLUMN player."attackStartedAt" IS 'Timestamp when active attack started (attacker holding attack button)';
```

## What These Columns Do

- **beingAttackedBy**: Stores the player ID of who is currently attacking/marking this player
- **markedAt**: Timestamp when the player was marked (attacker held mark button for 2s)
- **attackStartedAt**: Timestamp when the active attack started (attacker is holding attack button)

## Real-time Subscription

The BLE scanning screen subscribes to changes on these columns to show:
- Warning indicator when being marked
- Red border/alert when being actively attacked
- Dodge button becomes active when under attack

## Usage Flow

1. **Attacker marks target**: `beingAttackedBy` and `markedAt` are set
2. **Target sees warning**: Their screen shows "You're being marked!"
3. **Attacker starts attack**: `attackStartedAt` is set
4. **Target sees attack**: Red border, damage counter, dodge button active
5. **Target dodges OR attack ends**: All fields reset to null
