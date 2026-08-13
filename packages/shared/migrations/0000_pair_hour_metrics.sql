CREATE TABLE "pair_hour_metrics" (
	"pair_address" text NOT NULL,
	"hour_start_unix" integer NOT NULL,
	"reserve0" numeric NOT NULL,
	"reserve1" numeric NOT NULL,
	"reserve_usd" numeric NOT NULL,
	"volume_token0" numeric NOT NULL,
	"volume_token1" numeric NOT NULL,
	"volume_usd" numeric NOT NULL,
	"fees_usd" numeric GENERATED ALWAYS AS (volume_usd * 0.003) STORED NOT NULL,
	"hourly_txns" bigint NOT NULL,
	"ingested_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "pair_hour_metrics_pair_address_hour_start_unix_pk" PRIMARY KEY("pair_address","hour_start_unix"),
	CONSTRAINT "hour_start_unix_aligned" CHECK ("pair_hour_metrics"."hour_start_unix" > 0 AND "pair_hour_metrics"."hour_start_unix" % 3600 = 0)
);
