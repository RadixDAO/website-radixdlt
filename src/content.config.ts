// One collection per Webflow CMS collection in reference/webflow/items/. Every
// entry is the RAW Webflow item (id, cmsLocaleId, lastPublished, lastUpdated,
// createdOn, isArchived, isDraft, fieldData) -- no shape change, no lossy
// conversion, except `blog`: blog entries are editor-friendly Markdown files with
// validated frontmatter. Their migrated Webflow bodies remain raw HTML inside the
// Markdown so existing tags and classes are retained. See src/lib/content.ts for
// the adapter that exposes both formats through the existing CmsItem read model.
import { defineCollection, z } from 'astro:content';
import { glob } from 'astro/loaders';

const articlesLearn = defineCollection({
  loader: glob({ pattern: '**/*.json', base: './src/content/articles-learn', generateId: ({ data }) => data.id }),
  schema: z.object({
    id: z.string(),
    cmsLocaleId: z.string(),
    lastPublished: z.string().nullable(),
    lastUpdated: z.string(),
    createdOn: z.string(),
    isArchived: z.boolean(),
    isDraft: z.boolean(),
    fieldData: z.object({
      "icon": z.object({ fileId: z.string(), url: z.string(), alt: z.string().nullable() }).nullable(), // Image
      "article-category": z.string().nullable(), // Reference
      "sub-category": z.string().nullable(), // Reference
      "full-article-text": z.string(), // RichText
      "top-note": z.string(), // RichText
      "bottom-note-extra-tip": z.string(), // RichText
      "author": z.string().nullable(), // Reference
      "article-video": z.string().nullable(), // VideoLink
      "featured-in-homepage": z.boolean(), // Switch
      "featured-in-header": z.boolean(), // Switch
      "feature-in-category-header": z.boolean(), // Switch
      "feature-in-search": z.boolean(), // Switch
      "article-likes": z.number().nullable(), // Number
      "name": z.string(), // PlainText
      "slug": z.string(), // PlainText
    }),
  }),
});

const blog = defineCollection({
  // Filenames are for editors and sort chronologically. The explicit slug keeps
  // public URLs stable when an editor renames or reorders a file.
  loader: glob({ pattern: '**/*.md', base: './src/content/blog', generateId: ({ data }) => data.slug }),
  schema: z.object({
    title: z.string(),
    // Some published legacy URLs contain repeated hyphens, so preserve them.
    slug: z.string().regex(/^[a-z0-9](?:[a-z0-9-]*[a-z0-9])?$/),
    date: z.string().nullable(),
    author: z.string().nullable(),
    categories: z.array(z.string()),
    excerpt: z.string().nullable(),
    seoDescription: z.string().nullable(),
    featured: z.boolean(),
    showToc: z.boolean(),
    archived: z.boolean(),
    draft: z.boolean(),
    bodyFormat: z.enum(['html', 'markdown']),
    image: z.object({
      src: z.string(),
      alt: z.string().nullable(),
    }).nullable(),
    video: z.object({
      poster: z.string().nullable(),
      mp4: z.string().nullable(),
      webm: z.string().nullable(),
    }).nullable(),
    legacy: z.object({
      id: z.string(),
      createdAt: z.string(),
      updatedAt: z.string(),
      publishedAt: z.string().nullable(),
    }),
  }),
});

const blogAuthor = defineCollection({
  loader: glob({ pattern: '**/*.json', base: './src/content/blog-author', generateId: ({ data }) => data.id }),
  schema: z.object({
    id: z.string(),
    cmsLocaleId: z.string(),
    lastPublished: z.string(),
    lastUpdated: z.string(),
    createdOn: z.string(),
    isArchived: z.boolean(),
    isDraft: z.boolean(),
    fieldData: z.object({
      "role": z.string().nullable(), // PlainText
      "image": z.object({ fileId: z.string(), url: z.string(), alt: z.string().nullable() }).nullable(), // Image
      "description": z.string().nullable(), // PlainText
      "name": z.string(), // PlainText
      "slug": z.string(), // PlainText
    }),
  }),
});

