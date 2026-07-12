type ReverseGeocodeAddress = {
  house_number?: string;
  road?: string;
  neighbourhood?: string;
  suburb?: string;
  city_district?: string;
  city?: string;
  town?: string;
  village?: string;
  county?: string;
  state?: string;
  country?: string;
};

type ReverseGeocodeResponse = {
  display_name?: string;
  address?: ReverseGeocodeAddress;
};

export async function resolveCurrentLocation(): Promise<string> {
  if (typeof window === "undefined" || !("geolocation" in navigator)) {
    throw new Error("Location detection is not supported in this browser.");
  }

  return new Promise<string>((resolve, reject) => {
    navigator.geolocation.getCurrentPosition(
      async ({ coords }) => {
        try {
          const location = await reverseGeocode(coords.latitude, coords.longitude);
          resolve(location);
        } catch (error) {
          reject(error instanceof Error ? error : new Error("We couldn’t determine your location from your coordinates."));
        }
      },
      (error) => {
        reject(mapGeolocationError(error));
      },
      {
        enableHighAccuracy: true,
        timeout: 10000,
        maximumAge: 60000,
      },
    );
  });
}

async function reverseGeocode(latitude: number, longitude: number): Promise<string> {
  const url = new URL("https://nominatim.openstreetmap.org/reverse");
  url.searchParams.set("format", "jsonv2");
  url.searchParams.set("lat", String(latitude));
  url.searchParams.set("lon", String(longitude));
  url.searchParams.set("zoom", "18");
  url.searchParams.set("addressdetails", "1");
  url.searchParams.set("accept-language", "en");

  const response = await fetch(url.toString(), {
    headers: {
      Accept: "application/json",
    },
  });

  if (!response.ok) {
    throw new Error("Reverse geocoding failed. Please enter your location manually.");
  }

  const data = (await response.json()) as ReverseGeocodeResponse;
  const address = data.address ?? {};
  const city = address.city ?? address.town ?? address.village ?? address.city_district;
  const parts = [
    address.neighbourhood ?? address.suburb,
    city
  ].filter(Boolean) as string[];

  if (parts.length > 0) {
    return parts.join(", ");
  }

  // Fallback: take first 2 parts of display_name (typically locality/city) to omit country/state
  if (data.display_name) {
    const displayParts = data.display_name.split(",").map((p) => p.trim());
    return displayParts.slice(0, Math.min(2, displayParts.length)).join(", ");
  }

  return "Unknown location";
}

function mapGeolocationError(error: GeolocationPositionError): Error {
  switch (error.code) {
    case error.PERMISSION_DENIED:
      return new Error("Location access was denied. You can still enter your location manually.");
    case error.POSITION_UNAVAILABLE:
      return new Error("Your location is currently unavailable. Please try again or enter it manually.");
    case error.TIMEOUT:
      return new Error("Location lookup timed out. Please try again or enter your location manually.");
    default:
      return new Error("We couldn’t detect your location right now. Please try again or enter it manually.");
  }
}
