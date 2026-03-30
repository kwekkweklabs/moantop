interface AppConfig {
  appName: string
  appDescription: string
  links: {
    twitter: string
    github: string
    telegram: string
    discord: string
    docs: string
    buy: string
  }
  contracts: {
    main: string
    token: string
  }
  features: {
    darkMode: boolean
    smoothScroll: boolean
  }
}

export const config: AppConfig = {
  appName: 'MoanTop',
  appDescription: 'Smack your laptop and it moans back. The funniest prank website on the internet.',

  // Social links
  links: {
    twitter: '',
    github: 'https://github.com/kwekkweklabs/moantop',
    telegram: '',
    discord: '',
    docs: '',
    buy: '',
  },

  // Contract/wallet related (if needed)
  contracts: {
    main: '',
    token: '',
  },

  // Feature flags
  features: {
    darkMode: true,
    smoothScroll: true,
  },
}

export type Config = AppConfig
