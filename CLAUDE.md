# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

**Digital Assassins** is a cross-platform React Native multiplayer game application built with Expo, supporting iOS, Android, and web platforms from a single TypeScript codebase. The project uses Expo Router for file-based routing and is in early development (MVP phase with placeholder screens).

- **Repository**: https://github.com/FHU/Digital_Assassins.git
- **Framework**: React Native with Expo (v54.0.13)
- **Language**: TypeScript (v5.9.2, strict mode)
- **Build System**: Expo managed workflow with new architecture enabled
- **Package Manager**: npm
- **Status**: Early development - core navigation and theme system in place, game logic to be implemented

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

## Architecture & Code Structure

### Directory Organization
```
app/                    # Active development (file-based routing)
├── _layout.tsx        # Root layout wrapper (Stack navigation)
├── index.tsx          # Home screen / root route
├── host.tsx           # Host match screen
└── join.tsx           # Join match screen

constants/             # Shared constants (theme colors, etc.)
hooks/                 # Custom React hooks (useColorScheme, useThemeColor)
assets/                # Static images and fonts
```

**Note**: The `app-example/` directory only exists after running `npm run reset-project`. The `components/` directory should be created as reusable UI components are extracted.

### File-Based Routing (Expo Router)
- Files in `/app` automatically become routes based on filename
- `_layout.tsx` files define navigation structure and wrappers for their directory
- `(groupName)` syntax creates route groups without affecting the URL path
- Use `.ios.tsx`, `.android.tsx`, `.web.tsx` suffixes for platform-specific code

Current routes:
- `index.tsx` → "/" (Home screen)
- `host.tsx` → "/host" (Host match setup)
- `join.tsx` → "/join" (Join match screen)

The root `_layout.tsx` uses `Stack` navigation to manage screen transitions.

### Theme System
- Colors are defined in `constants/theme.ts` (primary, danger, text, tint, background, etc.)
- `hooks/useColorScheme.ts` - Detects system color scheme preference (light/dark)
- `hooks/useThemeColor.ts` - Returns appropriate color based on theme mode
- Call `useThemeColor({}, "colorName")` in components to get theme-aware colors
- System preference automatically switches theme (respects iOS/Android/web system settings)

### UI Components Pattern
- Use TypeScript for all components (strict mode enabled)
- Export components from a single index file (barrel export pattern)
- Support platform-specific implementations via `.ios.tsx`, `.web.tsx` suffixes
- Use `expo-vector-icons` for icons (`@expo/vector-icons/MaterialCommunityIcons`, etc.)

## Key Technologies

### Navigation
- **Expo Router** (v6.0.11) - File-based routing
- **React Navigation** (v7.1.8) - Native navigation library
  - `@react-navigation/bottom-tabs` - Tab-based navigation
  - `@react-navigation/native` - Core navigation primitives

### UI & Animation
- **React Native Reanimated** (v4.1.1) - Complex animations
- **React Native Gesture Handler** (v2.28.0) - Touch gestures
- **Expo Vector Icons** (v15.0.2) - Icon library

### Platform Features
- **expo-haptics** - Haptic feedback (vibration)
- **expo-splash-screen** - Custom splash screen
- **expo-image** - Optimized image component
- **expo-font** - Custom font loading
- **React Native Web** (v0.21.0) - Web platform support

## Development Guidelines

### TypeScript
- Strict mode is enabled; fix all type errors before committing
- Use path alias `@/` for absolute imports (configured in `tsconfig.json`)
- Define component props with `interface Props { ... }` or `type Props = { ... }`

### Code Quality
- ESLint is configured via `eslint-config-expo`
- VSCode auto-fixes linting issues on save (`.vscode/settings.json`)
- Import organization is automatic on save
- No tests are configured; focus on code review and manual testing

### Component Development
- As components become reusable across screens, extract them to `/components` directory
- Create a `components/index.ts` barrel export for clean imports: `export { Button } from './Button'`
- Use `useThemeColor` hook for theme-aware styling in all components
- Use composition over inheritance for complex UIs
- Each screen currently uses inline `StyleSheet.create()` - consider extracting styles as component library grows

