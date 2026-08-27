-- Rod & Paean wedding schema
-- Supabase → SQL Editor → New query → paste → Run

CREATE TABLE IF NOT EXISTS guests (
  id                   UUID        DEFAULT gen_random_uuid() PRIMARY KEY,
  created_at           TIMESTAMPTZ DEFAULT NOW(),

  -- Invite info (set by admin)
  household_name       TEXT        NOT NULL,
  primary_guest_name   TEXT        NOT NULL,
  plus_one_name        TEXT,
  party_members        JSONB       DEFAULT '[]'::jsonb,
  max_guests_allotted  INTEGER     NOT NULL DEFAULT 1,
  email                TEXT,

  -- RSVP response (set by guest)
  rsvp_status          TEXT        NOT NULL DEFAULT 'pending'
    CHECK (rsvp_status IN ('pending', 'attending', 'declined')),
  num_attending        INTEGER     DEFAULT 0,
  primary_attending    BOOLEAN     DEFAULT FALSE,
  primary_meal_choice  TEXT        CHECK (primary_meal_choice IN ('beef', 'fish', 'vegetarian') OR primary_meal_choice IS NULL),
  dietary_restrictions TEXT,

  -- Tracking
  email_sent           BOOLEAN     NOT NULL DEFAULT FALSE,
  email_sent_at        TIMESTAMPTZ,
  rsvp_submitted_at    TIMESTAMPTZ,
  rsvp_updated_at      TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS guests_name_idx ON guests (LOWER(primary_guest_name));

CREATE TABLE IF NOT EXISTS wedding_config (
  id            INTEGER     PRIMARY KEY DEFAULT 1,
  rsvp_locked   BOOLEAN     NOT NULL DEFAULT FALSE,
  rsvp_deadline DATE        DEFAULT '2027-01-15',
  updated_at    TIMESTAMPTZ DEFAULT NOW()
);

INSERT INTO wedding_config (id, rsvp_locked, rsvp_deadline)
VALUES (1, false, '2027-01-15')
ON CONFLICT (id) DO NOTHING;

-- Row Level Security
ALTER TABLE guests        ENABLE ROW LEVEL SECURITY;
ALTER TABLE wedding_config ENABLE ROW LEVEL SECURITY;

-- Guests: public can read (name lookup) and update their own RSVP
CREATE POLICY "guests_select" ON guests FOR SELECT USING (true);
CREATE POLICY "guests_update" ON guests FOR UPDATE USING (true);

-- Config: public can read (for RSVP deadline + locked state) and admin can write
CREATE POLICY "config_select" ON wedding_config FOR SELECT USING (true);
CREATE POLICY "config_update" ON wedding_config FOR UPDATE USING (true);
