# Supabase migrations — drift aanwezig

**Status (per 2026-04-21):** lokale `supabase/migrations/` directory en de remote `supabase_migrations.schema_migrations` tabel lopen uit de pas. `supabase db push` werkt hierdoor niet out-of-the-box.

## Wat is er aan de hand

Bij `npx supabase migration list` zie je drie categorieën:

1. **Beide aanwezig (in sync):** alleen `20260323`.
2. **Alleen lokaal (10 files):** `20260326`, `20260327`, `20260330` (x2), `20260413`, `20260415` (x2), `20260416` (x2), en onze nieuwste `20260421_agent_names.sql`. Deze zijn historisch direct in de Supabase Studio SQL editor gedraaid en zijn dus wél op de remote toegepast, maar niet als rij in `schema_migrations` bijgehouden.
3. **Alleen remote (16 IDs):** `20260325175612` t/m `20260420113632`. Dit zijn migraties die ooit via de CLI zijn gepusht maar waarvan de SQL-bestanden niet (meer) in deze repo staan. Schema-effect is op de DB aanwezig, SQL is bij ons kwijt.

## Gevolgen

- `supabase db push` weigert met "Remote migration versions not found in local migrations directory."
- `supabase db pull` weigert met hetzelfde bericht.
- Nieuwe migraties moeten voorlopig handmatig in Studio worden toegepast (plak SQL in SQL editor), net zoals we `20260421_agent_names.sql` hebben gedaan.

## Waarom we niet direct repareren

Het opschonen vereist `supabase migration repair --status reverted <id>` op de 16 remote-only entries + `--status applied <id>` op de 10 lokale files. Dat is een metadata-only operatie (geen schema-risico, geen data-risico), maar het wist wél de audit trail ("wanneer is welke migratie toegepast?") uit `schema_migrations`. We accepteren bewust de drift totdat iemand tijd heeft om:

1. Eerst `supabase_migrations.schema_migrations` te dumpen naar een JSON-file hier in de repo als historisch record.
2. Alle niet-triviale schemas (`pg_namespace` inventariseren) te betrekken in een `db pull --schema` snapshot.
3. De 26 `repair`-commands te draaien.
4. De snapshot als nieuwe baseline te committen en oude lokale files te archiveren.

Zie commit-geschiedenis (zoek op "reconcile migration history") of vraag Nick wanneer dit is gebeurd.

## Nieuwe migraties tot die tijd

1. Schrijf je SQL in een nieuw bestand: `supabase/migrations/YYYYMMDD_korte_naam.sql`
2. Open https://supabase.com/dashboard/project/mvqjhlxfvtqqubqgdvhz/sql/new
3. Plak en run.
4. Commit het bestand.

Dit is geen schoonheidsprijs maar werkt. De drift zelf introduceert geen production-risico — alleen een CLI-ergernis.
