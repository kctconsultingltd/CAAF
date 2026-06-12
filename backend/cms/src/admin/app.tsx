import type { StrapiApp } from '@strapi/strapi/admin';

export default {
  config: {
    locales: [],

    head: {
      favicon: '/caaf-logo.png',
      title: 'CAAF Admin',
    },

    auth: {
      logo: '/caaf-logo.png',
    },

    menu: {
      logo: '/caaf-logo.png',
    },

    theme: {
      dark: {
        colors: {
          // Primary / gold accent
          primary100: '#2a2008',
          primary200: '#4a3a10',
          primary500: '#c9a84c',
          primary600: '#b8933c',
          primary700: '#a07c2c',

          // Buttons
          buttonPrimary500: '#c9a84c',
          buttonPrimary600: '#b8933c',

          // Neutral surfaces — deep navy/charcoal matching the site
          neutral0:   '#0d0d1a',
          neutral100: '#13131f',
          neutral150: '#17172a',
          neutral200: '#1e1e30',
          neutral300: '#2a2a40',
          neutral400: '#3a3a55',
          neutral500: '#7a7a9a',
          neutral600: '#9a9aba',
          neutral700: '#c0c0d8',
          neutral800: '#e0e0f0',
          neutral900: '#f0f0fa',
          neutral1000: '#ffffff',

          // Danger stays red
          danger100: '#2a0808',
          danger200: '#5a1010',
          danger500: '#ee5e52',
          danger600: '#e03628',
          danger700: '#b72b1a',

          // Success stays green
          success100: '#071910',
          success200: '#0e3320',
          success500: '#4caf87',
          success600: '#3d9e76',
          success700: '#2d8d65',
        },
      },

      light: {
        colors: {
          primary100: '#fdf6e3',
          primary200: '#f5e6b8',
          primary500: '#c9a84c',
          primary600: '#b8933c',
          primary700: '#a07c2c',

          buttonPrimary500: '#c9a84c',
          buttonPrimary600: '#b8933c',
        },
      },
    },

    tutorials: false,
    notifications: { releases: false },
  },

  bootstrap(_app: StrapiApp) {},
};
