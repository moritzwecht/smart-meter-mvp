import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
    appId: 'de.moritzwecht.home',
    appName: 'My Home',
    webDir: 'public',
    server: {
        url: 'https://home.moritz-wecht.de',
        cleartext: true,
    },
};

export default config;
