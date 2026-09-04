-- Silverfort-specific forecasts grounded in the company's public disclosures.
-- These ask about future public evidence, not private employee information.
-- Clear the demo featured flag first so the unique partial index permits the
-- researched ARR market below to become the featured question.
update public.markets
set featured = false
where slug in (
  'next-secondary-before-december',
  'acquisition-announced-this-year',
  'voluntary-move-before-q4'
)
and status = 'open';

insert into public.markets (
  slug, category, title, description, resolution_source, closes_at,
  initial_probability, featured
)
values
  (
    'silverfort-publicly-reports-100m-arr',
    'company',
    'Will Silverfort publicly report ARR above $100M by year-end 2026?',
    'Silverfort has publicly described more than 100% ARR growth in 2023 and tens of millions in new ARR, but has not published a current ARR figure. This market resolves only on an explicit public company disclosure of ARR above $100M.',
    'Silverfort newsroom or an official company filing: https://www.silverfort.com/blog/silverfort-raises-116m-to-lead-identity-security-market/',
    '2026-12-31 23:59:59+00',
    42,
    true
  ),
  (
    'silverfort-names-new-fortune-50-customer',
    'company',
    'Will Silverfort publish a new named Fortune 50 customer by year-end 2026?',
    'Silverfort says it is trusted by more than 1,000 organizations, including multiple Fortune 50 companies. Resolve YES only if Silverfort publishes a new customer story or newsroom announcement that names a Fortune 50 customer during this market window.',
    'A dated customer story or newsroom announcement on https://www.silverfort.com/customer-stories/',
    '2026-12-31 23:59:59+00',
    55,
    false
  ),
  (
    'silverfort-major-platform-release-after-6',
    'company',
    'Will Silverfort announce a major platform release after v6.0 by year-end 2026?',
    'Silverfort announced v6.0 with Access Intelligence and Identity Graph & Inventory on October 15, 2025. Resolve YES for a new numbered major platform release or equivalent company-designated major release announced publicly before the close.',
    'Silverfort product newsroom: https://www.silverfort.com/press-news/silverfort-launches-two-new-capabilities-access-intelligence-identity-graph/',
    '2026-12-31 23:59:59+00',
    64,
    false
  )
on conflict (slug) do nothing;
