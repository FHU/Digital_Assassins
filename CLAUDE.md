# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

**Digital Assassins** is a cross-platform React Native multiplayer game application built with Expo, supporting iOS, Android, and web platforms from a single TypeScript codebase. The project uses Expo Router for file-based routing and includes a backend with Prisma for game logic and state management.

- **Repository**: https://github.com/FHU/Digital_Assassins.git
- **Framework**: React Native with Expo (v54.0.13)
- **Language**: TypeScript (v5.9.2, strict mode)
- **Build System**: Expo managed workflow with new architecture enabled
- **Package Manager**: npm
- **Status**: In active development - core navigation, BLE scanning, lobby system, and game mechanics in progress

## Essential Commands

### Development
```bash
npm start                    # Start Expo development server (interactive menu)
npm run ios                  # Run on iOS simulator
npm run android              # Run on Android emulator
npm run web                  # Run web version in browser
```

### Code Quality
```bash
npm run lint                 # Check linting issues
npm run lint -- --fix        # Auto-fix linting issues
```

### Project Management
```bash
npm run reset-project        # Reset to blank app (moves starter code to app-example)
```

### Building for Production (via EAS)
```bash
eas build --platform ios      # Build for iOS (requires EAS account)
eas build --platform android  # Build for Android (requires EAS account)
```

## Directory Structure

```
app/                          # Main app code (file-based routing with expo-router)
├── _layout.tsx               # Root layout wrapper
├── index.tsx                 # Home screen / root route
├── ble-scanning.tsx          # BLE device scanning screen
├── join_lobby.tsx            # Join lobby screen
├── waiting_lobby.tsx         # Waiting lobby for players
├── join.tsx                  # Join match screen
├── host_page/                # Host match setup directory
│   └── (nested host routes)  # Host-specific screens
└── ...                       # Additional game screens

components/                   # Reusable UI components
├── ui/                       # Atomic/base components
└── *                         # Feature/composite components

constants/                    # Shared constants (theme colors, etc.)
hooks/                        # Custom React hooks
services/                     # Service layer (API calls, business logic)
prisma/                       # Prisma schema and migrations
assets/                       # Static images and fonts
```

## Architecture & Routing (Expo Router)

- Files in `/app` automatically become routes based on filename
- `_layout.tsx` files define navigation structure and wrappers for their directory
- `(groupName)` syntax creates route groups without affecting the URL path
- Use `.ios.tsx`, `.android.tsx`, `.web.tsx` suffixes for platform-specific code

### Current Application Routes

**Digital Assassins** is a multiplayer game with the following navigation flow:
- `/` - Home screen with Host/Join options
- `/join` - Join match screen
- `/join_lobby` - Join lobby to wait for game start
- `/waiting_lobby` - Waiting lobby for players
- `/ble-scanning` - BLE device discovery for nearby players
- `/host_page/*` - Host match setup and management screens

## Theme System

- Colors are defined in `constants/theme.ts` with light/dark variants
- `hooks/useColorScheme.ts` - Detects system color scheme preference
- `hooks/useThemeColor.ts` - Returns appropriate color based on theme
- Components use `ThemedText` and `ThemedView` for automatic theme support
- System preference automatically switches theme (respects iOS/Android/web settings)

## Key Technologies

### Frontend
- **Expo Router** (v6.0.11) - File-based routing
- **React Navigation** (v7.1.8) - Native navigation library
- **React Native Reanimated** (v4.1.1) - Complex animations
- **React Native Gesture Handler** (v2.28.0) - Touch gestures
- **Expo Vector Icons** - Icon library
- **expo-device** - Device information and capabilities
- **expo-haptics** - Haptic feedback

### Backend & State
- **Prisma** - Database ORM and schema management
- **React Context API** - Global state management (primary approach)
- Consider Redux, Zustand, or MobX for complex state if needed

### Platform Features
- **expo-splash-screen** - Custom splash screen
- **expo-image** - Optimized image component
- **expo-font** - Custom font loading
- **React Native Web** (v0.21.0) - Web platform support
- **expo-ble** or similar - Bluetooth Low Energy for device scanning

## Development Guidelines

### TypeScript
- Strict mode is enabled; fix all type errors before committing
- Use path alias `@/` for absolute imports (configured in `tsconfig.json`)
- Define component props with `interface Props { ... }` or `type Props = { ... }`

