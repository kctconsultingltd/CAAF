import type { Core } from '@strapi/strapi';

const config = ({ env }: Core.Config.Shared.ConfigParams): Core.Config.Plugin => ({
  upload: {
    config: {
      provider: 'aws-s3',
      providerOptions: {
        accessKeyId: env('TIGRIS_ACCESS_KEY_ID'),
        secretAccessKey: env('TIGRIS_SECRET_ACCESS_KEY'),
        region: env('TIGRIS_REGION', 'auto'),
        endpoint: env('TIGRIS_ENDPOINT', 'https://fly.storage.tigris.dev'),
        forcePathStyle: true,
        params: {
          Bucket: env('TIGRIS_BUCKET_NAME'),
        },
      },
      actionOptions: {
        upload: {},
        uploadStream: {},
        delete: {},
      },
    },
  },
  'users-permissions': {
    config: {
      jwtSecret: env('JWT_SECRET'),
    },
  },
  // ─── Email ───────────────────────────────────────────────────────────────────
  // Install: npm install @strapi/plugin-email @strapi/provider-email-nodemailer
  // Then uncomment the block below and set env vars in .env
  //
  // email: {
  //   config: {
  //     provider: 'nodemailer',
  //     providerOptions: {
  //       host: env('SMTP_HOST', 'smtp.example.com'),
  //       port: env.int('SMTP_PORT', 587),
  //       secure: env.bool('SMTP_SECURE', false),
  //       auth: {
  //         user: env('SMTP_USERNAME'),
  //         pass: env('SMTP_PASSWORD'),
  //       },
  //     },
  //     settings: {
  //       defaultFrom: env('EMAIL_FROM', 'noreply@yourdomain.com'),
  //       defaultReplyTo: env('EMAIL_FROM', 'noreply@yourdomain.com'),
  //     },
  //   },
  // },
});

export default config;
