import { Platform } from 'react-native';

const tintColorLight = '#ffffffff'; 
const tintColorDark = '#741707ff'; 

export const Colors = {
  light: {
    text: '#11181C',          // dark gray text
    background: '#F2F4F6',    // light gray background
    tint: tintColorLight,     // accent
    icon: '#687076',
    tabIconDefault: '#9BA1A6',
    tabIconSelected: tintColorLight,

    // Custom extras for your buttons
    primary: '#00BFA6',       
    danger: '#FF3366',       
  },
  dark: {
    text: '#ECEDEE',          // light gray text
    background: '#0C1116',    // dark navy background
    tint: tintColorDark,      // accent
    icon: '#9BA1A6',
    tabIconDefault: '#9BA1A6',
    tabIconSelected: tintColorDark,

    primary: '#00BFA6',       
    danger: '#FF3366',        
  },
};

export const Fonts = Platform.select({
  ios: {
    sans: 'system-ui',
    serif: 'ui-serif',
    rounded: 'ui-rounded',
    mono: 'ui-monospace',
  },
  default: {
    sans: 'normal',
    serif: 'serif',
    rounded: 'normal',
    mono: 'monospace',
  },
  web: {
    sans: "system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif",
    serif: "Georgia, 'Times New Roman', serif",
    rounded: "'SF Pro Rounded', 'Hiragino Maru Gothic ProN', Meiryo, 'MS PGothic', sans-serif",
    mono: "SFMono-Regular, Menlo, Monaco, Consolas, 'Liberation Mono', 'Courier New', monospace",
  },
});
