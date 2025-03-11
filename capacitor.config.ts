
import { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.solofitness.app',
  appName: 'Solo Leveling Fitness',
  webDir: 'dist/public',
  server: {
    androidScheme: 'https'
  }
};

export default config;
