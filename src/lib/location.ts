type ReverseGeocodeAddress = {
  city?: string;
  town?: string;
  village?: string;
  suburb?: string;
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
  const parts = [
    address.city ?? address.town ?? address.village ?? address.suburb,
    address.state ?? address.county,
    address.country,
  ].filter(Boolean) as string[];

  if (parts.length > 0) {
    return parts.join(", ");
  }

  return data.display_name?.trim() || "Unknown location";
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
