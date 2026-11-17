// Store settings edited in the admin CMS (Settings page). Each top-level key is
// one row in the `settings` table; DEFAULT_SETTINGS fills in anything missing.

export interface StoreSettings {
  store: {
    name: string
    tagline: string
    about: string
    email: string
    phone: string
    whatsapp: string
    address: string
    socials: { instagram: string; tiktok: string; twitter: string; facebook: string; snapchat: string }
  }
  payments: {
    momoNumber: string
    momoName: string
    momoNetwork: string
    instructions: string
    paystackEnabled: boolean
  }
  delivery: {
    pickupAddress: string
    defaultFee: number
    freeOver: number
    regions: Array<{ name: string; fee: number }>
    note: string
  }
  notifications: {
    smsEnabled: boolean
    smsSender: string
    adminPhones: Array<string>
    orderPlaced: boolean
    paymentConfirmed: boolean
    statusChanged: boolean
  }
  seo: {
    titleSuffix: string
    defaultDescription: string
    keywords: string
  }
  announcement: { enabled: boolean; text: string; link: string }
}

export type SettingsKey = keyof StoreSettings
export const SETTINGS_KEYS: Array<SettingsKey> = ['store', 'payments', 'delivery', 'notifications', 'seo', 'announcement']

export const DEFAULT_SETTINGS: StoreSettings = {
  store: {
    name: 'Roes Outlet',
    tagline: 'Luxury on budget',
    about:
      'A jewelry brand that prioritises the best quality and bespoke jewelry for both men and women, young or old. Personalised pieces and jewelry combinations made for you: necklaces, bracelets, earrings, matching combos, anklets and more in stainless steel, gold plate and sterling silver.',
    email: 'roesoutlet@gmail.com',
    phone: '0541128719',
    whatsapp: '0541128719',
    address: 'Cape Coast, Ghana (4PM8+Q67)',
    socials: {
      instagram: 'roes_outlet',
      tiktok: 'roes_outlet',
      twitter: 'roes_outlet',
      facebook: 'Roes_radiance',
      snapchat: 'rhoouussyy',
    },
  },
  payments: {
    momoNumber: '0541128719',
    momoName: 'Roes Outlet',
    momoNetwork: 'MTN MoMo',
    instructions:
      'Send the order total to the MoMo number below with your order reference as the payment note, then enter the transaction ID so we can confirm it.',
    paystackEnabled: false,
  },
  delivery: {
    pickupAddress: 'Roes Outlet, Cape Coast (4PM8+Q67). We will text you when your order is ready.',
    defaultFee: 40,
    freeOver: 1000,
    regions: [
      { name: 'Greater Accra', fee: 35 },
      { name: 'Central', fee: 25 },
      { name: 'Ashanti', fee: 40 },
      { name: 'Western', fee: 40 },
      { name: 'Eastern', fee: 40 },
    ],
    note: 'Nationwide doorstep delivery by FedEx (next day, from GH₵35) or Speedaf (2–3 days, GH₵38–50), or same-day parcel by bus. No refunds; exchanges are allowed.',
  },
  notifications: {
    smsEnabled: true,
    smsSender: 'RoesOutlet',
    adminPhones: ['0541128719'],
    orderPlaced: true,
    paymentConfirmed: true,
    statusChanged: true,
  },
  seo: {
    titleSuffix: 'Roes Outlet',
    defaultDescription:
      'Shop affordable luxury jewelry in Ghana: gold and silver necklaces, luxe earrings, bracelet sets, watch sets, brooches and gift-ready combos. Nationwide delivery from Roes Outlet.',
    keywords: 'jewelry Ghana, earrings, necklaces, bracelets, watch sets, gold plated jewelry, Roes Outlet',
  },
  announcement: {
    enabled: true,
    text: 'Nationwide delivery · Every piece gift-boxed · Luxury on budget',
    link: '/shop',
  },
}
