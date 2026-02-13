import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://jzoiggtztmjxqhenhrto.supabase.co';
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imp6b2lnZ3R6dG1qeHFoZW5ocnRvIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzA0OTg0MDMsImV4cCI6MjA4NjA3NDQwM30.HYmT7GrsS_mHV25l1woNZaGK2Dm6W9DUereqQhQqFJQ';

export const supabase = createClient(supabaseUrl, supabaseAnonKey);

