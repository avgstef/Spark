import type { Template } from './types'

/** Starting points shown on the Templates screen. Each one is a seed idea, not
 *  a finished prompt — the engine does the work. */
export const TEMPLATES: Template[] = [
  {
    id: 't-code-review',
    name: 'Production code review',
    category: 'Coding',
    targetModel: 'High',
    blurb: 'A strict reviewer that finds real bugs, not style nitpicks.',
    idea:
      'Review a React + TypeScript pull request for correctness, performance and security. Return blocking issues first with file and line references, then non-blocking suggestions. Be blunt about real risks and skip formatting opinions.',
    tags: ['review', 'engineering', 'quality'],
  },
  {
    id: 't-api-build',
    name: 'REST API from scratch',
    category: 'Coding',
    targetModel: 'High',
    blurb: 'Complete, runnable service with tests and error handling.',
    idea:
      'Build a small REST API in Node with Express and SQLite for a task manager: CRUD endpoints, validation, error middleware, pagination and a Jest test suite. Include the folder structure and how to run it locally.',
    tags: ['backend', 'node', 'api'],
  },
  {
    id: 't-landing',
    name: 'High-converting landing page',
    category: 'Websites',
    targetModel: 'High',
    blurb: 'Structure, copy and code that all pull in one direction.',
    idea:
      'Create a landing page for a subscription habit-tracking app aimed at busy professionals. Dark premium aesthetic, hero with one clear promise, social proof, three feature blocks, pricing and FAQ. Single HTML file with inline CSS, fully responsive.',
    tags: ['landing', 'conversion', 'frontend'],
  },
  {
    id: 't-dashboard',
    name: 'Admin dashboard UI',
    category: 'Websites',
    targetModel: 'Medium',
    blurb: 'Data-dense interface that still feels calm.',
    idea:
      'Design and build a dark-mode analytics dashboard: KPI row, revenue line chart, cohort table and filter bar. Responsive, accessible, with empty and loading states.',
    tags: ['dashboard', 'ui', 'charts'],
  },
  {
    id: 't-mobile-flow',
    name: 'Mobile app onboarding',
    category: 'Apps',
    targetModel: 'High',
    blurb: 'Three screens that get users to first value fast.',
    idea:
      'Design the onboarding flow for an AI note-taking app on iOS. Minimise friction: three screens maximum, skip allowed, permissions requested in context. Include microcopy, states and the analytics events to track.',
    tags: ['mobile', 'onboarding', 'ux'],
  },
  {
    id: 't-product-spec',
    name: 'Product spec / PRD',
    category: 'Apps',
    targetModel: 'High',
    blurb: 'From fuzzy idea to an engineering-ready spec.',
    idea:
      'Write a one-page PRD for a browser extension that summarizes long articles. Cover problem, target user, MVP scope, non-goals, success metrics, technical constraints and open questions.',
    tags: ['product', 'spec', 'planning'],
  },
  {
    id: 't-portrait',
    name: 'Cinematic portrait',
    category: 'Images/Video',
    targetModel: 'Medium',
    blurb: 'Lens, light and palette locked in.',
    idea:
      'A cinematic portrait of an elderly watchmaker in his workshop, warm window light, 85mm lens, shallow depth of field, dust in the air, muted browns and amber, ultra detailed, film grain. 16:9. Avoid plastic skin and text.',
    tags: ['portrait', 'cinematic', 'midjourney'],
  },
  {
    id: 't-product-shot',
    name: 'Product hero shot',
    category: 'Images/Video',
    targetModel: 'Medium',
    blurb: 'Clean commercial lighting, no clutter.',
    idea:
      'Studio product shot of a matte black wireless earbud case on a dark stone surface, single soft key light from the left, subtle rim light, deep shadows, water droplets, minimal composition, macro detail, 4k commercial photography.',
    tags: ['product', 'studio', 'commercial'],
  },
  {
    id: 't-blog',
    name: 'SEO article writer',
    category: 'Writing',
    targetModel: 'Medium',
    blurb: 'Search intent first, fluff last.',
    idea:
      'Write a 1,200 word article on "how to track habits when you have ADHD" for a productivity blog. Practical, warm, no hype, includes a short intro, four actionable sections with examples, and a conclusion with one next step. Primary keyword: habit tracking for ADHD.',
    tags: ['blog', 'seo', 'content'],
  },
  {
    id: 't-cold-email',
    name: 'Cold outreach email',
    category: 'Writing',
    targetModel: 'High',
    blurb: 'Short, specific, no cringe.',
    idea:
      'Write a 90-word cold email to heads of engineering at 50-200 person SaaS companies, offering a code review service. One specific observation, one clear value line, one low-friction ask. No buzzwords, no flattery.',
    tags: ['email', 'sales', 'copy'],
  },
  {
    id: 't-gtm',
    name: 'Go-to-market plan',
    category: 'Business',
    targetModel: 'High',
    blurb: 'Channels, budget and 90-day sequencing.',
    idea:
      'Create a 90-day go-to-market plan for a $29/month AI writing tool launching to freelance copywriters. Cover positioning, three channels with expected CAC, launch sequence, content calendar and the five KPIs to watch weekly. State assumptions.',
    tags: ['gtm', 'launch', 'growth'],
  },
  {
    id: 't-pricing',
    name: 'Pricing teardown',
    category: 'Business',
    targetModel: 'High',
    blurb: 'Find the money left on the table.',
    idea:
      'Analyse a three-tier SaaS pricing model (Starter $9, Pro $29, Team $79) and recommend changes. Cover value metric, feature gating, annual discount, upgrade triggers and the risks of each change.',
    tags: ['pricing', 'strategy', 'saas'],
  },
  {
    id: 't-litreview',
    name: 'Literature scan',
    category: 'Research',
    targetModel: 'Medium',
    blurb: 'Evidence-weighted, citations required.',
    idea:
      'Summarise the current evidence on intermittent fasting and metabolic health. Separate strong evidence from preliminary findings, grade confidence for each claim, cite primary sources and list what would change the conclusion.',
    tags: ['research', 'evidence', 'health'],
  },
  {
    id: 't-competitor',
    name: 'Competitor matrix',
    category: 'Research',
    targetModel: 'High',
    blurb: 'Positioning gaps you can actually use.',
    idea:
      'Compare five AI note-taking apps across pricing, target user, core differentiator, integrations and weaknesses. Output a matrix plus three positioning gaps a new entrant could exploit.',
    tags: ['competitive', 'matrix', 'strategy'],
  },
  {
    id: 't-study',
    name: 'Study plan',
    category: 'General',
    targetModel: 'Medium',
    blurb: 'A realistic schedule, not a wish list.',
    idea:
      'Build a 6-week study plan to learn TypeScript for someone with two years of JavaScript experience, studying 45 minutes per day. Include weekly goals, exercises, a small project per fortnight and how to self-test.',
    tags: ['learning', 'plan', 'typescript'],
  },
  {
    id: 't-decision',
    name: 'Decision brief',
    category: 'General',
    targetModel: 'High',
    blurb: 'Structure a hard choice so it becomes obvious.',
    idea:
      'Help me decide between taking a senior role at a stable company and joining an early-stage startup as a founding engineer. Weigh compensation, learning, risk, lifestyle and optionality. Give a recommendation with the reasoning made explicit.',
    tags: ['decision', 'career', 'analysis'],
  },
]

