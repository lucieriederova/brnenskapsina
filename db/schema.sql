create table if not exists bookings (
  id bigserial primary key,
  kind text not null check (kind in ('slot', 'inquiry')),
  slot_date text,
  slot_start text,
  slot_end text,
  slot_title text,
  dog_name text,
  breed text,
  age text,
  package text,
  location text,
  preferred_date text,
  name text not null,
  phone text,
  email text not null,
  note text,
  created_at timestamptz not null default now()
);

create index if not exists bookings_slot_lookup
  on bookings (slot_date, slot_start, slot_end)
  where kind = 'slot';

-- Each slot booking gets a secret link to the follow-up questionnaire.
alter table bookings add column if not exists questionnaire_token text unique;

create table if not exists questionnaires (
  id bigserial primary key,
  booking_id bigint not null unique references bookings (id) on delete cascade,
  owner_name text not null,
  owner_phone text not null,
  owner_email text not null,
  emergency_name text not null,
  emergency_phone text not null,
  billing_address text not null,
  dog_name text not null,
  breed text not null,
  age text not null,
  weight text not null,
  vet_name text not null,
  vet_address text not null,
  vet_phone text not null,
  health_notes text,
  behavior_notes text,
  pickup_address text not null,
  created_at timestamptz not null default now()
);
