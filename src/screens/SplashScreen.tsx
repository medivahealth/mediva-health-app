import React, { useEffect, useRef } from 'react';
import { View, Text, StyleSheet, Animated, Dimensions, ImageBackground, Image, Platform } from 'react-native';

const { width } = Dimensions.get('window');

// Use a light Helvetica Neue style for brand text.
const MEDIVA_FONT_LIGHT = Platform.select({
  ios: 'HelveticaNeue-Light',
  android: 'sans-serif-light',
  default: 'Helvetica',
});

interface SplashScreenProps {
  onFinish: () => void;
}

export default function SplashScreen({ onFinish }: SplashScreenProps) {
  const logoScale = useRef(new Animated.Value(0.3)).current;
  const logoOpacity = useRef(new Animated.Value(0)).current;
  const textOpacity = useRef(new Animated.Value(0)).current;
  const taglineOpacity = useRef(new Animated.Value(0)).current;
  const logoPng = require('../../assets/applogo.png');

  useEffect(() => {
    Animated.sequence([
      // 1. Logo fades in and scales up
      Animated.parallel([
        Animated.timing(logoOpacity, {
          toValue: 1,
          duration: 600,
          useNativeDriver: true,
        }),
        Animated.spring(logoScale, {
          toValue: 1,
          friction: 6,
          tension: 40,
          useNativeDriver: true,
        }),
      ]),
      // 2. "Mediva" text fades in
      Animated.timing(textOpacity, {
        toValue: 1,
        duration: 500,
        useNativeDriver: true,
      }),
      // 3. Tagline fades in
      Animated.timing(taglineOpacity, {
        toValue: 1,
        duration: 500,
        useNativeDriver: true,
      }),
    ]).start();

    const timer = setTimeout(onFinish, 3500);
    return () => clearTimeout(timer);
  }, []);

  return (
    <ImageBackground
      source={require('../../assets/background.png')}
      style={styles.background}
      resizeMode="cover"
    >
      <View style={styles.container}>
        <Animated.View
          style={[
            styles.logoContainer,
            { opacity: logoOpacity, transform: [{ scale: logoScale }] },
          ]}
        >
          <Image source={logoPng} style={styles.logoFallback} resizeMode="contain" />
        </Animated.View>

        <View style={styles.textBlock}>
          <Animated.Text style={[styles.appName, { opacity: textOpacity }]}>
            Mediva
          </Animated.Text>

          <Animated.View style={[styles.taglineWrap, { opacity: taglineOpacity }]}>
            <Text style={styles.taglineLine1}>
              World-class Health , Absolutely free.
            </Text>
          </Animated.View>
        </View>
      </View>
    </ImageBackground>
  );
}

const LOGO_SIZE = width * 0.27;

const styles = StyleSheet.create({
  background: {
    flex: 1,
  },
  container: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 32,
  },
  logoContainer: {
    alignItems: 'center',
    marginBottom: 18, // pushes name slightly down from the centered logo
  },
  logoFallback: {
    width: LOGO_SIZE,
    height: LOGO_SIZE,
  },
  textBlock: {
    width: '100%',
    alignItems: 'center',
  },
  appName: {
    fontFamily: MEDIVA_FONT_LIGHT,
    fontWeight: '300',
    fontSize: 40,
    lineHeight: 48,
    color: '#FFFFFF',
    letterSpacing: 0.4,
    marginBottom: 12,
  },
  taglineWrap: {
    alignItems: 'center',
  },
  taglineLine1: {
    fontFamily: MEDIVA_FONT_LIGHT,
    fontWeight: '300',
    fontSize: 16,
    color: '#E5E7EB',
    textAlign: 'center',
    lineHeight: 24,
    letterSpacing: 0.18,
    maxWidth: 340,
  },
});
