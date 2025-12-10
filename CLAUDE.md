# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

<<<<<<< Updated upstream
**Digital Assassins** is a cross-platform React Native application built with Expo, supporting iOS, Android, and web platforms from a single TypeScript codebase. The project uses Expo Router for file-based routing and React Navigation for advanced navigation patterns.

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
├── join.tsx           # Join match screen (enter code)
├── join_lobby.tsx     # Join lobby screen (lobby details after code verified)
└── host_page/         # Host match management
    ├── host.tsx       # Host match setup (main screen)
    ├── lobby_code.tsx # Display generated lobby code
    ├── lobby_name.tsx # Set lobby/game name
    ├── participant_list.tsx # List all joined participants
    └── participant.tsx # Individual participant component

components/            # Reusable UI components
├── index.ts          # Barrel export
└── JoinCodeInput.tsx # Code input component (6-digit)

constants/            # Shared constants (theme colors, etc.)
hooks/                # Custom React hooks
├── useColorScheme.ts
├── useThemeColor.ts
├── useBluetooth.ts   # Bluetooth connectivity management
services/             # Business logic and data management
├── LobbyStore.ts     # MVP in-memory lobby storage (code generation, participant management)
assets/               # Static images and fonts
```

**Note**: The `app-example/` directory contains the Expo starter template and is preserved for reference.

### File-Based Routing (Expo Router)
- Files in `/app` automatically become routes based on filename
- `_layout.tsx` files define navigation structure and wrappers for their directory
- `(groupName)` syntax creates route groups without affecting the URL path
- Use `.ios.tsx`, `.android.tsx`, `.web.tsx` suffixes for platform-specific code

Current routes:
- `index.tsx` → "/" (Home screen with Host/Join buttons)
- `/host_page/host.tsx` → "/host_page/host" (Host match setup and participant management)
- `join.tsx` → "/join" (Join screen - enter 6-digit code)
- `join_lobby.tsx` → "/join_lobby?code=XXXXXX" (Lobby details after code verification)
- `/host_page/lobby_code.tsx` → "/host_page/lobby_code" (Display generated code)
- `/host_page/lobby_name.tsx` → "/host_page/lobby_name" (Set lobby name)
- `/host_page/participant_list.tsx` → "/host_page/participant_list" (View participants)

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
  - `@react-navigation/bottom-tabs` (v7.4.0) - Tab-based navigation
  - `@react-navigation/native` - Core navigation primitives
  - `@react-navigation/elements` (v2.6.3) - Navigation utilities

### Connectivity & Bluetooth
- **react-native-ble-plx** (v3.5.0) - Bluetooth Low Energy for device-to-device communication
- **expo-permissions** (v14.4.0) - Permission management (Bluetooth permissions on Android)
- **expo-linking** - Deep linking and settings integration

### UI & Animation
- **React Native Reanimated** (v4.1.1) - Complex animations
- **React Native Gesture Handler** (v2.28.0) - Touch gestures
- **React Native Worklets** (v0.5.1) - Worklet support for animations
- **Expo Vector Icons** (v15.0.2) - Icon library

### Platform Features
- **expo-haptics** - Haptic feedback (vibration)
- **expo-splash-screen** - Custom splash screen
- **expo-image** - Optimized image component
- **expo-font** - Custom font loading
- **expo-constants** - App constants and environment
- **expo-system-ui** - System UI customization
- **expo-symbols** (v1.0.7) - Native symbol support
- **expo-status-bar** - Status bar customization
- **expo-web-browser** - Web browser integration
- **React Native Web** (v0.21.0) - Web platform support
- **react-native-safe-area-context** (v5.6.0) - Safe area handling
- **react-native-screens** (v4.16.0) - Native screen components

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
- Reusable components are extracted to `/components` directory
- Use barrel exports (`components/index.ts`) for clean imports
- Use `useThemeColor` hook for theme-aware styling in all components
- Use composition over inheritance for complex UIs
- Each screen currently uses inline `StyleSheet.create()` - consider extracting styles as component library grows
- Examples: `JoinCodeInput` component for 6-digit code input

### Business Logic & Services
- MVP lobby management is in `/services/LobbyStore.ts` - in-memory storage for lobbies, participants, and code generation
- **Future**: Replace LobbyStore with backend (Firestore, Supabase, or custom API)
- Lobby structure: `code` (6-char), `hostName`, `name`, `participants[]`, `createdAt`
- Code generation: 6-character alphanumeric (A-Z, 0-9), auto-collision prevention

### Bluetooth Integration
- `useBluetooth()` hook (in `/hooks/useBluetooth.ts`) manages Bluetooth state and permissions
- Uses `react-native-ble-plx` for BLE device communication
- Platform-specific implementations:
  - **iOS**: Cannot programmatically enable Bluetooth; directs users to Settings app
  - **Android**: Can request enable via `BleManager.enable()`
  - **Web**: No Bluetooth support
- Permissions are checked before allowing match join/host
- Future: Replace with p2p communication layer (WebSocket, Firebase Realtime DB, or custom server)

### Cross-Platform Development
- Write platform-agnostic code by default
- Use platform-specific files only when necessary (`.ios.tsx`, `.android.tsx`, `.web.tsx`)
- Test on all three platforms (iOS simulator, Android emulator, web) before committing
- Use `Platform` from `react-native` for runtime platform detection if needed
- Bluetooth features gracefully degrade on web (no native BLE)

### State Management
- Currently no state management library is configured
- Lobby/participant state managed through `LobbyStore` module (will evolve into Redux/Zustand when backend is added)
- Screen-level state: Use `useState` for local state
- Global state: Consider React Context API for shared state (theme, user info) or Zustand/Redux for game state

## Configuration Files

### app.json
- Expo configuration file; defines app name, splash screen, icons, native features
- `experiments.reactCompiler` is enabled for automatic optimization
- `experiments.typedRoutes` is enabled for type-safe route navigation
- `scheme: "digitalassassins"` for deep linking
- Bluetooth permissions configured in `ios.infoPlist` and `android.permissions`
- New Architecture enabled (`newArchEnabled: true`)

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

**Digital Assassins** is a multiplayer game application in MVP phase. The game allows users to:
1. **Host a match**: Generate a 6-digit lobby code, set lobby name, wait for participants
2. **Join a match**: Enter a 6-digit code, see participants in the lobby

### User Flows

**Host Flow:**
1. Home screen → "Host" button
2. Set lobby name (lobby_name.tsx)
3. View generated 6-digit code (lobby_code.tsx)
4. See participants join in real-time (participant_list.tsx, host.tsx)
5. Start game (future feature)

**Join Flow:**
1. Home screen → "Join" button
2. Enter 6-digit code (join.tsx with JoinCodeInput)
3. View lobby details with participants (join_lobby.tsx)
4. Wait for host to start game (future feature)

### Theme & Styling
- Colors defined in `constants/theme.ts` with light/dark mode support
- Color palette:
  - **Light mode**: Light gray background (#F2F4F6), dark text (#11181C)
  - **Dark mode**: Dark navy background (#0C1116), light text (#ECEDEE)
  - **Accent colors**: primary (#00BFA6 - teal), danger (#FF3366 - red)
- Custom hooks: `useColorScheme()` detects system preference, `useThemeColor()` returns theme-aware colors
- The app uses inline `StyleSheet.create()` for component styling
- System automatically switches between light/dark mode based on device preference

## Critical Architecture Patterns

### Lobby Code & Participant Management
The `LobbyStore` (services/LobbyStore.ts) is the MVP backend replacement. Understand these key concepts:
- **Code generation**: 6-character alphanumeric with collision detection (see `generateUniqueCode()`)
- **In-memory storage**: Lobbies stored in `Map<code, Lobby>` - persists during app session, lost on app restart
- **Participant structure**: `{id, username, joinedAt}` - ID is auto-generated using `username-timestamp` pattern
- **Key functions**:
  - `createLobby(hostName, lobbyName)` - Called by host; generates code and creates lobby
  - `getLobbyByCode(code)` - Called by join flow to verify code exists
  - `addParticipantToLobby(code, username)` - Called when player joins
  - `getCurrentActiveLobby()` - MVP-only; returns first active lobby
  - `closeLobby(code)` - Called when host ends game

### Routing & Navigation Deep-Dive
The app uses Expo Router's file-based routing which creates routes from file names:
- Nested folders create route hierarchies (e.g., `/host_page/host.tsx` → `/host_page/host`)
- Root `_layout.tsx` defines the `Stack` navigator and shared wrappers
- Each route file is a screen component that receives route params via `useRoute()` or `useSearchParams()`
- The `join_lobby` route receives `code` as a query parameter from the `join` screen

### Bluetooth & Permissions Flow
When joining/hosting, the app checks Bluetooth state:
1. `useBluetooth()` hook initializes `BleManager` on app start
2. On match action (host/join), `enableBluetooth()` is called
3. If Bluetooth disabled, an alert prompts the user
4. On Android: Requests Bluetooth permissions + can enable BLE
5. On iOS: Cannot enable programmatically; redirects to Settings
6. Future: Replace with actual peer discovery/messaging via BLE (currently just checks state)

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

## Common Development Patterns & Integration Points

### Adding a New Screen
1. Create file in `/app` or subdirectory (e.g., `/app/game.tsx`)
2. Import at top of route file: `useRouter` from `expo-router`
3. Use `useThemeColor` hook for styling
4. Add route to root `_layout.tsx` if it's a new main route
5. Navigate via `router.push("/route-name")` or `router.push({pathname: "/route", params: {}})`

### Working with Lobbies
1. Host creates lobby: `const lobby = createLobby(hostName, lobbyName)` → Get back `{code, participants}`
2. Player joins: `const lobby = getLobbyByCode(code)` → Verify code exists, then `addParticipantToLobby(code, username)`
3. Always normalize codes to uppercase: `getLobbyByCode(code.toUpperCase())`
4. Participant IDs are unique per session; use them to identify and remove players

### Bluetooth Requires Permissions
- Always check `isBluetoothEnabled` before attempting to join/host
- Use `enableBluetooth()` callback to request user permission
- Web will not have Bluetooth support; gracefully skip Bluetooth checks or hide features

### Route Parameters
- Query params: `useSearchParams()` from `expo-router` (e.g., `/join_lobby?code=ABCD12`)
- Nested params: `useLocalSearchParams()` for route groups
- All params are strings; convert to appropriate types manually

### Theming in Components
- Always use `useThemeColor({}, "colorName")` instead of hardcoding colors
- Available colors: `text`, `background`, `tint`, `primary`, `danger`, `icon`
- Pass empty object `{}` as first param (for future override support)

## Debugging

- Use Expo Go app for sandbox development (limited native features like Bluetooth)
- Create development build for full native feature access: `eas build --platform [ios|android] --profile preview`
- Use device/simulator dev menu: Shake device (iOS) or press menu button (Android)
- VSCode debugging: Install `expo.vscode-expo-tools` extension for enhanced debugging
- Web debugging: Use browser DevTools (F12)
<<<<<<< Updated upstream
<<<<<<< Updated upstream
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
=======
- Check console logs: `console.log()` appears in dev server terminal and device logs
>>>>>>> Stashed changes
=======
- Check console logs: `console.log()` appears in dev server terminal and device logs
>>>>>>> Stashed changes
- Check console logs: `console.log()` appears in dev server terminal and device logs
