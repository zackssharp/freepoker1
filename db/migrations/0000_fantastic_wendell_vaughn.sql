CREATE TYPE "public"."game_status" AS ENUM('active', 'finished');--> statement-breakpoint
CREATE TYPE "public"."hand_result" AS ENUM('won', 'lost', 'folded', 'chopped');--> statement-breakpoint
CREATE TABLE "games" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"status" "game_status" DEFAULT 'active' NOT NULL,
	"small_blind" integer NOT NULL,
	"big_blind" integer NOT NULL,
	"starting_stack" integer NOT NULL,
	"bot_count" integer NOT NULL,
	"hands_played" integer DEFAULT 0 NOT NULL,
	"state" jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"ended_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "hand_players" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"hand_id" uuid NOT NULL,
	"seat_id" text NOT NULL,
	"name" text NOT NULL,
	"is_human" boolean DEFAULT false NOT NULL,
	"hole_cards" text[] DEFAULT ARRAY[]::text[] NOT NULL,
	"starting_stack" integer NOT NULL,
	"ending_stack" integer NOT NULL,
	"net" integer NOT NULL,
	"result" "hand_result" NOT NULL,
	"hand_label" text
);
--> statement-breakpoint
CREATE TABLE "hands" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"game_id" uuid NOT NULL,
	"hand_number" integer NOT NULL,
	"board" text[] DEFAULT ARRAY[]::text[] NOT NULL,
	"pot_size" integer NOT NULL,
	"went_to_showdown" boolean DEFAULT false NOT NULL,
	"ended_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "player_stats" (
	"user_id" uuid PRIMARY KEY NOT NULL,
	"hands_played" integer DEFAULT 0 NOT NULL,
	"hands_won" integer DEFAULT 0 NOT NULL,
	"showdowns_won" integer DEFAULT 0 NOT NULL,
	"biggest_pot" integer DEFAULT 0 NOT NULL,
	"net_profit" integer DEFAULT 0 NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "sessions" (
	"token" text PRIMARY KEY NOT NULL,
	"user_id" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"expires_at" timestamp with time zone NOT NULL
);
--> statement-breakpoint
CREATE TABLE "users" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"username" text NOT NULL,
	"display_name" text NOT NULL,
	"avatar_hue" integer DEFAULT 210 NOT NULL,
	"is_guest" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "games" ADD CONSTRAINT "games_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "hand_players" ADD CONSTRAINT "hand_players_hand_id_hands_id_fk" FOREIGN KEY ("hand_id") REFERENCES "public"."hands"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "hands" ADD CONSTRAINT "hands_game_id_games_id_fk" FOREIGN KEY ("game_id") REFERENCES "public"."games"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "player_stats" ADD CONSTRAINT "player_stats_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sessions" ADD CONSTRAINT "sessions_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "games_user_id_idx" ON "games" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "games_user_status_idx" ON "games" USING btree ("user_id","status");--> statement-breakpoint
CREATE INDEX "hand_players_hand_id_idx" ON "hand_players" USING btree ("hand_id");--> statement-breakpoint
CREATE UNIQUE INDEX "hands_game_hand_number_idx" ON "hands" USING btree ("game_id","hand_number");--> statement-breakpoint
CREATE INDEX "player_stats_net_profit_idx" ON "player_stats" USING btree ("net_profit" DESC NULLS LAST);--> statement-breakpoint
CREATE INDEX "sessions_user_id_idx" ON "sessions" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "sessions_expires_at_idx" ON "sessions" USING btree ("expires_at");--> statement-breakpoint
CREATE UNIQUE INDEX "users_username_idx" ON "users" USING btree ("username");