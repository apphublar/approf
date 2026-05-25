-- Force PostgREST/Supabase API to refresh newly created tables and columns.
notify pgrst, 'reload schema';
