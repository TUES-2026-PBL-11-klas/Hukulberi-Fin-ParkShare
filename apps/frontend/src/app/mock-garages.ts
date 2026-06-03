export type MapSpot = {
  id: string;
  title: string;
  address: string;
  latitude: number;
  longitude: number;
  pricePerHour: number;
  description?: string;
  photoUrls?: string[];
  hostUser?: {
    id?: string;
    name: string;
    email?: string;
  };
  averageRating?: number;
  reviewCount?: number;
};

export const mockGarages: MapSpot[] = [
  {
    id: "mock-garage-central",
    title: "Central Sofia Garage",
    address: "ul. Graf Ignatiev 18, Sofia",
    latitude: 42.6917,
    longitude: 23.3256,
    pricePerHour: 500,
    description:
      "Covered private garage near the city center with easy street access and enough clearance for most compact and midsize cars.",
    hostUser: { name: "ParkShare Demo Host" },
    averageRating: 4.8,
    reviewCount: 18,
  },
  {
    id: "mock-garage-ndk",
    title: "NDK Covered Parking",
    address: "bul. Vitosha 68, Sofia",
    latitude: 42.6869,
    longitude: 23.3187,
    pricePerHour: 450,
    description:
      "A tidy indoor spot close to NDK, useful for evening events and central errands.",
    hostUser: { name: "NDK Host" },
    averageRating: 4.6,
    reviewCount: 12,
  },
  {
    id: "mock-garage-alexander",
    title: "Alexander Nevsky Spot",
    address: "pl. Sveti Aleksandar Nevski, Sofia",
    latitude: 42.6962,
    longitude: 23.3328,
    pricePerHour: 600,
    description:
      "Central courtyard parking within walking distance of Alexander Nevsky Cathedral and nearby offices.",
    hostUser: { name: "Central Host" },
    averageRating: 4.9,
    reviewCount: 25,
  },
  {
    id: "mock-garage-lozenets",
    title: "Lozenets Private Garage",
    address: "ul. Krichim 24, Sofia",
    latitude: 42.6749,
    longitude: 23.3201,
    pricePerHour: 380,
    description:
      "Quiet residential garage in Lozenets with a straightforward entrance and calm surrounding streets.",
    hostUser: { name: "Lozenets Host" },
    averageRating: 4.7,
    reviewCount: 9,
  },
  {
    id: "mock-garage-oborishte",
    title: "Oborishte Courtyard Bay",
    address: "ul. Oborishte 31, Sofia",
    latitude: 42.699,
    longitude: 23.3421,
    pricePerHour: 420,
    description:
      "Courtyard bay in Oborishte, suited for short city visits and predictable daytime parking.",
    hostUser: { name: "Oborishte Host" },
    averageRating: 4.5,
    reviewCount: 7,
  },
];
