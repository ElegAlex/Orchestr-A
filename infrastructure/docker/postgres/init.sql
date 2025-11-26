-- PostgreSQL initialization script
-- This script runs when the container is first created

-- Create extensions if needed
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Log initialization
DO $$
BEGIN
  RAISE NOTICE 'ORCHESTR''A V2 Database initialized successfully';
END $$;
