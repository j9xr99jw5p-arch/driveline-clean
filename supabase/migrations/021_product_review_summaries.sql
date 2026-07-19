alter table public.products
add column if not exists review_sentiment text,
add column if not exists review_summary text,
add column if not exists review_praise jsonb,
add column if not exists review_complaints jsonb,
add column if not exists review_takeaway text,
add column if not exists review_count_analyzed integer,
add column if not exists review_rating_average numeric,
add column if not exists review_rating_breakdown jsonb,
add column if not exists review_source_name text,
add column if not exists review_source_url text;
