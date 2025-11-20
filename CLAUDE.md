# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

<<<<<<< Updated upstream
**Digital Assassins** is a cross-platform React Native application built with Expo, supporting iOS, Android, and web platforms from a single TypeScript codebase. The project uses Expo Router for file-based routing and React Navigation for advanced navigation patterns.

- **Repository**: https://github.com/FHU/Digital_Assassins.git
- **Framework**: React Native with Expo (v54.0.13)
- **Language**: TypeScript (v5.9.2, strict mode)
- **Build System**: Expo managed workflow
- **Package Manager**: npm

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
├── _layout.tsx        # Root layout wrapper
└── index.tsx          # Home screen / root route

app-example/           # Reference/template code (example patterns)
components/            # Reusable UI components (if created)
constants/             # Shared constants (colors, fonts, etc.)
hooks/                 # Custom React hooks
assets/                # Static images and fonts
```

### File-Based Routing (Expo Router)
- Files in `/app` automatically become routes
- `_layout.tsx` creates a layout wrapper for its directory
- `(tabs)` syntax creates route groups without affecting the URL
- `_layout.tsx` files define navigation structure for nested routes
- Use `.ios.tsx`, `.android.tsx`, `.web.tsx` for platform-specific code

Example structure:
```
app/
├── _layout.tsx           # Root wrapper
├── index.tsx             # "/" route
└── (tabs)/
    ├── _layout.tsx       # Tab navigation definition
    ├── home.tsx          # "/home" route
    └── explore.tsx       # "/explore" route
```

### Theme System
- Colors and typography are centralized (reference: `app-example/constants/theme.ts`)
- Custom hooks: `useColorScheme()`, `useThemeColor()` provide light/dark mode support
- Create themed components that accept `lightColor` and `darkColor` props
- System preference automatically switches theme (iOS/Android/web respect user settings)

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
- Place reusable components in `/components` directory
- Use composition over inheritance for complex UIs
- Create a `components/index.ts` barrel export for clean imports
- Reference `app-example/components/` for component patterns (themed text, views, etc.)

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

## Common Patterns from app-example

The `app-example` directory contains reference implementations:
- **Tab navigation** with haptic feedback (`app-example/app/(tabs)/_layout.tsx`)
- **Themed text and views** that support light/dark mode
- **Modal screens** with navigation
- **Custom hooks** for theme management
- **Parallax scroll views** for animated effects
- **Color scheme detection** (system preference + custom override)

Reference these files when implementing similar features.

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
=======
This is a React Native/Expo mobile application called "Digital_Assassins" built with TypeScript. It uses expo-router for file-based routing and supports iOS, Android, and web platforms. The project follows the Expo 54 framework with React 19 and React Native 0.81.

## Key Dependencies

- **Expo 54**: Cross-platform mobile framework
- **expo-router 6**: File-based routing system (similar to Next.js)
- **React 19 & React Native 0.81**: UI framework
- **React Navigation**: Navigation library with bottom tabs
- **React Native Reanimated & Gesture Handler**: Animation and gesture support
- **React Compiler**: Experimental React optimization enabled in app.json

## Directory Structure

```
├── app/                    # Main app code (file-based routing with expo-router)
│   ├── (tabs)/             # Tab layout group - renders bottom tab navigation
│   │   ├── index.tsx       # Home screen
│   │   ├── explore.tsx     # Explore screen
│   │   └── _layout.tsx     # Tab layout configuration
│   ├── modal.tsx           # Modal screen example
│   └── _layout.tsx         # Root layout with theme provider and stack navigator
├── components/             # Reusable UI components
│   ├── ui/                 # Atomic/base components (IconSymbol, Collapsible)
│   └── *                   # Feature/composite components (ThemedText, ThemedView, etc.)
├── constants/              # Theme colors and constants
├── hooks/                  # Custom React hooks (useColorScheme, useThemeColor)
├── scripts/                # Build and utility scripts
├── assets/                 # Images, icons, fonts
└── app.json                # Expo configuration and plugins
```

## Common Development Commands

```bash
# Start dev server
npm start

# Start on specific platform
npm run android              # Android emulator
npm run ios                  # iOS simulator
npm run web                  # Web browser

# Linting
npm run lint                 # Run ESLint

# Project reset
npm run reset-project        # Move starter code to app-example, create blank app
```

## Architecture & Routing

The app uses **expo-router** for file-based routing (file system → routes):
- `app/_layout.tsx` is the root layout wrapping all routes with a theme provider and status bar
- `app/(tabs)/` is a layout group creating a tab-based navigation UI
- Screens are defined by `.tsx` files in the app directory
- Routes are typed automatically with the `typedRoutes` experiment enabled

**Theming**: Color scheme (light/dark) is determined by `useColorScheme()` hook and passed through React Navigation's `ThemeProvider`.

## TypeScript Configuration

- Strict mode enabled: `"strict": true`
- Path alias: `@/*` maps to repository root for clean imports
- Target: ES2020+ with module support for React Native

## Theme System

- Colors defined in `constants/theme.ts` with light/dark variants
- `useColorScheme()` hook detects system theme preference
- `useThemeColor()` hook applies colors to specific design tokens
- Components use `ThemedText` and `ThemedView` for automatic theme support

## Component Patterns

- **Themed Components**: `ThemedText` and `ThemedView` automatically adapt to light/dark mode
- **Icon System**: `IconSymbol` component wraps platform-specific icon libraries
- **Haptic Feedback**: `HapticTab` provides haptic feedback on tab presses
- **Scroll Views**: `ParallaxScrollView` provides parallax header effect

## ESLint & Code Quality

- Configured via `eslint-config-expo` with flat config format
- Run `npm run lint` to check code
- The `dist/` directory is ignored
>>>>>>> Stashed changes
