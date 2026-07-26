CREATE TABLE "share_lookup_attempts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"token" text NOT NULL,
	"ip_hash" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "trip_collaborators" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"trip_id" uuid NOT NULL,
	"user_id" uuid NOT NULL,
	"role" text DEFAULT 'viewer' NOT NULL,
	"joined_via_share_id" uuid,
	"notify_opt_in" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "trip_shares" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"trip_id" uuid NOT NULL,
	"owner_user_id" uuid NOT NULL,
	"token" text NOT NULL,
	"permission" text DEFAULT 'view' NOT NULL,
	"is_revoked" boolean DEFAULT false NOT NULL,
	"expires_at" timestamp with time zone,
	"view_count" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "itinerary_items" ADD COLUMN "created_by_user_id" uuid;--> statement-breakpoint
ALTER TABLE "trips" ADD COLUMN "last_collaborator_digest_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "trip_collaborators" ADD CONSTRAINT "trip_collaborators_trip_id_trips_id_fk" FOREIGN KEY ("trip_id") REFERENCES "public"."trips"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "trip_collaborators" ADD CONSTRAINT "trip_collaborators_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "trip_collaborators" ADD CONSTRAINT "trip_collaborators_joined_via_share_id_trip_shares_id_fk" FOREIGN KEY ("joined_via_share_id") REFERENCES "public"."trip_shares"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "trip_shares" ADD CONSTRAINT "trip_shares_trip_id_trips_id_fk" FOREIGN KEY ("trip_id") REFERENCES "public"."trips"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "trip_shares" ADD CONSTRAINT "trip_shares_owner_user_id_users_id_fk" FOREIGN KEY ("owner_user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "share_lookup_ip_idx" ON "share_lookup_attempts" USING btree ("ip_hash","created_at");--> statement-breakpoint
CREATE INDEX "share_lookup_token_ip_idx" ON "share_lookup_attempts" USING btree ("token","ip_hash","created_at");--> statement-breakpoint
CREATE UNIQUE INDEX "trip_collaborators_trip_user_idx" ON "trip_collaborators" USING btree ("trip_id","user_id");--> statement-breakpoint
CREATE INDEX "trip_collaborators_user_idx" ON "trip_collaborators" USING btree ("user_id");--> statement-breakpoint
CREATE UNIQUE INDEX "trip_shares_token_idx" ON "trip_shares" USING btree ("token");--> statement-breakpoint
CREATE INDEX "trip_shares_owner_idx" ON "trip_shares" USING btree ("owner_user_id");--> statement-breakpoint
CREATE INDEX "trip_shares_trip_idx" ON "trip_shares" USING btree ("trip_id");--> statement-breakpoint
ALTER TABLE "itinerary_items" ADD CONSTRAINT "itinerary_items_created_by_user_id_users_id_fk" FOREIGN KEY ("created_by_user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;