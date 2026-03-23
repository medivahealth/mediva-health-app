## iOS (Apple Health) build steps

### 1) Install EAS CLI

```bash
npm i -g eas-cli
```

### 2) Login to Expo

```bash
eas login
```

### 3) Configure the project (first time)

From the project root:

```bash
eas build:configure
```

### 4) Create a development build (real device, HealthKit works)

```bash
eas build --platform ios --profile development
```

Install the resulting `.ipa` on your iPhone (EAS provides a link/QR). This is required because **Expo Go cannot access HealthKit**.

### 5) App config already includes HealthKit entitlement

HealthKit usage strings and entitlements are in `app.json` under `expo.ios.infoPlist` and `expo.ios.entitlements`.