const blogCategory = defineCollection({
  loader: glob({ pattern: '**/*.json', base: './src/content/blog-category', generateId: ({ data }) => data.id }),
  schema: z.object({
    id: z.string(),
    cmsLocaleId: z.string(),
    lastPublished: z.string(),
    lastUpdated: z.string(),
    createdOn: z.string(),
    isArchived: z.boolean(),
    isDraft: z.boolean(),
    fieldData: z.object({
      "description": z.string().nullable(), // PlainText
      "text-colour": z.string(), // Color
      "background-colour": z.string(), // Color
      "name": z.string(), // PlainText
      "slug": z.string(), // PlainText
    }),
  }),
});

const blueprintsDevelopers = defineCollection({
  loader: glob({ pattern: '**/*.json', base: './src/content/blueprints-developers', generateId: ({ data }) => data.id }),
  schema: z.object({
    id: z.string(),
    cmsLocaleId: z.string(),
    lastPublished: z.string().nullable(),
    lastUpdated: z.string(),
    createdOn: z.string(),
    isArchived: z.boolean(),
    isDraft: z.boolean(),
    fieldData: z.object({
      "order": z.number().nullable(), // Number
      "username": z.string().nullable(), // PlainText
      "icon": z.object({ fileId: z.string(), url: z.string(), alt: z.string().nullable() }), // Image
      "category": z.array(z.string()), // MultiReference
      "description": z.string(), // PlainText
      "github-url": z.string().nullable(), // Link
      "website-url": z.string().nullable(), // Link
      "name": z.string(), // PlainText
      "slug": z.string(), // PlainText
    }),
  }),
});

const careers = defineCollection({
  loader: glob({ pattern: '**/*.json', base: './src/content/careers', generateId: ({ data }) => data.id }),
  schema: z.object({
    id: z.string(),
    cmsLocaleId: z.string(),
    lastPublished: z.string().nullable(),
    lastUpdated: z.string(),
    createdOn: z.string(),
    isArchived: z.boolean(),
    isDraft: z.boolean(),
    fieldData: z.object({
      "job-spec": z.string(), // RichText
      "name": z.string(), // PlainText
      "slug": z.string(), // PlainText
    }),
  }),
});

const categoriesDevelopers = defineCollection({
  loader: glob({ pattern: '**/*.json', base: './src/content/categories-developers', generateId: ({ data }) => data.id }),
  schema: z.object({
    id: z.string(),
    cmsLocaleId: z.string(),
    lastPublished: z.string(),
    lastUpdated: z.string(),
    createdOn: z.string(),
    isArchived: z.boolean(),
    isDraft: z.boolean(),
    fieldData: z.object({
      "description": z.string(), // RichText
      "name": z.string(), // PlainText
      "slug": z.string(), // PlainText
    }),
  }),
});

const categoriesLearn = defineCollection({
  loader: glob({ pattern: '**/*.json', base: './src/content/categories-learn', generateId: ({ data }) => data.id }),
  schema: z.object({
    id: z.string(),
    cmsLocaleId: z.string(),
    lastPublished: z.string().nullable(),
    lastUpdated: z.string(),
    createdOn: z.string(),
    isArchived: z.boolean(),
    isDraft: z.boolean(),
    fieldData: z.object({
      "icon": z.object({ fileId: z.string(), url: z.string(), alt: z.string().nullable() }).nullable(), // Image
      "number-of-questions": z.string().nullable(), // PlainText
      "subcategory-set": z.boolean(), // Switch
      "subcategory": z.array(z.string()).nullable(), // MultiReference
      "name": z.string(), // PlainText
      "slug": z.string(), // PlainText
    }),
  }),
});

const ecosystemProjects = defineCollection({
  loader: glob({ pattern: '**/*.json', base: './src/content/ecosystem-projects', generateId: ({ data }) => data.id }),
  schema: z.object({
    id: z.string(),
    cmsLocaleId: z.string(),
    lastPublished: z.string(),
    lastUpdated: z.string(),
    createdOn: z.string(),
    isArchived: z.boolean(),
    isDraft: z.boolean(),
    fieldData: z.object({
      "logo": z.object({ fileId: z.string(), url: z.string(), alt: z.string().nullable() }), // Image
      "circle-logo": z.boolean(), // Switch
      "circle-border-radius-on-ecosystem-page": z.boolean(), // Switch
      "shadow-on-ecosystem-page": z.boolean(), // Switch
      "name": z.string(), // PlainText
      "slug": z.string(), // PlainText
    }),
  }),
});

