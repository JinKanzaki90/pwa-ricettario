# Librerie esterne

Copiate qui con la versione nel nome del file: nessun CDN a runtime (serve anche alla lettura offline).

| File | Origine | Licenza |
|---|---|---|
| `supabase-js-2.117.3.esm.js` | `@supabase/supabase-js@2.117.3` da npm, raccolto in un unico modulo ES con esbuild (`export { createClient }`, minimizzato, target es2020) | MIT, vedi `supabase-js-2.117.3.LICENSE` |

Per aggiornare: in una cartella temporanea `npm i @supabase/supabase-js@<versione> esbuild`, poi
`echo "export { createClient } from '@supabase/supabase-js';" > entry.js` e
`npx esbuild entry.js --bundle --format=esm --minify --target=es2020 --outfile=supabase-js-<versione>.esm.js`;
sostituire il file e aggiornare gli `import`.
