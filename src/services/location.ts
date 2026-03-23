import * as Location from 'expo-location';

export type LocationStateResult =
  | { consent: true; state: string; country: string; lat: number; lng: number }
  | { consent: false };

export async function requestAndResolveState(): Promise<LocationStateResult> {
  const { status } = await Location.requestForegroundPermissionsAsync();
  if (status !== 'granted') return { consent: false };

  const pos = await Location.getCurrentPositionAsync({
    accuracy: Location.Accuracy.Balanced,
  });

  const lat = pos.coords.latitude;
  const lng = pos.coords.longitude;

  const geo = await Location.reverseGeocodeAsync({ latitude: lat, longitude: lng });
  const first = geo[0];

  const state = (first?.region || first?.subregion || '').trim();
  const country = (first?.isoCountryCode || first?.country || '').trim();

  if (!state || !country) return { consent: false };

  return { consent: true, state, country, lat, lng };
}

