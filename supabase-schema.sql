-- Supabase Database Schema for WordPress AI SEO Automation
-- Run this SQL in your Supabase SQL Editor to create the required tables

-- Drop existing policies if they exist (to avoid conflicts)
DROP POLICY IF EXISTS "Service role has full access to settings" ON settings;
DROP POLICY IF EXISTS "Service role has full access to wordpress_sites" ON wordpress_sites;

-- Drop existing triggers if they exist
DROP TRIGGER IF EXISTS update_settings_updated_at ON settings;
DROP TRIGGER IF EXISTS update_wordpress_sites_updated_at ON wordpress_sites;

-- Create settings table
CREATE TABLE IF NOT EXISTS settings (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  key TEXT UNIQUE NOT NULL,
  value JSONB NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create wordpress_sites table
CREATE TABLE IF NOT EXISTS wordpress_sites (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT NOT NULL,
  url TEXT NOT NULL,
  username TEXT NOT NULL,
  password TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create indexes for faster lookups
CREATE INDEX IF NOT EXISTS idx_settings_key ON settings(key);
CREATE INDEX IF NOT EXISTS idx_sites_name ON wordpress_sites(name);

-- Enable Row Level Security (RLS)
ALTER TABLE settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE wordpress_sites ENABLE ROW LEVEL SECURITY;

-- Create policies for service role access (bypass RLS for server-side operations)
CREATE POLICY "Service role has full access to settings" ON settings
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Service role has full access to wordpress_sites" ON wordpress_sites
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- Insert default Gemini API key setting (empty by default)
INSERT INTO settings (key, value)
VALUES ('gemini_api_key', '""'::jsonb)
ON CONFLICT (key) DO NOTHING;

-- Create or replace function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create triggers to auto-update updated_at
CREATE TRIGGER update_settings_updated_at BEFORE UPDATE ON settings
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_wordpress_sites_updated_at BEFORE UPDATE ON wordpress_sites
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