const ecosystemsDevelopers = defineCollection({
  loader: glob({ pattern: '**/*.json', base: './src/content/ecosystems-developers', generateId: ({ data }) => data.id }),
  schema: z.object({
    id: z.string(),
    cmsLocaleId: z.string(),
    lastPublished: z.string(),
    lastUpdated: z.string(),
    createdOn: z.string(),
    isArchived: z.boolean(),
    isDraft: z.boolean(),
    fieldData: z.object({
      "logo": z.object({ fileId: z.string(), url: z.string(), alt: z.string().nullable() }), // Image
      "name": z.string(), // PlainText
      "slug": z.string(), // PlainText
    }),
  }),
});

const events = defineCollection({
  loader: glob({ pattern: '**/*.json', base: './src/content/events', generateId: ({ data }) => data.id }),
  schema: z.object({
    id: z.string(),
    cmsLocaleId: z.string(),
    lastPublished: z.string().nullable(),
    lastUpdated: z.string(),
    createdOn: z.string(),
    isArchived: z.boolean(),
    isDraft: z.boolean(),
    fieldData: z.object({
      "event-image": z.object({ fileId: z.string(), url: z.string(), alt: z.string().nullable() }), // Image
      "event-category": z.string(), // Option
      "description": z.string(), // PlainText
      "location": z.string(), // PlainText
      "start-date": z.string(), // DateTime
      "end-date": z.string(), // DateTime
      "event-link-text": z.string(), // PlainText
      "event-link-url": z.string(), // Link
      "name": z.string(), // PlainText
      "slug": z.string(), // PlainText
    }),
  }),
});

const faqs = defineCollection({
  loader: glob({ pattern: '**/*.json', base: './src/content/faqs', generateId: ({ data }) => data.id }),
  schema: z.object({
    id: z.string(),
    cmsLocaleId: z.string(),
    lastPublished: z.string(),
    lastUpdated: z.string(),
    createdOn: z.string(),
    isArchived: z.boolean(),
    isDraft: z.boolean(),
    fieldData: z.object({
      "content": z.string(), // PlainText
      "name": z.string(), // PlainText
      "slug": z.string(), // PlainText
    }),
  }),
});

const featuredOn = defineCollection({
  loader: glob({ pattern: '**/*.json', base: './src/content/featured-on', generateId: ({ data }) => data.id }),
  schema: z.object({
    id: z.string(),
    cmsLocaleId: z.string(),
    lastPublished: z.string(),
    lastUpdated: z.string(),
    createdOn: z.string(),
    isArchived: z.boolean(),
    isDraft: z.boolean(),
    fieldData: z.object({
      "logo": z.object({ fileId: z.string(), url: z.string(), alt: z.string().nullable() }), // Image
      "name": z.string(), // PlainText
      "slug": z.string(), // PlainText
    }),
  }),
});

const fullStackSocialComments = defineCollection({
  loader: glob({ pattern: '**/*.json', base: './src/content/full-stack-social-comments', generateId: ({ data }) => data.id }),
  schema: z.object({
    id: z.string(),
    cmsLocaleId: z.string(),
    lastPublished: z.string(),
    lastUpdated: z.string(),
    createdOn: z.string(),
    isArchived: z.boolean(),
    isDraft: z.boolean(),
    fieldData: z.object({
      "text": z.string(), // PlainText
      "platform": z.string(), // Option
      "social-url": z.string(), // Link
      "name": z.string(), // PlainText
      "slug": z.string(), // PlainText
    }),
  }),
});

const navigationFeaturedSection = defineCollection({
  loader: glob({ pattern: '**/*.json', base: './src/content/navigation-featured-section', generateId: ({ data }) => data.id }),
  schema: z.object({
    id: z.string(),
    cmsLocaleId: z.string(),
    lastPublished: z.string(),
    lastUpdated: z.string(),
    createdOn: z.string(),
    isArchived: z.boolean(),
    isDraft: z.boolean(),
    fieldData: z.object({
      "location": z.string(), // Option
      "url-link": z.string(), // Link
      "image": z.object({ fileId: z.string(), url: z.string(), alt: z.string().nullable() }), // Image
      "content-2": z.string(), // PlainText
      "gradient-text": z.string().nullable(), // PlainText
      "text-with-play-icon": z.string().nullable(), // PlainText
      "name": z.string(), // PlainText
      "slug": z.string(), // PlainText
    }),
  }),
});

