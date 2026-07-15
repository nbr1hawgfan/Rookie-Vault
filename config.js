// Rookie Vault — fill this in with your own Supabase project details
// before deploying. See README.md "Set up the shared database" for
// step-by-step instructions on where each value comes from.
//
// This file is loaded by index.html BEFORE app.js. Everything here ends
// up visible in the deployed site's source — that's normal and fine for
// the Supabase URL/anon key (they're meant to be public, and the real
// protection is the Row Level Security policies from schema.sql). Treat
// the PIN and shared password as a "keep casual visitors out" layer, not
// a bank vault.

window.ROOKIE_VAULT_CONFIG = {
  // Project Settings → API in your Supabase dashboard
  supabaseUrl: 'https://YOUR-PROJECT-REF.supabase.co',
  supabaseAnonKey: 'YOUR-ANON-PUBLIC-KEY',

  // The one shared login the app signs in with after a correct PIN.
  // Create this user in Supabase: Authentication → Users → Add user.
  sharedEmail: 'family@example.com',
  sharedPassword: 'choose-a-password',

  // Whatever PIN you and your son want to type in to open the app.
  appPin: '1234'
};
