export type MapSpot = {
  id: string;
  title: string;
  address: string;
  latitude: number;
  longitude: number;
  pricePerHour: number;
  spaceCount?: number;
  availableSpaces?: number;
  availableDays?: string[];
  availableFrom?: string;
  availableUntil?: string;
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
    spaceCount: 2,
    availableDays: ["MON", "TUE", "WED", "THU", "FRI"],
    availableFrom: "08:00",
    availableUntil: "19:00",
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
    spaceCount: 1,
    availableDays: ["FRI", "SAT", "SUN"],
    availableFrom: "10:00",
    availableUntil: "23:00",
    description:
      "A tidy indoor spot close to NDK, useful for evening events and central errands.",
    hostUser: { name: "NDK Host" },
    averageRating: 4.6,
    reviewCount: 12,
  },
];