const partners = defineCollection({
  loader: glob({ pattern: '**/*.json', base: './src/content/partners', generateId: ({ data }) => data.id }),
  schema: z.object({
    id: z.string(),
    cmsLocaleId: z.string(),
    lastPublished: z.string(),
    lastUpdated: z.string(),
    createdOn: z.string(),
    isArchived: z.boolean(),
    isDraft: z.boolean(),
    fieldData: z.object({
      "logo": z.object({ fileId: z.string(), url: z.string(), alt: z.string().nullable() }), // Image
      "name": z.string(), // PlainText
      "slug": z.string(), // PlainText
    }),
  }),
});

const podcast = defineCollection({
  loader: glob({ pattern: '**/*.json', base: './src/content/podcast', generateId: ({ data }) => data.id }),
  schema: z.object({
    id: z.string(),
    cmsLocaleId: z.string(),
    lastPublished: z.string().nullable(),
    lastUpdated: z.string(),
    createdOn: z.string(),
    isArchived: z.boolean(),
    isDraft: z.boolean(),
    fieldData: z.object({
      "featured": z.boolean(), // Switch
      "date": z.string().nullable(), // DateTime
      "guest-name": z.string().nullable(), // PlainText
      "guest-image": z.object({ fileId: z.string(), url: z.string(), alt: z.string().nullable() }).nullable(), // Image
      "company-logo": z.object({ fileId: z.string(), url: z.string(), alt: z.string().nullable() }).nullable(), // Image
      "excerpt": z.string().nullable(), // PlainText
      "main-content": z.string(), // RichText
      "podcast-embed-code": z.string(), // PlainText
      "name": z.string(), // PlainText
      "slug": z.string(), // PlainText
    }),
  }),
});

const projectCategories = defineCollection({
  loader: glob({ pattern: '**/*.json', base: './src/content/project-categories', generateId: ({ data }) => data.id }),
  schema: z.object({
    id: z.string(),
    cmsLocaleId: z.string(),
    lastPublished: z.string(),
    lastUpdated: z.string(),
    createdOn: z.string(),
    isArchived: z.boolean(),
    isDraft: z.boolean(),
    fieldData: z.object({
      "name": z.string(), // PlainText
      "slug": z.string(), // PlainText
    }),
  }),
});

const projects = defineCollection({
  loader: glob({ pattern: '**/*.json', base: './src/content/projects', generateId: ({ data }) => data.id }),
  schema: z.object({
    id: z.string(),
    cmsLocaleId: z.string(),
    lastPublished: z.string().nullable(),
    lastUpdated: z.string(),
    createdOn: z.string(),
    isArchived: z.boolean(),
    isDraft: z.boolean(),
    fieldData: z.object({
      "project-description": z.string(), // PlainText
      "project-logo": z.object({ fileId: z.string(), url: z.string(), alt: z.string().nullable() }), // Image
      "project-background": z.object({ fileId: z.string(), url: z.string(), alt: z.string().nullable() }), // Image
      "link-to-project": z.string(), // Link
      "categories": z.array(z.string()), // MultiReference
      "rank": z.number(), // Number
      "featured": z.boolean(), // Switch
      "name": z.string(), // PlainText
      "slug": z.string(), // PlainText
    }),
  }),
});

const projects6Highlighted = defineCollection({
  loader: glob({ pattern: '**/*.json', base: './src/content/projects-6-highlighted', generateId: ({ data }) => data.id }),
  schema: z.object({
    id: z.string(),
    cmsLocaleId: z.string(),
    lastPublished: z.string(),
    lastUpdated: z.string(),
    createdOn: z.string(),
    isArchived: z.boolean(),
    isDraft: z.boolean(),
    fieldData: z.object({
      "project-description": z.string(), // PlainText
      "project-logo": z.object({ fileId: z.string(), url: z.string(), alt: z.string().nullable() }), // Image
      "project-background": z.object({ fileId: z.string(), url: z.string(), alt: z.string().nullable() }), // Image
      "link-to-project": z.string(), // Link
      "categories": z.array(z.string()), // MultiReference
      "rank": z.number(), // Number
      "name": z.string(), // PlainText
      "slug": z.string(), // PlainText
    }),
  }),
});

