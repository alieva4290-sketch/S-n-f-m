# Sınıfım

Sınıfım, eski okul ve kurs arkadaşlarını buluşturan; sınıf toplulukları, profiller ve üyelere özel anı akışları sunan Türkçe bir sosyal arşivdir.

## Run & Operate

- `pnpm --filter @workspace/api-server run dev` — run the API server (port 5000)
- `pnpm run typecheck` — full typecheck across all packages
- `pnpm run build` — typecheck + build all packages
- `pnpm --filter @workspace/api-spec run codegen` — regenerate API hooks and Zod schemas from the OpenAPI spec
- `pnpm --filter @workspace/db run push` — push DB schema changes (dev only)
- Required env: `DATABASE_URL` — Postgres connection string

## Stack

- pnpm workspaces, Node.js 24, TypeScript 5.9
- API: Express 5
- DB: PostgreSQL + Drizzle ORM
- Validation: Zod (`zod/v4`), `drizzle-zod`
- API codegen: Orval (from OpenAPI spec)
- Build: esbuild (CJS bundle)

## Where things live

- `artifacts/sinifim` — React web uygulaması; ana arayüz ve teması `src/App.tsx` ile `src/index.css` içinde.
- `artifacts/api-server` — Express API ve Clerk oturum doğrulaması.
- `lib/api-spec/openapi.yaml` — API sözleşmesinin tek kaynağı.
- `lib/api-client-react` ve `lib/api-zod` — OpenAPI'den üretilen istemci kancaları ve doğrulama şemaları.
- `lib/db/src/schema/community.ts` — PostgreSQL/Drizzle topluluk şeması.

## Architecture decisions

- Kimlik doğrulama Replit tarafından yönetilen Clerk ile yapılır; uygulama profilleri Clerk kullanıcı kimliklerini kullanır.
- Kurum ve sınıf keşfi herkese açıktır; kişi araması yalnızca bulunabilirliği açan profilleri gösterir.
- Sınıf gönderileri ve üye listesi sunucu tarafında etkin üyelik olmadan döndürülmez.
- İlk sürümde sınıfa katılım doğrudandır; üyelik isteği onayı ve davet bağlantıları sonraki aşamaya bırakılmıştır.
- API tipleri ve Zod doğrulamaları OpenAPI'den üretilir; sözleşme değişikliğinde `pnpm --filter @workspace/api-spec run codegen` çalıştırılmalıdır.

## Product

Kullanıcılar kurum ve sınıf arayabilir, sınıf topluluğu oluşturup katılabilir, sınıf akışında not/anı/duyuru paylaşabilir, yorum ve beğeni ekleyebilir, profillerini düzenleyebilir ve kişi aramasında görünürlüklerini seçebilir. Arayüz tamamen Türkçedir; krem, mürekkep ve ölçülü mavi vurgularla dijital yıllık hissi taşır.

## User preferences

_Populate as you build — explicit user instructions worth remembering across sessions._

## Gotchas

- Web API çağrıları Clerk'in same-origin oturum çerezini kullanır; web istemcisine bearer token ekleme.
- Clerk proxy middleware'i JSON body parser'lardan önce bağlanmalıdır.
- Vite/Tailwind v4 ayarında `optimize: false`, Clerk tema katmanlarının üretimde sırasının bozulmasını önler.

## Pointers

- See the `pnpm-workspace` skill for workspace structure, TypeScript setup, and package details