### Cross-Platform Development
- Write platform-agnostic code by default
- Use platform-specific files only when necessary (`.ios.tsx`, `.android.tsx`, `.web.tsx`)
- Test on all three platforms (iOS simulator, Android emulator, web) before committing
- Use `Platform` from `react-native` for runtime platform detection if needed

### State Management
- Currently no state management library is configured
- Use React Context API for global state (reference: `app-example` for patterns)
- Consider Redux, Zustand, or MobX if complex state is needed

## Configuration Files

### app.json
- Expo configuration file; defines app name, splash screen, icons, native features
- `experiments.reactCompiler` is enabled for automatic optimization
- `experiments.typedRoutes` is enabled for type-safe route navigation
- `scheme: "digitalassassins"` for deep linking

### tsconfig.json
- Extends Expo's base config with strict TypeScript settings
- Path alias: `@/*` maps to project root

### eslint.config.js
- Uses Expo's ESLint configuration
- Ignores: `dist/*` directory

### .vscode/
- `settings.json`: Auto-fix on save, import organization, member sorting
- `extensions.json`: Recommends `expo.vscode-expo-tools` extension

## Testing & Deployment

### No Test Framework Currently
- Use manual testing on all platforms (iOS, Android, web)
- Use ESLint for code quality checks
- Consider adding Jest or Vitest if test coverage is needed

### Web Deployment
- `npm run web` produces a static output directory
- Can be deployed to Vercel, Netlify, or any static hosting service
- Configure in `app.json` under `web` section

### Mobile Deployment
- Use EAS Build for managed CI/CD: `eas build --platform ios/android`
- Requires EAS account (see https://eas.dev)
- Credentials are managed by Expo (not stored in repo per `.gitignore`)

## Current Application Structure

**Digital Assassins** is a multiplayer game application in early development. The current routing structure:
- `/` - Home screen with Host/Join buttons
- `/host` - Host match setup screen (placeholder)
- `/join` - Join match screen (placeholder)

### Theme & Styling
- Colors are defined in `constants/theme.ts`
- Custom hooks provide theme colors: `useColorScheme()`, `useThemeColor()`
- The app uses inline `StyleSheet.create()` for component styling (not extracted to separate files yet)
- Theme colors include: `primary`, `danger`, `text`, `tint`, `background`
- System automatically switches between light/dark mode based on device preference

## Git Workflow

- **Main branch**: `main` (default branch for PRs)
- Project uses standard git; no special workflow required
- `.gitignore` excludes: node_modules, .expo, native builds, app-example, .env files
- Commits should reference the specific feature or fix being implemented

## Performance & Optimization

- React Compiler (v19) is enabled experimentally for automatic optimization
- React Native new architecture is enabled in `app.json`
- Use React.memo for expensive components if needed
- Monitor bundle size using `npx expo export --platform web`
- Lazy load screens using React Router code splitting if needed

## Useful Resources

- **Expo Docs**: https://docs.expo.dev/
- **Expo Router Guide**: https://docs.expo.dev/router/introduction/
- **React Navigation**: https://reactnavigation.org/
- **React Native Docs**: https://reactnative.dev/
- **TypeScript React**: https://www.typescriptlang.org/docs/handbook/jsx.html

## Platform-Specific Notes

### iOS
- Uses native React for iOS UI
- Requires Xcode simulator or physical device via development build
- Haptic feedback uses native iOS haptics API
- App Store deployment via EAS Build + Apple Developer account

### Android
- Uses native React for Android UI
- Requires Android Studio emulator or physical device
- Haptic feedback uses Android vibration API
- Google Play Store deployment via EAS Build + Google Play Developer account

### Web
- Uses React Native Web; renders to DOM
- Responsive design required (consider different screen sizes)
- No native APIs (no haptics, limited camera/contacts access)
- Deploy as static site or SPA

## Debugging

- Use Expo Go app for sandbox development (limited native features)
- Create development build for full native feature access: `eas build --platform [ios|android] --profile preview`
- Use device/simulator dev menu: Shake device (iOS) or press menu button (Android)
- VSCode debugging: Install `expo.vscode-expo-tools` extension for enhanced debugging
- Web debugging: Use browser DevTools (F12)
