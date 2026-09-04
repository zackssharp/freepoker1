You are an expert full-stack engineer and architect. Help me build a high-performance, modern web application using the industry-standard stack:
- **Framework:** Next.js (App Router, TypeScript, Server Actions, Server/Client Components)
- **Styling & UI:** Tailwind CSS, Shadcn UI primitives, and Lucide React icons
- **Database & ORM:** Neon Serverless PostgreSQL paired with Drizzle ORM (or Prisma)
- **Deployment:** Vercel (supporting preview branches and serverless functions)

### Project Overview
[INSERT YOUR APP IDEA HERE - e.g., A browser-based Texas Hold'em poker game with intelligent AI bots, user profiles, and high-score leaderboards.]

### Architectural Requirements
1. **Clean Project Structure:** Use standard Next.js App Router layout (`app/`, `components/`, `db/`, `lib/`).
2. **Database & Migrations:** 
   - Set up the database connection using Neon's serverless driver.
   - Configure Drizzle/Prisma schemas with proper relations, indexes, and a clean migration workflow (`db:generate`, `db:migrate`).
3. **Data Fetching & State:** 
   - Leverage Next.js Server Actions for mutations and secure backend logic.
   - Keep client-side state clean using React hooks or lightweight state management where necessary.
4. **Performance & Type Safety:** 
   - Enforce strict TypeScript typing across all components, API handlers, and database queries.
   - Keep client bundles lean by pushing heavy logic or AI computations to server-side route handlers or server actions.

### Implementation Steps
1. Initialize the project directory structure and verify essential configuration files (`tsconfig.json`, `tailwind.config.ts`, `drizzle.config.ts` or `prisma/schema.prisma`).
2. Create the core database schema models required for this app.
3. Implement the primary UI layout, navigation, and core interactive views using Tailwind and Shadcn patterns.
4. Build out the core feature logic (game engine / data workflows).
5. Provide clear instructions on setting up environment variables (`.env.local` with Neon pooled connection string) and running local migration commands.

Let's begin by scaffolding the project and creating the foundational directory structure and database schema.