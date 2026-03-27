import * as Location from 'expo-location';

export type LocationStateResult =
  | { consent: true; state: string; country: string; lat: number; lng: number }
  | { consent: false; canAskAgain?: boolean };

export async function requestAndResolveState(): Promise<LocationStateResult> {
  const permission = await Location.requestForegroundPermissionsAsync();
  if (permission.status !== 'granted') {
    return { consent: false, canAskAgain: permission.canAskAgain };
  }

  const pos = await Location.getCurrentPositionAsync({
    accuracy: Location.Accuracy.Balanced,
  });

  const lat = pos.coords.latitude;
  const lng = pos.coords.longitude;

  const geo = await Location.reverseGeocodeAsync({ latitude: lat, longitude: lng });
  const first = geo[0];

  const state = (first?.region || first?.subregion || '').trim();
  const country = (first?.isoCountryCode || first?.country || '').trim();

  if (!state || !country) return { consent: false, canAskAgain: true };

  return { consent: true, state, country, lat, lng };
}

