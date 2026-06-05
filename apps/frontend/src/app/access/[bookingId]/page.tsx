import GateUnlocker from '../components/GateUnlocker';

export default async function AccessPage({ params }: { params: Promise<{ bookingId: string }> }) {
  const resolvedParams = await params;
  const bookingId = resolvedParams.bookingId;

  // In a real scenario, we would fetch the booking details here from the backend
  // to get the spot's latitude and longitude.
  // For this implementation, we will mock the spot coordinates (e.g. downtown Helsinki).
  const mockSpotLat = 60.1695;
  const mockSpotLng = 24.9354;

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-indigo-50 py-12 px-4 sm:px-6 lg:px-8 flex items-center justify-center">
      <div className="absolute inset-0 z-0 overflow-hidden">
        <div className="absolute -top-40 -right-40 w-80 h-80 bg-blue-100 rounded-full mix-blend-multiply filter blur-3xl opacity-70 animate-blob"></div>
        <div className="absolute top-40 -left-40 w-80 h-80 bg-indigo-100 rounded-full mix-blend-multiply filter blur-3xl opacity-70 animate-blob animation-delay-2000"></div>
        <div className="absolute -bottom-40 left-20 w-80 h-80 bg-purple-100 rounded-full mix-blend-multiply filter blur-3xl opacity-70 animate-blob animation-delay-4000"></div>
      </div>
      
      <div className="relative z-10 w-full">
        <GateUnlocker 
          bookingId={bookingId} 
          spotLatitude={mockSpotLat} 
          spotLongitude={mockSpotLng} 
        />
      </div>
    </div>
  );
}
