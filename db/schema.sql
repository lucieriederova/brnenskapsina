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