const radixOppServices = defineCollection({
  loader: glob({ pattern: '**/*.json', base: './src/content/radix-opp-services', generateId: ({ data }) => data.id }),
  schema: z.object({
    id: z.string(),
    cmsLocaleId: z.string(),
    lastPublished: z.string(),
    lastUpdated: z.string(),
    createdOn: z.string(),
    isArchived: z.boolean(),
    isDraft: z.boolean(),
    fieldData: z.object({
      "name": z.string(), // PlainText
      "slug": z.string(), // PlainText
    }),
  }),
});

const radixOppStatuses = defineCollection({
  loader: glob({ pattern: '**/*.json', base: './src/content/radix-opp-statuses', generateId: ({ data }) => data.id }),
  schema: z.object({
    id: z.string(),
    cmsLocaleId: z.string(),
    lastPublished: z.string().nullable(),
    lastUpdated: z.string(),
    createdOn: z.string(),
    isArchived: z.boolean(),
    isDraft: z.boolean(),
    fieldData: z.object({
      "status": z.string(), // Option
      "service-s": z.array(z.string()), // MultiReference
      "severity": z.string(), // Option
      "date-reported": z.string(), // DateTime
      "last-update": z.string(), // DateTime
      "content": z.string(), // RichText
      "name": z.string(), // PlainText
      "slug": z.string(), // PlainText
    }),
  }),
});

const radixServices = defineCollection({
  loader: glob({ pattern: '**/*.json', base: './src/content/radix-services', generateId: ({ data }) => data.id }),
  schema: z.object({
    id: z.string(),
    cmsLocaleId: z.string(),
    lastPublished: z.string(),
    lastUpdated: z.string(),
    createdOn: z.string(),
    isArchived: z.boolean(),
    isDraft: z.boolean(),
    fieldData: z.object({
      "name": z.string(), // PlainText
      "slug": z.string(), // PlainText
    }),
  }),
});

const radixStatuses = defineCollection({
  loader: glob({ pattern: '**/*.json', base: './src/content/radix-statuses', generateId: ({ data }) => data.id }),
  schema: z.object({
    id: z.string(),
    cmsLocaleId: z.string(),
    lastPublished: z.string(),
    lastUpdated: z.string(),
    createdOn: z.string(),
    isArchived: z.boolean(),
    isDraft: z.boolean(),
    fieldData: z.object({
      "status": z.string(), // Option
      "service-s": z.array(z.string()), // MultiReference
      "severity": z.string(), // Option
      "date-reported": z.string(), // DateTime
      "last-updated": z.string(), // DateTime
      "content": z.string(), // RichText
      "name": z.string(), // PlainText
      "slug": z.string(), // PlainText
    }),
  }),
});

const subCategoriesLearn = defineCollection({
  loader: glob({ pattern: '**/*.json', base: './src/content/sub-categories-learn', generateId: ({ data }) => data.id }),
  schema: z.object({
    id: z.string(),
    cmsLocaleId: z.string(),
    lastPublished: z.string().nullable(),
    lastUpdated: z.string(),
    createdOn: z.string(),
    isArchived: z.boolean(),
    isDraft: z.boolean(),
    fieldData: z.object({
      "icon": z.object({ fileId: z.string(), url: z.string(), alt: z.string().nullable() }), // Image
      "main-category": z.string().nullable(), // Reference
      "name": z.string(), // PlainText
      "slug": z.string(), // PlainText
    }),
  }),
});

