# BJJ Community Platform

## Setup

1. Supabase Projekt erstellen
2. SQL Tabellen ausführen (siehe unten)
3. Auf Netlify deployen
4. Umgebungsvariablen setzen

## Supabase SQL

Führe in Supabase SQL Editor aus:

### Tabelle: athletes
CREATE TABLE athletes (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  created_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL,
  name text NOT NULL,
  age integer,
  weight numeric,
  belt_rank text CHECK (belt_rank IN ('weiß', 'blau', 'lila', 'braun', 'schwarz')),
  image_url text,
  email text UNIQUE,
  bio text,
  user_id uuid REFERENCES auth.users(id)
);

ALTER TABLE athletes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Athletes viewable by everyone" ON athletes FOR SELECT USING (true);
CREATE POLICY "Users can insert own profile" ON athletes FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own profile" ON athletes FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete own profile" ON athletes FOR DELETE USING (auth.uid() = user_id);

### Tabelle: gyms
CREATE TABLE gyms (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  created_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL,
  name text NOT NULL,
  email text UNIQUE,
  street text,
  postal_code text,
  city text,
  address text,
  latitude numeric,
  longitude numeric,
  image_url text,
  description text,
  phone text,
  website text,
  user_id uuid REFERENCES auth.users(id)
);

ALTER TABLE gyms ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Gyms viewable by everyone" ON gyms FOR SELECT USING (true);
CREATE POLICY "Users can insert own gym" ON gyms FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own gym" ON gyms FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete own gym" ON gyms FOR DELETE USING (auth.uid() = user_id);

### Tabelle: open_mats
CREATE TABLE open_mats (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  created_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL,
  gym_id uuid REFERENCES gyms(id) ON DELETE CASCADE,
  title text NOT NULL,
  description text,
  event_date timestamp with time zone NOT NULL,
  duration_minutes integer DEFAULT 120
);

ALTER TABLE open_mats ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Open mats viewable by everyone" ON open_mats FOR SELECT USING (true);
CREATE POLICY "Gym owners can insert" ON open_mats FOR INSERT WITH CHECK (
  EXISTS (SELECT 1 FROM gyms WHERE gyms.id = gym_id AND gyms.user_id = auth.uid())
);
CREATE POLICY "Gym owners can update" ON open_mats FOR UPDATE USING (
  EXISTS (SELECT 1 FROM gyms WHERE gyms.id = gym_id AND gyms.user_id = auth.uid())
);
CREATE POLICY "Gym owners can delete" ON open_mats FOR DELETE USING (
  EXISTS (SELECT 1 FROM gyms WHERE gyms.id = gym_id AND gyms.user_id = auth.uid())
);

### Tabelle: gym_ratings
CREATE TABLE gym_ratings (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  created_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL,
  gym_id uuid REFERENCES gyms(id) ON DELETE CASCADE,
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE,
  rating integer CHECK (rating >= 1 AND rating <= 5),
  comment text,
  UNIQUE(gym_id, user_id)
);

ALTER TABLE gym_ratings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Ratings viewable by everyone" ON gym_ratings FOR SELECT USING (true);
CREATE POLICY "Users can insert own ratings" ON gym_ratings FOR INSERT WITH CHECK (auth.uid() = user_id);

## Deployment

1. GitHub Repository erstellen
2. Auf Netlify verbinden
3. Environment Variables in Netlify setzen:
   - SUPABASE_URL
   - SUPABASE_ANON_KEY
4. Deploy!