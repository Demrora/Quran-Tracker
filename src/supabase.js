import { createClient } from '@supabase/supabase-js'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
const supabaseKey = import.meta.env.VITE_SUPABASE_ANON_KEY

export const supabase = createClient(supabaseUrl, supabaseKey)

// Test de connexion
supabase.from('corpus').select('*').then(({ data, error }) => {
  console.log('TEST corpus data:', data)
  console.log('TEST corpus error:', error)
})