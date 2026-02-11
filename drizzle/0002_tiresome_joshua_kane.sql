ALTER TABLE "listings" ADD COLUMN "city" text;--> statement-breakpoint
ALTER TABLE "listings" ADD COLUMN "rating" numeric(2, 1) DEFAULT '0';