### Code Quality
- ESLint is configured via `eslint-config-expo`
- VSCode auto-fixes linting issues on save (`.vscode/settings.json`)
- Import organization is automatic on save
- No test framework currently configured; focus on code review and manual testing

### Component Development
- Reusable UI components are located in `/components` directory
- Create a `components/index.ts` barrel export for clean imports
- Use `useThemeColor` hook for theme-aware styling
- Use composition over inheritance for complex UIs
- Platform-specific implementations use `.ios.tsx`, `.android.tsx`, `.web.tsx` suffixes

### Cross-Platform Development
- Write platform-agnostic code by default
- Use platform-specific files only when necessary
- Test on all three platforms (iOS simulator, Android emulator, web) before committing
- Use `Platform` from `react-native` for runtime platform detection if needed

## Configuration Files

### app.json
- Expo configuration file; defines app name, splash screen, icons, native features
- `experiments.reactCompiler` is enabled for automatic optimization
- `experiments.typedRoutes` is enabled for type-safe route navigation
- `scheme: "digitalassassins"` for deep linking

### tsconfig.json
- Extends Expo's base config with strict TypeScript settings
- Path alias: `@/*` maps to project root

### prisma.config.ts
- Prisma configuration for database schema and client setup

### eslint.config.js
- Uses Expo's ESLint configuration
- Ignores: `dist/*` directory

### .vscode/
- `settings.json`: Auto-fix on save, import organization, member sorting
- `extensions.json`: Recommends `expo.vscode-expo-tools` extension

## Testing & Deployment

### Manual Testing
- Use manual testing on all platforms (iOS, Android, web)
- Use ESLint for code quality checks
- Consider adding Jest or Vitest if test coverage is needed

### Mobile Deployment
- Use EAS Build for managed CI/CD: `eas build --platform ios/android`
- Requires EAS account (see https://eas.dev)
- Credentials are managed by Expo (not stored in repo per `.gitignore`)

### Web Deployment
- `npm run web` produces a static output directory
- Can be deployed to Vercel, Netlify, or any static hosting service
- Configure in `app.json` under `web` section

## Git Workflow

- **Main branch**: `main` (default branch for PRs)
- Project uses standard git; no special workflow required
- `.gitignore` excludes: node_modules, .expo, native builds, .env files
- Commits should reference the specific feature or fix being implemented

## Performance & Optimization

- React Compiler (v19) is enabled experimentally for automatic optimization
- React Native new architecture is enabled in `app.json`
- Use React.memo for expensive components if needed
- Monitor bundle size using `npx expo export --platform web`
- BLE scanning operations should be optimized to avoid excessive battery drain

## Useful Resources

- **Expo Docs**: https://docs.expo.dev/
- **Expo Router Guide**: https://docs.expo.dev/router/introduction/
- **React Navigation**: https://reactnavigation.org/
- **React Native Docs**: https://reactnative.dev/
- **TypeScript React**: https://www.typescriptlang.org/docs/handbook/jsx.html
- **Prisma Docs**: https://www.prisma.io/docs/

## Platform-Specific Notes

### iOS
- Uses native React for iOS UI
- Requires Xcode simulator or physical device via development build
- Haptic feedback uses native iOS haptics API
- App Store deployment via EAS Build + Apple Developer account
- BLE requires appropriate device capabilities

### Android
- Uses native React for Android UI
- Requires Android Studio emulator or physical device
- Haptic feedback uses Android vibration API
- Google Play Store deployment via EAS Build + Google Play Developer account
- BLE requires appropriate permissions in AndroidManifest.xml

### Web
- Uses React Native Web; renders to DOM
- Responsive design required (consider different screen sizes)
- No native APIs (no haptics, no BLE, limited camera/contacts access)
- Deploy as static site or SPA

## Debugging

- Use Expo Go app for sandbox development (limited native features)
- Create development build for full native feature access: `eas build --platform [ios|android] --profile preview`
- Use device/simulator dev menu: Shake device (iOS) or press menu button (Android)
- VSCode debugging: Install `expo.vscode-expo-tools` extension for enhanced debugging
- Web debugging: Use browser DevTools (F12)