const teamMember = defineCollection({
  loader: glob({ pattern: '**/*.json', base: './src/content/team-member', generateId: ({ data }) => data.id }),
  schema: z.object({
    id: z.string(),
    cmsLocaleId: z.string(),
    lastPublished: z.string().nullable(),
    lastUpdated: z.string(),
    createdOn: z.string(),
    isArchived: z.boolean(),
    isDraft: z.boolean(),
    fieldData: z.object({
      "featured-member": z.boolean(), // Switch
      "jersey-team-member": z.boolean(), // Switch
      "role": z.string(), // RichText
      "image": z.object({ fileId: z.string(), url: z.string(), alt: z.string().nullable() }).nullable(), // Image
      "bio-excerpt": z.string(), // PlainText
      "twitter": z.string().nullable(), // Link
      "linkedin": z.string().nullable(), // Link
      "blank-item": z.boolean(), // Switch
      "order": z.number(), // Number
      "name": z.string(), // PlainText
      "slug": z.string(), // PlainText
    }),
  }),
});

const teamMembersLearn = defineCollection({
  loader: glob({ pattern: '**/*.json', base: './src/content/team-members-learn', generateId: ({ data }) => data.id }),
  schema: z.object({
    id: z.string(),
    cmsLocaleId: z.string(),
    lastPublished: z.string(),
    lastUpdated: z.string(),
    createdOn: z.string(),
    isArchived: z.boolean(),
    isDraft: z.boolean(),
    fieldData: z.object({
      "job-title": z.string(), // PlainText
      "photo": z.object({ fileId: z.string(), url: z.string(), alt: z.string().nullable() }), // Image
      "biography": z.string().nullable(), // RichText
      "facebook-link": z.string().nullable(), // Link
      "twitter-link": z.string().nullable(), // Link
      "linkedin-link": z.string().nullable(), // Link
      "profile-header-photo": z.object({ fileId: z.string(), url: z.string(), alt: z.string().nullable() }).nullable(), // Image
      "name": z.string(), // PlainText
      "slug": z.string(), // PlainText
    }),
  }),
});

const testemonials = defineCollection({
  loader: glob({ pattern: '**/*.json', base: './src/content/testemonials', generateId: ({ data }) => data.id }),
  schema: z.object({
    id: z.string(),
    cmsLocaleId: z.string(),
    lastPublished: z.string(),
    lastUpdated: z.string(),
    createdOn: z.string(),
    isArchived: z.boolean(),
    isDraft: z.boolean(),
    fieldData: z.object({
      "content": z.string(), // PlainText
      "image": z.object({ fileId: z.string(), url: z.string(), alt: z.string().nullable() }), // Image
      "name": z.string(), // PlainText
      "slug": z.string(), // PlainText
    }),
  }),
});

const tweets = defineCollection({
  loader: glob({ pattern: '**/*.json', base: './src/content/tweets', generateId: ({ data }) => data.id }),
  schema: z.object({
    id: z.string(),
    cmsLocaleId: z.string(),
    lastPublished: z.string().nullable(),
    lastUpdated: z.string(),
    createdOn: z.string(),
    isArchived: z.boolean(),
    isDraft: z.boolean(),
    fieldData: z.object({
      "location": z.string(), // Option
      "url": z.string(), // Link
      "avatar": z.object({ fileId: z.string(), url: z.string(), alt: z.string().nullable() }), // Image
      "content": z.string(), // PlainText
      "order": z.number().nullable(), // Number
      "name": z.string(), // PlainText
      "slug": z.string(), // PlainText
    }),
  }),
});

export const collections = {
  "articles-learn": articlesLearn,
  "blog": blog,
  "blog-author": blogAuthor,
  "blog-category": blogCategory,
  "blueprints-developers": blueprintsDevelopers,
  "careers": careers,
  "categories-developers": categoriesDevelopers,
  "categories-learn": categoriesLearn,
  "ecosystem-projects": ecosystemProjects,
  "ecosystems-developers": ecosystemsDevelopers,
  "events": events,
  "faqs": faqs,
  "featured-on": featuredOn,
  "full-stack-social-comments": fullStackSocialComments,
  "navigation-featured-section": navigationFeaturedSection,
  "partners": partners,
  "podcast": podcast,
  "project-categories": projectCategories,
  "projects": projects,
  "projects-6-highlighted": projects6Highlighted,
  "radix-opp-services": radixOppServices,
  "radix-opp-statuses": radixOppStatuses,
  "radix-services": radixServices,
  "radix-statuses": radixStatuses,
  "sub-categories-learn": subCategoriesLearn,
  "team-member": teamMember,
  "team-members-learn": teamMembersLearn,
  "testemonials": testemonials,
  "tweets": tweets,
};