export const CATEGORIES = [
  { id: 'Coding', icon: 'code', hint: 'Software, scripts, reviews, architecture' },
  { id: 'Websites', icon: 'globe', hint: 'Landing pages, UI, front-end builds' },
  { id: 'Apps', icon: 'apps', hint: 'Product flows, specs, mobile & desktop' },
  { id: 'Images/Video', icon: 'image', hint: 'Visual prompts, art direction, shots' },
  { id: 'Writing', icon: 'pen', hint: 'Articles, copy, emails, scripts' },
  { id: 'Business', icon: 'chart', hint: 'Strategy, GTM, pricing, ops' },
  { id: 'Research', icon: 'search', hint: 'Evidence, analysis, sources' },
  { id: 'General', icon: 'spark', hint: 'Everything else, done well' },
] as const

/* Capability levels. The upstream model behind each level is internal. */
export const TARGET_MODELS = ['Low', 'Medium', 'High'] as const

export const TIER_INFO = [
  { id: 'Low', hint: 'Fastest, lightest reasoning' },
  { id: 'Medium', hint: 'Balanced — recommended' },
  { id: 'High', hint: 'Deepest reasoning, slower' },
] as const

export const OUTPUT_STYLES = [
  { id: 'Quick', hint: 'Compact, 80-140 words' },
  { id: 'Detailed', hint: 'Structured, 150-300 words' },
  { id: 'Expert', hint: 'Thorough, variants included' },
] as const
