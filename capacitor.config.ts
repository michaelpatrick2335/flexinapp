import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.flexinapp.fitness',
  appName: 'Flexin',
  // Capacitor copies these files into the native iOS app bundle.
  // We use the already-built /app subfolder so the native app runs the
  // fitness client (not the marketing landing page).
  webDir: 'dist/public/app',
  // Helpful during development on a Mac if you want to point the app
  // at your live web build instead of the bundled copy. Leave commented
  // out for production builds.
  // server: {
  //   url: 'https://www.flexinfitapp.com/app',
  //   cleartext: false,
  // },
  ios: {
    contentInset: 'always',
    // Use the default WKWebView background so our dark UI doesn't flash white on load
    backgroundColor: '#0a0a0a',
  },
  plugins: {
    // Capacitor's SplashScreen plugin was painting a WHITE intermediate
    // screen (its default "Splash" image asset is white) between iOS
    // LaunchScreen and our React mount. We disable it entirely — our custom
    // dark LaunchScreen.storyboard now covers the full window until React
    // is interactive, and our html/body/#root are already #0d0f1a.
    SplashScreen: {
      launchShowDuration: 0,
      launchAutoHide: true,
      backgroundColor: '#0d0f1a',
      androidScaleType: 'CENTER_CROP',
      showSpinner: false,
      splashFullScreen: true,
      splashImmersive: true,
    },
    StatusBar: {
      style: 'DARK',
      backgroundColor: '#0a0a0a',
    },
  },
};

export default config;
