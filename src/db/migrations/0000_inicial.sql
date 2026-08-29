-- pg_trgm precisa existir antes de entities_name_trgm_idx (paleta Ctrl+K).
CREATE EXTENSION IF NOT EXISTS pg_trgm;--> statement-breakpoint
CREATE TABLE "campaigns" (
	"id" uuid PRIMARY KEY NOT NULL,
	"owner_id" text NOT NULL,
	"world_id" uuid,
	"name" text NOT NULL,
	"slug" text NOT NULL,
	"system" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "entities" (
	"id" uuid PRIMARY KEY NOT NULL,
	"campaign_id" uuid NOT NULL,
	"type_key" text NOT NULL,
	"name" text NOT NULL,
	"slug" text NOT NULL,
	"summary" text,
	"content" jsonb,
	"metadata" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"tags" text[] DEFAULT '{}' NOT NULL,
	"status" text,
	"visibility" text DEFAULT 'mestre' NOT NULL,
	"cover_url" text,
	"archived_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"search_vector" "tsvector" GENERATED ALWAYS AS (setweight(to_tsvector('portuguese'::regconfig, coalesce(name, '')), 'A') || setweight(to_tsvector('portuguese'::regconfig, coalesce(summary, '')), 'B') || setweight(jsonb_to_tsvector('portuguese'::regconfig, coalesce(content, '{}'::jsonb), '["string"]'), 'C')) STORED
);
--> statement-breakpoint
CREATE TABLE "entity_types" (
	"id" uuid PRIMARY KEY NOT NULL,
	"campaign_id" uuid,
	"key" text NOT NULL,
	"label" text NOT NULL,
	"plural" text NOT NULL,
	"icon" text,
	"color" text,
	"is_narrative" boolean DEFAULT false NOT NULL,
	"fields" jsonb DEFAULT '[]'::jsonb NOT NULL
);
--> statement-breakpoint
CREATE TABLE "events" (
	"entity_id" uuid PRIMARY KEY NOT NULL,
	"campaign_id" uuid NOT NULL,
	"in_world_sort" bigint,
	"in_world_label" text,
	"session_id" uuid,
	"location_id" uuid
);
--> statement-breakpoint
CREATE TABLE "entity_mentions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"campaign_id" uuid NOT NULL,
	"source_id" uuid NOT NULL,
	"target_id" uuid NOT NULL,
	"pos" integer NOT NULL,
	"context" text NOT NULL,
	"is_secret" boolean DEFAULT false NOT NULL
);
--> statement-breakpoint
CREATE TABLE "open_threads" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"campaign_id" uuid NOT NULL,
	"source_id" uuid NOT NULL,
	"pos" integer NOT NULL,
	"text" text NOT NULL,
	"resolved" boolean DEFAULT false NOT NULL
);
--> statement-breakpoint
CREATE TABLE "relationship_types" (
	"id" uuid PRIMARY KEY NOT NULL,
	"campaign_id" uuid,
	"key" text NOT NULL,
	"label" text NOT NULL,
	"inverse" text NOT NULL,
	"symmetric" boolean DEFAULT false NOT NULL
);
--> statement-breakpoint
CREATE TABLE "entity_relationships" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"campaign_id" uuid NOT NULL,
	"source_id" uuid NOT NULL,
	"target_id" uuid NOT NULL,
	"type_key" text NOT NULL,
	"status" text,
	"starts_at" bigint,
	"ends_at" bigint,
	"note" text,
	"is_secret" boolean DEFAULT false NOT NULL
);
--> statement-breakpoint
CREATE TABLE "sessions" (
	"entity_id" uuid PRIMARY KEY NOT NULL,
	"campaign_id" uuid NOT NULL,
	"number" integer NOT NULL,
	"played_at" date,
	"act_id" uuid
);
--> statement-breakpoint
ALTER TABLE "entities" ADD CONSTRAINT "entities_campaign_id_campaigns_id_fk" FOREIGN KEY ("campaign_id") REFERENCES "public"."campaigns"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "entity_types" ADD CONSTRAINT "entity_types_campaign_id_campaigns_id_fk" FOREIGN KEY ("campaign_id") REFERENCES "public"."campaigns"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "events" ADD CONSTRAINT "events_entity_id_entities_id_fk" FOREIGN KEY ("entity_id") REFERENCES "public"."entities"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "events" ADD CONSTRAINT "events_campaign_id_campaigns_id_fk" FOREIGN KEY ("campaign_id") REFERENCES "public"."campaigns"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "events" ADD CONSTRAINT "events_session_id_sessions_entity_id_fk" FOREIGN KEY ("session_id") REFERENCES "public"."sessions"("entity_id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "events" ADD CONSTRAINT "events_location_id_entities_id_fk" FOREIGN KEY ("location_id") REFERENCES "public"."entities"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "entity_mentions" ADD CONSTRAINT "entity_mentions_campaign_id_campaigns_id_fk" FOREIGN KEY ("campaign_id") REFERENCES "public"."campaigns"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "entity_mentions" ADD CONSTRAINT "entity_mentions_source_id_entities_id_fk" FOREIGN KEY ("source_id") REFERENCES "public"."entities"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "entity_mentions" ADD CONSTRAINT "entity_mentions_target_id_entities_id_fk" FOREIGN KEY ("target_id") REFERENCES "public"."entities"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "open_threads" ADD CONSTRAINT "open_threads_campaign_id_campaigns_id_fk" FOREIGN KEY ("campaign_id") REFERENCES "public"."campaigns"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "open_threads" ADD CONSTRAINT "open_threads_source_id_entities_id_fk" FOREIGN KEY ("source_id") REFERENCES "public"."entities"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "relationship_types" ADD CONSTRAINT "relationship_types_campaign_id_campaigns_id_fk" FOREIGN KEY ("campaign_id") REFERENCES "public"."campaigns"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "entity_relationships" ADD CONSTRAINT "entity_relationships_campaign_id_campaigns_id_fk" FOREIGN KEY ("campaign_id") REFERENCES "public"."campaigns"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "entity_relationships" ADD CONSTRAINT "entity_relationships_source_id_entities_id_fk" FOREIGN KEY ("source_id") REFERENCES "public"."entities"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "entity_relationships" ADD CONSTRAINT "entity_relationships_target_id_entities_id_fk" FOREIGN KEY ("target_id") REFERENCES "public"."entities"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sessions" ADD CONSTRAINT "sessions_entity_id_entities_id_fk" FOREIGN KEY ("entity_id") REFERENCES "public"."entities"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sessions" ADD CONSTRAINT "sessions_campaign_id_campaigns_id_fk" FOREIGN KEY ("campaign_id") REFERENCES "public"."campaigns"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sessions" ADD CONSTRAINT "sessions_act_id_entities_id_fk" FOREIGN KEY ("act_id") REFERENCES "public"."entities"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "campaigns_owner_slug_idx" ON "campaigns" USING btree ("owner_id","slug");--> statement-breakpoint
CREATE UNIQUE INDEX "entities_campaign_slug_idx" ON "entities" USING btree ("campaign_id","slug");--> statement-breakpoint
CREATE INDEX "entities_campaign_type_idx" ON "entities" USING btree ("campaign_id","type_key");--> statement-breakpoint
CREATE INDEX "entities_campaign_updated_idx" ON "entities" USING btree ("campaign_id","updated_at");--> statement-breakpoint
CREATE INDEX "entities_search_idx" ON "entities" USING gin ("search_vector");--> statement-breakpoint
CREATE INDEX "entities_name_trgm_idx" ON "entities" USING gin ("name" gin_trgm_ops);--> statement-breakpoint
CREATE INDEX "entities_tags_idx" ON "entities" USING gin ("tags");--> statement-breakpoint
CREATE UNIQUE INDEX "entity_types_campaign_key_idx" ON "entity_types" USING btree ("campaign_id","key");--> statement-breakpoint
CREATE UNIQUE INDEX "entity_types_global_key_idx" ON "entity_types" USING btree ("key") WHERE campaign_id is null;--> statement-breakpoint
CREATE INDEX "events_campaign_sort_idx" ON "events" USING btree ("campaign_id","in_world_sort");--> statement-breakpoint
CREATE UNIQUE INDEX "entity_mentions_source_target_pos_idx" ON "entity_mentions" USING btree ("source_id","target_id","pos");--> statement-breakpoint
CREATE INDEX "entity_mentions_target_idx" ON "entity_mentions" USING btree ("target_id");--> statement-breakpoint
CREATE INDEX "open_threads_campaign_resolved_idx" ON "open_threads" USING btree ("campaign_id","resolved");--> statement-breakpoint
CREATE UNIQUE INDEX "relationship_types_campaign_key_idx" ON "relationship_types" USING btree ("campaign_id","key");--> statement-breakpoint
CREATE UNIQUE INDEX "relationship_types_global_key_idx" ON "relationship_types" USING btree ("key") WHERE campaign_id is null;--> statement-breakpoint
CREATE INDEX "entity_relationships_source_idx" ON "entity_relationships" USING btree ("source_id");--> statement-breakpoint
CREATE INDEX "entity_relationships_target_idx" ON "entity_relationships" USING btree ("target_id");--> statement-breakpoint
CREATE UNIQUE INDEX "sessions_campaign_number_idx" ON "sessions" USING btree ("campaign_id","number");