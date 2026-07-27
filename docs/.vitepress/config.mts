import { defineConfig } from 'vitepress'

const websiteIcon = {
  svg: '<svg role="img" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><title>Website</title><path fill="currentColor" d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-1 17.93c-3.95-.49-7-3.85-7-7.93 0-.62.08-1.21.21-1.79L9 15v1c0 1.1.9 2 2 2v1.93zm6.9-2.54c-.26-.81-1-1.39-1.9-1.39h-1v-3c0-.55-.45-1-1-1H8v-2h2c.55 0 1-.45 1-1V7h2c1.1 0 2-.9 2-2v-.41c2.93 1.19 5 4.06 5 7.41 0 2.08-.8 3.97-2.1 5.39z"/></svg>',
}

export default defineConfig({
  title: 'Dev Homelab',
  titleTemplate: ':title · Dev Homelab',
  description:
    'Documentation for the Dev Homelab — daily-use Proxmox, single-CP Kubernetes, GitOps, and LAN access.',
  base: '/dev-homelab/',
  lang: 'en-US',
  cleanUrls: true,
  lastUpdated: true,

  head: [
    ['meta', { name: 'author', content: 'Nasr Aldin' }],
    ['meta', { property: 'og:title', content: 'Dev Homelab' }],
    [
      'meta',
      {
        property: 'og:description',
        content: 'Daily-use Kubernetes homelab on dedicated Proxmox hardware.',
      },
    ],
    ['meta', { property: 'og:url', content: 'https://nasraldin.github.io/dev-homelab/' }],
    ['link', { rel: 'me', href: 'https://nasraldin.com' }],
  ],

  themeConfig: {
    siteTitle: 'Dev Homelab',
    nav: [
      { text: 'Daily guide', link: '/guide/daily-use' },
      { text: 'Bring up', link: '/runbook/bring-up' },
      { text: 'Topology', link: '/architecture/topology' },
      {
        text: 'Repos',
        items: [
          { text: 'lab-home-k8s', link: 'https://github.com/nasraldin/lab-home-k8s' },
          { text: 'lab-home-gitops', link: 'https://github.com/nasraldin/lab-home-gitops' },
          { text: 'pipeline-templates', link: 'https://github.com/nasraldin/pipeline-templates' },
        ],
      },
    ],

    sidebar: {
      '/': [
        {
          text: 'Start here',
          collapsed: false,
          items: [
            { text: 'Home', link: '/' },
            { text: 'Daily use guide', link: '/guide/daily-use' },
            { text: 'Laptop kubeconfig', link: '/guide/kubeconfig' },
          ],
        },
        {
          text: 'Architecture',
          collapsed: false,
          items: [
            { text: 'Topology', link: '/architecture/topology' },
            { text: 'Network and access', link: '/architecture/network-and-access' },
            { text: 'Kubernetes design', link: '/architecture/kubernetes' },
            { text: 'AI stack', link: '/architecture/ai-stack' },
            { text: 'OpenTelemetry', link: '/architecture/opentelemetry' },
            { text: 'GPU passthrough', link: '/architecture/gpu-passthrough' },
            { text: 'Secrets and Infisical', link: '/architecture/secrets-and-infisical' },
            { text: 'Supply chain', link: '/architecture/supply-chain' },
            { text: 'Wazuh placement', link: '/architecture/wazuh' },
          ],
        },
        {
          text: 'Runbooks',
          collapsed: false,
          items: [
            { text: 'Bring up from scratch', link: '/runbook/bring-up' },
            { text: 'Acceptance checklist', link: '/runbook/acceptance' },
            { text: 'etcd backup and restore', link: '/runbook/etcd-backup-restore' },
          ],
        },
        {
          text: 'Operations',
          collapsed: true,
          items: [{ text: 'Maintenance', link: '/operations/maintenance' }],
        },
        {
          text: 'Access',
          collapsed: true,
          items: [
            { text: 'Public URLs', link: '/access/public-urls' },
            { text: 'LAN DNS (*.lab)', link: '/access/lan-dns' },
          ],
        },
        {
          text: 'CI/CD',
          collapsed: true,
          items: [{ text: 'GitLab pipelines', link: '/ci/pipelines' }],
        },
      ],
    },

    socialLinks: [
      { icon: 'github', link: 'https://github.com/nasraldin/dev-homelab', ariaLabel: 'GitHub' },
      {
        icon: websiteIcon,
        link: 'https://nasraldin.com',
        ariaLabel: 'Nasr Aldin website',
      },
    ],

    search: {
      provider: 'local',
    },

    editLink: {
      pattern: 'https://github.com/nasraldin/dev-homelab/edit/main/docs/:path',
      text: 'Edit this page on GitHub',
    },

    footer: {
      message: 'Dev Homelab docs by <a href="https://nasraldin.com">Nasr Aldin</a>',
      copyright: 'Copyright © 2026 <a href="https://nasraldin.com">Nasr Aldin</a>',
    },

    outline: {
      level: [2, 3],
    },
  },
})
